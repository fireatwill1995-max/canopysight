"""PyTorch Lightning training module for Canopy Sight detection models."""

from __future__ import annotations

import logging
from typing import Any

import pytorch_lightning as pl
import timm
import torch
import torch.nn as nn

from .types import TrainingConfig

logger = logging.getLogger(__name__)


class CanopyDetectionModule(pl.LightningModule):
    """PyTorch Lightning module wrapping a timm backbone + detection head.

    This module is intended for fine-tuning or training custom classification /
    detection heads on top of pretrained backbones from the timm model zoo.

    For full YOLO-style training, prefer ``ultralytics`` CLI directly.
    This module is useful when you need structured Lightning training with
    W&B logging, custom schedulers, and the Canopy Sight config system.

    Args:
        model_name: timm model name (e.g. 'efficientnet_b3', 'convnext_base').
        num_classes: Number of output classes.
        learning_rate: Initial learning rate.
        weight_decay: L2 regularisation factor.
        warmup_epochs: Number of warmup epochs for LR scheduler.
        epochs: Total training epochs (used for cosine schedule).
        pretrained: Use ImageNet-pretrained weights.
        freeze_backbone: Freeze backbone parameters for transfer learning.
    """

    def __init__(
        self,
        model_name: str = "efficientnet_b3",
        num_classes: int = 10,
        learning_rate: float = 1e-3,
        weight_decay: float = 1e-4,
        warmup_epochs: int = 3,
        epochs: int = 100,
        pretrained: bool = True,
        freeze_backbone: bool = False,
    ) -> None:
        super().__init__()
        self.save_hyperparameters()

        self.learning_rate = learning_rate
        self.weight_decay = weight_decay
        self.warmup_epochs = warmup_epochs
        self.epochs = epochs

        # Build backbone from timm
        self.backbone = timm.create_model(
            model_name,
            pretrained=pretrained,
            num_classes=num_classes,
        )

        if freeze_backbone:
            self._freeze_backbone()

        self.criterion = nn.CrossEntropyLoss()

    # ------------------------------------------------------------------
    # Forward
    # ------------------------------------------------------------------

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # type: ignore[override]
        return self.backbone(x)

    # ------------------------------------------------------------------
    # Training / validation steps
    # ------------------------------------------------------------------

    def training_step(self, batch: Any, batch_idx: int) -> torch.Tensor:  # type: ignore[override]
        images, targets = batch
        logits = self(images)
        loss = self.criterion(logits, targets)
        acc = (logits.argmax(dim=1) == targets).float().mean()
        self.log("train/loss", loss, prog_bar=True)
        self.log("train/acc", acc, prog_bar=True)
        return loss

    def validation_step(self, batch: Any, batch_idx: int) -> None:  # type: ignore[override]
        images, targets = batch
        logits = self(images)
        loss = self.criterion(logits, targets)
        acc = (logits.argmax(dim=1) == targets).float().mean()
        self.log("val/loss", loss, prog_bar=True, sync_dist=True)
        self.log("val/acc", acc, prog_bar=True, sync_dist=True)

    # ------------------------------------------------------------------
    # Optimiser and scheduler
    # ------------------------------------------------------------------

    def configure_optimizers(self) -> dict[str, Any]:
        optimizer = torch.optim.AdamW(
            self.parameters(),
            lr=self.learning_rate,
            weight_decay=self.weight_decay,
        )
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
            optimizer,
            T_max=self.epochs - self.warmup_epochs,
            eta_min=1e-6,
        )
        return {
            "optimizer": optimizer,
            "lr_scheduler": {
                "scheduler": scheduler,
                "interval": "epoch",
            },
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _freeze_backbone(self) -> None:
        """Freeze all backbone parameters except the classification head."""
        for name, param in self.backbone.named_parameters():
            if "classifier" not in name and "head" not in name and "fc" not in name:
                param.requires_grad = False
        logger.info("Backbone frozen — only head parameters are trainable")

    @classmethod
    def from_config(cls, config: TrainingConfig) -> "CanopyDetectionModule":
        """Instantiate from a TrainingConfig dataclass."""
        return cls(
            model_name=config.model_name,
            num_classes=config.num_classes,
            learning_rate=config.learning_rate,
            weight_decay=config.weight_decay,
            warmup_epochs=config.warmup_epochs,
            epochs=config.epochs,
            pretrained=config.pretrained,
            freeze_backbone=config.freeze_backbone,
        )
