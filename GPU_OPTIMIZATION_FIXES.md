# GPU Utilization Optimization Fixes

## 🔍 Issues Found

### 1. **Batch Size Being Overridden** ⚠️
- **Problem**: Code was overriding user's `--batch_size` argument based on GPU memory
- **Impact**: Even with `--batch_size 128`, it was reduced to 96 for 8GB GPUs
- **Fix**: Removed automatic override, now only suggests batch size

### 2. **Data Loading Bottleneck** ⚠️
- **Problem**: Synchronous image I/O in `__getitem__` causing GPU to wait
- **Impact**: GPU idle time while waiting for CPU to load/preprocess images
- **Fixes**:
  - Increased `prefetch_factor` from 2 to 4
  - Added `non_blocking=True` for GPU transfers
  - Optimized image loading with context manager

### 3. **No Gradient Accumulation** ⚠️
- **Problem**: `gradient_accumulation_steps` was hardcoded to 1
- **Impact**: Can't simulate larger batches without increasing actual batch size
- **Fix**: Added `--gradient_accumulation` command-line argument

### 4. **Missing GPU Monitoring** ⚠️
- **Problem**: No visibility into actual GPU memory usage during training
- **Impact**: Can't diagnose why GPU isn't being fully utilized
- **Fix**: Added GPU memory logging and monitoring script

## ✅ Fixes Applied

### 1. Removed Batch Size Override
**File**: `scripts/train_car_clip.py` (lines 549-560)

**Before**:
```python
# Automatically reduced batch_size based on GPU memory
if gpu_memory < 8:
    config['batch_size'] = min(config['batch_size'], 64)
```

**After**:
```python
# Only suggests batch size, doesn't override user's choice
suggested_batch_size = 96  # suggestion only
logger.info(f"Using batch size: {config['batch_size']} (from command line)")
```

### 2. Optimized Data Loading
**File**: `scripts/train_car_clip.py`

**Changes**:
- Increased `prefetch_factor`: 2 → 4 (more batches preloaded)
- Added `non_blocking=True` for GPU transfers (better pipelining)
- Optimized image loading with context manager

### 3. Added Gradient Accumulation
**File**: `scripts/train_car_clip.py`

**New argument**:
```bash
--gradient_accumulation 2  # Simulates 2x batch size
```

**Usage**:
```bash
python train_car_clip.py --batch_size 64 --gradient_accumulation 2
# Effective batch size = 64 * 2 = 128
```

### 4. Added GPU Memory Monitoring
**File**: `scripts/train_car_clip.py` + `scripts/check_gpu_utilization.py`

**During training**:
- Logs GPU memory on first batch
- Logs peak memory after each epoch
- Shows actual batch size being used

**Standalone script**:
```bash
python scripts/check_gpu_utilization.py
```

## 🚀 How to Use

### Maximum GPU Utilization

**For 8GB GPU (RTX 4060)**:
```bash
python scripts/train_car_clip.py \
    --batch_size 128 \
    --gradient_accumulation 2 \
    --num_workers 12 \
    --epochs 20 \
    --lr 2e-5
```

**For 12GB+ GPU**:
```bash
python scripts/train_car_clip.py \
    --batch_size 256 \
    --gradient_accumulation 2 \
    --num_workers 16 \
    --epochs 20 \
    --lr 2e-5
```

### Monitor GPU Usage

**During training** (in another terminal):
```bash
# Check GPU utilization
python scripts/check_gpu_utilization.py

# Or use nvidia-smi watch
nvidia-smi -l 1
```

**Expected output**:
```
GPU Memory - Allocated: 4.50 GB, Peak: 5.20 GB
Batch size: 128 (expected: 128)
```

## 📊 Expected Improvements

### Before Fixes:
- GPU Memory: 0.56 GB (8% of 8GB)
- Batch Size: Overridden to 96
- Speed: Slow (GPU waiting for CPU)

### After Fixes:
- GPU Memory: 4-6 GB (50-75% of 8GB) ✅
- Batch Size: Respects command-line argument ✅
- Speed: 2-3x faster (better GPU utilization) ✅

## 🔧 Troubleshooting

### If GPU memory still low:

1. **Check actual batch size**:
   ```bash
   # Look for this in training logs:
   Batch size: 128 (expected: 128)
   ```

2. **Increase gradient accumulation**:
   ```bash
   --gradient_accumulation 4  # Simulates 4x batch size
   ```

3. **Increase num_workers**:
   ```bash
   --num_workers 16  # More CPU cores for data loading
   ```

4. **Check data loading speed**:
   ```bash
   # Look for this in logs:
   Epoch time: 120s (412 samples/sec, 3.2 batches/sec)
   ```

### If training crashes (OOM):

1. **Reduce batch size**:
   ```bash
   --batch_size 64
   ```

2. **Use gradient accumulation instead**:
   ```bash
   --batch_size 64 --gradient_accumulation 2  # Effective: 128
   ```

3. **Disable mixed precision** (not recommended):
   ```bash
   --no_mixed_precision  # Uses FP32, needs more memory
   ```

## 📋 New Command-Line Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--batch_size` | 96 | Batch size (no longer overridden) |
| `--gradient_accumulation` | 1 | Steps to accumulate gradients |
| `--num_workers` | 8 | Data loading workers (increase for faster loading) |

## ✅ Verification Checklist

After running training, check:

1. ✅ **Batch size matches command line**:
   ```
   Batch size: 128 (expected: 128)
   ```

2. ✅ **GPU memory usage >30%**:
   ```
   GPU Memory - Peak: 4.50 GB (56% of 8GB)
   ```

3. ✅ **Good training speed**:
   ```
   Epoch time: 120s (412 samples/sec, 3.2 batches/sec)
   ```

4. ✅ **No data loading bottleneck**:
   - GPU utilization >80% (check with `nvidia-smi`)
   - Batches/sec should be >2 for batch_size 128

## 🎯 Status

✅ **All fixes applied**
✅ **Batch size override removed**
✅ **Data loading optimized**
✅ **Gradient accumulation added**
✅ **GPU monitoring added**

**Ready to train with maximum GPU utilization!**
