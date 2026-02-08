# GPU Acceleration Setup - Model Training

## ✅ Changes Made

The training script (`core/model_training.py`) has been updated to automatically detect and use GPU acceleration for faster training.

### GPU Support Added For:
1. **XGBoost** - Uses `tree_method='gpu_hist'` and `predictor='gpu_predictor'`
2. **LightGBM** - Uses `device='gpu'` with GPU platform/device IDs
3. **CatBoost** - Uses `task_type='GPU'` with device selection

### Features:
- ✅ Automatic GPU detection (checks NVIDIA GPU via `nvidia-smi` and PyTorch)
- ✅ Automatic fallback to CPU if GPU initialization fails
- ✅ Error handling with clear messages
- ✅ GPU status displayed at start of training

## 🚀 How It Works

When you run `python core/model_training.py`, the script will:

1. **Detect GPU** - Checks if NVIDIA GPU is available
2. **Display Status** - Shows GPU acceleration status
3. **Use GPU** - Automatically uses GPU for XGBoost, LightGBM, and CatBoost
4. **Fallback** - If GPU fails, automatically falls back to CPU

## 📊 Expected Output

```
================================================================================
GPU ACCELERATION STATUS
================================================================================
✅ GPU acceleration ENABLED - Training will be faster!
   GPU devices available: 1
================================================================================

4. Training XGBoost...
   Attempting GPU acceleration...
   ✅ GPU acceleration successful!
   R² Score: 0.XXXX
```

## 🔧 Requirements

### For GPU Acceleration:

1. **NVIDIA GPU** with CUDA support
2. **CUDA Toolkit** installed (version 11.0+ recommended)
3. **GPU-enabled libraries**:
   ```bash
   # XGBoost with GPU support
   pip install xgboost[gpu]
   # OR
   pip install xgboost --install-option=--gpu
   
   # LightGBM with GPU support
   pip install lightgbm --install-option=--gpu
   # OR compile from source with GPU support
   
   # CatBoost (GPU support included by default if CUDA available)
   pip install catboost
   ```

### Verify GPU is Available:

```bash
# Check NVIDIA GPU
nvidia-smi

# Check CUDA version
nvcc --version

# Test PyTorch CUDA (if installed)
python -c "import torch; print(torch.cuda.is_available())"
```

## ⚡ Performance Improvement

With GPU acceleration, you can expect:
- **3-10x faster** training for XGBoost/LightGBM/CatBoost
- **Faster hyperparameter tuning** (RandomizedSearchCV)
- **Reduced training time** from hours to minutes for large datasets

## 🐛 Troubleshooting

### Issue: "GPU failed, falling back to CPU"
**Causes:**
- CUDA not installed or wrong version
- GPU drivers not installed
- Library not compiled with GPU support

**Solutions:**
1. Install CUDA Toolkit: https://developer.nvidia.com/cuda-downloads
2. Install GPU-enabled libraries (see Requirements above)
3. Verify GPU is detected: `nvidia-smi`

### Issue: "No GPU detected"
**Causes:**
- No NVIDIA GPU installed
- GPU drivers not installed
- `nvidia-smi` command not available

**Solutions:**
- Install NVIDIA GPU drivers
- Verify GPU hardware is installed
- Training will continue with CPU (slower but functional)

### Issue: Out of Memory (OOM) on GPU
**Solutions:**
- Reduce batch size or dataset size
- Use CPU instead (remove GPU parameters)
- Reduce `n_estimators` or `max_depth` in models

## 📝 Notes

- **Random Forest** and **Linear Regression** still use CPU (they don't have GPU support)
- **Gradient Boosting (sklearn)** uses CPU (no GPU support)
- GPU is most beneficial for:
  - Large datasets (>10,000 samples)
  - Deep trees (high `max_depth`)
  - Many estimators (high `n_estimators`)
  - Hyperparameter tuning (many iterations)

## 🎯 Next Steps

1. **Run training**:
   ```bash
   python core/model_training.py
   ```

2. **Check GPU status** in the output - should show "✅ GPU acceleration ENABLED"

3. **Monitor GPU usage** (in another terminal):
   ```bash
   watch -n 1 nvidia-smi
   ```

4. **Compare speeds** - GPU training should be noticeably faster, especially during hyperparameter tuning
