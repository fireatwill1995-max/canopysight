#!/usr/bin/env python3
"""
Canopy Sight — Dataset Preparation Pipeline
Downloads, converts, and merges all training datasets into a single
YOLO-format directory ready for fine-tuning.

Usage:
    python scripts/prepare_data.py --roboflow-key YOUR_KEY [--skip-coco]
"""

import argparse
import json
import os
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

import yaml
from rich.console import Console
from rich.progress import track

console = Console()

ROOT       = Path(__file__).parent.parent
DATA_DIR   = ROOT / "data" / "canopy_detection"
CLASSES_CF = ROOT / "configs" / "classes.yaml"
DATASET_CF = ROOT / "configs" / "dataset.yaml"

# ─── Class taxonomy ──────────────────────────────────────────────────────────

with open(CLASSES_CF) as f:
    CLASSES_META = yaml.safe_load(f)

CANOPY_CLASSES: dict[int, str] = CLASSES_META["detection_classes"]
CLASS_NAME_TO_ID: dict[str, int] = {v: k for k, v in CANOPY_CLASSES.items()}
COCO_REMAP: dict[str, str | None] = CLASSES_META.get("coco_remap", {})

# COCO class id → name (80 classes)
COCO_ID_TO_NAME = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle", 4: "airplane",
    5: "bus", 6: "train", 7: "truck", 8: "boat", 9: "traffic light",
    10: "fire hydrant", 11: "stop sign", 12: "parking meter", 13: "bench",
    14: "bird", 15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow",
    20: "elephant", 21: "bear", 22: "zebra", 23: "giraffe", 24: "backpack",
    25: "umbrella", 26: "handbag", 27: "tie", 28: "suitcase", 29: "frisbee",
    30: "skis", 31: "snowboard", 32: "sports ball", 33: "kite",
    34: "baseball bat", 35: "baseball glove", 36: "skateboard",
    37: "surfboard", 38: "tennis racket", 39: "bottle", 40: "wine glass",
    41: "cup", 42: "fork", 43: "knife", 44: "spoon", 45: "bowl",
    46: "banana", 47: "apple", 48: "sandwich", 49: "orange", 50: "broccoli",
    51: "carrot", 52: "hot dog", 53: "pizza", 54: "donut", 55: "cake",
    56: "chair", 57: "couch", 58: "potted plant", 59: "bed",
    60: "dining table", 61: "toilet", 62: "tv", 63: "laptop", 64: "mouse",
    65: "remote", 66: "keyboard", 67: "cell phone", 68: "microwave",
    69: "oven", 70: "toaster", 71: "sink", 72: "refrigerator", 73: "book",
    74: "clock", 75: "vase", 76: "scissors", 77: "teddy bear",
    78: "hair drier", 79: "toothbrush",
}

# COCO class id → Canopy class id (None = skip this class)
COCO_TO_CANOPY: dict[int, int | None] = {}
for coco_id, coco_name in COCO_ID_TO_NAME.items():
    canopy_name = COCO_REMAP.get(coco_name)
    if canopy_name and canopy_name in CLASS_NAME_TO_ID:
        COCO_TO_CANOPY[coco_id] = CLASS_NAME_TO_ID[canopy_name]
    else:
        COCO_TO_CANOPY[coco_id] = None


# ─── Directory setup ─────────────────────────────────────────────────────────

def make_dirs():
    for split in ("train", "val", "test"):
        (DATA_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (DATA_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)
    console.print(f"[green]✓[/green] Dataset directories created at {DATA_DIR}")


# ─── COCO download + conversion ──────────────────────────────────────────────

def download_coco(skip: bool = False):
    if skip:
        console.print("[yellow]⚠[/yellow] Skipping COCO download (--skip-coco)")
        return

    coco_dir = ROOT / "data" / "coco2017_raw"
    ann_dir  = coco_dir / "annotations"

    urls = {
        "train2017.zip":               "http://images.cocodataset.org/zips/train2017.zip",
        "val2017.zip":                 "http://images.cocodataset.org/zips/val2017.zip",
        "annotations_trainval2017.zip":"http://images.cocodataset.org/annotations/annotations_trainval2017.zip",
    }

    for fname, url in urls.items():
        dest = coco_dir / fname
        if dest.exists():
            console.print(f"[dim]  Skipping {fname} — already downloaded[/dim]")
            continue
        console.print(f"[cyan]↓[/cyan] Downloading COCO {fname} …")
        coco_dir.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, dest)
        with zipfile.ZipFile(dest) as z:
            z.extractall(coco_dir)

    _convert_coco_annotations(coco_dir, ann_dir)


