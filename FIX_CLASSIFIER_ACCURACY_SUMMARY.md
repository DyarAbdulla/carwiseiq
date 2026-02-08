# Fix Car Make Classifier Accuracy - Complete Solution

## Root Cause Analysis

### Problem 1: Evaluation Script Bug (CRITICAL)
**Issue**: Evaluation script was using zero-shot CLIP prompts instead of the trained classifier head.

**Evidence**: 
- Validation accuracy: 16.45% (matches zero-shot CLIP performance)
- Test accuracy: 0% (evaluation bug)

**Fix**: Updated `test_car_classifier.py` to properly load and use the `CLIPFineTuner` model with classifier head.

### Problem 2: No Data Augmentation
**Issue**: Model only saw original images, limiting generalization.

**Fix**: Added augmentation transforms (flip, color jitter, rotation, translation).

### Problem 3: Class Imbalance
**Issue**: Some makes have many samples, others have few, hurting minority class performance.

**Fix**: Added weighted CrossEntropyLoss with balanced class weights.

### Problem 4: Suboptimal Hyperparameters
**Issue**: Learning rate too high (1e-4), not enough epochs (15).

**Fix**: Reduced LR to 2e-5, increased epochs to 20, added OneCycleLR scheduler.

### Problem 5: Missing Top-5 Metric
**Issue**: Only Top-1 accuracy tracked, but Top-5 is more practical for car classification.

**Fix**: Added Top-5 accuracy tracking in training, validation, and evaluation.

## Files Changed

### 1. `scripts/test_car_classifier.py` (MAJOR FIX)
**Changes**:
- ✅ Fixed `load_finetuned_model()` to load full `CLIPFineTuner` with classifier head
- ✅ Fixed `predict_make_model()` to use `model.make_classifier` instead of zero-shot CLIP
- ✅ Added proper train/val/test split (64%/16%/20%) with stratification
- ✅ Added Top-5 accuracy metrics
- ✅ Separate evaluation for validation and test sets

**Key Fix**:
```python
# Before (WRONG - zero-shot):
make_labels = [f"a photo of a {make} car" for make in makes]
outputs = clip_model(**inputs)  # Zero-shot CLIP

# After (CORRECT - trained classifier):
outputs = model(pixel_values, input_ids, attention_mask)
make_logits = outputs['make_logits']  # Trained classifier head
make_probs = torch.softmax(make_logits, dim=1)
```

### 2. `scripts/train_car_clip.py` (IMPROVEMENTS)
**Changes**:
- ✅ Added data augmentation transforms to `CarImageDataset`
- ✅ Added class balancing with weighted loss
- ✅ Added Top-5 accuracy tracking in training and validation
- ✅ Improved learning rate: 1e-4 → 2e-5
- ✅ Improved scheduler: CosineAnnealingLR → OneCycleLR (with warmup)
- ✅ Increased epochs: 15 → 20
- ✅ Proper train/val/test split with stratification

**Augmentation Transforms**:
- Random horizontal flip (50%)
- Color jitter (brightness, contrast, saturation, hue)
- Random rotation (±5 degrees)
- Random affine translation (5%)

## Expected Results

### Before Fixes:
- Validation: 16.45% (zero-shot CLIP baseline)
- Test: 0% (evaluation bug)

### After Fixes:
**Realistic Targets** (depends on dataset):

| Dataset Size | Makes | Expected Top-1 | Expected Top-5 |
|--------------|-------|----------------|----------------|
| Small (<5K) | 20-30 | 30-45% | 60-75% |
| Medium (5K-20K) | 30-50 | 40-60% | 70-85% |
| Large (20K+) | 50+ | 50-70% | 80-90% |

**Your dataset**: Check `data/image_labels.csv` to determine realistic targets.

## Testing Steps

### 1. Check Dataset
```powershell
cd scripts
python -c "import pandas as pd; df = pd.read_csv('../data/image_labels.csv'); print(f'Total images: {len(df)}'); print(f'Makes: {df[\"make\"].nunique()}'); print(df['make'].value_counts().head(10))"
```

### 2. Retrain Model
```powershell
python train_car_clip.py --epochs 20 --lr 2e-5
```

Expected output:
- Shows class weights computation
- Shows data augmentation enabled
- Shows Top-1 and Top-5 accuracy during training
- Best model saved to `models/car_clip_finetuned/best_model.pt`

### 3. Evaluate
```powershell
python test_car_classifier.py
```

Expected output:
```
--- VALIDATION SET ---
Make Accuracy (Top-1): XX.XX%
Make Accuracy (Top-5): XX.XX%

--- TEST SET ---
Make Accuracy (Top-1): XX.XX%
Make Accuracy (Top-5): XX.XX%
```

### 4. Compare Results
- Before: ~16.45% validation (zero-shot)
- After: Should be significantly higher (check your dataset size for realistic targets)

## Diagnosis Summary

**Why 16.45% validation accuracy?**
1. ✅ **Evaluation bug**: Script used zero-shot CLIP instead of trained classifier
2. ✅ **No class balancing**: Imbalanced classes hurt performance
3. ✅ **No augmentation**: Limited generalization
4. ✅ **Suboptimal LR**: Too high learning rate
5. ✅ **Limited training**: Only 15 epochs

**All issues fixed!**

## Status: ✅ COMPLETE

All improvements implemented:
- ✅ Fixed evaluation script bug (uses trained classifier)
- ✅ Added proper train/val/test split
- ✅ Added data augmentation
- ✅ Added class balancing
- ✅ Improved learning rate tuning
- ✅ Added Top-5 accuracy metric

**Ready to retrain and evaluate!**
