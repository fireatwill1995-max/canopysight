#!/usr/bin/env python3
"""
Canopy Sight — YOLO11 Fine-Tuning Script
Fine-tunes YOLO11 on the merged wildlife + security dataset.
Exports the best checkpoint to ONNX for edge-agent deployment.

Usage:
    python src/train_detector.py [--config configs/training.yaml] [--resume]

Recommended hardware: NVIDIA GPU with ≥16GB VRAM (e.g. A100, 3090, 4090).
Can run on CPU for testing but will be very slow.
Free GPU: Google Colab Pro / Kaggle / RunPod (A100 ~$1.50/hr).
"""

import argparse
import os
from pathlib import Path

import torch
import yaml
from ultralytics import YOLO
from rich.console import Console

console = Console()

ROOT       = Path(__file__).parent.parent
CONFIGS    = ROOT / "configs"
DATA_YAML  = ROOT / "data" / "canopy_detection" / "data.yaml"
RUNS_DIR   = ROOT / "runs" / "detect"


def load_config(path: str | Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def train(cfg: dict, resume: bool = False, data_yaml: Path = DATA_YAML) -> Path:
    if not data_yaml.exists():
        raise FileNotFoundError(
            f"Dataset not found at {data_yaml}.\n"
            "Run: python scripts/prepare_data.py --roboflow-key YOUR_KEY"
        )

    device_str = str(cfg.get("device", "0"))
    if device_str != "cpu" and not torch.cuda.is_available():
        console.print("[yellow]⚠[/yellow] CUDA not available — falling back to CPU. "
                      "Training will be slow.")
        device_str = "cpu"

    model_name: str = cfg["model"]
    console.print(f"\n[bold cyan]Model:[/bold cyan] {model_name}")
    console.print(f"[bold cyan]Device:[/bold cyan] {device_str}")
    console.print(f"[bold cyan]Epochs:[/bold cyan] {cfg['epochs']}")
    console.print(f"[bold cyan]Batch:[/bold cyan] {cfg['batch']}")

    model = YOLO(model_name)

    # ── Class weights for handling dataset imbalance ──────────────────────────
    class_weights_cfg: dict = {}
    with open(CONFIGS / "dataset.yaml") as f:
        ds_cfg = yaml.safe_load(f)
    class_weights_cfg = ds_cfg.get("class_weights", {})

    # Build weight vector in class-id order
    with open(data_yaml) as f:
        data_cfg = yaml.safe_load(f)
    class_names: list[str] = data_cfg.get("names", [])
    cls_weights = [class_weights_cfg.get(name, 1.0) for name in class_names]
    console.print(f"[dim]Class weights: {dict(zip(class_names, cls_weights))}[/dim]")

    # ── Training ─────────────────────────────────────────────────────────────
    results = model.train(
        data      = str(data_yaml),
        epochs    = cfg["epochs"],
        imgsz     = cfg["imgsz"],
        batch     = cfg["batch"],
        workers   = cfg.get("workers", 8),
        device    = device_str,
        patience  = cfg.get("patience", 30),
        amp       = cfg.get("amp", True),

        # Optimiser
        optimizer     = cfg.get("optimizer", "AdamW"),
        lr0           = cfg["lr0"],
        lrf           = cfg["lrf"],
        momentum      = cfg["momentum"],
        weight_decay  = cfg["weight_decay"],
        warmup_epochs = cfg["warmup_epochs"],
        warmup_momentum = cfg["warmup_momentum"],
        warmup_bias_lr  = cfg["warmup_bias_lr"],

        # Loss
        box = cfg["box"],
        cls = cfg["cls"],
        dfl = cfg["dfl"],

        # YOLO built-in augmentation
        hsv_h       = cfg.get("hsv_h", 0.015),
        hsv_s       = cfg.get("hsv_s", 0.7),
        hsv_v       = cfg.get("hsv_v", 0.4),
        degrees     = cfg.get("degrees", 5.0),
        translate   = cfg.get("translate", 0.1),
        scale       = cfg.get("scale", 0.5),
        shear       = cfg.get("shear", 2.0),
        perspective = cfg.get("perspective", 0.0002),
        flipud      = cfg.get("flipud", 0.0),
        fliplr      = cfg.get("fliplr", 0.5),
        mosaic      = cfg.get("mosaic", 1.0),
        mixup       = cfg.get("mixup", 0.15),
        copy_paste  = cfg.get("copy_paste", 0.3),

        # Validation thresholds
        conf = cfg.get("conf", 0.25),
        iou  = cfg.get("iou", 0.7),

        # Logging
        project     = cfg.get("project", "canopy-sight-detector"),
        name        = cfg.get("name", "yolo11m-wildlife-security-v1"),
        save        = True,
        save_period = cfg.get("save_period", 10),
        plots       = True,

        # Resume
        resume = resume,

        # W&B — set WANDB_API_KEY env var to enable
        **( {"tracker": "wandb"} if cfg.get("wandb", {}).get("enabled") else {} ),
    )

    best_pt = Path(results.save_dir) / "weights" / "best.pt"
    console.print(f"\n[green]✓[/green] Training complete. Best weights: {best_pt}")
    return best_pt


def export_onnx(weights: Path, cfg: dict) -> Path:
    """Export best checkpoint to ONNX for edge-agent deployment."""
    from src.export_onnx import export as _export
    return _export(weights, cfg)


def main():
    parser = argparse.ArgumentParser(description="Train Canopy Sight YOLO11 detector")
    parser.add_argument("--config", default=str(CONFIGS / "training.yaml"),
                        help="Path to training config YAML")
    parser.add_argument("--data", default=str(DATA_YAML),
                        help="Path to dataset data.yaml")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from last checkpoint")
    parser.add_argument("--export-only", metavar="WEIGHTS",
                        help="Skip training, just export this .pt file to ONNX")
    args = parser.parse_args()

    cfg = load_config(args.config)

    if args.export_only:
        best_pt = Path(args.export_only)
    else:
        best_pt = train(cfg, resume=args.resume, data_yaml=Path(args.data))

    onnx_path = export_onnx(best_pt, cfg)
    console.print(f"\n[bold green]ONNX model ready for deployment:[/bold green]")
    console.print(f"  {onnx_path}")
    console.print("\nCopy to edge-agent:")
    console.print(f"  cp {onnx_path} apps/edge-agent/models/canopy-wildlife-v1.onnx")


if __name__ == "__main__":
    main()
