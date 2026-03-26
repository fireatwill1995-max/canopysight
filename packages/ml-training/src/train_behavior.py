#!/usr/bin/env python3
"""
Canopy Sight — Behavior Classifier Training Script
Trains the EfficientNet-B2 behavior classifier on cropped person sequences.

Data format expected in data/behavior/:
  train/<behavior_name>/<sequence_id>/<frame_001.jpg ... frame_005.jpg>
  val/<behavior_name>/<sequence_id>/<frame_001.jpg ... frame_005.jpg>

The easiest way to get initial data:
  1. UCF-101 (action recognition) — https://www.crcv.ucf.edu/data/UCF101.php
     Extract sequences for: running, climbing, carrying, fighting, crawling
  2. Custom surveillance footage clips — crop the person bounding box
     from every frame and organise into folders by behavior label.
  3. Use crop_sequences.py (see scripts/) to auto-crop from YOLO outputs.

Usage:
    python src/train_behavior.py [--epochs 60] [--batch 64]
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

import yaml
from PIL import Image
from rich.console import Console
from rich.progress import track

from src.behavior_classifier import BehaviorClassifier, BEHAVIORS, BEHAVIOR_TO_ID

console = Console()

ROOT     = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "behavior"
RUNS_DIR = ROOT / "runs" / "behavior"

# ── Dataset ──────────────────────────────────────────────────────────────────

class BehaviorSequenceDataset(Dataset):
    """
    Loads T-frame sequences of cropped person detections.
    Directory structure:
        split/<behavior>/<sequence_id>/<frame_XXX.jpg>
    """

    MEAN = [0.485, 0.456, 0.406]
    STD  = [0.229, 0.224, 0.225]

    def __init__(self, root: Path, split: str = "train", seq_len: int = 5,
                 img_size: int = 224, augment: bool = True):
        self.split   = split
        self.seq_len = seq_len
        self.samples: list[tuple[Path, int]] = []  # (sequence_dir, label_id)

        # Collect sequences
        split_dir = root / split
        if not split_dir.exists():
            raise FileNotFoundError(
                f"Behavior dataset not found at {split_dir}.\n"
                "See docstring for data preparation instructions."
            )

        for behavior_dir in sorted(split_dir.iterdir()):
            if not behavior_dir.is_dir():
                continue
            label = BEHAVIOR_TO_ID.get(behavior_dir.name)
            if label is None:
                console.print(f"[yellow]⚠[/yellow] Unknown behavior class: {behavior_dir.name}")
                continue
            for seq_dir in sorted(behavior_dir.iterdir()):
                if seq_dir.is_dir():
                    self.samples.append((seq_dir, label))

        if augment and split == "train":
            self.transform = transforms.Compose([
                transforms.Resize((img_size + 32, img_size + 32)),
                transforms.RandomCrop(img_size),
                transforms.RandomHorizontalFlip(0.5),
                transforms.ColorJitter(brightness=0.4, contrast=0.4,
                                       saturation=0.3, hue=0.1),
                transforms.RandomGrayscale(p=0.1),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.MEAN, std=self.STD),
                transforms.RandomErasing(p=0.2),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.Resize((img_size, img_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=self.MEAN, std=self.STD),
            ])

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        seq_dir, label = self.samples[idx]
        frames = sorted(seq_dir.glob("*.jpg")) + sorted(seq_dir.glob("*.png"))

        # Sample T frames evenly from the sequence
        T = self.seq_len
        if len(frames) >= T:
            step = len(frames) / T
            chosen = [frames[int(i * step)] for i in range(T)]
        else:
            # Repeat last frame to pad
            chosen = frames + [frames[-1]] * (T - len(frames))

        imgs = torch.stack([self.transform(Image.open(f).convert("RGB")) for f in chosen])
        return imgs, label


# ── Training loop ─────────────────────────────────────────────────────────────

def train(
    epochs:   int   = 60,
    batch:    int   = 64,
    lr:       float = 3e-4,
    seq_len:  int   = 5,
    dropout:  float = 0.4,
    device:   str   = "auto",
    resume:   str | None = None,
):
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    console.print(f"[cyan]Device:[/cyan] {device}")

    # ── Data ──────────────────────────────────────────────────────────────────
    train_ds = BehaviorSequenceDataset(DATA_DIR, split="train", seq_len=seq_len, augment=True)
    val_ds   = BehaviorSequenceDataset(DATA_DIR, split="val",   seq_len=seq_len, augment=False)
    console.print(f"[cyan]Train:[/cyan] {len(train_ds):,} sequences  "
                  f"[cyan]Val:[/cyan] {len(val_ds):,} sequences")

    train_loader = DataLoader(train_ds, batch_size=batch, shuffle=True,
                              num_workers=4, pin_memory=True, drop_last=True)
    val_loader   = DataLoader(val_ds,   batch_size=batch, shuffle=False,
                              num_workers=4, pin_memory=True)

    # ── Model ─────────────────────────────────────────────────────────────────
    model = BehaviorClassifier(
        num_classes=len(BEHAVIORS),
        seq_len=seq_len,
        dropout=dropout,
        pretrained=True,
    ).to(device)

    if resume:
        ckpt = torch.load(resume, map_location=device)
        model.load_state_dict(ckpt["model"])
        console.print(f"[green]✓[/green] Resumed from {resume}")

    # ── Loss & optimiser ──────────────────────────────────────────────────────
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    # Cosine annealing with warm restarts
    scheduler = optim.lr_scheduler.CosineAnnealingWarmRestarts(
        optimizer, T_0=15, T_mult=2, eta_min=1e-6
    )

    # ── W&B (optional) ────────────────────────────────────────────────────────
    try:
        import wandb
        wandb.init(project="canopy-sight", name="behavior-classifier-v1",
                   config={"epochs": epochs, "batch": batch, "lr": lr,
                           "seq_len": seq_len, "model": "efficientnet_b2"})
        use_wandb = True
    except Exception:
        use_wandb = False

    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    best_val_acc = 0.0
    best_ckpt    = RUNS_DIR / "best.pt"

    for epoch in range(1, epochs + 1):
        # ── Train epoch ───────────────────────────────────────────────────────
        model.train()
        total_loss, correct, total = 0.0, 0, 0

        for imgs, labels in track(train_loader, description=f"Epoch {epoch:3d}/{epochs}"):
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(imgs)
            loss = criterion(logits, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            total_loss += loss.item() * labels.size(0)
            correct    += (logits.argmax(1) == labels).sum().item()
            total      += labels.size(0)

        scheduler.step()

        train_loss = total_loss / total
        train_acc  = correct / total

        # ── Val epoch ─────────────────────────────────────────────────────────
        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                logits = model(imgs)
                val_correct += (logits.argmax(1) == labels).sum().item()
                val_total   += labels.size(0)

        val_acc = val_correct / val_total if val_total else 0

        console.print(
            f"  Epoch {epoch:3d}/{epochs}  "
            f"loss={train_loss:.4f}  acc={train_acc:.3f}  "
            f"val_acc={val_acc:.3f}  lr={scheduler.get_last_lr()[0]:.2e}"
        )

        if use_wandb:
            import wandb
            wandb.log({"train_loss": train_loss, "train_acc": train_acc,
                       "val_acc": val_acc, "epoch": epoch})

        # ── Save best ─────────────────────────────────────────────────────────
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({"model": model.state_dict(),
                        "epoch": epoch,
                        "val_acc": val_acc,
                        "behaviors": BEHAVIORS}, best_ckpt)
            console.print(f"  [green]★[/green] New best: val_acc={val_acc:.4f} → {best_ckpt}")

    console.print(f"\n[bold green]Training complete.[/bold green] "
                  f"Best val_acc={best_val_acc:.4f}")

    # ── Export to ONNX ────────────────────────────────────────────────────────
    ckpt = torch.load(best_ckpt, map_location="cpu")
    model.load_state_dict(ckpt["model"])
    onnx_path = str(RUNS_DIR / "behavior_classifier.onnx")
    model.export_onnx(onnx_path, seq_len=seq_len)
    console.print(f"\nCopy to edge-agent:")
    console.print(f"  cp {onnx_path} apps/edge-agent/models/behavior_classifier.onnx")

    return best_ckpt


# ── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train Canopy Sight behavior classifier")
    parser.add_argument("--epochs",  type=int,   default=60)
    parser.add_argument("--batch",   type=int,   default=64)
    parser.add_argument("--lr",      type=float, default=3e-4)
    parser.add_argument("--seq-len", type=int,   default=5)
    parser.add_argument("--device",  default="auto")
    parser.add_argument("--resume",  default=None, help="Resume from checkpoint path")
    args = parser.parse_args()

    train(
        epochs=args.epochs, batch=args.batch, lr=args.lr,
        seq_len=args.seq_len, device=args.device, resume=args.resume,
    )


if __name__ == "__main__":
    main()
