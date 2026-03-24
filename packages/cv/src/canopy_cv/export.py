"""ONNX and TensorRT model export utilities for Canopy Sight."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import onnx
import torch
from ultralytics import YOLO

logger = logging.getLogger(__name__)


def export_to_onnx(
    model_path: str,
    output_path: str,
    input_size: tuple[int, int] = (640, 640),
    opset_version: int = 17,
    dynamic_batch: bool = True,
) -> str:
    """Export a YOLO model to ONNX format.

    Args:
        model_path: Path to the source .pt weights.
        output_path: Destination path for the .onnx file.
        input_size: (height, width) of the model input.
        opset_version: ONNX opset version.
        dynamic_batch: Enable dynamic batch size axis.

    Returns:
        The resolved output path.
    """
    logger.info("Exporting %s to ONNX (%s, opset %d)", model_path, input_size, opset_version)

    model = YOLO(model_path)
    model.export(
        format="onnx",
        imgsz=list(input_size),
        opset=opset_version,
        dynamic=dynamic_batch,
    )

    # Ultralytics places the ONNX file next to the weights
    auto_path = Path(model_path).with_suffix(".onnx")
    dest = Path(output_path)
    if auto_path != dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        auto_path.rename(dest)

    # Validate the exported model
    onnx_model = onnx.load(str(dest))
    onnx.checker.check_model(onnx_model)
    logger.info("ONNX model exported and validated: %s", dest)
    return str(dest)


def optimize_for_tensorrt(
    onnx_path: str,
    output_path: str,
    fp16: bool = True,
    int8: bool = False,
) -> str:
    """Optimise an ONNX model for NVIDIA TensorRT (Jetson / GPU deployment).

    Args:
        onnx_path: Path to the source ONNX model.
        output_path: Destination path for the TensorRT engine.
        fp16: Enable FP16 precision.
        int8: Enable INT8 quantisation (requires calibration data).

    Returns:
        The resolved output path.
    """
    try:
        import tensorrt as trt
    except ImportError as exc:
        raise ImportError(
            "TensorRT is not installed. Install the tensorrt Python package for "
            "Jetson/GPU deployment: pip install tensorrt"
        ) from exc

    logger.info("Building TensorRT engine from %s (fp16=%s, int8=%s)", onnx_path, fp16, int8)

    trt_logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(trt_logger)
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, trt_logger)

    with open(onnx_path, "rb") as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                logger.error("TensorRT parse error: %s", parser.get_error(i))
            raise RuntimeError("Failed to parse ONNX model for TensorRT")

    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1 << 30)  # 1 GB

    if fp16 and builder.platform_has_fast_fp16:
        config.set_flag(trt.BuilderFlag.FP16)
    if int8 and builder.platform_has_fast_int8:
        config.set_flag(trt.BuilderFlag.INT8)

    engine = builder.build_serialized_network(network, config)
    if engine is None:
        raise RuntimeError("TensorRT engine build failed")

    dest = Path(output_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f:
        f.write(engine)

    logger.info("TensorRT engine saved: %s", dest)
    return str(dest)


def validate_exported_model(
    original_path: str,
    exported_path: str,
    test_image: str,
    tolerance: float = 0.01,
) -> dict[str, object]:
    """Compare predictions between the original and exported model.

    Args:
        original_path: Path to the original .pt weights.
        exported_path: Path to the exported ONNX model.
        test_image: Path to a test image.
        tolerance: Maximum allowed confidence difference.

    Returns:
        Dict with 'match' (bool), 'original_count', 'exported_count',
        'max_conf_diff'.
    """
    import onnxruntime as ort

    original = YOLO(original_path)
    orig_results = original(test_image, verbose=False)
    orig_boxes = orig_results[0].boxes

    exported = YOLO(exported_path)
    exp_results = exported(test_image, verbose=False)
    exp_boxes = exp_results[0].boxes

    orig_count = len(orig_boxes) if orig_boxes is not None else 0
    exp_count = len(exp_boxes) if exp_boxes is not None else 0

    max_diff = 0.0
    if orig_boxes is not None and exp_boxes is not None:
        min_count = min(orig_count, exp_count)
        if min_count > 0:
            orig_conf = orig_boxes.conf[:min_count].cpu().numpy()
            exp_conf = exp_boxes.conf[:min_count].cpu().numpy()
            max_diff = float(np.max(np.abs(orig_conf - exp_conf)))

    match = abs(orig_count - exp_count) == 0 and max_diff <= tolerance

    result = {
        "match": match,
        "original_count": orig_count,
        "exported_count": exp_count,
        "max_conf_diff": max_diff,
    }
    logger.info("Validation result: %s", result)
    return result
