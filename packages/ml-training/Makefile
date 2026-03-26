# ─────────────────────────────────────────────────────────────────────────────
# Canopy Sight ML Training — Makefile
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: install prepare train-detector train-behavior export deploy help

# Install Python dependencies
install:
	pip install -e ".[dev]"
	@echo "✓ Dependencies installed"

# Download and prepare all training datasets
# Set ROBOFLOW_API_KEY env var first (free at roboflow.com)
prepare:
	python scripts/prepare_data.py --roboflow-key $${ROBOFLOW_API_KEY}

prepare-no-coco:
	python scripts/prepare_data.py --roboflow-key $${ROBOFLOW_API_KEY} --skip-coco

# Train YOLO11 detector
train-detector:
	python src/train_detector.py --config configs/training.yaml

# Train behavior classifier
train-behavior:
	python src/train_behavior.py --epochs 60 --batch 64

# Export to ONNX (provide WEIGHTS=path/to/best.pt)
export:
	python src/export_onnx.py --weights $(WEIGHTS)

# Deploy trained models to edge-agent
deploy: models/canopy-wildlife-v1.onnx
	cp models/canopy-wildlife-v1.onnx ../../apps/edge-agent/models/
	@if [ -f runs/behavior/behavior_classifier.onnx ]; then \
		cp runs/behavior/behavior_classifier.onnx ../../apps/edge-agent/models/; \
		echo "✓ Behavior classifier deployed"; \
	fi
	@if [ -f models/canopy-wildlife-v1.json ]; then \
		cp models/canopy-wildlife-v1.json ../../apps/edge-agent/models/; \
	fi
	@echo "✓ Models deployed to apps/edge-agent/models/"

# Full pipeline: prepare → train → export → deploy
all: prepare train-detector export deploy

help:
	@echo ""
	@echo "  Canopy Sight ML Training Pipeline"
	@echo ""
	@echo "  make install          Install Python dependencies"
	@echo "  make prepare          Download + prepare all datasets"
	@echo "  make train-detector   Fine-tune YOLO11 detector"
	@echo "  make train-behavior   Train EfficientNet behavior classifier"
	@echo "  make export WEIGHTS=… Export .pt → ONNX"
	@echo "  make deploy           Copy ONNX models to edge-agent"
	@echo "  make all              Full pipeline end-to-end"
	@echo ""
	@echo "  Recommended: NVIDIA GPU with ≥16GB VRAM"
	@echo "  Free GPU:    Kaggle / Google Colab Pro / RunPod"
	@echo ""
