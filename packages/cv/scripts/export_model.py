"""CLI entry point for exporting Canopy Sight models to ONNX / TensorRT."""

from __future__ import annotations

import argparse
import logging

from canopy_cv.export import export_to_onnx, optimize_for_tensorrt, validate_exported_model

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a Canopy Sight model")
    parser.add_argument("model", type=str, help="Path to source .pt model weights")
    parser.add_argument("--output", type=str, required=True, help="Output file path")
    parser.add_argument(
        "--format",
        type=str,
        choices=["onnx", "tensorrt"],
        default="onnx",
        help="Export format",
    )
    parser.add_argument("--input-size", type=int, nargs=2, default=[640, 640], help="H W")
    parser.add_argument("--opset", type=int, default=17, help="ONNX opset version")
    parser.add_argument("--fp16", action="store_true", help="Enable FP16 precision")
    parser.add_argument("--int8", action="store_true", help="Enable INT8 quantisation")
    parser.add_argument("--no-dynamic", action="store_true", help="Disable dynamic batch size")
    parser.add_argument(
        "--validate",
        type=str,
        default=None,
        help="Path to test image for validation",
    )
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    args = parse_args()

    input_size = tuple(args.input_size)

    if args.format == "onnx":
        onnx_path = export_to_onnx(
            model_path=args.model,
            output_path=args.output,
            input_size=input_size,
            opset_version=args.opset,
            dynamic_batch=not args.no_dynamic,
        )
        logger.info("ONNX model exported: %s", onnx_path)

        if args.validate:
            result = validate_exported_model(args.model, onnx_path, args.validate)
            logger.info("Validation: %s", result)

    elif args.format == "tensorrt":
        # First export to ONNX, then convert to TensorRT
        onnx_path = args.output.replace(".engine", ".onnx")
        export_to_onnx(
            model_path=args.model,
            output_path=onnx_path,
            input_size=input_size,
            opset_version=args.opset,
        )
        trt_path = optimize_for_tensorrt(
            onnx_path=onnx_path,
            output_path=args.output,
            fp16=args.fp16,
            int8=args.int8,
        )
        logger.info("TensorRT engine exported: %s", trt_path)


if __name__ == "__main__":
    main()
