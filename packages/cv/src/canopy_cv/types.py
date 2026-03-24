"""Type definitions for the Canopy CV pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Detection:
    """A single object detection result."""

    label: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2
    class_id: int

    @property
    def width(self) -> float:
        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> float:
        return self.bbox[3] - self.bbox[1]

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def center(self) -> tuple[float, float]:
        return (
            (self.bbox[0] + self.bbox[2]) / 2,
            (self.bbox[1] + self.bbox[3]) / 2,
        )


@dataclass
class SegmentationResult:
    """A single segmentation mask result."""

    mask: np.ndarray  # H x W boolean mask
    score: float
    area: int
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2


@dataclass
class TrainingConfig:
    """Configuration for model training."""

    model_name: str = "yolov9c"
    num_classes: int = 80
    learning_rate: float = 1e-3
    epochs: int = 100
    batch_size: int = 16
    image_size: int = 640
    optimizer: str = "AdamW"
    weight_decay: float = 1e-4
    warmup_epochs: int = 3
    scheduler: str = "cosine"
    data_dir: str = "data"
    output_dir: str = "runs"
    wandb_project: str = "canopy-sight"
    wandb_entity: str | None = None
    num_workers: int = 4
    pin_memory: bool = True
    pretrained: bool = True
    freeze_backbone: bool = False
    augmentation: str = "default"


@dataclass
class ExportConfig:
    """Configuration for model export."""

    format: str = "onnx"  # onnx, tensorrt
    input_size: tuple[int, int] = (640, 640)
    fp16: bool = True
    int8: bool = False
    device: str = "auto"
    dynamic_batch: bool = True
    opset_version: int = 17


@dataclass
class ModelConfig:
    """Full model configuration combining training and export settings."""

    name: str = "default"
    description: str = ""
    training: TrainingConfig = field(default_factory=TrainingConfig)
    export: ExportConfig = field(default_factory=ExportConfig)
    classes: list[str] = field(default_factory=list)
