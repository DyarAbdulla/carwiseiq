#!/usr/bin/env python3
"""
Train Kurdistan/Iraq car price model from local cleaned_car_data.csv only.
Saves model, scaler, encoders, and metadata to backend/models/ for production inference.
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.base import clone
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

warnings.filterwarnings("ignore", category=UserWarning)

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
BACKEND_MODELS = ROOT / "backend" / "models"

DATA_CANDIDATES = [
    ROOT / "cleaned_car_data.csv",
    ROOT / "data" / "cleaned_car_data.csv",
    BACKEND_MODELS.parent / "cleaned_car_data.csv",
]

CURRENT_YEAR = 2026
RANDOM_STATE = 42


def resolve_data_path() -> Path:
    for p in DATA_CANDIDATES:
        if p.exists() and p.is_file():
            return p
    raise FileNotFoundError(
        "Could not find cleaned_car_data.csv. Expected one of: "
        + ", ".join(str(p) for p in DATA_CANDIDATES)
    )


def load_and_inspect(path: Path) -> pd.DataFrame:
    print("\n=== LOADING DATASET ===")
    df = pd.read_csv(path)
    print(f"Path: {path}")
    print(f"Shape: {df.shape}")
    print("Columns:", list(df.columns))
    print("\nDtypes:\n", df.dtypes)
    print("\nFirst 10 rows:")
    print(df.head(10).to_string())
    return df


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["car_age_years"] = (CURRENT_YEAR - pd.to_numeric(out["year"], errors="coerce")).clip(lower=0)
    mile = pd.to_numeric(out["mileage"], errors="coerce").fillna(0)
    out["mileage_per_year"] = mile / np.maximum(out["car_age_years"].replace(0, np.nan), 0.5)
    out["mileage_per_year"] = out["mileage_per_year"].fillna(mile / 1.0)
    out["log_mileage"] = np.log1p(mile.clip(lower=0))
    # Non-leaky "efficiency" style feature (uses list price only indirectly via row context)
    out["inv_sqrt_mileage"] = 1.0 / np.sqrt(mile.clip(lower=1.0))
    return out


def preprocess_frame(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Impute missing, IQR price filter, return frame and lookup dicts for inference."""
    print("\n=== PREPROCESSING ===")
    df = df.copy()
    if "price" not in df.columns:
        raise ValueError("Dataset must contain a 'price' column")

    # Ensure optional columns exist (dataset may lack color/transmission)
    if "color" not in df.columns:
        df["color"] = "Unknown"
    else:
        df["color"] = df["color"].fillna("Unknown").astype(str)

    if "transmission" not in df.columns:
        df["transmission"] = "Unknown"
    else:
        df["transmission"] = df["transmission"].fillna("Unknown").astype(str)

    # Parse scraped_date
    if "scraped_date" in df.columns:
        df["scraped_date"] = pd.to_datetime(df["scraped_date"], errors="coerce")
        median_ts = df["scraped_date"].median()
        df["scraped_date"] = df["scraped_date"].fillna(median_ts)
        df["scraped_ordinal"] = df["scraped_date"].astype("int64") // 10**9
    else:
        df["scraped_ordinal"] = 0.0

    # Title fallback
    if "title" not in df.columns:
        df["title"] = ""

    df = add_engineered_features(df)

    # Target: drop invalid prices
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    before = len(df)
    df = df[df["price"].notna() & (df["price"] > 0)]
    print(f"Dropped rows with missing/non-positive price: {before - len(df)}")

    # Domain-only price bounds. IQR-based removal was incorrectly chopping the entire
    # luxury tail (upper fence ~48k on this market), so SUVs / imports never appeared
    # in training and the model capped around mid-range economy prices.
    before = len(df)
    df = df[(df["price"] >= 300) & (df["price"] <= 3_000_000)]
    print(
        f"Price domain filter [300, 3_000_000]: removed {before - len(df)} rows, kept {len(df)}"
    )

    # Median/mode imputation per column
    for col in df.columns:
        if col == "price":
            continue
        if df[col].dtype == object or str(df[col].dtype) == "string":
            mode = df[col].mode()
            fill = mode.iloc[0] if len(mode) else ""
            df[col] = df[col].fillna(fill)
        else:
            med = df[col].median()
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].fillna(med)

    # Lookup tables for redundant encoded columns at inference (string -> typical encoded)
    lookups: dict = {}
    for enc_col, raw_col in [
        ("condition_encoded", "condition"),
        ("fuel_type_encoded", "fuel_type"),
        ("location_encoded", "location"),
    ]:
        if enc_col in df.columns and raw_col in df.columns:
            g = df.groupby(raw_col, observed=False)[enc_col].median()
            lookups[f"{raw_col}_to_{enc_col}"] = g.to_dict()

    meta = {
        "median_scraped_ordinal": float(df["scraped_ordinal"].median()),
        "lookups": lookups,
    }
    return df, meta


