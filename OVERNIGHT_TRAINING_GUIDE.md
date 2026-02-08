# Overnight Training Guide - 15 Hours

## 🎯 Overview

Automated 15-hour training script optimized for maximum accuracy improvement with advanced features.

**Current Status:**
- 57,312 car images
- 41 car brands (after filtering)
- Current accuracy: 15.24% Top-1, 55.80% Top-5
- GPU: RTX 4060 8GB

**Target:**
- 42-65% Top-1 accuracy
- Fully automated - run and sleep!

## 🚀 Quick Start

### Option 1: Use Batch File (Easiest)
```powershell
scripts\run_overnight_training.bat
```

### Option 2: Run Python Script Directly
```powershell
python scripts/train_overnight.py --epochs 80 --batch_size 128 --lr 2e-5 --num_workers 12 --patience 10
```

## 📋 What It Does

### Training Script (`train_overnight.py`)

**Features:**
- ✅ **100 epochs** (or until early stopping, up to 15 hours)
- ✅ **Batch size 128** (optimized for RTX 4060)
- ✅ **Learning rate 2e-5** with cosine annealing
- ✅ **Early stopping** (patience=15, stops if no improvement)
- ✅ **Checkpoint saving** every 5 epochs
- ✅ **Mixed precision FP16** (faster, less memory)
- ✅ **MixUp augmentation** (alpha=0.2) for better generalization
- ✅ **AutoAugment** (ImageNet policy) for stronger augmentation
- ✅ **Label smoothing** (0.1) for better calibration
- ✅ **Progress logging** every 10 minutes
- ✅ **GPU temperature monitoring** (auto-stop if >85°C)
- ✅ **GPU memory monitoring**
- ✅ **Time estimation** (shows remaining time)

**Outputs:**
- Best model: `models/car_clip_finetuned/best_model_overnight.pt`
- Checkpoints: `models/car_clip_finetuned/checkpoints_overnight/`
- Training logs: `logs/training_YYYYMMDD_HHMMSS.log`
- Training history: `logs/training_history_YYYYMMDD_HHMMSS.json`

### Evaluation Script (`evaluate_final.py`)

**Features:**
- ✅ **Top-1, Top-3, Top-5, Top-10 accuracy**
- ✅ **Per-brand accuracy breakdown**
- ✅ **Confusion matrix** (most confused pairs)
- ✅ **Detailed report** (`results/final_report_*.txt`)
- ✅ **JSON results** (`results/final_results_*.json`)

## ⚙️ Configuration

### Default Settings (Optimized for RTX 4060 8GB)

```python
batch_size: 128
epochs: 100
learning_rate: 2e-5
num_workers: 12
early_stopping_patience: 15
mixed_precision: True (FP16)
label_smoothing: 0.1
mixup_alpha: 0.2
use_autoaugment: True
gpu_temp_threshold: 85°C
monitor_interval_minutes: 10
```

### Customize Settings

```powershell
# More epochs, larger batch
python scripts/train_overnight.py --epochs 100 --batch_size 256

# Faster training (smaller batch, fewer workers)
python scripts/train_overnight.py --batch_size 64 --num_workers 8

# More patience (wait longer for improvement)
python scripts/train_overnight.py --patience 15
```

## 📊 Expected Results

### Training Progress

You'll see:
- Epoch-by-epoch progress
- Training/validation loss and accuracy
- GPU memory usage
- Time estimates
- Early stopping status

### Final Accuracy Targets

**Realistic Targets** (based on 41 brands, ~45K images):
- **Top-1 Accuracy**: 42-65% ✅
- **Top-5 Accuracy**: 70-85% ✅
- **Top-10 Accuracy**: 80-90% ✅

**Per-Brand:**
- Common brands (1000+ images): 50-70% Top-1
- Medium brands (100-1000 images): 40-60% Top-1
- Rare brands (50-100 images): 30-50% Top-1

## 🔍 Monitoring

### During Training

**Check logs:**
```powershell
# View latest log file
Get-Content logs\training_*.log -Tail 50

# Or open in notepad
notepad logs\training_*.log
```

**Check GPU usage:**
```powershell
# In another terminal
nvidia-smi -l 1
```

### After Training

**View results:**
```powershell
# Read final report
notepad results\final_report_*.txt

# Check training history
python -c "import json; data = json.load(open('logs/training_history_*.json')); print(f\"Best accuracy: {max([e['val_acc'] for e in data])*100:.2f}%\")"
```

## 🛠️ Troubleshooting

### If Training Stops Early

**Check:**
- Early stopping triggered (no improvement for 10 epochs)
- This is normal - model may have converged
- Check `best_model_overnight.pt` for best model

### If OOM Error

**Reduce batch size:**
```powershell
python scripts/train_overnight.py --batch_size 64
```

### If Training Too Slow

**Reduce workers:**
```powershell
python scripts/train_overnight.py --num_workers 8
```

### If Accuracy Not Improving

**Check:**
1. Label mapping: `python scripts/check_model_labels.py`
2. Dataset quality: Review `data/dataset_validation_report.md`
3. Training logs: Check for errors or warnings

## 📁 File Structure

```
models/car_clip_finetuned/
├── best_model_overnight.pt          # Best model (use this!)
├── checkpoints_overnight/
│   ├── checkpoint_epoch_5.pt
│   ├── checkpoint_epoch_10.pt
│   └── ...
└── mappings.json

logs/
├── training_20260118_020000.log      # Training logs
└── training_history_20260118_020000.json

results/
├── final_report_20260118_140000.txt  # Human-readable report
└── final_results_20260118_140000.json # Machine-readable results
```

## ✅ Success Checklist

After overnight training:

- ✅ Best model saved: `best_model_overnight.pt`
- ✅ Final report generated: `results/final_report_*.txt`
- ✅ Top-1 accuracy: 42-65%+
- ✅ Top-5 accuracy: 70-85%+
- ✅ Training completed without errors
- ✅ Early stopping worked (or reached max epochs)
- ✅ GPU temperature stayed below 85°C

## 🎯 Next Steps

1. **Review results:**
   ```powershell
   notepad results\final_report_*.txt
   ```

2. **Check per-brand accuracy:**
   - Identify low-accuracy brands
   - May need more images or label fixes

3. **Use best model:**
   - Model is saved as `best_model_overnight.pt`
   - Backend will use it automatically
   - Or copy to `best_model.pt` to make it default

4. **Restart backend:**
   ```powershell
   cd backend
   python -m uvicorn app.main:app --reload
   ```

## 🚨 Important Notes

1. **Power Management**: Disable sleep/hibernate during training
2. **Disk Space**: Ensure 5-10 GB free for checkpoints
3. **Backup**: Training creates checkpoints automatically
4. **Interrupt**: Can stop with Ctrl+C (saves current checkpoint)
5. **Resume**: Can resume from checkpoint if needed (future feature)

## 🎉 Ready to Train!

Just run:
```powershell
scripts\run_overnight_training.bat
```

Then go to sleep! The script will:
- Train for up to 12 hours
- Save best model automatically
- Generate full evaluation report
- Log everything to files

**Sweet dreams!** 😴
