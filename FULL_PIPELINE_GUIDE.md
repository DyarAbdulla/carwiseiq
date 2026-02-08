# Full Pipeline Guide: Diagnose, Clean, Train, Evaluate

## 🎯 Overview

This pipeline will:
1. **Diagnose** your dataset to find all problems
2. **Clean** the dataset (remove duplicates, balance classes)
3. **Train** an optimized model
4. **Evaluate** comprehensively with recommendations

## 🚀 Quick Start

### Option 1: Run Everything Automatically
```powershell
scripts\run_full_pipeline.bat
```

### Option 2: Run Steps Manually

#### Step 1: Diagnose Dataset
```powershell
python scripts\diagnose_dataset.py
```
**Output:** `diagnostics\diagnostic_report_*.json`

**What it checks:**
- Total images vs labeled images
- Missing/unlabeled images
- Duplicate images
- Label quality
- Class distribution (images per brand)

#### Step 2: Clean Dataset
```powershell
# Dry run (see what would change)
python scripts\clean_dataset.py --min_samples 100 --max_samples 2000

# Apply changes
python scripts\clean_dataset.py --apply --min_samples 100 --max_samples 2000
```

**What it does:**
- Removes duplicate images (by hash)
- Removes brands with <100 images
- Balances dataset (max 2000 images per brand)
- Validates all image files exist
- Removes invalid CSV entries

**Output:** `data\image_labels_cleaned_final.csv`

#### Step 3: Train Optimized Model
```powershell
python scripts\train_optimized.py
```

**Configuration:**
- Batch size: 128
- Learning rate: 2e-5
- Epochs: 40 (with early stopping)
- Simple augmentation (proven to work)
- Cosine annealing LR schedule
- Saves best model

**Output:** 
- `models\car_clip_finetuned\best_model.pt`
- `logs\training_optimized_*.log`
- `logs\training_history_*.json`

#### Step 4: Evaluate Comprehensively
```powershell
python scripts\evaluate_comprehensive.py
```

**Output:**
- `results\evaluation_report_*.txt` (human-readable)
- `results\evaluation_results_*.json` (machine-readable)

**Shows:**
- Top-1, Top-3, Top-5, Top-10 accuracy
- Per-brand accuracy breakdown
- Most confused brand pairs
- Practical recommendation (use model or collect more data?)

## 📊 Expected Results

### After Cleaning:
- **Before:** 48,693 images, 41 brands
- **After:** ~35,000-40,000 images, ~25-30 brands
- **Removed:** Duplicates, rare brands, excess images

### After Training:
- **Target:** 25-35% Top-1 accuracy
- **Target:** 70-80% Top-5 accuracy
- **Current:** 10.95% Top-1 (needs improvement)

### If Accuracy Still Low:
The evaluation script will tell you:
- Which brands have low accuracy
- Whether to collect more data
- Whether to train longer
- Whether model is usable

## 🔍 Understanding the Diagnostics

### Common Issues Found:

1. **Unlabeled Images**
   - Problem: Images in folder but not in CSV
   - Fix: Run `create_image_labels.py` to label them

2. **Duplicate Images**
   - Problem: Same image appears multiple times
   - Fix: Cleaning script removes duplicates automatically

3. **Rare Brands**
   - Problem: Brands with <100 images hurt accuracy
   - Fix: Cleaning script removes them (or collect more data)

4. **Imbalanced Dataset**
   - Problem: Some brands have 5000+ images, others have 50
   - Fix: Cleaning script balances to max 2000 per brand

## ⚙️ Configuration Options

### Cleaning Options:
```powershell
# More aggressive (remove brands with <150 images)
python scripts\clean_dataset.py --apply --min_samples 150 --max_samples 1500

# Less aggressive (keep brands with <50 images)
python scripts\clean_dataset.py --apply --min_samples 50 --max_samples 3000
```

### Training Options:
Edit `scripts/train_optimized.py` CONFIG:
```python
CONFIG = {
    'batch_size': 128,      # Increase if GPU memory allows
    'epochs': 40,           # Increase for better accuracy
    'learning_rate': 2e-5,  # Lower for fine-tuning
    'early_stopping_patience': 8,
}
```

## 📝 Output Files

### Diagnostics:
- `diagnostics/diagnostic_report_YYYYMMDD_HHMMSS.json`
  - All statistics and issues found
  - Recommendations

### Cleaned Dataset:
- `data/image_labels_cleaned_final.csv`
  - Use this for training

### Training:
- `models/car_clip_finetuned/best_model.pt`
  - Best model checkpoint
- `logs/training_optimized_*.log`
  - Full training log
- `logs/training_history_*.json`
  - Epoch-by-epoch metrics

### Evaluation:
- `results/evaluation_report_*.txt`
  - Human-readable report
- `results/evaluation_results_*.json`
  - Machine-readable results

## ✅ Success Checklist

After running the pipeline:

- ✅ Diagnostic report shows no critical issues
- ✅ Cleaned dataset has balanced classes
- ✅ Training completes without errors
- ✅ Top-1 accuracy: 25-35%+
- ✅ Top-5 accuracy: 70-80%+
- ✅ Evaluation report provides clear recommendation

## 🚨 Troubleshooting

### If Cleaning Removes Too Many Images:
- Reduce `--min_samples` (e.g., `--min_samples 50`)
- Increase `--max_samples` (e.g., `--max_samples 3000`)

### If Training Fails (OOM):
- Reduce batch size in `train_optimized.py`: `'batch_size': 64`
- Or use the memory-optimized `train_car_clip.py` instead

### If Accuracy Still Low:
- Check evaluation report for low-accuracy brands
- Collect more data for those brands
- Train for more epochs (50-100)
- Check for label quality issues

## 🎯 Next Steps

1. **Run the pipeline:**
   ```powershell
   scripts\run_full_pipeline.bat
   ```

2. **Check the evaluation report:**
   - Open `results\evaluation_report_*.txt`
   - Read the recommendation section

3. **If accuracy is good (25%+):**
   - Use the model in production
   - Restart backend to load new model

4. **If accuracy is still low:**
   - Follow recommendations in evaluation report
   - Collect more data for low-accuracy brands
   - Train longer or with different settings

## 📞 Quick Reference

```powershell
# Full pipeline
scripts\run_full_pipeline.bat

# Individual steps
python scripts\diagnose_dataset.py
python scripts\clean_dataset.py --apply
python scripts\train_optimized.py
python scripts\evaluate_comprehensive.py
```

**Ready to fix your dataset and improve accuracy!** 🚀
