#!/usr/bin/env python3
"""
YOLOv8 Fine-tuning Script for Rail Safety Detection
Trains a custom model on rail-specific datasets
"""

from ultralytics import YOLO
import os
import yaml

def create_dataset_config(data_dir: str, output_path: str):
    """Create YOLO dataset configuration file"""
    config = {
        'path': data_dir,
        'train': 'images/train',
        'val': 'images/val',
        'test': 'images/test',
        'nc': 5,  # Number of classes
        'names': ['person', 'vehicle', 'animal', 'equipment', 'debris']
    }
    
    with open(output_path, 'w') as f:
        yaml.dump(config, f)
    
    print(f"✅ Dataset config created: {output_path}")

def train_model(
    model_size: str = 'n',  # n, s, m, l, x
    epochs: int = 100,
    batch_size: int = 16,
    img_size: int = 640,
    data_config: str = 'dataset.yaml',
    pretrained: bool = True
):
    """
    Train YOLOv8 model on custom rail safety dataset
    
    Args:
        model_size: Model size (n=nano, s=small, m=medium, l=large, x=xlarge)
        epochs: Number of training epochs
        batch_size: Batch size for training
        img_size: Input image size
        data_config: Path to dataset YAML config
        pretrained: Use pretrained weights
    """
    
    # Load pretrained model
    model_name = f'yolov8{model_size}.pt'
    if pretrained:
        model = YOLO(model_name)
        print(f"✅ Loaded pretrained model: {model_name}")
    else:
        model = YOLO(f'yolov8{model_size}.yaml')
        print(f"✅ Initialized new model: {model_name}")
    
    # Training parameters optimized for rail safety
    results = model.train(
        data=data_config,
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        name='rail-safety-v1',
        project='runs/train',
        
        # Data augmentation for rail environments
        hsv_h=0.015,  # Hue augmentation
        hsv_s=0.7,    # Saturation augmentation
        hsv_v=0.4,    # Value augmentation
        degrees=10,   # Rotation augmentation
        translate=0.1, # Translation augmentation
        scale=0.5,    # Scaling augmentation
        flipud=0.0,   # Vertical flip (usually not needed for rail)
        fliplr=0.5,   # Horizontal flip
        mosaic=1.0,   # Mosaic augmentation
        mixup=0.1,    # Mixup augmentation
        
        # Optimization
        optimizer='AdamW',
        lr0=0.01,     # Initial learning rate
        lrf=0.01,     # Final learning rate
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        warmup_bias_lr=0.1,
        
        # Loss function weights
        box=7.5,      # Box loss gain
        cls=0.5,      # Class loss gain
        dfl=1.5,      # DFL loss gain
        
        # Validation
        val=True,
        plots=True,
        save=True,
        save_period=10,
        
        # Device
        device=0,     # GPU device (0 for first GPU, 'cpu' for CPU)
        
        # Advanced
        close_mosaic=10,  # Disable mosaic in last N epochs
        resume=False,
        amp=True,     # Automatic Mixed Precision
        fraction=1.0, # Dataset fraction to use
        profile=False,
        freeze=None,  # Freeze layers (e.g., [0, 1, 2] for first 3 layers)
    )
    
    print(f"\n✅ Training completed!")
    print(f"📊 Results saved to: {results.save_dir}")
    print(f"📈 Best mAP50: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
    print(f"📈 Best mAP50-95: {results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")
    
    # Export to ONNX for edge deployment
    model.export(format='onnx', imgsz=img_size, simplify=True)
    print(f"✅ Model exported to ONNX format")
    
    return results

def validate_model(model_path: str, data_config: str):
    """Validate trained model"""
    model = YOLO(model_path)
    results = model.val(data=data_config)
    
    print(f"\n📊 Validation Results:")
    print(f"   mAP50: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
    print(f"   mAP50-95: {results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")
    print(f"   Precision: {results.results_dict.get('metrics/precision(B)', 'N/A')}")
    print(f"   Recall: {results.results_dict.get('metrics/recall(B)', 'N/A')}")
    
    return results

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Train YOLOv8 for rail safety detection')
    parser.add_argument('--model', type=str, default='n', choices=['n', 's', 'm', 'l', 'x'],
                        help='Model size (n=nano, s=small, m=medium, l=large, x=xlarge)')
    parser.add_argument('--epochs', type=int, default=100, help='Number of training epochs')
    parser.add_argument('--batch', type=int, default=16, help='Batch size')
    parser.add_argument('--data', type=str, default='dataset.yaml', help='Dataset config path')
    parser.add_argument('--data-dir', type=str, help='Dataset directory (creates config)')
    parser.add_argument('--validate', type=str, help='Validate model (path to .pt file)')
    
    args = parser.parse_args()
    
    if args.validate:
        validate_model(args.validate, args.data)
    elif args.data_dir:
        config_path = os.path.join(args.data_dir, 'dataset.yaml')
        create_dataset_config(args.data_dir, config_path)
        train_model(args.model, args.epochs, args.batch, data_config=config_path)
    else:
        train_model(args.model, args.epochs, args.batch, data_config=args.data)