def _convert_coco_annotations(coco_dir: Path, ann_dir: Path):
    """Convert COCO JSON annotations → YOLO .txt format, remapping classes."""
    for split_name, ann_file, out_split in [
        ("train2017", "instances_train2017.json", "train"),
        ("val2017",   "instances_val2017.json",   "val"),
    ]:
        ann_path = ann_dir / ann_file
        if not ann_path.exists():
            console.print(f"[yellow]⚠[/yellow] {ann_file} not found — skipping COCO {split_name}")
            continue

        console.print(f"[cyan]↻[/cyan] Converting COCO {split_name} annotations …")
        with open(ann_path) as f:
            data = json.load(f)

        img_id_to_fname = {img["id"]: img["file_name"] for img in data["images"]}
        img_id_to_size  = {img["id"]: (img["width"], img["height"]) for img in data["images"]}

        # Group annotations by image
        img_anns: dict[int, list] = {}
        for ann in data["annotations"]:
            coco_cls  = ann["category_id"] - 1  # COCO is 1-indexed
            canopy_id = COCO_TO_CANOPY.get(coco_cls)
            if canopy_id is None:
                continue
            img_anns.setdefault(ann["image_id"], []).append((canopy_id, ann["bbox"]))

        label_out = DATA_DIR / "labels" / out_split
        image_out = DATA_DIR / "images" / out_split
        src_img_dir = coco_dir / split_name

        for img_id, anns in track(img_anns.items(), description=f"  COCO {out_split}"):
            fname = img_id_to_fname[img_id]
            W, H  = img_id_to_size[img_id]

            # Copy image
            src = src_img_dir / fname
            if src.exists():
                shutil.copy2(src, image_out / fname)

            # Write label
            lines = []
            for cls_id, (bx, by, bw, bh) in anns:
                cx = (bx + bw / 2) / W
                cy = (by + bh / 2) / H
                nw = bw / W
                nh = bh / H
                cx, cy, nw, nh = (max(0, min(1, v)) for v in (cx, cy, nw, nh))
                lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")

            stem = Path(fname).stem
            (label_out / f"{stem}.txt").write_text("\n".join(lines))

    console.print("[green]✓[/green] COCO conversion complete")


# ─── Roboflow download ───────────────────────────────────────────────────────

def download_roboflow(api_key: str):
    try:
        from roboflow import Roboflow
    except ImportError:
        console.print("[red]✗[/red] roboflow not installed — run: pip install roboflow")
        return

    with open(DATASET_CF) as f:
        cfg = yaml.safe_load(f)

    rf = Roboflow(api_key=api_key)

    for source in cfg.get("sources", []):
        if source["type"] != "roboflow":
            continue

        name = source["name"]
        console.print(f"[cyan]↓[/cyan] Downloading Roboflow dataset: {name}")
        try:
            project = rf.workspace(source["workspace"]).project(source["project"])
            dataset = project.version(source["version"]).download(
                "yolov8",
                location=str(ROOT / "data" / "roboflow_raw" / name),
                overwrite=False,
            )
            _ingest_roboflow_dataset(
                Path(dataset.location),
                source.get("classes", []),
            )
        except Exception as exc:
            console.print(f"[yellow]⚠[/yellow] Failed to download {name}: {exc}")


