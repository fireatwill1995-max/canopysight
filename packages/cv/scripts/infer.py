"""CLI entry point for running inference with Canopy Sight models."""

from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict
from pathlib import Path

import cv2
import numpy as np

from canopy_cv.detection import DetectionPipeline

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Canopy Sight inference")
    parser.add_argument("input", type=str, help="Image path, directory, or video file")
    parser.add_argument("--model", type=str, default="yolov9c.pt", help="Model weights path")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold for NMS")
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--output", type=str, default=None, help="Output directory for results")
    parser.add_argument("--save-json", action="store_true", help="Save results as JSON")
    parser.add_argument("--save-images", action="store_true", help="Save annotated images")
    return parser.parse_args()


def draw_detections(image: np.ndarray, detections: list) -> np.ndarray:
    """Draw bounding boxes and labels on an image."""
    annotated = image.copy()
    for det in detections:
        x1, y1, x2, y2 = [int(v) for v in det.bbox]
        color = (0, 255, 0)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        label = f"{det.label} {det.confidence:.2f}"
        cv2.putText(annotated, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
    return annotated


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    args = parse_args()

    pipeline = DetectionPipeline(
        model_path=args.model,
        device=args.device,
        conf_threshold=args.conf,
        iou_threshold=args.iou,
    )
    pipeline.warmup()

    input_path = Path(args.input)
    output_dir = Path(args.output) if args.output else Path("inference_output")
    output_dir.mkdir(parents=True, exist_ok=True)

    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
    video_extensions = {".mp4", ".avi", ".mov", ".mkv"}

    if input_path.is_file() and input_path.suffix.lower() in image_extensions:
        # Single image
        image = cv2.imread(str(input_path))
        detections = pipeline.predict(image)
        logger.info("Found %d detections in %s", len(detections), input_path.name)

        for det in detections:
            print(f"  {det.label}: {det.confidence:.3f} @ {det.bbox}")

        if args.save_json:
            json_path = output_dir / f"{input_path.stem}.json"
            json_path.write_text(json.dumps([asdict(d) for d in detections], indent=2))

        if args.save_images:
            annotated = draw_detections(image, detections)
            out_path = output_dir / f"{input_path.stem}_annotated{input_path.suffix}"
            cv2.imwrite(str(out_path), annotated)

    elif input_path.is_dir():
        # Directory of images
        images = [p for p in input_path.iterdir() if p.suffix.lower() in image_extensions]
        logger.info("Processing %d images from %s", len(images), input_path)

        for img_path in sorted(images):
            image = cv2.imread(str(img_path))
            detections = pipeline.predict(image)
            logger.info("  %s: %d detections", img_path.name, len(detections))

            if args.save_json:
                json_path = output_dir / f"{img_path.stem}.json"
                json_path.write_text(json.dumps([asdict(d) for d in detections], indent=2))

            if args.save_images:
                annotated = draw_detections(image, detections)
                out_path = output_dir / f"{img_path.stem}_annotated{img_path.suffix}"
                cv2.imwrite(str(out_path), annotated)

    elif input_path.is_file() and input_path.suffix.lower() in video_extensions:
        # Video file
        cap = cv2.VideoCapture(str(input_path))
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            detections = pipeline.predict(frame)
            if detections:
                logger.info("Frame %d: %d detections", frame_idx, len(detections))
            frame_idx += 1
        cap.release()
        logger.info("Processed %d frames", frame_idx)

    else:
        logger.error("Unsupported input: %s", input_path)


if __name__ == "__main__":
    main()
