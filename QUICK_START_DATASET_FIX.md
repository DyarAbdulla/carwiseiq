# Quick Start: Fix Dataset for Better Accuracy

## 🎯 Goal
Improve accuracy from 14.62% to 25-35%+ by fixing dataset issues.

## ⚡ Quick Steps

### Step 1: Run Validation (5-10 minutes)
```powershell
python scripts/validate_classifier_dataset.py
```

**This will check:**
- ✅ Class distribution (imbalanced classes)
- ✅ Duplicate images
- ✅ Corrupted/missing images  
- ✅ Brand-specific accuracy
- ✅ Potential mislabeled images

**Output:**
- Console: Detailed findings
- `data/dataset_validation_report.md`: Summary report
- `data/dataset_validation_results.json`: Detailed results

### Step 2: Review Findings
Check the console output and report for:
1. **Rare makes** (<10 images) - need to remove
2. **Duplicates with different labels** - critical issue
3. **Corrupted images** - need to remove
4. **Low-accuracy brands** - may have label issues

### Step 3: Fix Issues (Priority Order)

#### A. Remove Duplicates (CRITICAL)
```powershell
# Dry run first
python scripts/remove_duplicates.py

# Apply changes
python scripts/remove_duplicates.py --apply
```

#### B. Filter Rare Makes
```powershell
# Dry run first
python scripts/fix_rare_makes.py --min_samples 10

# Apply changes
python scripts/fix_rare_makes.py --min_samples 10 --apply
```

#### C. Recreate Labels (Auto-fixes corrupted images)
```powershell
python scripts/create_image_labels.py
```

This now automatically:
- ✅ Skips corrupted images
- ✅ Filters rare makes (<10 samples)
- ✅ Validates image integrity

### Step 4: Retrain Model
```powershell
python scripts/train_car_clip.py --epochs 20 --lr 2e-5
```

### Step 5: Evaluate
```powershell
python scripts/test_car_classifier.py
```

## 📊 Expected Results

### Before Fixes:
- Top-1 Accuracy: 14.62%
- Issues: Duplicates, rare makes, corrupted images

### After Fixes:
- Top-1 Accuracy: **25-35%+** ✅
- Clean dataset: No duplicates, no rare makes, all images valid

## 🔍 What Each Script Does

| Script | Purpose | Time |
|--------|---------|------|
| `validate_classifier_dataset.py` | Diagnose all issues | 5-10 min |
| `remove_duplicates.py` | Remove duplicate images | 2-5 min |
| `fix_rare_makes.py` | Filter rare makes | <1 min |
| `create_image_labels.py` | Recreate clean labels | 2-5 min |

## ⚠️ Important Notes

1. **Backups**: Scripts create backups before making changes
2. **Dry Run**: Always run with dry-run first to see what will change
3. **Manual Review**: Check mislabeled images manually if needed
4. **Model Required**: Brand accuracy analysis requires trained model

## 🎯 Success Checklist

After fixes, verify:
- ✅ No duplicate images with different labels
- ✅ All makes have >=10 samples
- ✅ All images are valid and loadable
- ✅ Top-1 accuracy improved to 25-35%+

## 📝 Full Plan

See `DATASET_FIX_PLAN.md` for detailed explanation of each issue and fix.
