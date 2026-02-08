# Quick Start: Safe Training with Pre-Flight Checks

## 🚀 One Command to Rule Them All

```powershell
scripts\run_safe_training.bat
```

**That's it!** This will:
1. ✅ Run all pre-flight checks
2. ✅ Only proceed if ALL checks pass
3. ✅ Diagnose and clean dataset
4. ✅ Train with maximum CPU+GPU utilization
5. ✅ Auto-save checkpoints every 5 epochs
6. ✅ Auto-resume if interrupted
7. ✅ Generate comprehensive evaluation

## ✅ What You'll See

### Pre-Flight Checks (Must All Pass):
```
✓ Python Version: Python 3.13.0
✓ PyTorch & CUDA: PyTorch 2.1.0, CUDA 12.1, GPU: RTX 4060
✓ Required Packages: All installed
✓ GPU Detection: NVIDIA GeForce RTX 4060 (8.0 GB)
✓ Disk Space: 45.2 GB free
✓ Images Folder: 57,312 images found
✓ CSV Labels File: image_labels_filtered.csv - 48,693 images
✓ Image Readability: Checked 100 images: 2 errors (2.0%)
✓ Paths: All writable
✓ Training Dry-Run: All tests passed

✓ ALL CHECKS PASSED - READY FOR TRAINING
```

### If Any Check Fails:
```
✗ Some checks failed - Fix errors before training

Missing packages:
  - pip install transformers
```

**Fix the errors, then run again!**

## 📋 Before You Leave

**Check these files exist:**
- ✅ `logs/training_status.txt` - Being updated
- ✅ `models/car_clip_finetuned/checkpoint_latest.pt` - Latest checkpoint
- ✅ Training log shows GPU utilization 90-100%

## 🔄 If Training Stops

**Auto-Resume:**
1. Training saves checkpoint every 5 epochs
2. If interrupted, run same command again
3. Automatically resumes from last checkpoint
4. No progress lost!

## 📊 Monitor Progress

**Check status:**
```powershell
# View latest status
Get-Content logs\training_status.txt -Tail 20

# View training log
Get-Content logs\training_optimized_*.log -Tail 50
```

**Check GPU:**
```powershell
nvidia-smi -l 1
```

## ✅ Success Indicators

**Good Signs:**
- GPU utilization: 90-100%
- CPU utilization: 80-100%
- Images/second: 40-60+
- Checkpoints saving every 5 epochs
- Status file updating

**Bad Signs:**
- GPU utilization: <70% → Check data loading
- Training stopped → Check error_log.txt
- OOM error → Batch size auto-reduced

## 🎯 Expected Timeline

- **Pre-flight checks**: ~2-3 minutes
- **Dataset cleaning**: ~2-3 minutes (parallel processing)
- **Training**: ~3-4 hours for 40 epochs
- **Evaluation**: ~5-10 minutes

**Total**: ~4 hours (vs 8-10 hours before optimizations)

## 🚨 Emergency Procedures

### If GPU Overheats:
- Monitor script auto-stops training
- Check `logs/training_status.txt`
- Resume after cooling down

### If Power Loss:
- Latest checkpoint saved
- Run same command to resume
- No data loss!

### If OOM Error:
- Emergency checkpoint saved
- Reduce batch size in CONFIG
- Resume from checkpoint

## 📝 Files to Check After Training

1. **Best Model:**
   - `models/car_clip_finetuned/best_model.pt`

2. **Evaluation Report:**
   - `results/evaluation_report_*.txt`

3. **Training Log:**
   - `logs/training_optimized_*.log`

4. **Status File:**
   - `logs/training_status.txt`

## 🎉 Ready!

Run the safe training pipeline and leave your computer:

```powershell
scripts\run_safe_training.bat
```

**All checks run first. Only proceed if everything passes!**
