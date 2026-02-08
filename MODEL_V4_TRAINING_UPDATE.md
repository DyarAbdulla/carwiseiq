# Model V4 Training Script - Updated for Pre-Extracted Image Features

## ✅ Updates Completed

### 1. **Pre-Extracted Image Features Integration**
- ✅ Loads image features directly from `data/image_features_optimized.npy` (57,603 × 512)
- ✅ Uses `image_metadata.csv` for row alignment verification
- ✅ No image re-extraction - uses cached features
- ✅ Handles missing images (8,098 zero vectors already in numpy array)

### 2. **Data Loading Pipeline**
- ✅ Loads CSV dataset from `data/final_dataset_with_images.csv`
- ✅ Loads pre-extracted image features (512 dimensions after PCA)
- ✅ Verifies alignment using `image_metadata.csv`
- ✅ Ensures dataset rows match image feature rows

### 3. **Feature Engineering**
- ✅ Advanced tabular features (18+ features):
  - Age-based depreciation curves
  - Mileage per year
  - Luxury/premium brand indicators
  - Market segment classification
  - Condition numeric encoding
  - Popular model flags
  - Interaction features
  - Brand popularity

### 4. **Feature Combination**
- ✅ Combines tabular features + image features
- ✅ Total features: ~18 tabular + 512 image = ~530 features
- ✅ Maintains proper alignment throughout

### 5. **Scaling Strategy**
- ✅ Scales ONLY tabular features using `RobustScaler`
- ✅ Keeps image features unchanged (already normalized by PCA)
- ✅ Prevents double-scaling of image features

### 6. **Model Training**
- ✅ Train/test split with `random_state=42`
- ✅ XGBoost with Optuna hyperparameter optimization (50 trials)
- ✅ LightGBM (if available)
- ✅ RandomForest (fallback)
- ✅ Metrics: R², RMSE, MAE, MAPE

### 7. **Model Saving**
- ✅ Saves best model to `models/best_model_v4.pkl`
- ✅ Saves scaler to `models/scaler_v4.pkl`
- ✅ Saves encoders to `models/encoders_v4.pkl`
- ✅ Saves model info to `models/model_v4_info.json`

---

## 📋 Key Features

### Row Alignment
- Uses `image_metadata.csv` to verify alignment
- Handles sequential (0..N-1) and non-sequential indices
- Ensures image features match correct car records

### Missing Image Handling
- 8,098 images missing (14%)
- Uses zero vectors already stored in numpy array
- Model learns to handle missing images gracefully

### Feature Scaling
- Tabular features: Scaled with `RobustScaler`
- Image features: Unchanged (already PCA-normalized)
- Prevents information loss from double-scaling

---

## 🚀 Usage

### Run Training:
```bash
python train_model_v4_optimized.py
```

### Expected Output:
- Model training logs in `model_training_v4.log`
- Best model saved to `models/best_model_v4.pkl`
- Model info saved to `models/model_v4_info.json`

### Target Metrics:
- **R² ≥ 0.85** (85%+ accuracy)
- **RMSE < $5,000**
- **MAE < $3,000**
- **MAPE < 10%**

---

## 📊 Data Flow

```
1. Load CSV Dataset (57,603 rows)
   ↓
2. Load Image Features (57,603 × 512)
   ↓
3. Verify Alignment (using image_metadata.csv)
   ↓
4. Create Advanced Tabular Features (18+ features)
   ↓
5. Combine Tabular + Image Features (~530 total)
   ↓
6. Train/Test Split (80/20, random_state=42)
   ↓
7. Scale Tabular Features Only
   ↓
8. Train Models (XGBoost, LightGBM, RandomForest)
   ↓
9. Select Best Model
   ↓
10. Save Model + Preprocessors
```

---

## ✅ Verification Checklist

- [x] Loads pre-extracted image features (no re-extraction)
- [x] Proper row alignment using metadata
- [x] Combines tabular + image features correctly
- [x] Scales only numeric features (not image vectors)
- [x] Handles missing images (zero vectors)
- [x] Train/test split with random_state=42
- [x] Saves model + preprocessors
- [x] Prints final metrics

---

## 📝 Notes

1. **No Image Re-Extraction**: The script uses pre-extracted features from `data/image_features_optimized.npy`. This saves ~30-60 minutes per training run.

2. **Alignment Guarantee**: Uses `image_metadata.csv` to ensure image features match the correct car records. The metadata has sequential indices (0..N-1), so alignment is straightforward.

3. **Missing Images**: 8,098 images (14%) are missing. These are already represented as zero vectors in the numpy array, so no special handling needed.

4. **Feature Scaling**: Only tabular features are scaled. Image features are kept unchanged since they're already PCA-normalized.

5. **Model Selection**: The script trains multiple models and selects the best one based on R² score.

---

## 🎯 Next Steps

1. **Run Training**: Execute `python train_model_v4_optimized.py`
2. **Monitor Progress**: Check `model_training_v4.log` for training progress
3. **Verify Results**: Check `models/model_v4_info.json` for final metrics
4. **Deploy Model**: Update `core/predict_price.py` to load v4 model

---

## 📁 Files Created/Updated

- ✅ `train_model_v4_optimized.py` - Updated training script
- ✅ `models/best_model_v4.pkl` - Best model (created after training)
- ✅ `models/scaler_v4.pkl` - Feature scaler
- ✅ `models/encoders_v4.pkl` - Label encoders
- ✅ `models/model_v4_info.json` - Model metadata

---

**Status**: ✅ Ready for training!
