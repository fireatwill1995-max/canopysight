"""Canopy CV — Computer vision pipeline for Canopy Sight."""

from .types import Detection, ExportConfig, ModelConfig, SegmentationResult, TrainingConfig
from .config import get_preset, load_config, save_config

__all__ = [
    "Detection",
    "ExportConfig",
    "ModelConfig",
    "SegmentationResult",
    "TrainingConfig",
    "get_preset",
    "load_config",
    "save_config",
]

__version__ = "0.1.0"
