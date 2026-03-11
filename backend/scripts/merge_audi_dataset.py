#!/usr/bin/env python3
"""
Merge Audi Kurdistan supplementary data into the main training dataset.

Maps Audi CSV columns to the main dataset format:
  Audi: make, model, trim, year, mileage_km, condition, fuel_type, transmission, engine_size, price_usd
  Main: make, model, trim, year, mileage, price, location, condition, fuel_type, engine_size, cylinders

Usage:
  python backend/scripts/merge_audi_dataset.py
  python backend/scripts/merge_audi_dataset.py --main-data path/to/main.csv --output path/to/merged.csv
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Column mapping: Audi -> Main dataset
AUDI_TO_MAIN = {
    "make": "make",
    "model": "model",
    "trim": "trim",
    "year": "year",
    "mileage_km": "mileage",
    "condition": "condition",
    "fuel_type": "fuel_type",
    "engine_size": "engine_size",
    "price_usd": "price",
}

# Condition mapping: Audi uses "Used"/"New", main uses "New"/"Excellent"/"Good"/etc.
CONDITION_MAP = {
    "New": "New",
    "Used": "Good",  # Map Used to Good for consistency with training
}

# Estimate cylinders from engine_size (common patterns)
def estimate_cylinders(engine_size: float) -> int:
    if pd.isna(engine_size) or engine_size <= 0:
        return 4
    es = float(engine_size)
    if es <= 2.5:
        return 4
    if es <= 3.5:
        return 6
    return 8


def load_audi_data(audi_path: Path) -> pd.DataFrame:
    """Load and transform Audi data to main dataset format."""
    if not audi_path.exists():
        raise FileNotFoundError(f"Audi data not found: {audi_path}")

    df = pd.read_csv(audi_path)
    logger.info(f"Loaded Audi data: {len(df)} rows from {audi_path}")

    # Rename columns
    df_out = df.rename(columns=AUDI_TO_MAIN).copy()

    # Map condition
    df_out["condition"] = df_out["condition"].map(CONDITION_MAP).fillna("Good")

    # Add location (Kurdistan for all Audi data)
    df_out["location"] = "Kurdistan"
    df_out["mileage_unit"] = "km"

    # Estimate cylinders
    df_out["cylinders"] = df_out["engine_size"].apply(estimate_cylinders)

    # Drop transmission (not used in main model)
    if "transmission" in df_out.columns:
        df_out = df_out.drop(columns=["transmission"])

    return df_out


def find_main_dataset() -> Path | None:
    """Find the main training dataset (cleaned_car_data.csv or iqcars_cleaned.csv)."""
    candidates = [
        ROOT_DIR / "cleaned_car_data.csv",
        ROOT_DIR / "data" / "cleaned_car_data.csv",
        ROOT_DIR / "data" / "iqcars_cleaned.csv",
        BACKEND_DIR / "cleaned_car_data.csv",
        BACKEND_DIR / "data" / "iqcars_cleaned.csv",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge Audi Kurdistan data into main dataset")
    ap.add_argument(
        "--audi-csv",
        type=Path,
        default=BACKEND_DIR / "data" / "audi_kurdistan_prices.csv",
        help="Path to Audi Kurdistan prices CSV",
    )
    ap.add_argument(
        "--main-data",
        type=Path,
        default=None,
        help="Path to main dataset (auto-detect if not set)",
    )
    ap.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output path for merged CSV (default: overwrite main or save to data/merged_car_data.csv)",
    )
    ap.add_argument(
        "--output-only-audi",
        type=Path,
        default=None,
        help="If set, output only the transformed Audi data (for testing)",
    )
    args = ap.parse_args()

    # Load Audi data
    audi_df = load_audi_data(args.audi_csv)

    if args.output_only_audi:
        audi_df.to_csv(args.output_only_audi, index=False)
        logger.info(f"Saved transformed Audi data to {args.output_only_audi}")
        return

    # Load main dataset
    main_path = args.main_data or find_main_dataset()
    if not main_path or not main_path.exists():
        logger.warning(
            "Main dataset not found. Saving only Audi data as merged output. "
            "Place cleaned_car_data.csv or iqcars_cleaned.csv in project root or data/ to merge."
        )
        main_df = pd.DataFrame()
    else:
        main_df = pd.read_csv(main_path)
        logger.info(f"Loaded main dataset: {len(main_df)} rows from {main_path}")

    # Align columns for merge
    if len(main_df) > 0:
        # Add missing columns to audi_df (filled with NaN) so it matches main_df
        for col in main_df.columns:
            if col not in audi_df.columns:
                audi_df[col] = pd.NA
        audi_df = audi_df[main_df.columns]
        combined = pd.concat([main_df, audi_df], ignore_index=True)
    else:
        combined = audi_df

    # Output path
    out_path = args.output
    if out_path is None:
        if main_path and main_path.exists():
            # Backup and overwrite main
            backup = main_path.with_suffix(".csv.bak")
            if backup.exists():
                backup.unlink()
            main_df.to_csv(backup, index=False)
            logger.info(f"Backed up main dataset to {backup}")
            out_path = main_path
        else:
            out_path = ROOT_DIR / "data" / "merged_car_data.csv"
            out_path.parent.mkdir(parents=True, exist_ok=True)

    combined.to_csv(out_path, index=False)
    logger.info(f"Merged dataset saved: {len(combined)} rows ({len(main_df)} main + {len(audi_df)} Audi) -> {out_path}")
    logger.info("Run model training (e.g. python model_training.py) to retrain with the new data.")


if __name__ == "__main__":
    main()
