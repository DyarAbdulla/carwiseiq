# Memory Optimization Update for train_car_clip.py

## ✅ Changes Applied

### 1. Reduced Batch Size
- **Before:** `batch_size: 16`
- **After:** `batch_size: 8`
- **Reason:** Reduces GPU memory usage by 50% per batch

### 2. Increased Gradient Accumulation
- **Before:** `gradient_accumulation_steps: 8`
- **After:** `gradient_accumulation_steps: 16`
- **Effective Batch Size:** Still maintains 128 (8 × 16 = 128)
- **Reason:** Simulates larger batch size without using more GPU memory

### 3. Reduced Data Loading Workers
- **Before:** `num_workers: 8`
- **After:** `num_workers: 2`
- **Reason:** Reduces RAM usage (each worker uses memory for prefetching)

### 4. More Aggressive Cache Clearing
- **Before:** `empty_cache_frequency: 10` (every 10 batches)
- **After:** `empty_cache_frequency: 5` (every 5 batches)
- **Additional:** Cache cleared after every epoch
- **Reason:** Prevents memory fragmentation and accumulation

### 5. Immediate Tensor Deletion
- **Added:** Delete all intermediate tensors immediately after use
- **Tensors deleted:** `pixel_values`, `input_ids`, `attention_mask`, `make_labels`, `outputs`, `loss`, `clip_loss`, `make_loss`, `make_logits`, `top5_preds`, `preds`, `labels`
- **Reason:** Frees GPU memory immediately instead of waiting for garbage collection

### 6. Gradient Checkpointing
- **Added:** `use_gradient_checkpointing: True`
- **Implementation:** Uses CLIP model's built-in `gradient_checkpointing_enable()`
- **Trade-off:** Saves ~30-40% GPU memory at cost of ~20% slower training
- **Reason:** Trades compute for memory (critical for 8GB GPU)

### 7. Automatic Filtered Dataset Usage
- **Priority Order:**
  1. `data/image_labels_filtered.csv` (if exists)
  2. `data/image_labels_cleaned.csv` (if filtered not found)
  3. `data/image_labels.csv` (fallback)
- **Status:** ✅ Already implemented

### 8. Mixed Precision (FP16)
- **Status:** ✅ Already enabled (`mixed_precision: True`)
- **Benefit:** Reduces memory usage by ~50% compared to FP32

## 📊 Expected Memory Usage

### Before Optimizations:
- Batch size 16: ~6-7 GB GPU memory
- Risk: CUDA OOM errors

### After Optimizations:
- Batch size 8: ~3-4 GB GPU memory
- With gradient checkpointing: ~2-3 GB GPU memory
- Safety margin: ~5 GB free on RTX 4060 8GB

## 🚀 Usage

### Default (Optimized Settings):
```powershell
python scripts/train_car_clip.py
```

### Custom Settings:
```powershell
python scripts/train_car_clip.py --batch_size 8 --gradient_accumulation 16 --num_workers 2
```

## ⚠️ Important Notes

1. **Training Speed:** Will be slower due to:
   - Smaller batch size (more iterations)
   - Gradient checkpointing (~20% slower)
   - Fewer workers (slower data loading)
   
2. **Effective Batch Size:** Still 128 (8 × 16), so training quality should be similar

3. **Memory Monitoring:** Script logs GPU memory usage after each epoch

4. **If Still OOM:** Further reduce batch_size to 4 and increase gradient_accumulation to 32

## ✅ Verification

Check that training starts without OOM errors:
```powershell
python scripts/train_car_clip.py --epochs 1
```

Monitor GPU memory:
```powershell
nvidia-smi -l 1
```

Expected: GPU memory should stay below 5 GB during training.
