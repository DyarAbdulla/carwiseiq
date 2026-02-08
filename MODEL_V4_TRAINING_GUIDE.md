# Model V4 Training Guide - Target: 85-90% Accuracy

## Overview

This script implements advanced optimizations to push model accuracy from 83% to 85-90%:

### Key Features:
1. ✅ **Advanced Feature Engineering** - 18+ new features
2. ✅ **Optuna Hyperparameter Tuning** - 100 trials per model
3. ✅ **CatBoost Support** - Better categorical handling
4. ✅ **Ensemble Methods** - Weighted & Stacking ensembles
5. ✅ **Price Range Segmentation** - Separate models for budget/luxury
6. ✅ **10-Fold Cross-Validation** - Robust evaluation

---

## Installation

```bash
pip install optuna catboost lightgbm xgboost scikit-learn pandas numpy
```

---

## Usage

### Basic Training
```bash
python train_model_v4_optimized.py
```

### Expected Output
- Hyperparameter optimization (100 trials each)
- Model training (XGBoost, CatBoost, LightGBM)
- Ensemble creation
- Price range segmentation
- Model saving

### Training Time
- **Hyperparameter Optimization**: ~2-4 hours (100 trials × 2 models)
- **Model Training**: ~30-60 minutes
- **Total**: ~3-5 hours

---

## Advanced Features Created

### 1. Age-Based Depreciation
- `new_car_penalty`: 0.85 (0-1 year), 0.75 (2-3), 0.65 (4-5), etc.
- Captures depreciation curves

### 2. Mileage Analysis
- `mileage_per_year`: Annual mileage rate
- `high_mileage_flag`: Flag for high annual mileage

### 3. Brand Classification
- `is_luxury_brand`: Mercedes, BMW, Audi, Porsche, etc.
- `is_premium_brand`: Acura, Infiniti, Volvo, etc.

### 4. Market Segmentation
- `market_segment`: luxury, sports, truck, SUV, economy, mid-range

### 5. Condition Encoding
- `condition_numeric`: 6 (New) to 0 (Salvage)

### 6. Popularity Flags
- `is_popular_model`: Top 20% most common models

### 7. Interaction Features
- `year_mileage_interaction`
- `engine_cylinders_interaction`
- `luxury_age_interaction`
- `condition_age_interaction`

---

## Model Comparison

The script trains and compares:
1. **XGBoost** (optimized)
2. **CatBoost** (optimized)
3. **LightGBM**
4. **Ensemble (XGBoost + CatBoost)** - 60/40 weighted
5. **Ensemble (3 Models)** - 40/30/30 weighted
6. **Stacking Ensemble** - Ridge meta-learner

Best model is automatically selected based on R² score.

---

## Price Range Segmentation

Separate models trained for:
- **Budget**: <$15,000
- **Mid-Range**: $15,000-$35,000
- **Luxury**: $35,000-$75,000
- **Ultra-Luxury**: >$75,000

Each range has different pricing dynamics, improving accuracy.

---

## Output Files

### Models Saved:
1. `models/best_model_v4.pkl` - Best performing model
2. `models/xgboost_model_v4.pkl` - XGBoost model
3. `models/catboost_model_v4.pkl` - CatBoost model (if available)
4. `models/lightgbm_model_v4.pkl` - LightGBM model (if available)
5. `models/ensemble_*_model_v4.pkl` - Ensemble models

### Metadata:
- `models/model_v4_info.json` - Complete model information

---

## Target Metrics

- ✅ **R² ≥ 0.85** (85%+ accuracy)
- ✅ **RMSE < $5,000**
- ✅ **MAE < $3,000**
- ✅ **MAPE < 10%**

---

## Monitoring Progress

Check `model_training_v4.log` for detailed logs:
```bash
tail -f model_training_v4.log
```

---

## Troubleshooting

### Optuna Not Available
- Script falls back to default hyperparameters
- Install: `pip install optuna`

### CatBoost Not Available
- Script skips CatBoost training
- Install: `pip install catboost`

### Out of Memory
- Reduce `OPTUNA_TRIALS` (default: 100)
- Reduce dataset size for testing

### Slow Training
- Reduce `OPTUNA_TRIALS` to 50 or 25
- Use smaller dataset for initial testing

---

## Next Steps After Training

1. **Verify Model Files**
   ```bash
   ls models/best_model_v4.pkl
   ```

2. **Check Metrics**
   ```bash
   cat models/model_v4_info.json
   ```

3. **Update Prediction Code**
   - Update `core/predict_price.py` to load v4 model
   - Add v4 to model priority list

4. **Test Predictions**
   ```python
   from core.predict_price import predict_price
   # Test with sample car
   ```

---

## Expected Improvements

| Metric | Current (v3) | Target (v4) | Expected |
|--------|-------------|-------------|----------|
| R² Score | 0.8378 | ≥0.85 | +1.5% |
| RMSE | $6,080 | <$5,000 | -18% |
| MAE | ~$4,000 | <$3,000 | -25% |
| MAPE | ~12% | <10% | -17% |

---

## Notes

- **Hyperparameter Optimization**: Takes longest time but provides best results
- **Ensemble**: Usually performs better than individual models
- **Price Segmentation**: Improves accuracy for extreme price ranges
- **Feature Engineering**: Key to reaching 85%+ accuracy

---

## Success Criteria

✅ **Model achieves R² ≥ 0.85**
✅ **RMSE < $5,000**
✅ **All models saved successfully**
✅ **Price range models trained**

**Status**: Ready to train! 🚀
