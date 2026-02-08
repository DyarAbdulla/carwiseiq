# Install GPU-Enabled ML Libraries

## Current Issue
GPU is detected but not being used because the libraries need GPU-enabled versions installed.

## Installation Instructions

### 1. XGBoost with GPU Support

**Option A: Install from conda-forge (Recommended)**
```bash
conda install -c conda-forge py-xgboost-gpu
```

**Option B: Build from source with CUDA**
```bash
# Requires CUDA Toolkit installed
git clone --recursive https://github.com/dmlc/xgboost
cd xgboost
mkdir build
cd build
cmake .. -DUSE_CUDA=ON
make -j4
cd ../python-package
python setup.py install
```

**Option C: Use pre-built wheel (if available)**
```bash
# Check XGBoost version
pip show xgboost

# For XGBoost 2.0+, GPU support is included but requires CUDA
# Just ensure CUDA is installed and use device='cuda'
```

### 2. LightGBM with GPU Support

**Option A: Install pre-built GPU version**
```bash
# LightGBM GPU requires OpenCL or CUDA
# Install OpenCL SDK first, then:
pip install lightgbm --config-settings=cmake.define.USE_GPU=ON
```

**Option B: Build from source**
```bash
git clone --recursive https://github.com/microsoft/LightGBM
cd LightGBM
mkdir build
cd build
cmake .. -DUSE_GPU=ON
make -j4
cd ../python-package
python setup.py install
```

**Note:** LightGBM GPU requires OpenCL, which may not be available on all systems.

### 3. CatBoost with GPU Support

**CatBoost includes GPU support by default if CUDA is available:**
```bash
# Just install CatBoost - it will use GPU if CUDA is detected
pip install catboost

# Verify CUDA is available
python -c "import catboost; print(catboost.get_gpu_device_count())"
```

## Quick Check Script

Create a file `check_gpu_libraries.py`:

```python
import sys

print("=" * 60)
print("GPU Library Support Check")
print("=" * 60)

# Check XGBoost
try:
    import xgboost as xgb
    print("\n✅ XGBoost installed")
    try:
        test = xgb.XGBRegressor(device='cuda', n_estimators=1)
        print("   ✅ GPU support: YES (CUDA device)")
    except:
        try:
            test = xgb.XGBRegressor(tree_method='gpu_hist', n_estimators=1)
            print("   ✅ GPU support: YES (gpu_hist)")
        except:
            print("   ❌ GPU support: NO")
except ImportError:
    print("\n❌ XGBoost not installed")

# Check LightGBM
try:
    import lightgbm as lgb
    print("\n✅ LightGBM installed")
    try:
        test = lgb.LGBMRegressor(device='gpu', n_estimators=1)
        print("   ✅ GPU support: YES")
    except:
        print("   ❌ GPU support: NO (requires OpenCL/CUDA)")
except ImportError:
    print("\n❌ LightGBM not installed")

# Check CatBoost
try:
    import catboost as cb
    print("\n✅ CatBoost installed")
    try:
        count = cb.get_gpu_device_count()
        if count > 0:
            print(f"   ✅ GPU support: YES ({count} device(s))")
        else:
            print("   ❌ GPU support: NO (no CUDA devices)")
    except:
        print("   ❌ GPU support: NO")
except ImportError:
    print("\n❌ CatBoost not installed")

print("\n" + "=" * 60)
```

Run it:
```bash
python check_gpu_libraries.py
```

## Current Status

Based on your terminal output:
- ✅ GPU detected (NVIDIA RTX 4060)
- ✅ CUDA available (version 13)
- ⚠️ XGBoost: GPU parameters may not be working
- ⚠️ LightGBM: Installation failed (--install-option deprecated)
- ✅ CatBoost: Says GPU successful but Task Manager shows 0% usage

## Recommended Action

1. **For XGBoost**: The newer versions (2.0+) use `device='cuda'` instead of `tree_method='gpu_hist'`. The code has been updated to try both.

2. **For LightGBM**: GPU support requires OpenCL or CUDA compilation. Since installation failed, it will use CPU.

3. **For CatBoost**: Even though it says "GPU successful", verify in Task Manager. If GPU shows 0%, CatBoost might be falling back to CPU silently.

## Verify GPU Usage

After running training, check Task Manager:
- **GPU tab** should show >0% utilization during XGBoost/LightGBM/CatBoost training
- **CPU tab** should show lower usage when GPU is active

If GPU still shows 0%, the libraries may not have proper GPU support installed.
