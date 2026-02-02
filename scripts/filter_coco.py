#!/usr/bin/env python3
"""
Filter COCO dataset for rail-relevant classes
Extracts person, vehicle classes and converts to YOLO format
"""

import os
import shutil
import json
from pathlib import Path

# COCO class IDs we want to keep
RELEVANT_CLASSES = {
    0: "person",      # person
    1: "vehicle",    # bicycle -> vehicle
    2: "vehicle",    # car -> vehicle
    3: "vehicle",    # motorcycle -> vehicle
    5: "vehicle",    # bus -> vehicle
    6: "vehicle",    # train -> vehicle
    7: "vehicle",    # truck -> vehicle
}

# Our class mapping
CLASS_MAP = {
    "person": 0,
    "vehicle": 1,
    "animal": 2,
    "equipment": 3,
    "debris": 4,
}

def convert_coco_to_yolo(coco_dir: str, output_dir: str):
    """Convert COCO format to YOLO format"""
    coco_path = Path(coco_dir)
    output_path = Path(output_dir)
    
    # Load COCO annotations
    for split in ["train", "val"]:
        ann_file = coco_path / f"annotations/instances_{split}2017.json"
        if not ann_file.exists():
            print(f"⚠️  Skipping {split} - annotation file not found")
            continue
        
        with open(ann_file) as f:
            coco_data = json.load(f)
        
        # Create output directories
        img_dir = output_path / "images" / split
        label_dir = output_path / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        label_dir.mkdir(parents=True, exist_ok=True)
        
        # Build image ID to filename mapping
        image_map = {img["id"]: img["file_name"] for img in coco_data["images"]}
        
        # Process annotations
        annotations_by_image = {}
        for ann in coco_data["annotations"]:
            image_id = ann["image_id"]
            category_id = ann["category_id"]
            
            # Map COCO category to our classes
            if category_id in RELEVANT_CLASSES:
                our_class = RELEVANT_CLASSES[category_id]
                class_id = CLASS_MAP[our_class]
                
                if image_id not in annotations_by_image:
                    annotations_by_image[image_id] = []
                
                # Convert bbox from [x, y, width, height] to YOLO [center_x, center_y, width, height] (normalized)
                img_info = coco_data["images"][image_id - 1]  # COCO IDs are 1-indexed
                img_width = img_info["width"]
                img_height = img_info["height"]
                
                x, y, w, h = ann["bbox"]
                center_x = (x + w / 2) / img_width
                center_y = (y + h / 2) / img_height
                norm_w = w / img_width
                norm_h = h / img_height
                
                annotations_by_image[image_id].append(
                    f"{class_id} {center_x:.6f} {center_y:.6f} {norm_w:.6f} {norm_h:.6f}\n"
                )
        
        # Write labels and copy images
        copied = 0
        for image_id, labels in annotations_by_image.items():
            if len(labels) == 0:
                continue
            
            filename = image_map[image_id]
            base_name = Path(filename).stem
            
            # Write label file
            label_file = label_dir / f"{base_name}.txt"
            with open(label_file, "w") as f:
                f.writelines(labels)
            
            # Copy image
            src_img = coco_path / split / filename
            if src_img.exists():
                dst_img = img_dir / filename
                shutil.copy2(src_img, dst_img)
                copied += 1
        
        print(f"✅ Converted {split}: {copied} images with relevant annotations")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python filter_coco.py <coco_dir> <output_dir>")
        sys.exit(1)
    
    convert_coco_to_yolo(sys.argv[1], sys.argv[2])
    print("✅ COCO to YOLO conversion complete!")