def build_feature_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str], list[str]]:
    """Return X with feature columns only (no price)."""
    drop_cols = {"price"}
    feature_cols = [c for c in df.columns if c not in drop_cols]
    # Drop raw datetime if present
    if "scraped_date" in feature_cols:
        feature_cols.remove("scraped_date")
    X = df[feature_cols].copy()
    cat_cols = [c for c in feature_cols if X[c].dtype == object or str(X[c].dtype) == "string"]
    num_cols = [c for c in feature_cols if c not in cat_cols]
    return X, cat_cols, num_cols


def try_import_xgb_lgbm():
    xgb = None
    lgb = None
    try:
        import xgboost as xgb_module

        xgb = xgb_module
    except ImportError:
        pass
    try:
        import lightgbm as lgb_module

        lgb = lgb_module
    except ImportError:
        pass
    return xgb, lgb


def main() -> int:
    data_path = resolve_data_path()
    df_raw = load_and_inspect(data_path)
    df, meta = preprocess_frame(df_raw)

    y = df["price"].astype(float).values
    X_df, cat_cols, num_cols = build_feature_matrix(df)
    print(f"\nCategorical features ({len(cat_cols)}):", cat_cols)
    print(f"Numeric features ({len(num_cols)}):", num_cols)

    X_train, X_test, y_train, y_test = train_test_split(
        X_df, y, test_size=0.2, random_state=RANDOM_STATE
    )
    print(f"\nTrain size: {len(X_train)}, Test size: {len(X_test)}")

    ordinal = OrdinalEncoder(
        handle_unknown="use_encoded_value",
        unknown_value=-1,
        max_categories=20000,
    )
    preprocess = ColumnTransformer(
        transformers=[
            ("cat", ordinal, cat_cols),
            ("num", "passthrough", num_cols),
        ],
        remainder="drop",
        sparse_threshold=0,
    )

    scaler = StandardScaler()
    xgb_mod, lgb_mod = try_import_xgb_lgbm()

    candidates: list[tuple[str, object]] = [
        (
            "rf",
            RandomForestRegressor(
                n_estimators=400,
                max_depth=None,
                min_samples_leaf=2,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            ),
        ),
        (
            "gbr",
            GradientBoostingRegressor(
                random_state=RANDOM_STATE,
                max_depth=5,
                n_estimators=300,
                learning_rate=0.06,
            ),
        ),
    ]

    if xgb_mod is not None:
        tree_method = "hist"
        try:
            import torch

            _ = torch.cuda.is_available()
        except Exception:
            pass
        candidates.append(
            (
                "xgb",
                xgb_mod.XGBRegressor(
                    n_estimators=500,
                    max_depth=10,
                    learning_rate=0.05,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                    tree_method=tree_method,
                ),
            )
        )

    if lgb_mod is not None:
        candidates.append(
            (
                "lgb",
                lgb_mod.LGBMRegressor(
                    n_estimators=600,
                    max_depth=-1,
                    learning_rate=0.05,
                    num_leaves=128,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                    verbose=-1,
                ),
            )
        )

    best_name = None
    best_pipe = None
    best_r2 = -np.inf

    print("\n=== BASELINE MODEL COMPARISON (hold-out) ===")
    for name, est in candidates:
        pipe = Pipeline(
            steps=[
                ("prep", preprocess),
                ("scale", scaler),
                ("model", est),
            ]
        )
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)
        r2 = r2_score(y_test, pred)
        mae = mean_absolute_error(y_test, pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
        print(f"  {name}: R2={r2:.4f} MAE={mae:.2f} RMSE={rmse:.2f}")
        if r2 > best_r2:
            best_r2 = r2
            best_name = name
            best_pipe = pipe

    assert best_pipe is not None and best_name is not None

    print(f"\nBest base model: {best_name} (R2={best_r2:.4f})")

    # Hyperparameter tuning on best family
    print("\n=== RANDOMIZED SEARCH (best estimator) ===")
    base_est = best_pipe.named_steps["model"]
    param_grid: dict = {}
    if best_name == "rf":
        param_grid = {
            "model__n_estimators": [300, 500, 700],
            "model__max_depth": [20, 30, None],
            "model__min_samples_leaf": [1, 2, 4],
        }
    elif best_name == "gbr":
        param_grid = {
            "model__n_estimators": [200, 400, 600],
            "model__learning_rate": [0.03, 0.06, 0.1],
            "model__max_depth": [3, 5, 7],
        }
    elif best_name == "xgb":
        param_grid = {
            "model__n_estimators": [400, 600, 800],
            "model__max_depth": [6, 10, 14],
            "model__learning_rate": [0.03, 0.05, 0.08],
            "model__subsample": [0.8, 0.9],
            "model__colsample_bytree": [0.8, 0.95],
        }
    elif best_name == "lgb":
        param_grid = {
            "model__n_estimators": [500, 800],
            "model__num_leaves": [64, 128, 256],
            "model__learning_rate": [0.03, 0.05, 0.08],
            "model__subsample": [0.8, 0.9],
        }

    search = RandomizedSearchCV(
        Pipeline(
            steps=[
                ("prep", clone(preprocess)),
                ("scale", StandardScaler()),
                ("model", clone(base_est)),
            ]
        ),
        param_distributions=param_grid,
        n_iter=min(24, max(12, 4 * max(1, len(param_grid)))),
        cv=3,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        scoring="r2",
        verbose=1,
    )
    search.fit(X_train, y_train)
    final_pipe: Pipeline = search.best_estimator_
    print("Best params:", search.best_params_)
    print("Best CV R2:", search.best_score_)

    y_pred = final_pipe.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    print(f"\n=== TEST METRICS ===\nR2: {r2:.4f}\nMAE: {mae:.2f}\nRMSE: {rmse:.2f}")

    # Sample comparison
    print("\n=== 20 RANDOM TEST SAMPLES (actual vs pred) ===")
    rng = np.random.RandomState(RANDOM_STATE)
    idx = rng.choice(len(y_test), size=min(20, len(y_test)), replace=False)
    for i in idx:
        print(f"  actual={y_test[i]:,.0f}  pred={y_pred[i]:,.0f}")

    BACKEND_MODELS.mkdir(parents=True, exist_ok=True)

    # Extract scaler & encoders for separate files (as requested)
    prep: ColumnTransformer = final_pipe.named_steps["prep"]
    scale: StandardScaler = final_pipe.named_steps["scale"]
    model = final_pipe.named_steps["model"]

    joblib.dump(final_pipe, BACKEND_MODELS / "price_prediction_pipeline.joblib")
    joblib.dump(scale, BACKEND_MODELS / "feature_scaler.joblib")
    joblib.dump(prep, BACKEND_MODELS / "column_transformer.joblib")
    joblib.dump(model, BACKEND_MODELS / "regressor_model.joblib")

    feature_list = list(X_df.columns)
    with open(BACKEND_MODELS / "feature_columns.json", "w", encoding="utf-8") as f:
        json.dump(
            {
                "feature_columns": feature_list,
                "categorical_columns": cat_cols,
                "numeric_columns": num_cols,
            },
            f,
            indent=2,
        )

    meta["medians"] = {
        "condition_encoded": float(df["condition_encoded"].median()),
        "fuel_type_encoded": float(df["fuel_type_encoded"].median()),
        "location_encoded": float(df["location_encoded"].median()),
    }
    with open(BACKEND_MODELS / "inference_meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    model_info = {
        "metrics": {
            "test": {
                "r2": float(r2),
                "mae": float(mae),
                "rmse": float(rmse),
            },
            "best_model": best_name,
            "tuned_params": search.best_params_,
            "target_r2_note": "Real market listings often land below 0.95 R2; tune features/data for gains.",
        },
        "feature_columns": feature_list,
        "current_year": CURRENT_YEAR,
        "data_path": str(data_path),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
    }
    with open(BACKEND_MODELS / "model_info.json", "w", encoding="utf-8") as f:
        json.dump(model_info, f, indent=2)

    # Back-compat single pickle name expected by older loader
    import pickle

    with open(BACKEND_MODELS / "production_model.pkl", "wb") as f:
        pickle.dump(
            {
                "pipeline": final_pipe,
                "version": 2,
                "kind": "sklearn_pipeline",
            },
            f,
        )

    print("\n=== POST-TRAINING: LOAD + 10 ROW PREDICTIONS ===")
    loaded = joblib.load(BACKEND_MODELS / "price_prediction_pipeline.joblib")
    sample = X_df.sample(10, random_state=RANDOM_STATE)
    actual = df.loc[sample.index, "price"].values
    pred10 = loaded.predict(sample)
    for i in range(len(sample)):
        print(f"  row {sample.index[i]}: actual={actual[i]:,.0f}  pred={pred10[i]:,.0f}")

    print(f"\nSaved artifacts under: {BACKEND_MODELS}")
    print("Done.")
    if r2 < 0.95:
        print(
            f"\nNote: Test R2 is {r2:.4f} (< 0.95). "
            "Consider more features, cleaner labels, or longer tuning; market data is noisy."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
