# Model Retraining Guide - Fix Overpricing Issue

## Problem
The model is predicting **$89,902** for a 2024 Chery Tiggo 7 Pro with 15,000 km, but the market average is only **$17,163**. This is a **5.2x overpricing** issue.

## Current Model Status

### Model Files Location
- **Models Directory**: `models/` (project root)
- **Backend Models**: `backend/app/models/` (if different)
- **Current Model**: Based on logs, using `best_model_v4.pkl` or `best_model_v2.pkl`

### Current Model Metrics (from logs)
- **Model RMSE**: $5,952.57
- **Model R²**: 0.8376 (83.76% variance explained)
- **Model Version**: v4 (or v2)

## Step 1: Validate Training Data Prices

### Run Data Validation Script
```bash
python validate_training_data.py
```

This will:
- Check price statistics (mean, median, min, max)
- Identify unrealistic prices (< $100 or > $200,000)
- Analyze Chery Tiggo 7 Pro 2024 prices specifically
- Flag potential data quality issues

### Expected Output
```
PRICE STATISTICS
Mean price: $XX,XXX.XX
Median price: $XX,XXX.XX
Minimum price: $X,XXX.XX
Maximum price: $XXX,XXX.XX
```

### Check for Issues
- **If mean price > $50,000**: Possible currency conversion error
- **If Chery Tiggo 7 Pro 2024 prices > $30,000**: Data may be inflated
- **If many prices > $100,000**: Check for data entry errors

## Step 2: Check Current Model Metrics

### Run Model Metrics Check
```bash
python check_model_metrics.py
```

This will show:
- Which model file is currently loaded
- Model accuracy (R², RMSE, MAE, MAPE)
- Model version and training date
- Feature count and transformation settings

## Step 3: Dataset Files

### Training Dataset Location
The training script (`core/model_training.py`) loads from:
- **Primary**: `cleaned_car_data.csv` (project root)
- **Backend uses**: `data/final_dataset_with_images.csv` or `data/cleaned_car_data.csv`

### Verify Dataset
```bash
# Check if dataset exists
ls -lh cleaned_car_data.csv
ls -lh data/cleaned_car_data.csv
ls -lh data/final_dataset_with_images.csv
```

## Step 4: Retrain the Model

### Main Training Script
**Location**: `core/model_training.py`

### How to Run
```bash
# From project root directory
cd "c:\Car price prection program Local E"
python core/model_training.py
```

### Training Process
The script will:
1. Load `cleaned_car_data.csv`
2. Apply feature engineering
3. Remove outliers using IQR method
4. Apply log transformation (log1p)
5. Train multiple models (Random Forest, XGBoost, LightGBM, etc.)
6. Select best model based on R² score
7. Save model to `models/best_model_v2.pkl` (or v4)

### Expected Training Output
```
STEP 1: Loading and preparing data...
Dataset loaded: XX,XXX rows, XX columns

STEP 2: Splitting data (80% train, 20% test)...
Training set: XX,XXX samples
Test set: XX,XXX samples

STEP 3: Training multiple models...
1. Training Linear Regression...
   R² Score: 0.XXXX
2. Training Random Forest Regressor...
   R² Score: 0.XXXX
...

STEP 10: Saving improved model (V2)...
[OK] Improved model saved to: models/best_model_v2.pkl

Model Comparison Table:
Model                  R² Score    RMSE ($)      MAE ($)       MAPE (%)
Random Forest (Tuned)  0.XXXX      $X,XXX.XX     $X,XXX.XX    XX.XX
```

### Training Time
- **Fast training**: ~5-10 minutes
- **Full training with hyperparameter tuning**: ~30-60 minutes

## Step 5: Verify New Model

### After Training
1. **Check model file was created**:
   ```bash
   ls -lh models/best_model_v2.pkl
   ```

2. **Check model metrics**:
   ```bash
   python check_model_metrics.py
   ```

3. **Test prediction**:
   - Restart backend server
   - Make a prediction for Chery Tiggo 7 Pro 2024
   - Check if prediction is closer to $17,163

## Step 6: Replace Old Model (if needed)

### Model Loading Priority
The system loads models in this order:
1. `models/best_model_v4.pkl` (highest priority)
2. `models/best_model_v3.pkl`
3. `models/best_model_v2.pkl`
4. `models/car_price_model.pkl`
5. `models/best_model.pkl` (lowest priority)

### To Use New Model
- The training script automatically saves to `best_model_v2.pkl`
- If you want to use v4, rename or copy:
  ```bash
  cp models/best_model_v2.pkl models/best_model_v4.pkl
  ```

## Troubleshooting

### Issue: Dataset not found
**Solution**: Ensure `cleaned_car_data.csv` exists in project root or run data cleaning first:
```bash
python data_cleaning.py
```

### Issue: Training fails with memory error
**Solution**: Reduce dataset size or use `fast_retrain.py`:
```bash
python fast_retrain.py
```

### Issue: Model still overpricing after retraining
**Possible Causes**:
1. **Training data has inflated prices** - Check with `validate_training_data.py`
2. **Feature encoding mismatch** - Verify location/make/model encoders match
3. **Model needs more data** - Check dataset size
4. **Outliers not removed** - Check IQR outlier removal is working

### Issue: Predictions are too low
**Solution**: Check if log transformation is being applied correctly (should use expm1)

## Quick Retrain Command

```bash
# Full retraining
python core/model_training.py

# Fast retraining (simpler model, faster)
python fast_retrain.py

# Check results
python check_model_metrics.py
python validate_training_data.py
```

## Expected Results After Retraining

### Good Model Metrics
- **R² Score**: 0.50 - 0.85 (realistic range)
- **RMSE**: $3,000 - $7,000 (lower is better)
- **MAE**: $2,000 - $5,000 (lower is better)
- **MAPE**: 10% - 25% (lower is better)

### Good Predictions
- **2024 Chery Tiggo 7 Pro, 15,000 km**: Should predict **$15,000 - $20,000**
- **Within ±20% of market average**: Acceptable
- **No predictions > $100,000** for regular cars

## Files Reference

### Training Scripts
- `core/model_training.py` - Main training script (full featured)
- `model_training.py` - Root level training script
- `fast_retrain.py` - Fast retraining (simpler model)
- `train_model_v4_optimized.py` - Advanced v4 training with image features

### Validation Scripts
- `validate_training_data.py` - Check training data prices
- `check_model_metrics.py` - Check current model metrics

### Dataset Files
- `data/cleaned_car_data.csv` - Cleaned dataset
- `data/final_dataset_with_images.csv` - Dataset with image URLs
- `cleaned_car_data.csv` - Root level dataset (used by training)

### Model Files
- `models/best_model_v4.pkl` - Latest model (highest priority)
- `models/best_model_v2.pkl` - V2 model
- `models/car_price_model.pkl` - Backup model
