# Next Steps After Filtering Rare Makes

## ✅ What You've Done

1. ✅ Removed 326 duplicate images → **49,179 clean images**
2. ✅ Filtered rare brands (<50 images) → **Filtered dataset ready**

## 🎯 What to Do Now

### Step 1: Verify Filtered Dataset
```powershell
# Check the filtered dataset exists
python -c "import pandas as pd; df = pd.read_csv('data/image_labels_filtered.csv'); print(f'Brands: {df[\"make\"].nunique()}'); print(f'Images: {len(df)}'); print(df['make'].value_counts().head(10))"
```

**Expected**: Should show only brands with ≥50 images.

### Step 2: Retrain Model with Filtered Dataset
```powershell
python scripts/train_car_clip.py --epochs 20 --lr 2e-5
```

**The training script now automatically:**
- ✅ Uses `image_labels_filtered.csv` if it exists (priority)
- ✅ Falls back to `image_labels_cleaned.csv` if filtered not found
- ✅ Falls back to `image_labels.csv` if cleaned not found

**What to expect:**
- Training on fewer brands (only those with ≥50 images)
- Better class balance
- Improved accuracy (target: 25-35%+)

### Step 3: Evaluate New Model
```powershell
python scripts/test_car_classifier.py
```

**Check:**
- Top-1 accuracy should improve from 15.24%
- Top-5 accuracy should improve from 55.80%
- Brand-specific accuracy should be more consistent

### Step 4: Verify Label Mapping (If Still Low Accuracy)

If accuracy is still low, check for label mapping issues:

```powershell
python scripts/check_model_labels.py
```

**This verifies:**
- Model labels match dataset labels
- Label order is consistent
- Classifier output size matches number of makes

## 📊 Expected Improvements

### Before Filtering:
- Brands: 94 (many with <50 images)
- Images: 49,179
- Accuracy: 15.24% Top-1

### After Filtering:
- Brands: ~40-50 (only brands with ≥50 images)
- Images: ~45,000-48,000 (removed rare brands)
- **Expected Accuracy: 25-35%+ Top-1** ✅

## 🔍 If Accuracy Still Low

If accuracy doesn't improve after filtering:

1. **Check label mapping**:
   ```powershell
   python scripts/check_model_labels.py
   ```

2. **Review validation report**:
   - Check `data/dataset_validation_report.md`
   - Look for brands with 0% accuracy
   - May indicate label errors for those brands

3. **Manual label review**:
   - Check low-accuracy brands manually
   - Verify labels are correct
   - Fix any mislabeled images

4. **Increase minimum samples**:
   ```powershell
   # Filter brands with <100 images instead of 50
   python scripts/filter_rare_makes.py --min_samples 100 --apply
   python scripts/train_car_clip.py --epochs 20
   ```

## ✅ Success Checklist

After retraining, verify:
- ✅ Top-1 accuracy: 25-35%+ (up from 15.24%)
- ✅ Top-5 accuracy: 60-75%+ (up from 55.80%)
- ✅ Training loss decreases smoothly
- ✅ Validation loss doesn't increase significantly
- ✅ Brand-specific accuracy is consistent

## 🚀 Quick Command Summary

```powershell
# 1. Verify filtered dataset
python -c "import pandas as pd; df = pd.read_csv('data/image_labels_filtered.csv'); print(f'Brands: {df[\"make\"].nunique()}, Images: {len(df)}')"

# 2. Retrain with filtered dataset
python scripts/train_car_clip.py --epochs 20 --lr 2e-5

# 3. Evaluate
python scripts/test_car_classifier.py

# 4. Check label consistency
python scripts/check_model_labels.py
```

## 📝 Notes

- The training script now **automatically uses the filtered dataset** if it exists
- No need to manually specify which file to use
- Backups are created automatically before filtering
- You can always go back to previous datasets if needed

**Ready to retrain!** 🎯
