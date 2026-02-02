#!/bin/bash
# Download and prepare rail safety datasets for YOLO training

set -e

DATA_DIR="./datasets/rail-safety"
mkdir -p "$DATA_DIR"/{images/{train,val,test},labels/{train,val,test}}

echo "📥 Downloading rail safety datasets..."

# Roboflow Rail Safety Dataset (if available)
# Note: You'll need to sign up and get API key from roboflow.com
if [ -n "$ROBOFLOW_API_KEY" ]; then
    echo "Downloading from Roboflow..."
    # roboflow download command would go here
fi

# COCO Dataset (for person, vehicle classes)
echo "📥 Downloading COCO dataset subset..."
if [ ! -f "$DATA_DIR/coco.zip" ]; then
    wget -O "$DATA_DIR/coco.zip" "https://github.com/ultralytics/yolov5/releases/download/v1.0/coco2017labels.zip"
    unzip -q "$DATA_DIR/coco.zip" -d "$DATA_DIR/coco"
    
    # Filter for relevant classes: person (0), bicycle (1), car (2), motorcycle (3), 
    # bus (5), train (6), truck (7)
    python3 scripts/filter_coco.py "$DATA_DIR/coco" "$DATA_DIR"
fi

# Rail-specific datasets from public sources
echo "📥 Downloading additional rail datasets..."

# Railway Crossing Dataset (if available)
# You can add URLs to public rail safety datasets here

# Custom annotation tool output
echo "💡 Tip: Use LabelImg or CVAT to annotate your own rail footage"
echo "   Place annotated images in: $DATA_DIR/images/train"
echo "   Place YOLO format labels in: $DATA_DIR/labels/train"

echo "✅ Dataset preparation complete!"
echo "📊 Dataset structure:"
echo "   $DATA_DIR/"
echo "   ├── images/"
echo "   │   ├── train/"
echo "   │   ├── val/"
echo "   │   └── test/"
echo "   └── labels/"
echo "       ├── train/"
echo "       ├── val/"
echo "       └── test/"
