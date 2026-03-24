"""Model configuration with predefined presets for Canopy Sight use cases."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any

import yaml

from .types import ExportConfig, ModelConfig, TrainingConfig

# ---------------------------------------------------------------------------
# Predefined configuration presets
# ---------------------------------------------------------------------------

PRESETS: dict[str, ModelConfig] = {
    "drone_surveillance": ModelConfig(
        name="drone_surveillance",
        description="Optimized for aerial drone surveillance with wide-angle views",
        training=TrainingConfig(
            model_name="yolov9c",
            num_classes=15,
            learning_rate=1e-3,
            epochs=150,
            batch_size=8,
            image_size=1280,
            augmentation="heavy",
        ),
        export=ExportConfig(
            format="onnx",
            input_size=(1280, 1280),
            fp16=True,
        ),
        classes=[
            "person",
            "vehicle",
            "animal",
            "building",
            "fence",
            "gate",
            "road",
            "water",
            "vegetation",
            "fire",
            "smoke",
            "drone",
            "boat",
            "equipment",
            "debris",
        ],
    ),
    "perimeter_security": ModelConfig(
        name="perimeter_security",
        description="Perimeter intrusion detection with fixed cameras",
        training=TrainingConfig(
            model_name="yolov9c",
            num_classes=8,
            learning_rate=5e-4,
            epochs=200,
            batch_size=16,
            image_size=640,
            augmentation="default",
        ),
        export=ExportConfig(
            format="tensorrt",
            input_size=(640, 640),
            fp16=True,
        ),
        classes=[
            "person",
            "vehicle",
            "animal",
            "fence_breach",
            "package",
            "tool",
            "weapon",
            "fire",
        ],
    ),
    "wildlife_monitoring": ModelConfig(
        name="wildlife_monitoring",
        description="Wildlife detection and tracking in natural environments",
        training=TrainingConfig(
            model_name="yolov9c",
            num_classes=20,
            learning_rate=1e-3,
            epochs=200,
            batch_size=8,
            image_size=640,
            freeze_backbone=True,
            augmentation="heavy",
        ),
        export=ExportConfig(
            format="onnx",
            input_size=(640, 640),
            fp16=True,
        ),
        classes=[
            "deer",
            "bear",
            "coyote",
            "wolf",
            "fox",
            "rabbit",
            "raccoon",
            "skunk",
            "bird",
            "eagle",
            "hawk",
            "owl",
            "snake",
            "cat",
            "dog",
            "moose",
            "elk",
            "boar",
            "turkey",
            "other",
        ],
    ),
}


def get_preset(name: str) -> ModelConfig:
    """Return a predefined configuration preset by name.

    Args:
        name: One of 'drone_surveillance', 'perimeter_security', 'wildlife_monitoring'.

    Raises:
        KeyError: If the preset name is not found.
    """
    if name not in PRESETS:
        available = ", ".join(PRESETS.keys())
        raise KeyError(f"Unknown preset '{name}'. Available presets: {available}")
    return PRESETS[name]


def load_config(path: str | Path) -> ModelConfig:
    """Load a ModelConfig from a YAML file.

    The YAML file should have top-level keys matching ModelConfig fields.
    Nested 'training' and 'export' keys map to TrainingConfig and ExportConfig.
    """
    path = Path(path)
    with open(path) as f:
        data: dict[str, Any] = yaml.safe_load(f)

    training_data = data.pop("training", {})
    export_data = data.pop("export", {})

    # Convert input_size list to tuple if present
    if "input_size" in export_data and isinstance(export_data["input_size"], list):
        export_data["input_size"] = tuple(export_data["input_size"])

    return ModelConfig(
        training=TrainingConfig(**training_data),
        export=ExportConfig(**export_data),
        **data,
    )


def save_config(config: ModelConfig, path: str | Path) -> None:
    """Save a ModelConfig to a YAML file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = asdict(config)
    with open(path, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
