"""CLI entry point for training Canopy Sight detection models."""

from __future__ import annotations

import argparse
import logging

import pytorch_lightning as pl
from pytorch_lightning.loggers import WandbLogger

from canopy_cv.config import get_preset, load_config
from canopy_cv.training import CanopyDetectionModule
from canopy_cv.types import TrainingConfig

logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a Canopy Sight detection model")

    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--preset",
        type=str,
        choices=["drone_surveillance", "perimeter_security", "wildlife_monitoring"],
        help="Use a predefined configuration preset",
    )
    group.add_argument("--config", type=str, help="Path to a YAML config file")

    parser.add_argument("--model", type=str, default=None, help="timm model name override")
    parser.add_argument("--num-classes", type=int, default=None)
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None, help="Learning rate")
    parser.add_argument("--image-size", type=int, default=None)
    parser.add_argument("--data-dir", type=str, default=None)
    parser.add_argument("--output-dir", type=str, default="runs")
    parser.add_argument("--wandb-project", type=str, default="canopy-sight")
    parser.add_argument("--no-wandb", action="store_true", help="Disable W&B logging")
    parser.add_argument("--gpus", type=int, default=None)
    parser.add_argument("--seed", type=int, default=42)

    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    args = parse_args()

    pl.seed_everything(args.seed)

    # Build training config
    if args.preset:
        model_config = get_preset(args.preset)
        cfg = model_config.training
    elif args.config:
        model_config = load_config(args.config)
        cfg = model_config.training
    else:
        cfg = TrainingConfig()

    # Apply CLI overrides
    if args.model:
        cfg.model_name = args.model
    if args.num_classes is not None:
        cfg.num_classes = args.num_classes
    if args.epochs is not None:
        cfg.epochs = args.epochs
    if args.batch_size is not None:
        cfg.batch_size = args.batch_size
    if args.lr is not None:
        cfg.learning_rate = args.lr
    if args.image_size is not None:
        cfg.image_size = args.image_size
    if args.data_dir:
        cfg.data_dir = args.data_dir

    # Build module
    module = CanopyDetectionModule.from_config(cfg)

    # Logger
    pl_logger = None
    if not args.no_wandb:
        pl_logger = WandbLogger(project=args.wandb_project, log_model=True)

    # Trainer
    trainer = pl.Trainer(
        max_epochs=cfg.epochs,
        accelerator="auto",
        devices=args.gpus or "auto",
        logger=pl_logger,
        default_root_dir=args.output_dir,
        precision="16-mixed" if cfg.image_size >= 1280 else 32,
    )

    logger.info("Starting training with config: %s", cfg)
    # NOTE: A real DataModule would be needed here.
    # trainer.fit(module, datamodule=data_module)
    logger.info(
        "Training entry point ready. Provide a DataModule to start training. "
        "Example: trainer.fit(module, datamodule=your_data_module)"
    )


if __name__ == "__main__":
    main()
