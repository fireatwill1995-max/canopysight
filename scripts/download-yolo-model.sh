#!/bin/bash

# Download YOLO Model for Edge Agent
# This script downloads the YOLOv8n model for use with the edge agent

set -e

MODEL_DIR="./apps/edge-agent/models"
MODEL_URL="https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx"
MODEL_FILE="$MODEL_DIR/yolov8n.onnx"

echo "📥 Downloading YOLOv8n model for edge agent..."

# Create models directory if it doesn't exist
mkdir -p "$MODEL_DIR"

# Check if model already exists
if [ -f "$MODEL_FILE" ]; then
    echo "✅ Model already exists at $MODEL_FILE"
    read -p "Do you want to download again? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
fi

# Download model
echo "Downloading from $MODEL_URL..."
if command -v wget &> /dev/null; then
    wget -O "$MODEL_FILE" "$MODEL_URL"
elif command -v curl &> /dev/null; then
    curl -L -o "$MODEL_FILE" "$MODEL_URL"
else
    echo "❌ Neither wget nor curl is available. Please download manually:"
    echo "   URL: $MODEL_URL"
    echo "   Save to: $MODEL_FILE"
    exit 1
fi

if [ -f "$MODEL_FILE" ]; then
    echo "✅ Model downloaded successfully to $MODEL_FILE"
    echo "   Size: $(du -h "$MODEL_FILE" | cut -f1)"
else
    echo "❌ Failed to download model"
    exit 1
fi
