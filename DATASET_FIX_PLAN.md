# Dataset Fix Plan for Low Accuracy (14.62%)

## 🔍 Current Situation

- **Achieved Accuracy**: 14.62% Top-1 (expected 25-35%)
- **Training**: Completed 20 epochs with proper settings
- **Issue**: Dataset quality problems preventing model from learning effectively

## 📋 Validation Steps

### Step 1: Run Validation Script
```powershell
python scripts/validate_classifier_dataset.py
```

This will check:
1. ✅ Class distribution (imbalanced classes)
2. ✅ Duplicate images
3. ✅ Corrupted/missing images
4. ✅ Brand-specific accuracy
5. ✅ Potential mislabeled images

## 🎯 Expected Issues & Fixes

### Issue 1: Imbalanced Classes
**Symptom**: Some makes have <10 images, others have 1000+

**Fix**:
1. **Remove rare makes** (<10 images):
   ```python
   # In create_image_labels.py or training script
   min_samples = 10
   make_counts = labels_df['make'].value_counts()
   valid_makes = make_counts[make_counts >= min_samples].index
   labels_df = labels_df[labels_df['make'].isin(valid_makes)]
   ```

2. **Balance common makes** (if needed):
   - Option A: Downsample common makes to ~500 images each
   - Option B: Use class weights (already implemented)
   - Option C: Use stratified sampling

**Action**: Update `scripts/create_image_labels.py` to filter rare makes before saving.

### Issue 2: Mislabeled Images
**Symptom**: Model predicts different make with high confidence

**Fix**:
1. **Manual review**: Check flagged images from validation script
2. **Auto-correction**: For high-confidence predictions (>0.8), consider auto-correcting
3. **Remove uncertain**: Remove images where model confidence <0.3

**Action**: Create `scripts/fix_mislabels.py` to:
- Load validation results
- Show flagged images for manual review
- Optionally auto-correct high-confidence mislabels

### Issue 3: Duplicate Images with Different Labels
**Symptom**: Same image labeled as different makes

**Fix**:
1. **Remove duplicates**: Keep only one copy of each duplicate
2. **Resolve conflicts**: If duplicates have different labels, use majority vote or remove

**Action**: Create `scripts/remove_duplicates.py`:
```python
# Keep first occurrence, remove others
# If labels conflict, use most common label or remove all
```

### Issue 4: Corrupted/Missing Images
**Symptom**: Images can't be loaded or are invalid

**Fix**:
1. **Remove from dataset**: Delete entries for corrupted/missing images
2. **Re-download**: If source available, re-download missing images

**Action**: Update `scripts/create_image_labels.py` to skip corrupted images.

### Issue 5: Low Accuracy Brands
**Symptom**: Specific brands have <10% accuracy

**Fix**:
1. **Check label quality**: Manually verify labels for low-accuracy brands
2. **Increase samples**: Collect more images for low-accuracy brands
3. **Remove if unfixable**: If brand has consistently wrong labels, remove it

**Action**: Review validation report, manually check flagged brands.

## 🔧 Implementation Plan

### Phase 1: Data Cleaning (Immediate)

1. **Filter Rare Makes**:
   ```powershell
   # Update create_image_labels.py to filter makes with <10 samples
   python scripts/create_image_labels.py
   ```

2. **Remove Duplicates**:
   ```powershell
   python scripts/remove_duplicates.py
   ```

3. **Remove Corrupted Images**:
   ```powershell
   # Already handled in create_image_labels.py (skips invalid)
   python scripts/create_image_labels.py
   ```

### Phase 2: Label Correction (1-2 days)

1. **Review Mislabels**:
   ```powershell
   python scripts/review_mislabels.py
   # Shows flagged images for manual review
   ```

2. **Fix Labels**:
   - Manually correct mislabeled images
   - Or use auto-correction for high-confidence cases

3. **Recreate Labels File**:
   ```powershell
   python scripts/create_image_labels.py
   ```

### Phase 3: Dataset Balancing (Optional)

1. **Balance Common Makes**:
   ```powershell
   python scripts/balance_dataset.py --max_samples_per_make 500
   ```

2. **Verify Distribution**:
   ```powershell
   python scripts/validate_classifier_dataset.py
   ```

### Phase 4: Retrain (After fixes)

1. **Retrain Model**:
   ```powershell
   python scripts/train_car_clip.py --epochs 20 --lr 2e-5
   ```

2. **Evaluate**:
   ```powershell
   python scripts/test_car_classifier.py
   ```

3. **Expected Improvement**: 25-35% Top-1 accuracy

## 📊 Priority Order

1. **HIGH**: Remove duplicates with inconsistent labels
2. **HIGH**: Filter rare makes (<10 samples)
3. **MEDIUM**: Fix mislabeled images (top 50-100)
4. **MEDIUM**: Remove corrupted images
5. **LOW**: Balance common makes (if still low accuracy)

## 🎯 Success Criteria

After fixes, expect:
- ✅ No duplicate images with different labels
- ✅ All makes have >=10 samples
- ✅ <5% mislabeled images
- ✅ All images are valid and loadable
- ✅ Top-1 accuracy: 25-35%+
- ✅ Top-5 accuracy: 60-75%+

## 📝 Next Steps

1. **Run validation**: `python scripts/validate_classifier_dataset.py`
2. **Review report**: Check `data/dataset_validation_report.md`
3. **Fix issues**: Follow priority order above
4. **Recreate labels**: `python scripts/create_image_labels.py`
5. **Retrain**: `python scripts/train_car_clip.py --epochs 20`

## 🔍 Monitoring

After retraining, check:
- Brand-specific accuracy improved
- Overall accuracy: 25-35%+
- No systematic misclassifications
- Training loss decreases smoothly
