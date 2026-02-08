# Improve Car Make Classifier Accuracy

## Current Problem
- Validation accuracy: 16.45% (very low)
- Test accuracy: 0% (evaluation bug)
- Root cause: Evaluation script uses zero-shot CLIP instead of trained classifier head

## Fixes Applied

### 1. Fixed Evaluation Script Bug ✅
**File**: `scripts/test_car_classifier.py`

**Problem**: The `predict_make_model()` function was using zero-shot CLIP prompts instead of the trained classifier head.

**Fix**:
- Updated `load_finetuned_model()` to load the full `CLIPFineTuner` model with classifier head
- Updated `predict_make_model()` to use `model.make_classifier` for predictions
- Added `use_classifier` parameter to toggle between classifier and zero-shot

**Key Changes**:
```python
# Before: Used zero-shot CLIP prompts
make_labels = [f"a photo of a {make} car" for make in makes]
outputs = clip_model(**inputs)  # Zero-shot

# After: Uses trained classifier head
outputs = model(pixel_values, input_ids, attention_mask)
make_logits = outputs['make_logits']  # Trained classifier
make_probs = torch.softmax(make_logits, dim=1)
```

### 2. Added Proper Train/Val/Test Split ✅
**File**: `scripts/test_car_classifier.py`

- Added stratified train/val/test split (64%/16%/20%)
- Evaluation now reports separate metrics for validation and test sets
- Test set saved to `data/test_set.csv` for consistent evaluation

### 3. Added Data Augmentation ✅
**File**: `scripts/train_car_clip.py`

- Added `CarImageDataset` augmentation transforms:
  - Random horizontal flip (50%)
  - Color jitter (brightness, contrast, saturation, hue)
  - Random rotation (±5 degrees)
  - Random affine translation (5%)
- Augmentation only applied during training (not validation/test)

### 4. Added Class Balancing ✅
**File**: `scripts/train_car_clip.py`

- Computes class weights using `sklearn.utils.class_weight.compute_class_weight('balanced')`
- Applies weighted CrossEntropyLoss to handle imbalanced classes
- Weights computed from training set distribution

### 5. Improved Learning Rate Tuning ✅
**File**: `scripts/train_car_clip.py`

- Changed default learning rate: `1e-4` → `2e-5` (better convergence)
- Added OneCycleLR scheduler (with warmup) as primary scheduler
- Falls back to CosineAnnealingLR if OneCycleLR not available
- Increased epochs: 15 → 20

### 6. Added Top-5 Accuracy Metric ✅
**Files**: `scripts/train_car_clip.py`, `scripts/test_car_classifier.py`

- Added Top-5 accuracy tracking in training loop
- Added Top-5 accuracy in validation
- Added Top-5 accuracy in evaluation script
- More practical metric for car classification (user can select from top-5)

## Files Changed

1. ✅ `scripts/test_car_classifier.py`
   - Fixed `load_finetuned_model()` to load full model with classifier
   - Fixed `predict_make_model()` to use classifier head
   - Added proper train/val/test split
   - Added Top-5 accuracy metrics

2. ✅ `scripts/train_car_clip.py`
   - Added data augmentation transforms
   - Added class balancing with weighted loss
   - Added Top-5 accuracy tracking
   - Improved learning rate (2e-5) and scheduler (OneCycleLR)
   - Increased epochs to 20
   - Proper train/val/test split with stratification

## Expected Improvements

### Before Fixes:
- Validation: 16.45% (zero-shot CLIP performance)
- Test: 0% (evaluation bug)

### After Fixes:
- **Realistic Targets** (based on dataset size and class distribution):
  - **Top-1 Accuracy**: 40-60% (if dataset has 50+ makes with good distribution)
  - **Top-5 Accuracy**: 70-85% (more practical metric)
  - **Test Accuracy**: Should match validation (within 2-3%)

### Factors Affecting Accuracy:
1. **Dataset size**: More images per make = higher accuracy
2. **Class balance**: Balanced classes = better performance
3. **Image quality**: Clear, centered car images perform better
4. **Number of makes**: Fewer makes = higher accuracy

## Testing Steps

### 1. Retrain Model with Improvements
```powershell
cd scripts
python train_car_clip.py --epochs 20 --lr 2e-5
```

Expected output:
- Shows class weights computation
- Shows data augmentation enabled
- Shows Top-1 and Top-5 accuracy during training
- Saves model to `models/car_clip_finetuned/best_model.pt`

### 2. Evaluate with Fixed Script
```powershell
python test_car_classifier.py
```

Expected output:
```
--- VALIDATION SET ---
Total samples: XXX
Make Accuracy (Top-1): XX.XX%
Make Accuracy (Top-5): XX.XX%

--- TEST SET ---
Total samples: XXX
Make Accuracy (Top-1): XX.XX%
Make Accuracy (Top-5): XX.XX%
```

### 3. Compare Before/After
- Before: ~16.45% validation (zero-shot CLIP)
- After: Should be significantly higher (40-60%+ depending on dataset)

## Diagnosis: Why Was Validation Only 16.45%?

1. **Evaluation Bug**: Script was using zero-shot CLIP instead of trained classifier
2. **No Class Balancing**: Imbalanced classes hurt minority class performance
3. **No Data Augmentation**: Limited generalization
4. **Suboptimal Learning Rate**: 1e-4 might have been too high
5. **Limited Training**: Only 15 epochs might not be enough

## Realistic Accuracy Targets

Based on typical car classification datasets:

| Dataset Size | Makes | Expected Top-1 | Expected Top-5 |
|--------------|-------|----------------|----------------|
| Small (<5K images) | 20-30 | 30-45% | 60-75% |
| Medium (5K-20K) | 30-50 | 40-60% | 70-85% |
| Large (20K+) | 50+ | 50-70% | 80-90% |

**Your target**: Check your dataset size and number of makes to set realistic expectations.

## Status: ✅ COMPLETE

All improvements implemented:
- ✅ Fixed evaluation script bug
- ✅ Added proper train/val/test split
- ✅ Added data augmentation
- ✅ Added class balancing
- ✅ Improved learning rate tuning
- ✅ Added Top-5 accuracy metric

**Next Steps**:
1. Retrain model: `python scripts/train_car_clip.py --epochs 20`
2. Evaluate: `python scripts/test_car_classifier.py`
3. Compare results and adjust hyperparameters if needed