def _ingest_roboflow_dataset(rf_dir: Path, wanted_classes: list[str]):
    """
    Copy a downloaded Roboflow YOLO dataset into DATA_DIR,
    remapping class IDs to Canopy taxonomy.
    """
    data_yaml = rf_dir / "data.yaml"
    if not data_yaml.exists():
        console.print(f"[yellow]⚠[/yellow] No data.yaml in {rf_dir} — skipping")
        return

    with open(data_yaml) as f:
        rf_cfg = yaml.safe_load(f)

    rf_classes: list[str] = rf_cfg.get("names", [])
    # Build mapping: rf_class_id → canopy_class_id
    rf_to_canopy: dict[int, int | None] = {}
    for i, name in enumerate(rf_classes):
        norm = name.lower().replace(" ", "_")
        if wanted_classes and norm not in [c.lower().replace(" ", "_") for c in wanted_classes]:
            rf_to_canopy[i] = None
            continue
        rf_to_canopy[i] = CLASS_NAME_TO_ID.get(norm)

    for rf_split, canopy_split in [("train", "train"), ("valid", "val"), ("test", "test")]:
        img_src = rf_dir / rf_split / "images"
        lbl_src = rf_dir / rf_split / "labels"
        if not img_src.exists():
            continue

        img_dst = DATA_DIR / "images" / canopy_split
        lbl_dst = DATA_DIR / "labels" / canopy_split

        for img_path in img_src.glob("*"):
            shutil.copy2(img_path, img_dst / img_path.name)

        for lbl_path in lbl_src.glob("*.txt"):
            lines_out = []
            for line in lbl_path.read_text().splitlines():
                parts = line.strip().split()
                if not parts:
                    continue
                rf_cls = int(parts[0])
                canopy_cls = rf_to_canopy.get(rf_cls)
                if canopy_cls is None:
                    continue
                lines_out.append(f"{canopy_cls} {' '.join(parts[1:])}")
            stem = lbl_path.stem
            (lbl_dst / f"{stem}.txt").write_text("\n".join(lines_out))

    console.print(f"[green]✓[/green] Ingested {rf_dir.name}")


# ─── Write final data.yaml ────────────────────────────────────────────────────

def write_data_yaml():
    out = {
        "path": str(DATA_DIR),
        "train": "images/train",
        "val":   "images/val",
        "test":  "images/test",
        "nc":    len(CANOPY_CLASSES),
        "names": list(CANOPY_CLASSES.values()),
    }
    out_path = DATA_DIR / "data.yaml"
    with open(out_path, "w") as f:
        yaml.dump(out, f, default_flow_style=False, sort_keys=False)
    console.print(f"[green]✓[/green] Wrote {out_path}")


# ─── Dataset statistics ──────────────────────────────────────────────────────

def print_stats():
    from collections import Counter
    counts: Counter = Counter()
    for split in ("train", "val", "test"):
        lbl_dir = DATA_DIR / "labels" / split
        n_images = len(list((DATA_DIR / "images" / split).glob("*")))
        n_labels = 0
        for lp in lbl_dir.glob("*.txt"):
            for line in lp.read_text().splitlines():
                parts = line.strip().split()
                if parts:
                    counts[int(parts[0])] += 1
                    n_labels += 1
        console.print(f"  {split:6s}  {n_images:6,} images  {n_labels:7,} annotations")

    console.print("\n[bold]Per-class annotation counts:[/bold]")
    for cls_id, name in CANOPY_CLASSES.items():
        c = counts.get(cls_id, 0)
        bar = "█" * min(40, c // 50)
        console.print(f"  {cls_id:2d} {name:20s} {c:6,}  {bar}")


# ─── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Prepare Canopy Sight training data")
    parser.add_argument("--roboflow-key", default=os.getenv("ROBOFLOW_API_KEY", ""),
                        help="Roboflow API key (or set ROBOFLOW_API_KEY env var)")
    parser.add_argument("--skip-coco", action="store_true",
                        help="Skip COCO download (useful if already downloaded)")
    args = parser.parse_args()

    console.rule("[bold cyan]Canopy Sight — Data Preparation[/bold cyan]")
    make_dirs()
    download_coco(skip=args.skip_coco)
    if args.roboflow_key:
        download_roboflow(args.roboflow_key)
    else:
        console.print("[yellow]⚠[/yellow] No Roboflow API key — skipping wildlife datasets.\n"
                      "   Get a free key at https://roboflow.com and re-run with --roboflow-key KEY")
    write_data_yaml()
    console.rule("[bold]Dataset Statistics[/bold]")
    print_stats()
    console.rule("[bold green]Done[/bold green]")


if __name__ == "__main__":
    main()
