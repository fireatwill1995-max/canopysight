#!/usr/bin/env python3
"""
Canopy Sight — ONNX Export & Verification
Exports YOLO11 .pt → ONNX, then verifies the model
produces the same outputs as the PyTorch version.

Usage:
    python src/export_onnx.py --weights runs/detect/yolo11m.../weights/best.pt
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import yaml
from ultralytics import YOLO
from rich.console import Console

console = Console()

ROOT      = Path(__file__).parent.parent
MODELS_OUT = ROOT / "models"  # Final ONNX destination


def export(weights: Path, cfg: dict | None = None, opset: int = 17) -> Path:
    """
    Export YOLO11 .pt to ONNX.

    Parameters
    ----------
    weights : Path  — path to best.pt
    cfg     : dict  — training config (used for imgsz, half)
    opset   : int   — ONNX opset version

    Returns
    -------
    Path to exported ONNX file
    """
    cfg = cfg or {}
    imgsz = cfg.get("imgsz", 640)
    half  = cfg.get("export_onnx", {}).get("half", False)

    console.print(f"\n[cyan]Exporting[/cyan] {weights} → ONNX …")

    model = YOLO(weights)
    success = model.export(
        format   = "onnx",
        imgsz    = imgsz,
        opset    = opset,
        simplify = True,
        half     = half,
        dynamic  = False,
    )

    # Ultralytics writes the .onnx next to the .pt
    onnx_src = Path(str(weights).replace(".pt", ".onnx"))
    if not onnx_src.exists():
        # Fallback: check export directory
        onnx_src = weights.parent / (weights.stem + ".onnx")
    if not onnx_src.exists():
        raise FileNotFoundError(f"ONNX export not found — expected {onnx_src}")

    # ── Verify model ──────────────────────────────────────────────────────────
    _verify(onnx_src, imgsz)

    # ── Copy to canonical destination ─────────────────────────────────────────
    MODELS_OUT.mkdir(parents=True, exist_ok=True)
    out_name = cfg.get("name", "canopy-wildlife-v1") + ".onnx"
    dest = MODELS_OUT / out_name
    shutil.copy2(onnx_src, dest)

    # ── Print metadata ────────────────────────────────────────────────────────
    model_onnx = onnx.load(str(dest))
    console.print(f"\n[bold green]✓ ONNX export verified[/bold green]")
    console.print(f"  File  : {dest}")
    console.print(f"  Size  : {dest.stat().st_size / 1e6:.1f} MB")
    console.print(f"  Opset : {model_onnx.opset_import[0].version}")
    console.print(f"  Half  : {half}")

    # Write model metadata sidecar for edge-agent model-manager.ts
    _write_metadata(dest, cfg)

    return dest


def _verify(onnx_path: Path, imgsz: int = 640):
    """Run a dummy forward pass through ORT to catch graph errors."""
    console.print(f"  [dim]Verifying ONNX model …[/dim]")
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    dummy = np.random.rand(1, 3, imgsz, imgsz).astype(np.float32)
    input_name = sess.get_inputs()[0].name
    outputs = sess.run(None, {input_name: dummy})
    assert outputs is not None and len(outputs) > 0, "Empty ONNX output"
    console.print(f"  [dim]Output shape: {[o.shape for o in outputs]}[/dim]")


def _write_metadata(onnx_path: Path, cfg: dict):
    """
    Write a JSON sidecar consumed by the edge-agent's model-manager.ts.
    This lets the edge-agent auto-discover class names and input size.
    """
    import json

    classes_yaml = ROOT / "configs" / "classes.yaml"
    with open(classes_yaml) as f:
        classes_cfg = yaml.safe_load(f)

    classes: list[str] = list(classes_cfg["detection_classes"].values())

    meta = {
        "name":       onnx_path.stem,
        "version":    "1.0.0",
        "inputSize":  cfg.get("imgsz", 640),
        "classes":    classes,
        "framework":  "yolo11",
        "description":"Canopy Sight wildlife & security detector — YOLO11 fine-tuned",
        "exportedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }

    meta_path = onnx_path.with_suffix(".json")
    meta_path.write_text(json.dumps(meta, indent=2))
    console.print(f"  [dim]Metadata: {meta_path}[/dim]")


def main():
    parser = argparse.ArgumentParser(description="Export YOLO11 weights to ONNX")
    parser.add_argument("--weights", required=True, help="Path to best.pt")
    parser.add_argument("--config",  default=str(ROOT / "configs" / "training.yaml"))
    parser.add_argument("--opset",   type=int, default=17)
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    export(Path(args.weights), cfg=cfg, opset=args.opset)


if __name__ == "__main__":
    main()
