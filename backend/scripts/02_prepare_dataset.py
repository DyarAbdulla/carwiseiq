#!/usr/bin/env python3
"""
02_prepare_dataset.py - Organize and split labeled data for training.

- Reads data/car_labels.csv (filename, make, model)
- Filters makes with fewer than min_samples_per_make
- Builds make_to_idx, model_to_idx
- Stratified 70% train / 15% val / 15% test by make
- Saves data/splits.json and data/label_maps.json

Data augmentation (rotation, flip, brightness, zoom) is applied during
training in 03_train_model.py.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_LABELS = ROOT / "data" / "car_labels.csv"
DEFAULT_CAR_IMAGES = ROOT / "car_images"
DEFAULT_OUTPUT_DIR = ROOT / "data"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels-csv", type=Path, default=DEFAULT_LABELS)
    ap.add_argument("--car-images-dir", type=Path, default=DEFAULT_CAR_IMAGES)
    ap.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    ap.add_argument("--min-samples-per-make", type=int, default=10)
    ap.add_argument("--val-ratio", type=float, default=0.15)
    ap.add_argument("--test-ratio", type=float, default=0.15)
    args = ap.parse_args()

    if not args.labels_csv.exists():
        logger.error("Labels not found: %s. Run 01_label_images.py first.", args.labels_csv)
        sys.exit(1)
    if not args.car_images_dir.exists():
        logger.error("Car images dir not found: %s", args.car_images_dir)
        sys.exit(1)

    df = pd.read_csv(args.labels_csv)
    for c in ("filename", "make", "model"):
        if c not in df.columns:
            logger.error("Labels CSV must have: filename, make, model. Found: %s", list(df.columns))
            sys.exit(1)

    df["make"] = df["make"].fillna("").astype(str).str.strip()
    df["model"] = df["model"].fillna("").astype(str).str.strip()
    df.loc[df["make"] == "", "make"] = "Unknown"
    df.loc[df["model"] == "", "model"] = "Unknown"

    # Resolve full path and keep only existing files
    def path_for(fname: str) -> Path:
        return args.car_images_dir / fname

    df["path"] = df["filename"].apply(path_for)
    df = df[df["path"].apply(lambda p: p.exists())].copy()
    if df.empty:
        logger.error("No existing image paths found under %s", args.car_images_dir)
        sys.exit(1)

    # Filter rare makes
    make_counts = df["make"].value_counts()
    keep_makes = make_counts[make_counts >= args.min_samples_per_make].index.tolist()
    df = df[df["make"].isin(keep_makes)].copy()
    if df.empty:
        logger.error("No samples left after filtering makes with >= %d", args.min_samples_per_make)
        sys.exit(1)
    logger.info("After filtering: %d samples, %d makes", len(df), len(keep_makes))

    # Build label maps (global for model; same make can have same model name across brands)
    makes = sorted(df["make"].unique().tolist())
    models = sorted(df["model"].unique().tolist())
    make_to_idx = {m: i for i, m in enumerate(makes)}
    model_to_idx = {m: i for i, m in enumerate(models)}
    make_list = makes
    model_list = models

    df["make_idx"] = df["make"].map(make_to_idx)
    df["model_idx"] = df["model"].map(model_to_idx)
    df = df.dropna(subset=["make_idx", "model_idx"]).astype({"make_idx": int, "model_idx": int})

    # Stratified split by make
    # First train+val vs test, then train vs val
    train_val, test = train_test_split(
        df, test_size=args.test_ratio, stratify=df["make"], random_state=42
    )
    val_ratio_adj = args.val_ratio / (1.0 - args.test_ratio)
    train, val = train_test_split(
        train_val, test_size=val_ratio_adj, stratify=train_val["make"], random_state=42
    )

    def to_records(d: pd.DataFrame) -> list[dict]:
        return [
            {
                "path": str(row["path"]),
                "filename": row["filename"],
                "make": row["make"],
                "model": row["model"],
                "make_idx": int(row["make_idx"]),
                "model_idx": int(row["model_idx"]),
            }
            for _, row in d.iterrows()
        ]

    splits = {
        "train": to_records(train),
        "val": to_records(val),
        "test": to_records(test),
    }
    label_maps = {
        "make_to_idx": make_to_idx,
        "model_to_idx": model_to_idx,
        "make_list": make_list,
        "model_list": model_list,
        "num_makes": len(make_list),
        "num_models": len(model_list),
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    splits_path = args.output_dir / "splits.json"
    maps_path = args.output_dir / "label_maps.json"
    with open(splits_path, "w", encoding="utf-8") as f:
        json.dump(splits, f, indent=2)
    with open(maps_path, "w", encoding="utf-8") as f:
        json.dump(label_maps, f, indent=2)

    logger.info("Wrote %s (train=%d, val=%d, test=%d)", splits_path, len(splits["train"]), len(splits["val"]), len(splits["test"]))
    logger.info("Wrote %s (makes=%d, models=%d)", maps_path, label_maps["num_makes"], label_maps["num_models"])


if __name__ == "__main__":
    main()
