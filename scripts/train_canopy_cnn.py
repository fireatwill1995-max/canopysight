#!/usr/bin/env python3
"""
Canopy Sight™ — World-Class CNN Training Pipeline
=================================================
Multi-stage training: Coarse → Fine → Ultra Fine-tune
Uses YOLOv11 (or YOLOv8) with genetic hyperparameter evolution.
Optimized for rail/site safety: person, vehicle, animal, equipment, debris.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

# Ensure project root is on path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Canopy Sight class set (must match apps/edge-agent and dataset)
CANOPY_CLASSES = ["person", "vehicle", "animal", "equipment", "debris"]
NUM_CLASSES = len(CANOPY_CLASSES)
DEFAULT_DATA_YAML = "dataset.yaml"
RUNS_DIR = PROJECT_ROOT / "runs" / "detect"
MODEL_OUTPUT_DIR = PROJECT_ROOT / "apps" / "edge-agent" / "models"


def get_yolo_model(base: str = "yolo11", size: str = "s"):
    """Load best available YOLO (YOLO11 preferred, fallback YOLOv8)."""
    try:
        from ultralytics import YOLO
    except ImportError:
        raise SystemExit(
            "Install training deps: pip install ultralytics torch torchvision"
        )
    # Prefer YOLO11 (better mAP, fewer params); fallback YOLOv8
    for prefix in (f"{base}{size}", f"yolov8{size}"):
        name = f"{prefix}.pt"
        try:
            model = YOLO(name)
            print(f"[OK] Loaded pretrained: {name}")
            return model
        except Exception:
            continue
    model = YOLO(f"yolov8{size}.pt")
    print(f"[OK] Loaded pretrained: yolov8{size}.pt (YOLO11 not available)")
    return model


def create_dataset_yaml(data_dir: str, output_path: str) -> str:
    """Create YOLO dataset YAML for Canopy Sight (5 classes)."""
    data_path = Path(data_dir).resolve()
    config = {
        "path": str(data_path),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "nc": NUM_CLASSES,
        "names": CANOPY_CLASSES,
    }
    import yaml
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    print(f"[OK] Dataset config: {out}")
    return str(out)


def train_stage_coarse(
    model,
    data_yaml: str,
    epochs: int = 60,
    batch: int = 16,
    imgsz: int = 640,
    device: str = "0",
    project: str = "runs/detect",
    name: str = "canopy_coarse",
    lr0: float = 0.01,
    **kwargs,
):
    """Stage 1: Coarse tune — full backbone, strong augmentation."""
    return model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        name=name,
        project=project,
        device=device,
        optimizer="AdamW",
        lr0=lr0,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        warmup_bias_lr=0.1,
        box=7.5,
        cls=0.5,
        dfl=1.5,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=15,
        translate=0.1,
        scale=0.5,
        shear=2.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.15,
        copy_paste=0.1,
        close_mosaic=10,
        amp=True,
        fraction=1.0,
        profile=False,
        freeze=None,
        val=True,
        plots=True,
        save=True,
        save_period=10,
        **kwargs,
    )


def train_stage_fine(
    model,
    data_yaml: str,
    epochs: int = 80,
    batch: int = 16,
    imgsz: int = 640,
    device: str = "0",
    project: str = "runs/detect",
    name: str = "canopy_fine",
    lr0: float = 0.002,
    **kwargs,
):
    """Stage 2: Fine-tune — lower LR, more epochs, close_mosaic for stability."""
    return model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        name=name,
        project=project,
        device=device,
        optimizer="AdamW",
        lr0=lr0,
        lrf=0.005,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=2,
        warmup_momentum=0.8,
        warmup_bias_lr=0.05,
        box=7.5,
        cls=0.5,
        dfl=1.5,
        hsv_h=0.012,
        hsv_s=0.6,
        hsv_v=0.35,
        degrees=10,
        translate=0.08,
        scale=0.4,
        shear=1.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        mosaic=0.9,
        mixup=0.1,
        copy_paste=0.05,
        close_mosaic=15,
        amp=True,
        fraction=1.0,
        profile=False,
        freeze=None,
        val=True,
        plots=True,
        save=True,
        save_period=10,
        **kwargs,
    )


def train_stage_ultra(
    model,
    data_yaml: str,
    epochs: int = 50,
    batch: int = 16,
    imgsz: int = 640,
    device: str = "0",
    project: str = "runs/detect",
    name: str = "canopy_ultra",
    lr0: float = 0.0003,
    freeze: int | None = 10,
    **kwargs,
):
    """Stage 3: Ultra fine-tune — lowest LR, optional freeze, minimal aug."""
    return model.train(
        data=data_yaml,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        name=name,
        project=project,
        device=device,
        optimizer="AdamW",
        lr0=lr0,
        lrf=0.001,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=1,
        warmup_momentum=0.9,
        warmup_bias_lr=0.02,
        box=7.5,
        cls=0.5,
        dfl=1.5,
        hsv_h=0.008,
        hsv_s=0.4,
        hsv_v=0.25,
        degrees=5,
        translate=0.05,
        scale=0.3,
        shear=0.0,
        perspective=0.0,
        flipud=0.0,
        fliplr=0.5,
        mosaic=0.5,
        mixup=0.05,
        copy_paste=0.0,
        close_mosaic=20,
        amp=True,
        fraction=1.0,
        profile=False,
        freeze=freeze,
        val=True,
        plots=True,
        save=True,
        save_period=5,
        **kwargs,
    )


def run_hyperparameter_tune(
    model,
    data_yaml: str,
    epochs: int = 30,
    iterations: int = 100,
    device: str = "0",
):
    """Genetic hyperparameter evolution (optional, run before or after stage 1)."""
    space = {
        "lr0": (1e-4, 1e-1),
        "lrf": (0.01, 0.5),
        "momentum": (0.7, 0.98),
        "weight_decay": (0.0, 0.001),
        "warmup_epochs": (0.0, 5.0),
        "box": (5.0, 10.0),
        "cls": (0.3, 1.0),
        "dfl": (1.0, 2.0),
        "hsv_h": (0.0, 0.02),
        "hsv_s": (0.3, 0.8),
        "hsv_v": (0.2, 0.6),
        "degrees": (0.0, 15.0),
        "translate": (0.05, 0.15),
        "scale": (0.3, 0.7),
        "mosaic": (0.5, 1.0),
        "mixup": (0.0, 0.2),
    }
    results = model.tune(
        data=data_yaml,
        epochs=epochs,
        iterations=iterations,
        optimizer="AdamW",
        space=space,
        device=device,
        plots=True,
        save=True,
        val=True,
    )
    return results


def export_onnx(model_path: str, imgsz: int = 640, output_dir: str | None = None):
    """Export PyTorch model to ONNX for edge-agent (simplify, opset 12)."""
    from ultralytics import YOLO
    model = YOLO(model_path)
    out = model.export(
        format="onnx",
        imgsz=imgsz,
        simplify=True,
        opset=12,
        dynamic=False,
    )
    if output_dir:
        out_path = Path(out)
        dest = Path(output_dir)
        dest.mkdir(parents=True, exist_ok=True)
        # Edge-agent expects rail-safety-v1.onnx or similar
        dest_file = dest / "rail-safety-v1.onnx"
        if out_path != dest_file:
            shutil.copy2(out_path, dest_file)
        print(f"[OK] ONNX copied to {dest_file}")
        return str(dest_file)
    return out


def main():
    parser = argparse.ArgumentParser(
        description="Canopy Sight CNN: multi-stage YOLO training pipeline"
    )
    parser.add_argument(
        "--stage",
        choices=["coarse", "fine", "ultra", "all", "tune"],
        default="all",
        help="Training stage or 'all' for coarse→fine→ultra",
    )
    parser.add_argument("--data", type=str, default=DEFAULT_DATA_YAML)
    parser.add_argument("--data-dir", type=str, help="Dataset root (creates data yaml)")
    parser.add_argument("--model-base", choices=["yolo11", "yolov8"], default="yolo11")
    parser.add_argument("--model-size", choices=["n", "s", "m", "l"], default="s")
    parser.add_argument("--resume", type=str, help="Resume from .pt checkpoint")
    parser.add_argument("--epochs-coarse", type=int, default=60)
    parser.add_argument("--epochs-fine", type=int, default=80)
    parser.add_argument("--epochs-ultra", type=int, default=50)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", type=str, default="0")
    parser.add_argument("--tune-iterations", type=int, default=100)
    parser.add_argument("--export-dir", type=str, default=str(MODEL_OUTPUT_DIR))
    parser.add_argument("--skip-export", action="store_true")
    parser.add_argument("--quick", action="store_true", help="Quick test: 1 epoch per stage (for pipeline validation)")
    args = parser.parse_args()

    if args.quick:
        args.epochs_coarse = 1
        args.epochs_fine = 1
        args.epochs_ultra = 1
        print("Quick mode: 1 epoch per stage (pipeline validation only)")

    # Resolve data yaml
    if args.data_dir:
        data_yaml = create_dataset_yaml(
            args.data_dir,
            str(Path(args.data_dir) / "dataset.yaml"),
        )
    else:
        data_yaml = args.data
        if not os.path.isabs(data_yaml):
            data_yaml = str(PROJECT_ROOT / data_yaml)
        if not os.path.isfile(data_yaml):
            print(
                f"[!] Data config not found: {data_yaml}. Use --data-dir to create from a dataset folder."
            )
            sys.exit(1)

    project = str(RUNS_DIR)
    best_pt = None

    if args.stage == "tune":
        model = get_yolo_model(args.model_base, args.model_size)
        run_hyperparameter_tune(
            model, data_yaml, epochs=30, iterations=args.tune_iterations, device=args.device
        )
        print("Tune complete. Use best_hyperparameters.yaml for subsequent stages.")
        return

    if args.resume:
        from ultralytics import YOLO
        model = YOLO(args.resume)
        best_pt = Path(args.resume).resolve()
        print(f"Resuming from {args.resume}")
    else:
        model = get_yolo_model(args.model_base, args.model_size)

    if args.stage in ("coarse", "all"):
        results = train_stage_coarse(
            model,
            data_yaml,
            epochs=args.epochs_coarse,
            batch=args.batch,
            imgsz=args.imgsz,
            device=args.device,
            project=project,
            name="canopy_coarse",
        )
        best_pt = Path(results.save_dir) / "weights" / "best.pt"
        if best_pt.exists():
            from ultralytics import YOLO
            model = YOLO(str(best_pt))

    if args.stage in ("fine", "all") and best_pt and best_pt.exists():
        from ultralytics import YOLO
        model = YOLO(str(best_pt))
        results = train_stage_fine(
            model,
            data_yaml,
            epochs=args.epochs_fine,
            batch=args.batch,
            imgsz=args.imgsz,
            device=args.device,
            project=project,
            name="canopy_fine",
        )
        best_pt = Path(results.save_dir) / "weights" / "best.pt"
        if best_pt.exists():
            from ultralytics import YOLO
            model = YOLO(str(best_pt))

    if args.stage in ("ultra", "all") and best_pt and best_pt.exists():
        from ultralytics import YOLO
        model = YOLO(str(best_pt))
        results = train_stage_ultra(
            model,
            data_yaml,
            epochs=args.epochs_ultra,
            batch=args.batch,
            imgsz=args.imgsz,
            device=args.device,
            project=project,
            name="canopy_ultra",
        )
        best_pt = Path(results.save_dir) / "weights" / "best.pt"

    if not best_pt or not best_pt.exists():
        print("No best.pt found; skipping export.")
        return

    if not args.skip_export:
        export_onnx(str(best_pt), imgsz=args.imgsz, output_dir=args.export_dir)

    print("\n[OK] Canopy Sight CNN training pipeline complete.")
    print("   Deploy: copy rail-safety-v1.onnx to apps/edge-agent/models/ and run edge-agent.")


if __name__ == "__main__":
    main()
