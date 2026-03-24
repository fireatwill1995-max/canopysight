"""Albumentations data augmentation pipelines for drone / surveillance imagery."""

from __future__ import annotations

import albumentations as A
from albumentations.pytorch import ToTensorV2


def get_train_transforms(image_size: int = 640) -> A.Compose:
    """Training augmentation pipeline with heavy augmentation for drone imagery.

    Includes geometric transforms (flip, rotate, crop), colour jitter,
    weather-like effects, and mosaic-style random crop.
    """
    return A.Compose(
        [
            A.RandomResizedCrop(height=image_size, width=image_size, scale=(0.5, 1.0)),
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.1),
            A.RandomRotate90(p=0.25),
            A.ShiftScaleRotate(
                shift_limit=0.1,
                scale_limit=0.2,
                rotate_limit=15,
                border_mode=0,
                p=0.5,
            ),
            A.OneOf(
                [
                    A.RandomBrightnessContrast(
                        brightness_limit=0.3, contrast_limit=0.3, p=1.0
                    ),
                    A.HueSaturationValue(
                        hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=1.0
                    ),
                    A.CLAHE(clip_limit=4.0, p=1.0),
                ],
                p=0.7,
            ),
            A.OneOf(
                [
                    A.GaussNoise(var_limit=(10.0, 50.0), p=1.0),
                    A.GaussianBlur(blur_limit=(3, 7), p=1.0),
                    A.MotionBlur(blur_limit=7, p=1.0),
                ],
                p=0.3,
            ),
            A.OneOf(
                [
                    A.RandomFog(fog_coef_lower=0.1, fog_coef_upper=0.3, p=1.0),
                    A.RandomRain(
                        slant_lower=-10,
                        slant_upper=10,
                        drop_length=10,
                        drop_width=1,
                        p=1.0,
                    ),
                    A.RandomShadow(p=1.0),
                ],
                p=0.15,
            ),
            A.CoarseDropout(
                max_holes=8,
                max_height=int(image_size * 0.1),
                max_width=int(image_size * 0.1),
                p=0.2,
            ),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ],
        bbox_params=A.BboxParams(
            format="pascal_voc",
            label_fields=["class_labels"],
            min_visibility=0.3,
        ),
    )


def get_val_transforms(image_size: int = 640) -> A.Compose:
    """Validation augmentation pipeline — deterministic resize and normalize."""
    return A.Compose(
        [
            A.Resize(height=image_size, width=image_size),
            A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
            ToTensorV2(),
        ],
        bbox_params=A.BboxParams(
            format="pascal_voc",
            label_fields=["class_labels"],
            min_visibility=0.3,
        ),
    )


def get_test_transforms(image_size: int = 640) -> A.Compose:
    """Test-time augmentation pipeline — same as validation."""
    return get_val_transforms(image_size)
