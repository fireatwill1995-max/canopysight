"""SAM2 segmentation pipeline for Canopy Sight."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import torch

from .types import SegmentationResult

logger = logging.getLogger(__name__)


def _resolve_device(device: str) -> str:
    if device != "auto":
        return device
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class SegmentationPipeline:
    """Instance segmentation pipeline backed by SAM2.

    Args:
        model_type: SAM2 model variant — 'vit_h', 'vit_l', 'vit_b', or 'vit_t'.
        checkpoint_path: Path to SAM2 checkpoint. If None, uses default SAM2 weights.
        device: Device string — 'auto', 'cuda', 'cpu', or 'mps'.
    """

    def __init__(
        self,
        model_type: str = "vit_h",
        checkpoint_path: str | None = None,
        device: str = "auto",
    ) -> None:
        self.model_type = model_type
        self.checkpoint_path = checkpoint_path
        self.device = _resolve_device(device)
        self._model: Any = None
        self._predictor: Any = None
        self._auto_generator: Any = None

    def load_model(self) -> None:
        """Load the SAM2 model and build predictor / auto mask generator."""
        try:
            from segment_anything_2.build_sam import build_sam2
            from segment_anything_2.sam2_image_predictor import SAM2ImagePredictor
            from segment_anything_2.automatic_mask_generator import SAM2AutomaticMaskGenerator
        except ImportError:
            try:
                from sam2.build_sam import build_sam2
                from sam2.sam2_image_predictor import SAM2ImagePredictor
                from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator
            except ImportError as exc:
                raise ImportError(
                    "SAM2 is not installed. Install via: pip install segment-anything-2 "
                    "or pip install git+https://github.com/facebookresearch/segment-anything-2.git"
                ) from exc

        logger.info("Loading SAM2 model (%s) on %s", self.model_type, self.device)
        self._model = build_sam2(
            self.model_type,
            self.checkpoint_path,
            device=self.device,
        )
        self._predictor = SAM2ImagePredictor(self._model)
        self._auto_generator = SAM2AutomaticMaskGenerator(self._model)
        logger.info("SAM2 model loaded")

    @property
    def predictor(self) -> Any:
        if self._predictor is None:
            self.load_model()
        return self._predictor

    @property
    def auto_generator(self) -> Any:
        if self._auto_generator is None:
            self.load_model()
        return self._auto_generator

    # ------------------------------------------------------------------
    # Segmentation modes
    # ------------------------------------------------------------------

    def segment_automatic(self, image: np.ndarray) -> list[SegmentationResult]:
        """Automatically segment all objects in the image.

        Args:
            image: RGB numpy array (H, W, 3).

        Returns:
            List of SegmentationResult sorted by descending score.
        """
        masks = self.auto_generator.generate(image)
        results = [
            SegmentationResult(
                mask=m["segmentation"],
                score=float(m["predicted_iou"]),
                area=int(m["area"]),
                bbox=tuple(m["bbox"]),  # type: ignore[arg-type]
            )
            for m in masks
        ]
        results.sort(key=lambda r: r.score, reverse=True)
        return results

    def segment_prompted(
        self,
        image: np.ndarray,
        points: list[tuple[float, float]],
        labels: list[int],
    ) -> list[SegmentationResult]:
        """Segment using point prompts.

        Args:
            image: RGB numpy array (H, W, 3).
            points: List of (x, y) prompt coordinates.
            labels: List of labels (1 = foreground, 0 = background) per point.

        Returns:
            List of SegmentationResult (one per predicted mask variant).
        """
        self.predictor.set_image(image)

        point_coords = np.array(points, dtype=np.float32)
        point_labels = np.array(labels, dtype=np.int32)

        masks, scores, _ = self.predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True,
        )
        return self._masks_to_results(masks, scores)

    def segment_from_boxes(
        self,
        image: np.ndarray,
        boxes: list[list[float]],
    ) -> list[SegmentationResult]:
        """Segment objects given bounding box prompts.

        Args:
            image: RGB numpy array (H, W, 3).
            boxes: List of [x1, y1, x2, y2] bounding boxes.

        Returns:
            List of SegmentationResult (one per box).
        """
        self.predictor.set_image(image)

        results: list[SegmentationResult] = []
        for box in boxes:
            box_arr = np.array(box, dtype=np.float32)
            masks, scores, _ = self.predictor.predict(
                box=box_arr,
                multimask_output=False,
            )
            # Take the single best mask for each box
            best = self._masks_to_results(masks, scores)
            if best:
                results.append(best[0])
        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _masks_to_results(
        masks: np.ndarray, scores: np.ndarray
    ) -> list[SegmentationResult]:
        """Convert raw mask arrays to SegmentationResult list."""
        results: list[SegmentationResult] = []
        for i in range(len(masks)):
            mask = masks[i]
            ys, xs = np.where(mask)
            if len(xs) == 0:
                bbox = (0.0, 0.0, 0.0, 0.0)
            else:
                bbox = (float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max()))
            results.append(
                SegmentationResult(
                    mask=mask,
                    score=float(scores[i]),
                    area=int(mask.sum()),
                    bbox=bbox,
                )
            )
        results.sort(key=lambda r: r.score, reverse=True)
        return results
