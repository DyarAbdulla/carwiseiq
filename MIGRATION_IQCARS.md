# IQCars Dataset Migration

## Overview
This migration updates the project to use the new IQCars datasets exclusively, replacing old datasets and models with a clean, production-ready setup.

## Changes Made

### 1. Data Pipeline (`core/pipelines/iqcars_pipeline.py`)
- Merges 3 IQCars CSV files (`iqcars1.csv`, `iqcars2.csv`, `iqcars3.csv`)
- Cleans schema: normalizes column names, drops unwanted columns (`listing_id`, `price_iqd`, `phone_number`, `showroom`, `description`)
- Parses numeric columns robustly:
  - Year: 1990 to current_year+1
  - Mileage: strips "km", commas; converts to int
  - Price: uses `price_usd` column, handles formats like "$12,300", "12300", "12,300 USD"
- Removes outliers:
  - Price: $500 to $300,000 USD
  - Mileage: max 1,000,000 km
  - Optional quantile trimming (1%-99%) per make
- Feature engineering: adds `age_of_car` feature
- Outputs:
  - `data/iqcars_merged_raw.csv` - Raw merged dataset
  - `data/iqcars_cleaned.csv` - Final cleaned training dataset

### 2. Visualization Report (`core/pipelines/iqcars_report.py`)
- Generates plots:
  - Price distribution (linear and log scale)
  - Price vs Year scatter
  - Price vs Mileage scatter
  - Boxplot price by top 10 makes
  - Correlation heatmap
- Creates markdown report: `reports/data_report.md`
- Saves plots to: `reports/plots/*.png`

### 3. GPU Detection (`core/gpu.py`)
- Detects NVIDIA GPU availability
- Returns GPU info (name, availability)
- Used by training script for GPU/CPU fallback

### 4. Retrain Script (`core/retrain_iqcars.py`)
- Loads `data/iqcars_cleaned.csv`
- Uses CatBoost (preferred) or LightGBM/XGBoost fallback
- GPU support with automatic CPU fallback
- KFold cross-validation (5 folds)
- Saves:
  - `models/production_model.pkl` - Production model
  - `models/encoders.pkl` - Label encoders (if needed)
  - `models/model_info.json` - Model metadata
  - `models/model_performance.json` - Evaluation metrics

### 5. Backend Updates
- **`core/predict_price.py`**: Updated to prioritize `models/production_model.pkl`
- **`backend/app/api/routes/model_info.py`**: Updated to show production model info
- **`backend/middleware/rate_limit.py`**: Bypasses rate limiting for localhost in development mode

### 6. Frontend Fixes
- **`frontend/i18n.ts`**: Removed trailingSlash config (handled by next.config.js)
- Budget page: No syntax errors found (may have been transient)

### 7. Archive Structure
Old datasets and models moved to:
- `data/_archive/` - Old datasets
- `models/_archive/` - Old models

## Usage

### Step 1: Run Data Pipeline
```bash
python core/pipelines/iqcars_pipeline.py
```

### Step 2: Generate Report (Optional)
```bash
python core/pipelines/iqcars_report.py
```

### Step 3: Retrain Model
```bash
python core/retrain_iqcars.py
```

### Step 4: Start Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Step 5: Start Frontend
```bash
cd frontend
npm run dev
```

## Verification

After retraining, verify:
1. `/api/health` returns OK
2. `/api/model-info` shows production model info
3. `/api/predict` returns realistic prices ($500-$300,000 range)
4. No 429 errors in development mode
5. Budget page compiles without errors

## Model Features

The production model uses:
- **Required**: `make`, `model`, `year`, `mileage`
- **Optional**: `engine_size`, `cylinders`, `condition`, `fuel_type`, `location`, `age_of_car`

If optional features don't exist in IQCars dataset, they're gracefully handled by dropping those features.

## Notes

- Old models are archived, not deleted
- Production model is saved as `production_model.pkl` (single source of truth)
- GPU training automatically falls back to CPU if GPU unavailable
- Rate limiting disabled for localhost in development mode
