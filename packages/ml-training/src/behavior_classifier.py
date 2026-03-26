"""
Canopy Sight — EfficientNet-B2 Behavior Classifier
Classifies suspicious human behaviors from cropped detection sequences.

Architecture:
  • EfficientNet-B2 backbone (ImageNet pre-trained)
  • Temporal fusion via learnable weighted average over T frames
  • MLP classification head with dropout
  • 8 output classes (see BEHAVIORS below)

Input:  (B, T, 3, 224, 224) — batch of T-frame crop sequences
Output: (B, 8)              — behavior logits
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torchvision.models as tvm
from torchvision.models import EfficientNet_B2_Weights


# ── Class definitions ────────────────────────────────────────────────────────

BEHAVIORS: list[str] = [
    "walking",      # 0 — normal gait, upright
    "running",      # 1 — fast movement, arms pumping
    "crouching",    # 2 — low posture (hiding / setting trap)
    "stationary",   # 3 — not moving (loitering)
    "climbing",     # 4 — fence / wall traversal
    "carrying",     # 5 — carrying object / bag / carcass
    "crawling",     # 6 — belly-to-ground movement
    "fighting",     # 7 — aggressive physical interaction
]

BEHAVIOR_TO_ID: dict[str, int] = {b: i for i, b in enumerate(BEHAVIORS)}

# Risk delta added to base risk score when behavior detected
BEHAVIOR_RISK_DELTA: dict[str, float] = {
    "walking":    0,
    "running":    20,
    "crouching":  35,
    "stationary": 10,
    "climbing":   45,
    "carrying":   30,
    "crawling":   40,
    "fighting":   50,
}


# ── Temporal fusion module ───────────────────────────────────────────────────

class TemporalFusion(nn.Module):
    """
    Fuses T per-frame feature vectors into a single representation.
    Uses learnable attention weights so the model can focus on the
    most informative frames in the sequence.
    """

    def __init__(self, feat_dim: int, seq_len: int):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(feat_dim, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
        )
        self.seq_len = seq_len

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, D)
        weights = self.attn(x)            # (B, T, 1)
        weights = torch.softmax(weights, dim=1)
        out = (x * weights).sum(dim=1)    # (B, D)
        return out


# ── Main model ───────────────────────────────────────────────────────────────

class BehaviorClassifier(nn.Module):
    """
    EfficientNet-B2 based behavior classifier with temporal attention.

    Parameters
    ----------
    num_classes : int
        Number of behavior classes (default 8).
    seq_len : int
        Number of frames per sequence (default 5).
    dropout : float
        Dropout rate before classifier head (default 0.4).
    pretrained : bool
        Load ImageNet pre-trained EfficientNet-B2 backbone (default True).
    """

    def __init__(
        self,
        num_classes: int = len(BEHAVIORS),
        seq_len: int = 5,
        dropout: float = 0.4,
        pretrained: bool = True,
    ):
        super().__init__()
        self.seq_len = seq_len
        self.num_classes = num_classes

        # EfficientNet-B2 backbone — strip the final classifier
        weights = EfficientNet_B2_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = tvm.efficientnet_b2(weights=weights)
        feat_dim = backbone.classifier[1].in_features  # 1408 for B2

        # Remove the original classifier
        self.backbone = nn.Sequential(
            backbone.features,
            backbone.avgpool,
            nn.Flatten(),
        )

        # Temporal fusion attention
        self.temporal_fusion = TemporalFusion(feat_dim, seq_len)

        # Classification head
        self.classifier = nn.Sequential(
            nn.Linear(feat_dim, 512),
            nn.SiLU(inplace=True),
            nn.Dropout(p=dropout),
            nn.Linear(512, 128),
            nn.SiLU(inplace=True),
            nn.Dropout(p=dropout / 2),
            nn.Linear(128, num_classes),
        )

        self._feat_dim = feat_dim

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Parameters
        ----------
        x : Tensor of shape (B, T, C, H, W)
        Returns
        -------
        Tensor of shape (B, num_classes) — raw logits
        """
        B, T, C, H, W = x.shape
        # Process all frames through backbone in one batch for efficiency
        x_flat = x.view(B * T, C, H, W)                  # (B*T, C, H, W)
        feats   = self.backbone(x_flat)                   # (B*T, feat_dim)
        feats   = feats.view(B, T, self._feat_dim)        # (B, T, feat_dim)

        # Temporal fusion
        fused = self.temporal_fusion(feats)               # (B, feat_dim)

        # Classify
        logits = self.classifier(fused)                   # (B, num_classes)
        return logits

    @torch.no_grad()
    def predict(self, x: torch.Tensor, threshold: float = 0.4) -> list[dict]:
        """
        Run inference and return human-readable predictions.

        Parameters
        ----------
        x : Tensor (B, T, C, H, W) — already normalised
        threshold : float — minimum probability to report a behavior

        Returns
        -------
        List of dicts per sample:
          {
            "behavior"      : str,   # top predicted behavior
            "confidence"    : float, # probability 0-1
            "all_probs"     : dict,  # {behavior_name: prob}
            "risk_delta"    : float, # additional risk from this behavior
            "is_suspicious" : bool,  # True if behavior != walking/stationary
          }
        """
        self.eval()
        logits = self.forward(x)
        probs  = torch.softmax(logits, dim=-1)  # (B, num_classes)

        results = []
        for sample_probs in probs:
            top_idx  = sample_probs.argmax().item()
            top_prob = sample_probs[top_idx].item()
            behavior = BEHAVIORS[top_idx] if top_prob >= threshold else "walking"

            results.append({
                "behavior":       behavior,
                "confidence":     float(top_prob),
                "all_probs":      {BEHAVIORS[i]: float(p) for i, p in enumerate(sample_probs)},
                "risk_delta":     BEHAVIOR_RISK_DELTA.get(behavior, 0),
                "is_suspicious":  behavior not in ("walking", "stationary"),
            })

        return results

    def export_onnx(self, out_path: str, seq_len: int | None = None, opset: int = 17):
        """Export the model to ONNX for edge-agent (onnxruntime-node) deployment."""
        import onnx
        import onnxsim

        T = seq_len or self.seq_len
        dummy = torch.randn(1, T, 3, 224, 224)
        self.eval()

        torch.onnx.export(
            self,
            dummy,
            out_path,
            opset_version=opset,
            input_names=["input"],
            output_names=["logits"],
            dynamic_axes={
                "input":  {0: "batch"},
                "logits": {0: "batch"},
            },
        )

        # Simplify
        model_onnx, ok = onnxsim.simplify(out_path)
        if ok:
            onnx.save(model_onnx, out_path)

        print(f"✓ Behavior classifier exported to {out_path}")
        return out_path
