"""YOLOv9 detection pipeline for Canopy Sight."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
import torch
from ultralytics import YOLO

from .types import Detection

if TYPE_CHECKING:
    from ultralytics.engine.results import Results

logger = logging.getLogger(__name__)


def _resolve_device(device: str) -> str:
    """Resolve 'auto' to the best available device."""
    if device != "auto":
        return device
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class DetectionPipeline:
    """Object detection pipeline backed by Ultralytics YOLOv9.

    Args:
        model_path: Path to YOLO weights file (e.g. 'yolov9c.pt').
        device: Device string — 'auto', 'cuda', 'cpu', or 'mps'.
        conf_threshold: Minimum confidence for detections.
        iou_threshold: IoU threshold for NMS.
    """

    def __init__(
        self,
        model_path: str = "yolov9c.pt",
        device: str = "auto",
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
    ) -> None:
        self.model_path = model_path
        self.device = _resolve_device(device)
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self._model: YOLO | None = None

    # ------------------------------------------------------------------
    # Model lifecycle
    # ------------------------------------------------------------------

    def load_model(self) -> None:
        """Load the YOLO model into memory."""
        logger.info("Loading YOLO model from %s on %s", self.model_path, self.device)
        self._model = YOLO(self.model_path)
        self._model.to(self.device)

    def warmup(self) -> None:
        """Run a dummy forward pass to warm up the model."""
        if self._model is None:
            self.load_model()
        dummy = np.zeros((640, 640, 3), dtype=np.uint8)
        self._model(dummy, verbose=False)  # type: ignore[union-attr]
        logger.info("Model warmed up")

    @property
    def model(self) -> YOLO:
        if self._model is None:
            self.load_model()
        assert self._model is not None
        return self._model

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(
        self,
        image: np.ndarray | str,
        conf: float | None = None,
        iou: float | None = None,
        classes: list[int] | None = None,
        max_det: int = 300,
    ) -> list[Detection]:
        """Run detection on a single image.

        Args:
            image: NumPy BGR array or file path string.
            conf: Override confidence threshold.
            iou: Override IoU threshold.
            classes: Filter to specific class IDs.
            max_det: Maximum detections per image.

        Returns:
            List of Detection objects.
        """
        results: list[Results] = self.model(
            image,
            conf=conf or self.conf_threshold,
            iou=iou or self.iou_threshold,
            classes=classes,
            max_det=max_det,
            verbose=False,
        )
        return self._parse_results(results[0])

    def predict_batch(
        self,
        images: list[np.ndarray | str],
        conf: float | None = None,
        iou: float | None = None,
        classes: list[int] | None = None,
        max_det: int = 300,
    ) -> list[list[Detection]]:
        """Run detection on a batch of images.

        Args:
            images: List of NumPy BGR arrays or file path strings.
            conf: Override confidence threshold.
            iou: Override IoU threshold.
            classes: Filter to specific class IDs.
            max_det: Maximum detections per image.

        Returns:
            List of detection lists, one per image.
        """
        results: list[Results] = self.model(
            images,
            conf=conf or self.conf_threshold,
            iou=iou or self.iou_threshold,
            classes=classes,
            max_det=max_det,
            verbose=False,
        )
        return [self._parse_results(r) for r in results]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _parse_results(self, result: Results) -> list[Detection]:
        """Convert Ultralytics Results to Detection dataclasses."""
        detections: list[Detection] = []
        boxes = result.boxes
        if boxes is None:
            return detections

        names = result.names or {}
        for i in range(len(boxes)):
            cls_id = int(boxes.cls[i].item())
            detections.append(
                Detection(
                    label=names.get(cls_id, str(cls_id)),
                    confidence=float(boxes.conf[i].item()),
                    bbox=tuple(boxes.xyxy[i].tolist()),  # type: ignore[arg-type]
                    class_id=cls_id,
                )
            )
        return detections
