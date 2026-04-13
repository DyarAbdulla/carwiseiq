"""
Production price prediction using the trained sklearn Pipeline
(price_prediction_pipeline.joblib) and inference_meta.json for row construction.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional, Sequence

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

CURRENT_YEAR = 2026

_cached_pipeline = None
_cached_meta: dict = {}
_cached_feature_columns: Optional[list[str]] = None
_using_fallback = False
_model_load_failed = False


def clear_prediction_model_cache() -> None:
    """
    Drop in-memory pipeline/meta so the next load_model() reads backend/models/* from disk.
    Called at startup before preload; use after swapping artifacts without restarting the interpreter.
    """
    global _cached_pipeline, _cached_meta, _cached_feature_columns, _using_fallback, _model_load_failed
    _cached_pipeline = None
    _cached_meta = {}
    _cached_feature_columns = None
    _using_fallback = False
    _model_load_failed = False


def _backend_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _root_dir() -> Path:
    return _backend_dir().parent


def _models_paths() -> list[Path]:
    b = _backend_dir()
    r = _root_dir()
    return [
        b / "models" / "price_prediction_pipeline.joblib",
        Path("/app/models/price_prediction_pipeline.joblib"),
        r / "models" / "price_prediction_pipeline.joblib",
    ]


def _meta_paths() -> list[Path]:
    b = _backend_dir()
    r = _root_dir()
    return [
        b / "models" / "inference_meta.json",
        Path("/app/models/inference_meta.json"),
        r / "models" / "inference_meta.json",
    ]


def _find_first_existing(paths: list[Path]) -> Optional[Path]:
    for p in paths:
        if p.exists():
            return p
    return None


def load_model():
    """Load sklearn pipeline and inference metadata (cached)."""
    global _cached_pipeline, _cached_meta, _cached_feature_columns, _using_fallback, _model_load_failed

    if _cached_pipeline is not None:
        return _cached_pipeline, _cached_meta
    if _model_load_failed:
        return None, {}

    pipe_path = _find_first_existing(_models_paths())
    meta_path = _find_first_existing(_meta_paths())

    if not pipe_path:
        logger.warning("price_prediction_pipeline.joblib not found; predictions will use dataset fallback")
        _using_fallback = True
        _model_load_failed = True
        _cached_pipeline = None
        _cached_meta = {}
        _cached_feature_columns = None
        return None, {}

    try:
        _cached_pipeline = joblib.load(pipe_path)
        logger.info("Loaded price prediction pipeline from %s", pipe_path)
    except Exception as e:
        logger.error("Failed to load pipeline: %s", e, exc_info=True)
        _using_fallback = True
        _model_load_failed = True
        _cached_pipeline = None
        _cached_meta = {}
        _cached_feature_columns = None
        return None, {}

    if meta_path and meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                _cached_meta = json.load(f)
        except Exception as e:
            logger.warning("Could not load inference_meta.json: %s", e)
            _cached_meta = {}
    else:
        logger.warning("inference_meta.json not found; using defaults for encoded lookups")
        _cached_meta = {}

    fc_path = pipe_path.parent / "feature_columns.json"
    _cached_feature_columns = None
    if fc_path.exists():
        try:
            with open(fc_path, "r", encoding="utf-8") as f:
                _cached_feature_columns = json.load(f).get("feature_columns")
        except Exception as e:
            logger.warning("Could not load feature_columns.json: %s", e)

    return _cached_pipeline, _cached_meta


def _align_feature_frame(X: pd.DataFrame, column_order: Optional[Sequence[str]]) -> pd.DataFrame:
    """Match training column order (sklearn usually aligns by name; this avoids edge cases)."""
    if not column_order:
        return X
    missing = [c for c in column_order if c not in X.columns]
    if missing:
        logger.warning("feature_columns.json lists columns not in inference row: %s", missing)
        return X
    return X[list(column_order)]


def _lookup_encoded(meta: dict, raw_key: str, enc_key: str, raw_val: str) -> float:
    """Map raw string to dataset-style encoded float using training lookups."""
    medians = meta.get("medians") or {}
    fallback = float(medians.get(enc_key, 0.0))
    lk = (meta.get("lookups") or {}).get(f"{raw_key}_to_{enc_key}")
    if not lk:
        return fallback
    if raw_val in lk:
        return float(lk[raw_val])
    # case-insensitive
    rl = raw_val.strip().lower()
    for k, v in lk.items():
        if str(k).strip().lower() == rl:
            return float(v)
    return fallback


def _build_feature_row(car_data: dict, meta: dict) -> pd.DataFrame:
    """Build a single-row DataFrame matching training columns."""
    year = int(car_data.get("year") or 2020)
    make = str(car_data.get("make") or "").strip()
    model = str(car_data.get("model") or "").strip()
    trim = str(car_data.get("trim") or "").strip()
    mileage = float(car_data.get("mileage") or 0)
    engine_size = float(car_data.get("engine_size") or 2.0)
    cylinders = int(car_data.get("cylinders") or 4)
    condition = str(car_data.get("condition") or "Used").strip()
    fuel_type = str(car_data.get("fuel_type") or "Gasoline").strip()
    location = str(car_data.get("location") or "Baghdad").strip()
    mileage_unit = str(car_data.get("mileage_unit") or "km").strip()
    color = str(car_data.get("color") or "Unknown").strip()
    transmission = str(car_data.get("transmission") or "Unknown").strip()

    title = f"{year} {make} {model} {trim}".strip() if trim else f"{year} {make} {model}".strip()

    scraped_ordinal = float(meta.get("median_scraped_ordinal", 0.0))

    cond_enc = _lookup_encoded(meta, "condition", "condition_encoded", condition)
    fuel_enc = _lookup_encoded(meta, "fuel_type", "fuel_type_encoded", fuel_type)
    loc_enc = _lookup_encoded(meta, "location", "location_encoded", location)

    car_age_years = float(max(0, CURRENT_YEAR - year))
    mile = max(0.0, mileage)
    mpy = mile / max(car_age_years, 0.5) if car_age_years > 0 else mile
    log_mileage = float(np.log1p(mile))
    inv_sqrt_mileage = float(1.0 / np.sqrt(max(mile, 1.0)))
    age_of_car = car_age_years

    row = {
        "title": title,
        "make": make,
        "model": model,
        "trim": trim if trim else "Base",
        "mileage_unit": mileage_unit,
        "location": location,
        "condition": condition,
        "fuel_type": fuel_type,
        "color": color,
        "transmission": transmission,
        "year": year,
        "mileage": mile,
        "engine_size": engine_size,
        "cylinders": cylinders,
        "condition_encoded": cond_enc,
        "fuel_type_encoded": fuel_enc,
        "location_encoded": loc_enc,
        "age_of_car": age_of_car,
        "scraped_ordinal": scraped_ordinal,
        "car_age_years": car_age_years,
        "mileage_per_year": float(mpy),
        "log_mileage": log_mileage,
        "inv_sqrt_mileage": inv_sqrt_mileage,
    }
    return pd.DataFrame([row])


def _predict_from_dataset(car_data: dict) -> float:
    """Estimate price from dataset when the ML pipeline is unavailable."""
    try:
        from app.services.dataset_loader import DatasetLoader

        loader = DatasetLoader.get_instance()
        df = loader.dataset
        if df is None or len(df) == 0:
            return 20000.0
        price_col = loader.get_price_column() or "price"
        if price_col not in df.columns:
            return 20000.0
        make = str(car_data.get("make", "")).strip()
        model_name = str(car_data.get("model", "")).strip()
        year = int(car_data.get("year", 2020))
        mileage = car_data.get("mileage")
        if mileage is None or (isinstance(mileage, float) and np.isnan(mileage)):
            mileage = 50000
        mileage = float(mileage)
        mask = pd.Series(True, index=df.index)
        if make:
            mask &= df["make"].astype(str).str.strip().str.lower() == make.lower()
        if model_name:
            mask &= df["model"].astype(str).str.strip().str.lower() == model_name.lower()
        mask &= df["year"].astype(int) == year
        subset = df.loc[mask]
        if len(subset) == 0:
            subset = df[
                (df["make"].astype(str).str.strip().str.lower() == make.lower())
                & (df["model"].astype(str).str.strip().str.lower() == model_name.lower())
            ]
        if len(subset) == 0:
            subset = df[df["make"].astype(str).str.strip().str.lower() == make.lower()]
        if len(subset) == 0:
            subset = df
        prices = subset[price_col].dropna()
        if len(prices) == 0:
            return 20000.0
        mean_price = float(prices.mean())
        mean_mileage = subset["mileage"].mean() if "mileage" in subset.columns else 50000
        if pd.notna(mean_mileage) and mean_mileage > 0:
            ratio = mean_mileage / max(mileage, 1000)
            ratio = min(2.0, max(0.5, ratio))
            estimate = mean_price * ratio
        else:
            estimate = mean_price
        return float(max(500, min(1000000, estimate)))
    except Exception as e:
        logger.warning("Dataset fallback failed: %s", e)
        return 20000.0


def predict_price(car_data: dict, return_confidence: bool = False) -> float:
    """
    Predict price using the trained sklearn Pipeline.

    Args:
        car_data: Vehicle features from the API (make, model, year, mileage, etc.)
        return_confidence: Reserved for future use.

    Returns:
        Predicted price in USD.
    """
    _ = return_confidence
    try:
        pipeline, meta = load_model()
        if pipeline is None:
            return _predict_from_dataset(car_data)

        X = _align_feature_frame(_build_feature_row(car_data, meta), _cached_feature_columns)
        pred = pipeline.predict(X)
        price = float(pred[0]) if hasattr(pred, "__len__") else float(pred)

        if not np.isfinite(price) or price < 100:
            logger.warning("Invalid pipeline output %s; using dataset fallback", price)
            return _predict_from_dataset(car_data)
        if price > 2_000_000:
            price = min(price, 2_000_000.0)

        return price
    except Exception as e:
        logger.error("predict_price error: %s", e, exc_info=True)
        try:
            return _predict_from_dataset(car_data)
        except Exception:
            return 15000.0


def preload_model() -> None:
    """Load pipeline at app startup (always clears cache first so new deploys pick up fresh artifacts)."""
    try:
        clear_prediction_model_cache()
        load_model()
    except Exception as e:
        logger.warning("preload_model failed: %s", e)
