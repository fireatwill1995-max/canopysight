"""Basic test skeleton for the Canopy CV detection pipeline."""

from __future__ import annotations

import numpy as np
import pytest

from canopy_cv.types import Detection, SegmentationResult, TrainingConfig, ExportConfig, ModelConfig
from canopy_cv.config import get_preset, PRESETS


# ---------------------------------------------------------------------------
# Type / dataclass tests
# ---------------------------------------------------------------------------


class TestDetectionDataclass:
    def test_properties(self):
        det = Detection(label="person", confidence=0.95, bbox=(10, 20, 110, 120), class_id=0)
        assert det.width == 100
        assert det.height == 100
        assert det.area == 10_000
        assert det.center == (60.0, 70.0)

    def test_fields(self):
        det = Detection(label="car", confidence=0.8, bbox=(0, 0, 50, 50), class_id=2)
        assert det.label == "car"
        assert det.class_id == 2


class TestSegmentationResult:
    def test_creation(self):
        mask = np.zeros((100, 100), dtype=bool)
        mask[10:50, 10:50] = True
        result = SegmentationResult(
            mask=mask, score=0.9, area=int(mask.sum()), bbox=(10, 10, 50, 50)
        )
        assert result.area == 40 * 40
        assert result.score == 0.9


class TestTrainingConfig:
    def test_defaults(self):
        cfg = TrainingConfig()
        assert cfg.model_name == "yolov9c"
        assert cfg.num_classes == 80
        assert cfg.learning_rate == 1e-3


class TestExportConfig:
    def test_defaults(self):
        cfg = ExportConfig()
        assert cfg.format == "onnx"
        assert cfg.fp16 is True
        assert cfg.int8 is False


# ---------------------------------------------------------------------------
# Config preset tests
# ---------------------------------------------------------------------------


class TestPresets:
    def test_all_presets_exist(self):
        for name in ["drone_surveillance", "perimeter_security", "wildlife_monitoring"]:
            cfg = get_preset(name)
            assert isinstance(cfg, ModelConfig)
            assert cfg.name == name
            assert len(cfg.classes) > 0

    def test_unknown_preset_raises(self):
        with pytest.raises(KeyError):
            get_preset("nonexistent")

    def test_drone_surveillance_details(self):
        cfg = get_preset("drone_surveillance")
        assert cfg.training.image_size == 1280
        assert cfg.training.num_classes == 15
        assert "person" in cfg.classes


# ---------------------------------------------------------------------------
# Detection pipeline tests (require model download — mark as slow)
# ---------------------------------------------------------------------------


@pytest.mark.slow
class TestDetectionPipeline:
    """These tests require a YOLO model to be available. Run with: pytest -m slow"""

    def test_pipeline_loads(self):
        from canopy_cv.detection import DetectionPipeline

        pipeline = DetectionPipeline(model_path="yolov9c.pt", device="cpu")
        pipeline.load_model()
        assert pipeline._model is not None

    def test_predict_returns_detections(self):
        from canopy_cv.detection import DetectionPipeline

        pipeline = DetectionPipeline(model_path="yolov9c.pt", device="cpu")
        dummy_image = np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8)
        results = pipeline.predict(dummy_image)
        assert isinstance(results, list)
