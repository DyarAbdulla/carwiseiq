# IQCars Retrain Guide

## Quick Start

### 1. Run Data Pipeline
```bash
python core/pipelines/iqcars_pipeline.py
```
This will:
- Merge `data/iqcars1.csv`, `data/iqcars2.csv`, `data/iqcars3.csv`
- Clean and parse prices/mileage/years
- Remove outliers
- Save to `data/iqcars_cleaned.csv`

### 2. Generate Report (Optional)
```bash
python core/pipelines/iqcars_report.py
```
This creates visualizations and a markdown report in `reports/`.

### 3. Retrain Model
```bash
python core/retrain_iqcars.py
```
This will:
- Load `data/iqcars_cleaned.csv`
- Train CatBoost/LightGBM/XGBoost model
- Use GPU if available (auto-fallback to CPU)
- Perform 5-fold cross-validation
- Save to `models/production_model.pkl`

### 4. Start Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 5. Start Frontend
```bash
cd frontend
npm run dev
```

## Verification

After retraining, check:
1. **Health**: `curl http://127.0.0.1:8000/api/health`
2. **Model Info**: `curl http://127.0.0.1:8000/api/model-info`
3. **Prediction**: Test with realistic car data
4. **No 429 errors**: Rate limiting disabled for localhost in dev

## Files Created

### Data Files
- `data/iqcars_merged_raw.csv` - Raw merged dataset
- `data/iqcars_cleaned.csv` - Final cleaned training dataset

### Model Files
- `models/production_model.pkl` - Production model (single source of truth)
- `models/encoders.pkl` - Label encoders (if needed)
- `models/model_info.json` - Model metadata
- `models/model_performance.json` - Evaluation metrics

### Reports
- `reports/data_report.md` - Dataset summary report
- `reports/plots/1_price_distribution.png` - Price distribution
- `reports/plots/2_price_vs_year.png` - Price vs Year
- `reports/plots/3_price_vs_mileage.png` - Price vs Mileage
- `reports/plots/4_price_by_make.png` - Price by Make
- `reports/plots/5_correlation_heatmap.png` - Correlation matrix

## Archive Old Files (Optional)

To archive old datasets/models:
```bash
python scripts/archive_old_files.py
```

This moves old files to `data/_archive/` and `models/_archive/`.

## Troubleshooting

### GPU Not Detected
- Model will automatically use CPU
- Training will still work, just slower

### Missing Columns
- If optional columns (`engine_size`, `cylinders`, etc.) don't exist, they're gracefully handled
- Model will train with available features only

### Price Range Issues
- If predictions are unrealistic, check:
  1. Price parsing in pipeline (should use `price_usd` column)
  2. Outlier removal (should cap at $500-$300,000)
  3. Model training metrics (check `model_performance.json`)

## Model Features

**Required:**
- `make` - Car make/brand
- `model` - Car model
- `year` - Year (1990 to current_year+1)
- `mileage` - Mileage in km
- `price` - Target variable (USD)

**Optional:**
- `engine_size` - Engine size in liters
- `cylinders` - Number of cylinders
- `condition` - Condition (New, Used, etc.)
- `fuel_type` - Fuel type (Gasoline, Diesel, etc.)
- `location` - Location
- `age_of_car` - Calculated: current_year - year
