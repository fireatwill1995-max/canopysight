# Canopy Sight — CNN Training & Integration

World-class multi-stage YOLO training pipeline for rail/site safety detection: **person**, **vehicle**, **animal**, **equipment**, **debris**.

## Pipeline Overview

1. **Coarse tune** — Full backbone, strong augmentation (60 epochs default).
2. **Fine-tune** — Lower LR, more epochs, close_mosaic for stability (80 epochs).
3. **Ultra fine-tune** — Lowest LR, optional backbone freeze, minimal aug (50 epochs).
4. **Optional**: Run **hyperparameter evolution** (`model.tune()`) before or between stages.

Uses **YOLO11** when available (better mAP, fewer params), fallback **YOLOv8**. Exports to **ONNX** for the edge-agent.

## Prerequisites

- Python 3.10+
- GPU with CUDA (recommended) or CPU
- Dataset in YOLO format (images + labels)

```bash
# From repo root
pip install -r scripts/requirements-train.txt
# GPU: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

## Dataset

- **Path**: `datasets/rail-safety/` (or use `--data-dir`).
- **Layout**: `images/{train,val,test}` and `labels/{train,val,test}`.
- **Classes**: `0=person, 1=vehicle, 2=animal, 3=equipment, 4=debris`.
- **Labels**: One `.txt` per image; each line: `class_id center_x center_y width height` (normalized 0–1).

Use `scripts/filter_coco.py` to build from COCO, or annotate with LabelImg/CVAT.

## Run Training

```bash
# Full pipeline (coarse → fine → ultra), export ONNX to edge-agent
python scripts/train_canopy_cnn.py --data-dir datasets/rail-safety --stage all

# Single stage
python scripts/train_canopy_cnn.py --data datasets/rail-safety/dataset.yaml --stage coarse
python scripts/train_canopy_cnn.py --resume runs/detect/canopy_coarse/weights/best.pt --stage fine

# Hyperparameter evolution (optional)
python scripts/train_canopy_cnn.py --data datasets/rail-safety/dataset.yaml --stage tune --tune-iterations 100
```

Trained ONNX is written to **`apps/edge-agent/models/rail-safety-v1.onnx`**. The edge-agent prefers this model when present.

## Verify Integration

From the edge-agent app:

```bash
cd apps/edge-agent
npm run verify-cnn
```

This loads the CNN (trained or fallback), runs inference on a synthetic image, and checks that all detection types are valid Canopy Sight types (person, vehicle, animal, equipment, debris, unknown).

## Integration in Software

- **Model manager** (`apps/edge-agent/src/inference/model-manager.ts`): Registers `rail-safety-v1`; uses it when the file exists.
- **YOLO detector** (`apps/edge-agent/src/inference/yolo.ts`): Maps model classes to `DetectionType` (including **equipment** and **debris**).
- **Types** (`apps/edge-agent/src/types.ts`): `DetectionType` = person | vehicle | animal | equipment | debris | unknown.

Running the edge-agent with a trained model: ensure `apps/edge-agent/models/rail-safety-v1.onnx` is present; the agent will load it automatically.

**Quick sanity check (no dataset):** Download a fallback model so verification passes:
`apps/edge-agent/models/yolov8n.onnx` from [Ultralytics assets](https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx). Then run `cd apps/edge-agent && npm run verify-cnn`.
