# Model Retraining Summary - Fix $89,902 Overpricing Issue

## 🔍 Problem Analysis

**Issue**: Model predicts **$89,902** for 2024 Chery Tiggo 7 Pro (15,000 km)  
**Market Average**: **$17,163**  
**Overpricing Factor**: **5.2x** (523% higher than market)

## 📍 Key File Locations

### 1. Training Scripts
- **Main Training**: `core/model_training.py` ✅ (RECOMMENDED)
- **Fast Training**: `fast_retrain.py` (simpler, faster)
- **V4 Training**: `train_model_v4_optimized.py` (advanced with image features)

### 2. Model Files (Saved After Training)
- **Location**: `models/` directory (project root)
- **Priority Order**:
  1. `models/best_model_v4.pkl` (highest - will load first)
  2. `models/best_model_v3.pkl`
  3. `models/best_model_v2.pkl` ✅ (saved by main training script)
  4. `models/car_price_model.pkl`
  5. `models/best_model.pkl` (lowest)

### 3. Dataset Files
- **Training uses**: `cleaned_car_data.csv` (root) or `data/cleaned_car_data.csv`
- **Backend uses**: `data/final_dataset_with_images.csv` or `data/cleaned_car_data.csv`

### 4. Validation Scripts (Created)
- `validate_training_data.py` - Check training data prices
- `check_model_metrics.py` - Check current model metrics

## 📊 Current Model Metrics

Based on backend logs:
- **Model RMSE**: $5,952.57
- **Model R²**: 0.8376 (83.76%)
- **Model Version**: v4 (or v2)
- **Issue**: High RMSE suggests model accuracy problems

## 🚀 Retraining Steps

### Step 1: Validate Training Data
```bash
python validate_training_data.py
```

**What to check**:
- Mean price should be $15,000 - $30,000 (realistic range)
- Chery Tiggo 7 Pro 2024 prices should be $10,000 - $25,000
- No prices > $100,000 for regular cars
- No prices < $100 (likely errors)

### Step 2: Check Current Model
```bash
python check_model_metrics.py
```

**What to see**:
- Which model file is loaded
- Current R², RMSE, MAE metrics
- Model training date

### Step 3: Retrain Model
```bash
# From project root
python core/model_training.py
```

**What happens**:
1. Loads dataset from `cleaned_car_data.csv` or `data/cleaned_car_data.csv`
2. Applies feature engineering
3. Removes outliers (IQR method)
4. Trains multiple models (Random Forest, XGBoost, etc.)
5. Selects best model based on R² score
6. Saves to `models/best_model_v2.pkl`

**Expected output**:
```
STEP 1: Loading and preparing data...
Dataset loaded: XX,XXX rows, XX columns

STEP 3: Training multiple models...
1. Training Linear Regression...
   R² Score: 0.XXXX
2. Training Random Forest Regressor...
   R² Score: 0.XXXX
...

STEP 10: Saving improved model (V2)...
[OK] Improved model saved to: models/best_model_v2.pkl

Model Comparison Table:
Model                  R² Score    RMSE ($)      MAE ($)
Random Forest (Tuned)  0.XXXX      $X,XXX.XX    $X,XXX.XX
```

### Step 4: Verify New Model
```bash
# Check metrics
python check_model_metrics.py

# Restart backend
# Test prediction for Chery Tiggo 7 Pro 2024
```

## ⚠️ Important Checks Before Retraining

### 1. Dataset Price Validation
Run `validate_training_data.py` and check:
- ✅ Mean price is realistic ($15k-$30k)
- ✅ No extreme outliers (> $100k for regular cars)
- ✅ Chery Tiggo 7 Pro 2024 prices are reasonable ($10k-$25k)

### 2. Dataset Location
Ensure dataset exists:
```bash
# Check if dataset exists
ls cleaned_car_data.csv
ls data/cleaned_car_data.csv
ls data/final_dataset_with_images.csv
```

### 3. Model Directory
Ensure models directory exists:
```bash
mkdir -p models
```

## 🎯 Expected Results After Retraining

### Good Model Metrics
- **R² Score**: 0.50 - 0.85 ✅
- **RMSE**: $3,000 - $7,000 ✅ (lower is better)
- **MAE**: $2,000 - $5,000 ✅ (lower is better)

### Good Predictions
- **2024 Chery Tiggo 7 Pro, 15,000 km**: **$15,000 - $20,000** ✅
- **Within ±20% of market average** ($17,163) ✅
- **No predictions > $50,000** for this car ✅

## 🔧 Troubleshooting

### Issue: "cleaned_car_data.csv not found"
**Solution**: 
```bash
# Copy dataset to root
cp data/cleaned_car_data.csv cleaned_car_data.csv
# OR
cp data/final_dataset_with_images.csv cleaned_car_data.csv
```

### Issue: Model still overpricing after retraining
**Possible causes**:
1. **Training data has inflated prices** → Run `validate_training_data.py`
2. **Wrong dataset used** → Check which dataset was loaded during training
3. **Feature encoding mismatch** → Verify encoders match between training and prediction
4. **Model not replaced** → Ensure new model file overwrites old one

### Issue: Training takes too long
**Solution**: Use fast retraining:
```bash
python fast_retrain.py
```

## 📝 Quick Reference

### Files Created
- ✅ `validate_training_data.py` - Validate dataset prices
- ✅ `check_model_metrics.py` - Check current model metrics
- ✅ `MODEL_RETRAINING_GUIDE.md` - Detailed guide
- ✅ `MODEL_RETRAINING_SUMMARY.md` - This file

### Training Script Location
- **Main**: `core/model_training.py` (line 68-74)
- **Saves to**: `models/best_model_v2.pkl` (line 755)

### Model Loading Priority
The prediction system loads models in this order (from `core/predict_price.py` line 38-47):
1. `models/best_model_v4.pkl`
2. `models/best_model_v3.pkl`
3. `models/best_model_v2.pkl` ✅ (saved by training)
4. `models/car_price_model.pkl`
5. `models/best_model.pkl`

## 🎬 Next Steps

1. **Run validation**: `python validate_training_data.py`
2. **Check current model**: `python check_model_metrics.py`
3. **Retrain model**: `python core/model_training.py`
4. **Verify new model**: `python check_model_metrics.py`
5. **Test prediction**: Restart backend and test Chery Tiggo 7 Pro 2024
6. **Expected result**: Prediction should be **$15,000 - $20,000** (close to $17,163 market average)
