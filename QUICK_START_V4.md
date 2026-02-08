# Quick Start - Model V4 Training

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install optuna catboost lightgbm xgboost scikit-learn pandas numpy
```

### 2. Run Training
```bash
python train_model_v4_optimized.py
```

### 3. Expected Results
- **Target**: R² ≥ 0.85 (85%+ accuracy)
- **Training Time**: ~3-5 hours
- **Output**: `models/best_model_v4.pkl`

---

## ⚡ Fast Training (Testing)

For quick testing, reduce optimization trials:

```python
# Edit train_model_v4_optimized.py, change:
OPTUNA_TRIALS = 10  # Instead of 100
```

This reduces training time to ~30-60 minutes.

---

## 📊 What Gets Trained

1. **XGBoost** (Optuna optimized)
2. **CatBoost** (Optuna optimized)
3. **LightGBM**
4. **Ensemble (XGBoost + CatBoost)** - 60/40
5. **Ensemble (3 Models)** - 40/30/30
6. **Stacking Ensemble** - Ridge meta-learner

**Best model automatically selected!**

---

## 🎯 Features Added

- ✅ Luxury brand indicators
- ✅ Age-based depreciation curves
- ✅ Mileage per year analysis
- ✅ Market segmentation
- ✅ Condition numeric encoding
- ✅ Popular model flags
- ✅ Interaction features
- ✅ Price range segmentation

---

## 📁 Output Files

- `models/best_model_v4.pkl` - Best model
- `models/xgboost_model_v4.pkl` - XGBoost
- `models/catboost_model_v4.pkl` - CatBoost
- `models/lightgbm_model_v4.pkl` - LightGBM
- `models/model_v4_info.json` - Model info

---

## ✅ Success Criteria

- R² ≥ 0.85 ✅
- RMSE < $5,000 ✅
- MAE < $3,000 ✅
- MAPE < 10% ✅

---

## 🔍 Monitor Progress

```bash
# Watch log file
tail -f model_training_v4.log

# Or check console output
```

---

## 🎉 Ready to Train!

Just run:
```bash
python train_model_v4_optimized.py
```

The script will:
1. ✅ Create advanced features
2. ✅ Optimize hyperparameters (100 trials)
3. ✅ Train all models
4. ✅ Create ensembles
5. ✅ Train price range models
6. ✅ Save best model
7. ✅ Report results

**Good luck! 🚀**
