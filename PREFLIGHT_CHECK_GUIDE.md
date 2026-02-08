# Pre-Flight Check System Guide

## 🎯 Overview

The pre-flight check system validates **everything** before training starts, so you can safely leave your computer and return to a trained model.

## 🚀 Quick Start

### Run Pre-Flight Checks Only:
```powershell
python scripts\preflight_check.py
```

### Run Safe Training Pipeline (Checks + Training):
```powershell
scripts\run_safe_training.bat
```

## ✅ What Gets Checked

### 1. System Checks
- ✅ **Python Version**: Must be 3.8+
- ✅ **PyTorch & CUDA**: Installed and working
- ✅ **Required Packages**: torch, transformers, pandas, PIL, numpy, sklearn, tqdm
- ✅ **Optional Packages**: kornia (GPU augmentation), psutil (CPU monitoring)
- ✅ **GPU Detection**: RTX 4060 detected with 8GB VRAM
- ✅ **Disk Space**: At least 10GB free

### 2. Dataset Checks
- ✅ **Images Folder**: `car_images/` exists with 1,000+ images
- ✅ **CSV Labels File**: Found and readable
- ✅ **CSV Format**: Has required columns (image_filename, make, model)
- ✅ **Image Readability**: Random sample of 100 images are readable
- ✅ **No Corrupted Images**: Less than 5% error rate

### 3. Path Checks
- ✅ **Scripts Folder**: Exists
- ✅ **Data Folder**: Exists and accessible
- ✅ **Images Folder**: Exists and accessible
- ✅ **Models Folder**: Can be created and written
- ✅ **Logs Folder**: Can be created and written
- ✅ **Results Folder**: Can be created and written

### 4. Training Dry-Run
- ✅ **GPU Usage**: Training will use GPU (not CPU)
- ✅ **Model Loading**: CLIP model loads successfully
- ✅ **Dataset Loading**: CSV loads and processes correctly
- ✅ **DataLoader Creation**: DataLoader created without errors
- ✅ **Batch Processing**: Can process a training batch
- ✅ **Checkpoint Saving**: Can save checkpoints

## 📊 Output Format

```
PRE-FLIGHT CHECK SYSTEM
================================================================================
Start time: 2026-01-18 10:30:00

1. SYSTEM CHECKS
================================================================================
  ✓ Python Version: Python 3.13.0
  ✓ PyTorch & CUDA: PyTorch 2.1.0, CUDA 12.1, GPU: NVIDIA GeForce RTX 4060
  ✓ Required Packages: All installed
  ✓ GPU Detection: NVIDIA GeForce RTX 4060 (8.0 GB)
  ✓ Disk Space: 45.2 GB free (need 10 GB+)

2. DATASET CHECKS
================================================================================
  ✓ Images Folder: 57,312 images found
  ✓ CSV Labels File: image_labels_filtered.csv - 48,693 labeled images
  ✓ Image Readability: Checked 100 images: 2 errors (2.0%)

3. PATH CHECKS
================================================================================
  ✓ Scripts folder: C:\...\scripts (writable)
  ✓ Data folder: C:\...\data (writable)
  ...

4. TRAINING DRY-RUN
================================================================================
  ✓ GPU Usage: Will use NVIDIA GeForce RTX 4060
  ✓ Model Loading: Model loaded on cuda
  ✓ Batch Processing: Processed batch of 4 images
  ✓ Checkpoint Saving: Can save checkpoints

================================================================================
PRE-FLIGHT CHECK SUMMARY
================================================================================

Results: 10/10 checks passed

  PASS - Python Version
  PASS - PyTorch & CUDA
  PASS - Required Packages
  PASS - GPU Detection
  PASS - Disk Space
  PASS - Images Folder
  PASS - CSV Labels File
  PASS - Image Readability
  PASS - Paths
  PASS - Training Dry-Run

================================================================================
✓ ALL CHECKS PASSED - READY FOR TRAINING
================================================================================
```

## 🛡️ Error Handling Features

### Auto-Save Checkpoints
- **Every 5 epochs**: Automatic checkpoint saved
- **On error**: Emergency checkpoint saved
- **On interruption**: Latest checkpoint saved

### Auto-Resume Training
- If training stops (error, power loss, etc.)
- Run same command again → automatically resumes from last checkpoint
- No data loss!

### Error Logging
- All errors saved to `logs/error_log.txt`
- Training status saved to `logs/training_status.txt`
- Full tracebacks for debugging

## 📋 Common Issues & Fixes

### Issue: "Python Version" FAIL
**Fix:** Install Python 3.8 or higher

### Issue: "PyTorch & CUDA" FAIL
**Fix:** 
```powershell
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
```

### Issue: "Required Packages" FAIL
**Fix:**
```powershell
pip install transformers pandas pillow numpy scikit-learn tqdm
```

### Issue: "GPU Detection" FAIL
**Fix:**
- Check NVIDIA drivers installed
- Check CUDA toolkit installed
- Verify GPU is enabled in BIOS

### Issue: "Disk Space" FAIL
**Fix:** Free up disk space (need 10GB+)

### Issue: "Images Folder" FAIL
**Fix:** Ensure `car_images/` folder exists with images

### Issue: "CSV Labels File" FAIL
**Fix:** Run `python scripts/create_image_labels.py` to create labels

### Issue: "Image Readability" FAIL
**Fix:** Check for corrupted images, run cleaning script

### Issue: "Training Dry-Run" FAIL
**Fix:** Check error message for specific issue

## 🔄 Auto-Resume Feature

If training stops for any reason:

1. **Checkpoint saved**: `models/car_clip_finetuned/checkpoint_latest.pt`
2. **Run same command**: `python scripts/train_optimized.py`
3. **Auto-resumes**: From last saved epoch
4. **No data loss**: All progress preserved

## 📊 Monitoring (Optional)

Run monitor in separate terminal:
```powershell
python scripts/monitor_training.py
```

**Monitors:**
- GPU temperature (auto-stop if >85°C)
- GPU utilization
- Writes status to `logs/training_status.txt`

## ✅ Success Checklist

Before leaving your computer:

- ✅ All pre-flight checks pass (green checkmarks)
- ✅ Training started without errors
- ✅ GPU utilization shows 90-100%
- ✅ Checkpoints saving every 5 epochs
- ✅ Status file being updated

## 🎯 Usage Workflow

1. **Run pre-flight checks:**
   ```powershell
   python scripts\preflight_check.py
   ```

2. **If all checks pass:**
   ```powershell
   scripts\run_safe_training.bat
   ```

3. **Leave computer** - Training runs automatically

4. **Return later** - Check:
   - `logs/training_status.txt` - Latest status
   - `models/car_clip_finetuned/best_model.pt` - Best model
   - `results/evaluation_report_*.txt` - Final results

## 🚨 If Checks Fail

The script will:
- Show exactly which check failed
- Provide specific error messages
- Suggest fixes
- **STOP** before wasting time on training

**Fix the errors, then run checks again!**

## 📝 Files Created

- `logs/preflight_check_*.json` - Full check results
- `logs/training_status.txt` - Real-time training status
- `logs/error_log.txt` - All errors logged
- `models/car_clip_finetuned/checkpoint_latest.pt` - Latest checkpoint (auto-resume)

## 🎉 Ready to Train Safely!

Run the safe training pipeline:
```powershell
scripts\run_safe_training.bat
```

**All checks will run first. Only proceed if everything passes!**
