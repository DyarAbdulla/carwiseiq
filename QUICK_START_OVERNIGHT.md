# Quick Start: Overnight Training - 15 Hours

## 🚀 One Command to Rule Them All

```powershell
scripts\run_overnight_training.bat
```

**That's it!** The script will:
1. ✅ Train for up to 15 hours (or until early stopping)
2. ✅ Save best model automatically
3. ✅ Generate full evaluation report
4. ✅ Log everything to files
5. ✅ Monitor GPU temperature (auto-stop if overheating)

## 📋 What You Get

### After Training Completes:

**Best Model:**
- `models/car_clip_finetuned/best_model_overnight.pt`

**Evaluation Report:**
- `results/final_report_YYYYMMDD_HHMMSS.txt` - Human-readable
- `results/final_results_YYYYMMDD_HHMMSS.json` - Machine-readable

**Training Logs:**
- `logs/training_YYYYMMDD_HHMMSS.log` - Full training log
- `logs/training_history_YYYYMMDD_HHMMSS.json` - Epoch-by-epoch metrics

## 🎯 Expected Results

**Target Accuracy:**
- Top-1: **42-65%** (up from 15.24%)
- Top-5: **70-85%** (up from 55.80%)
- Top-10: **80-90%**

## ⚙️ Configuration

**Default Settings** (optimized for RTX 4060 8GB):
- Batch size: 128
- Epochs: 100 (or until early stopping)
- Learning rate: 2e-5
- Early stopping: Patience 15 epochs
- Checkpoints: Every 5 epochs
- Mixed precision: FP16
- Label smoothing: 0.1
- MixUp: Enabled (alpha=0.2)
- AutoAugment: Enabled
- GPU temp monitoring: Auto-stop at 85°C
- Progress monitoring: Every 10 minutes

**Customize:**
```powershell
python scripts/train_overnight.py --epochs 100 --batch_size 64 --patience 15
```

## 📊 Monitoring

**During Training:**
```powershell
# View latest log (in another terminal)
Get-Content logs\training_*.log -Tail 50 -Wait
```

**After Training:**
```powershell
# View final report
notepad results\final_report_*.txt
```

## ✅ Success Checklist

- ✅ Training completed without errors
- ✅ Best model saved: `best_model_overnight.pt`
- ✅ Final report generated
- ✅ Top-1 accuracy: 42-65%+
- ✅ Top-5 accuracy: 70-85%+
- ✅ GPU temperature stayed safe (<85°C)

## 🎉 Ready!

Just run the batch file and go to sleep! 😴

```powershell
scripts\run_overnight_training.bat
```
