#!/usr/bin/env python3
"""
01_label_images.py - Auto-label car images for training.

Modes:
  placeholder: Create car_labels.csv with make=Unknown, model=Unknown for all car_*.jpg.
               Edit the CSV manually to correct labels (recommended: fix at least 1000).
  from_dataset: Merge labels from an existing CSV (filename, make, model). Unmatched → Unknown.
  claude_sample: Use Claude API to label a subset (requires ANTHROPIC_API_KEY). Rest → Unknown.

Output: data/car_labels.csv with columns: filename, make, model

Usage:
  python -m scripts.01_label_images --mode placeholder
  python -m scripts.01_label_images --mode from_dataset --dataset-csv ../data/iqcars_cleaned.csv --filename-col image_filename
  python -m scripts.01_label_images --mode claude_sample --claude-sample-size 500
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import re
import sys
from pathlib import Path

import pandas as pd

# Project root (parent of backend)
BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Default paths
DEFAULT_CAR_IMAGES = ROOT / "car_images"
DEFAULT_OUTPUT_CSV = ROOT / "data" / "car_labels.csv"
DEFAULT_DATA_DIR = ROOT / "data"

PROMPT = """Analyze this car image and identify the make and model.
Return ONLY valid JSON: {"make": "string or null", "model": "string or null"}
Examples: {"make": "BMW", "model": "X5"} or {"make": "Toyota", "model": "Camry"}
If unsure, use null."""


def _list_car_images(car_images_dir: Path) -> list[Path]:
    images = sorted(car_images_dir.glob("car_*.jpg"))
    images = [p for p in images if p.is_file()]
    return images


def _parse_claude_json(text: str) -> tuple[str | None, str | None]:
    text = (text or "").strip()
    m = re.search(r"\{[^{}]*\}", text)
    if m:
        text = m.group(0)
    try:
        d = json.loads(text)
        make = d.get("make")
        model = d.get("model")
        return (
            str(make).strip() if make and str(make).strip() else None,
            str(model).strip() if model and str(model).strip() else None,
        )
    except Exception:
        return None, None


def run_placeholder(car_images_dir: Path, output_csv: Path) -> pd.DataFrame:
    images = _list_car_images(car_images_dir)
    rows = [{"filename": p.name, "make": "Unknown", "model": "Unknown"} for p in images]
    df = pd.DataFrame(rows)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)
    logger.info("Created %s with %d rows (make=Unknown, model=Unknown). Edit CSV to correct labels.", output_csv, len(df))
    return df


def run_from_dataset(
    car_images_dir: Path,
    output_csv: Path,
    dataset_csv: Path,
    filename_col: str,
    make_col: str = "make",
    model_col: str = "model",
) -> pd.DataFrame:
    if not dataset_csv.exists():
        raise FileNotFoundError(f"Dataset CSV not found: {dataset_csv}")

    ds = pd.read_csv(dataset_csv)
    for c in (filename_col, make_col, model_col):
        if c not in ds.columns:
            raise ValueError(f"Dataset missing column: {c}")

    # Normalize: dataset may have path or plain filename
    ds = ds.astype({filename_col: str, make_col: str, model_col: str})
    ds[filename_col] = ds[filename_col].apply(lambda x: Path(x).name if x else "")
    lookup = ds.set_index(filename_col).to_dict("index")

    images = _list_car_images(car_images_dir)
    rows = []
    matched = 0
    for p in images:
        rec = lookup.get(p.name)
        if rec is not None:
            make = (rec.get(make_col) or "").strip() or "Unknown"
            model = (rec.get(model_col) or "").strip() or "Unknown"
            matched += 1
        else:
            make, model = "Unknown", "Unknown"
        rows.append({"filename": p.name, "make": make, "model": model})

    df = pd.DataFrame(rows)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)
    logger.info("From dataset: matched %d of %d. Wrote %s", matched, len(rows), output_csv)
    return df


def run_claude_sample(
    car_images_dir: Path,
    output_csv: Path,
    sample_size: int,
) -> pd.DataFrame:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set. Falling back to placeholder for all.")
        return run_placeholder(car_images_dir, output_csv)

    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic not installed. Falling back to placeholder for all.")
        return run_placeholder(car_images_dir, output_csv)

    images = _list_car_images(car_images_dir)
    to_label = images[: min(sample_size, len(images))]
    client = anthropic.Anthropic(api_key=api_key)
    model_id = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")

    labeled = {}
    for i, p in enumerate(to_label):
        try:
            with open(p, "rb") as f:
                raw = f.read()
            b64 = base64.b64encode(raw).decode("ascii")
            # Assume jpeg
            content = [
                {"type": "text", "text": PROMPT},
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
            ]
            msg = client.messages.create(
                model=model_id,
                max_tokens=128,
                messages=[{"role": "user", "content": content}],
            )
            text = "".join(getattr(b, "text", "") or "" for b in (msg.content or []))
            make, model = _parse_claude_json(text)
            labeled[p.name] = (make or "Unknown", model or "Unknown")
        except Exception as e:
            logger.warning("Claude failed for %s: %s", p.name, e)
            labeled[p.name] = ("Unknown", "Unknown")

        if (i + 1) % 50 == 0:
            logger.info("Claude labeled %d / %d", i + 1, len(to_label))

    # Build full list: labeled + rest as Unknown
    all_names = {p.name for p in images}
    rows = []
    for p in images:
        m, mo = labeled.get(p.name, ("Unknown", "Unknown"))
        rows.append({"filename": p.name, "make": m, "model": mo})

    df = pd.DataFrame(rows)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)
    logger.info("Claude labeled %d; rest Unknown. Wrote %s", len(labeled), output_csv)
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description="Label car images for training")
    ap.add_argument("--car-images-dir", type=Path, default=DEFAULT_CAR_IMAGES, help="Directory with car_*.jpg")
    ap.add_argument("--output-csv", type=Path, default=DEFAULT_OUTPUT_CSV, help="Output car_labels.csv")
    ap.add_argument(
        "--mode",
        choices=("placeholder", "from_dataset", "claude_sample"),
        default="placeholder",
        help="placeholder=all Unknown; from_dataset=merge CSV; claude_sample=Claude for N images",
    )
    ap.add_argument("--dataset-csv", type=Path, help="For from_dataset: CSV with make/model")
    ap.add_argument("--filename-col", default="image_filename", help="Column with image filename in dataset")
    ap.add_argument("--make-col", default="make", help="Make column in dataset")
    ap.add_argument("--model-col", default="model", help="Model column in dataset")
    ap.add_argument("--claude-sample-size", type=int, default=500, help="For claude_sample: how many to label")
    args = ap.parse_args()

    if not args.car_images_dir.exists():
        logger.error("Car images dir not found: %s", args.car_images_dir)
        sys.exit(1)

    if args.mode == "from_dataset":
        if not args.dataset_csv:
            logger.error("--dataset-csv required for from_dataset")
            sys.exit(1)
        run_from_dataset(
            args.car_images_dir,
            args.output_csv,
            args.dataset_csv,
            args.filename_col,
            args.make_col,
            args.model_col,
        )
    elif args.mode == "claude_sample":
        run_claude_sample(args.car_images_dir, args.output_csv, args.claude_sample_size)
    else:
        run_placeholder(args.car_images_dir, args.output_csv)


if __name__ == "__main__":
    main()
