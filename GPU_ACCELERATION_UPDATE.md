# GPU Acceleration & CPU Optimization Update

## Summary
Updated `train_model_v4_optimized.py` to use **full CPU + GPU acceleration** and **Optuna pruning** for much faster training.

## Changes Made

### 1. GPU Detection (`check_gpu_available()`)
- Added function to detect GPU availability for XGBoost
- Automatically falls back to CPU if GPU is not available
- Tests GPU by creating a small test model

### 2. XGBoost GPU Acceleration
**GPU Parameters Added:**
- `tree_method = "gpu_hist"` - Uses GPU for histogram-based tree construction
- `predictor = "gpu_predictor"` - Uses GPU for predictions
- `gpu_id = 0` - Uses first GPU device

**CPU Optimization:**
- `n_jobs = -1` - Uses ALL CPU cores for parallel processing

### 3. Optuna Pruning (MedianPruner)
- **Early stopping** for slow/bad trials
- Prunes trials that perform worse than the median
- Saves significant time by stopping unpromising trials early
- Configuration:
  - `n_startup_trials=5` - Don't prune first 5 trials
  - `n_warmup_steps=0` - Prune immediately if worse than median
  - `interval_steps=1` - Check every step

### 4. Updated Functions

#### `optimize_xgboost()`
- Added `use_gpu` parameter
- Automatically adds GPU parameters if GPU is available
- Includes pruning logic in objective function
- Reports pruned trial count

#### `main()`
- Checks GPU availability before optimization
- Passes `use_gpu` flag to optimization function
- Logs GPU/CPU status throughout training

## Performance Improvements

### Before:
- CPU-only training
- No pruning (all 50 trials run to completion)
- ~750 seconds per trial
- **Total time: ~10+ hours** for 50 trials

### After (with GPU):
- **GPU-accelerated tree construction** (5-10x faster)
- **Pruning stops bad trials early** (saves 30-50% time)
- **All CPU cores** used for parallel operations
- **Expected time: 2-4 hours** for 50 trials (with pruning)

### After (CPU fallback):
- **All CPU cores** used (`n_jobs=-1`)
- **Pruning still active** (saves time)
- **Expected time: 4-6 hours** for 50 trials (with pruning)

## Usage

The script automatically:
1. ✅ Detects GPU availability
2. ✅ Uses GPU if available, CPU if not
3. ✅ Uses all CPU cores (`n_jobs=-1`)
4. ✅ Prunes bad trials early
5. ✅ Preserves all existing data loading and alignment

## Requirements

### For GPU Support:
```bash
# XGBoost with GPU support
pip install xgboost[gpu]

# Or install CUDA-enabled XGBoost
# See: https://xgboost.readthedocs.io/en/latest/build.html#building-with-gpu-support
```

### For CPU-only:
- Standard XGBoost installation works fine
- Script automatically falls back to CPU

## What's Preserved

✅ All existing data loading logic
✅ Pre-extracted image features (`data/image_features_optimized.npy`)
✅ Row alignment using `image_metadata.csv`
✅ Feature engineering
✅ Model saving structure
✅ All other optimizations

## Next Steps

Run training:
```bash
python train_model_v4_optimized.py
```

The script will:
1. Check for GPU
2. Use GPU if available (much faster)
3. Use all CPU cores regardless
4. Prune bad trials early
5. Train models with optimized hyperparameters

## Expected Output

```
CHECKING GPU AVAILABILITY
================================================================================
✅ GPU detected and available for XGBoost

HYPERPARAMETER OPTIMIZATION
================================================================================
Optimizing XGBoost with 50 trials...
   Using GPU acceleration (gpu_hist)
[I ...] Trial 0 finished with value: 0.8747...
[I ...] Trial 1 finished with value: 0.8746...
...
Best XGBoost R²: 0.8816
Pruned trials: 12  # <-- Shows how many trials were stopped early
```

---

**Status:** ✅ Ready to train with GPU + CPU acceleration + pruning!
