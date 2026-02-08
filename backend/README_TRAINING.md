# Car Make/Model Classifier – Training Guide

The `/api/ai/detect-car-vision` endpoint uses a **local CNN** (EfficientNetB4, two-headed: make + model) instead of an external API. This document describes how to prepare data, train, and deploy.

## Overview

- **Data:** 57,312+ images in `car_images/` named `car_000001.jpg`, `car_000002.jpg`, etc.
- **Output:** `data/car_labels.csv` → `data/splits.json` + `data/label_maps.json` → `models/car_classifier.keras` + `models/car_classifier_label_maps.json`
- **Inference:** `app/services/car_model_service.py` loads the model and runs locally (no external API).
- **Manual training (PowerShell, all GPU + CPU):** see **§6b**.

## 1. Label Images (`01_label_images.py`)

Creates `data/car_labels.csv` with columns: `filename`, `make`, `model`.

### Modes

| Mode | Description |
|------|-------------|
| `placeholder` | Sets `make=Unknown`, `model=Unknown` for all `car_*.jpg`. **Edit the CSV manually** to correct at least 1,000 rows for better training. |
| `from_dataset` | Fills labels from an existing CSV (e.g. `data/iqcars_cleaned.csv`) by matching `filename` (or `image_filename`). Unmatched → `Unknown`. |
| `claude_sample` | Uses Claude API to label a subset (requires `ANTHROPIC_API_KEY`). Rest → `Unknown`. |

### Commands

From project root (or `backend/`):

```bash
# Placeholder only (then edit data/car_labels.csv)
python backend/scripts/01_label_images.py --mode placeholder

# From existing dataset (adjust columns to match your CSV)
python backend/scripts/01_label_images.py --mode from_dataset \
  --dataset-csv data/iqcars_cleaned.csv \
  --filename-col image_filename --make-col make --model-col model

# Claude for first 500 (optional, costs API usage)
ANTHROPIC_API_KEY=sk-... python backend/scripts/01_label_images.py --mode claude_sample --claude-sample-size 500
```

### Paths

- `--car-images-dir`: default `car_images/` (project root). Override if needed, e.g. `C:\Car price prediction program Local E\car_images`.
- `--output-csv`: default `data/car_labels.csv`.

### Manual Labeling

1. Open `data/car_labels.csv` in Excel or a text editor.
2. Replace `Unknown` with real `make` and `model` (e.g. `Toyota`, `Camry`).
3. **Recommendation:** Correct at least 1,000–2,000 rows for meaningful training.

---

## 2. Prepare Dataset (`02_prepare_dataset.py`)

- Reads `data/car_labels.csv`.
- Drops makes with &lt; `--min-samples-per-make` (default 10).
- Stratified split: **70% train, 15% val, 15% test** by make.
- Writes:
  - `data/splits.json`: `train`, `val`, `test` lists of `{ path, filename, make, model, make_idx, model_idx }`.
  - `data/label_maps.json`: `make_to_idx`, `model_to_idx`, `make_list`, `model_list`, `num_makes`, `num_models`.

### Command

```bash
python backend/scripts/02_prepare_dataset.py
```

Options: `--labels-csv`, `--car-images-dir`, `--output-dir`, `--min-samples-per-make`, `--val-ratio`, `--test-ratio`.

---

## 3. Train Model (`03_train_model.py`)

- **Architecture:** EfficientNetB4 (ImageNet), two heads: **make** and **model** (softmax).
- **Augmentation:** rotation, horizontal flip, brightness, zoom (training only).
- **Training:** Adam lr=0.001, batch=32, epochs=50, early stopping on `val_loss` (patience=5).
- **Saves:**
  - `models/car_classifier.keras` (best by `val_loss`)
  - `models/car_classifier_label_maps.json` (copy of label maps for inference)
  - `models/training_report.txt` (val/test accuracy)

### Command

```bash
python backend/scripts/03_train_model.py
```

The script **uses all GPUs** (MirroredStrategy if 2+) and **all CPU cores** (TensorFlow intra/inter-op threads). For full commands and options, see **§6b**.

**Options:** `--splits-json`, `--label-maps`, `--model-dir`, `--batch-size`, `--epochs`, `--lr`, `--lr-reduce`, `--mixed-precision`, `--target-size` (224).

### Targets

- **Make accuracy:** &gt; 85%
- **Model accuracy:** &gt; 75%
- **Inference:** &lt; 3 s for 4–10 images on CPU.

### Hardware

- **Training:** GPU recommended; runs on CPU if needed.
- **Inference:** CPU is fine; first request loads the model (~few seconds), then &lt; 3 s per batch.

---

## 4. Inference and API

- **Service:** `app/services/car_model_service.py`
  - `detect_car_from_images(images: List[bytes])` → `{ make, model, confidence, error }`
  - Resize 224×224, EfficientNet preprocessing, majority vote over 4–10 images.
  - If `confidence < 0.6` for make or model, that field is `null`.
- **Endpoint:** `POST /api/ai/detect-car-vision`  
  - Input: `{ "images": [{ "data": "<base64>", "media_type": "image/jpeg" }] }` (4–10 images).  
  - Output: `{ "make", "model", "confidence", "error" }`.  
  - Same contract as before; **frontend needs no changes**.

### Model Paths

- Default: `models/car_classifier.keras` and `models/car_classifier_label_maps.json` under the **project root** (parent of `backend/`).
- Override via env:  
  `CAR_CLASSIFIER_MODEL`, `CAR_CLASSIFIER_LABEL_MAPS` (optional).

---

## 5. Folder Structure

```
project_root/
  car_images/           # 57,312+ car_000001.jpg, ...
  data/
    car_labels.csv      # from 01
    splits.json         # from 02
    label_maps.json     # from 02
  models/
    car_classifier.keras
    car_classifier_label_maps.json
    training_report.txt
  backend/
    scripts/
      01_label_images.py
      02_prepare_dataset.py
      03_train_model.py
    app/
      services/
        car_model_service.py
      api/routes/
        ai.py           # uses car_model_service for /detect-car-vision
```

---

## 6. Quick Start

1. **Labels (placeholder + manual):**
   ```bash
   python backend/scripts/01_label_images.py --mode placeholder
   # Edit data/car_labels.csv — fix at least 1000 rows
   ```

2. **Splits and label maps:**
   ```bash
   python backend/scripts/02_prepare_dataset.py
   ```

3. **Train:**
   ```bash
   python backend/scripts/03_train_model.py
   ```

4. **Run backend:**  
   The `/api/ai/detect-car-vision` endpoint will use `models/car_classifier.keras` and `models/car_classifier_label_maps.json` automatically.

---

## 6b. How to Start Training Manually in PowerShell (All GPU + CPU)

**`03_train_model.py` uses all available hardware:**
- **All GPUs:** MirroredStrategy (if 2+ GPUs), memory growth. Training runs on GPU (e.g. RTX 4060).
- **All CPU cores:** TensorFlow intra/inter-op threads = `cpu_count`; **tf.data parallel `map(..., num_parallel_calls=AUTOTUNE)`** so image load/preprocess runs on many CPU cores and keeps the GPU fed (avoids GPU at 2% and CPU at 84%).
- **Prefetch:** `tf.data.AUTOTUNE` to overlap data loading with GPU compute.

Run these in **PowerShell** from the **project root** (the folder that contains `backend/`, `car_images/`, `data/`).

---

### Step 1: Go to project root

```powershell
cd "C:\Car price prection program Local E"
```

(Use your actual project path if different.)

---

### Step 2: Create labels (if not already done)

**From your existing dataset** (e.g. `image_labels_cleaned.csv` with `image_filename` = `car_000001.jpg`):

```powershell
python backend/scripts/01_label_images.py --mode from_dataset --dataset-csv data/image_labels_cleaned.csv --filename-col image_filename --make-col make --model-col model --car-images-dir car_images --output-csv data/car_labels.csv
```

**Or placeholder** (then edit `data/car_labels.csv` manually):

```powershell
python backend/scripts/01_label_images.py --mode placeholder --car-images-dir car_images --output-csv data/car_labels.csv
```

---

### Step 3: Prepare dataset (splits + label maps)

```powershell
python backend/scripts/02_prepare_dataset.py --labels-csv data/car_labels.csv --car-images-dir car_images --output-dir data --min-samples-per-make 20
```

---

### Step 4: Start training (all GPU + CPU)

**For RTX 4060 8GB** (use `--mixed-precision` to use Tensor Cores and raise GPU utilization):

```powershell
python backend/scripts/03_train_model.py --splits-json data/splits.json --label-maps data/label_maps.json --model-dir models --epochs 80 --batch-size 32 --lr 0.0005 --lr-reduce --mixed-precision
```

**Basic** (all GPUs and CPU, no mixed precision):

```powershell
python backend/scripts/03_train_model.py --splits-json data/splits.json --label-maps data/label_maps.json --model-dir models --epochs 80 --batch-size 32 --lr 0.0005 --lr-reduce
```

**Larger batch** (if you have enough GPU memory):

```powershell
python backend/scripts/03_train_model.py --splits-json data/splits.json --label-maps data/label_maps.json --model-dir models --epochs 80 --batch-size 64 --lr 0.0005 --lr-reduce
```

**Shorter run** (e.g. to test):

```powershell
python backend/scripts/03_train_model.py --splits-json data/splits.json --label-maps data/label_maps.json --model-dir models --epochs 10 --batch-size 32
```

---

### Step 5: Outputs

After training finishes:

- `models/car_classifier.keras` – best model (by `val_loss`)
- `models/car_classifier_label_maps.json` – label maps for inference
- `models/training_report.txt` – val/test accuracy

---

### Training options (for Step 4)

| Option | Default | Description |
|--------|---------|-------------|
| `--epochs` | 50 | Number of epochs. Use 80–100 for best accuracy. |
| `--batch-size` | 32 | Increase (e.g. 64) if GPU memory allows. |
| `--lr` | 0.001 | Learning rate. 0.0005 often helps accuracy. |
| `--lr-reduce` | off | Add ReduceLROnPlateau (factor=0.5, patience=3). |
| `--mixed-precision` | off | `mixed_float16` on GPU (needs compatible GPU). |
| `--allow-cpu` | off | Allow training without GPU (default: exit if `GPUs []`). Use only if you must run on CPU. |
| `--splits-json` | `data/splits.json` | Path to splits from step 3. |
| `--label-maps` | `data/label_maps.json` | Path to label maps from step 3. |
| `--model-dir` | `models` | Where to save the `.keras` and `_label_maps.json`. |

---

### Run the backend after training

Start the API as usual. `/api/ai/detect-car-vision` will use `models/car_classifier.keras` and `models/car_classifier_label_maps.json` automatically.

---

## 7. Dependencies

In `backend/requirements.txt`:

- `tensorflow>=2.13.0`
- `pillow>=10.0.0`
- `numpy>=1.24.0`
- `scikit-learn>=1.3.0`
- `pandas>=2.0.0`

Install: `pip install -r backend/requirements.txt`

---

## 8. Best Recommendations for Highest Accuracy

Use these together for the best make/model accuracy (targets: **>90% make**, **>80% model**).

---

### 1. Data quality and quantity

| Recommendation | Why |
|----------------|-----|
| **Label 5,000–15,000+ images** correctly (not just 1,000) | More data reduces overfitting and improves rare classes. |
| **Prefer `from_dataset`** if you have a clean CSV (e.g. `iqcars_cleaned.csv`) with `image_filename` matching `car_XXXXXX.jpg` | Fewer manual errors than placeholder + hand edit. |
| **Remove or fix `Unknown`** | Either delete rows with `make=Unknown`/`model=Unknown` in the CSV before step 2, or replace with real make/model. Training on `Unknown` as a class usually hurts. |
| **Use consistent names** | One spelling per make/model (e.g. `Toyota` everywhere, not `Toyota.` or `TOYOTA`). |
| **Balance classes** | Avoid one make with >40–50% of samples. Add more images for rare makes or drop makes with very few samples. |

---

### 2. Step 2: prepare dataset

```bash
python backend/scripts/02_prepare_dataset.py --min-samples-per-make 20
```

- **`--min-samples-per-make 20`** (or **25–30**): drops makes with too few examples so the model can learn them. Default 10 is low for good accuracy.
- **Exclude `Unknown`**: before running 02, open `data/car_labels.csv`, delete rows where `make` or `model` is `Unknown`, then save.

---

### 3. Step 3: training for best accuracy

**Recommended command (run step 2 with `--min-samples-per-make 20` first):**

```bash
python backend/scripts/03_train_model.py --epochs 80 --batch-size 32 --lr 0.0005 --lr-reduce
```

**If you have a strong GPU and more data:**

```bash
python backend/scripts/03_train_model.py --epochs 100 --batch-size 64 --lr 0.0005 --lr-reduce
```

**Important:** `--min-samples-per-make` is for **step 2** (`02_prepare_dataset.py`) only. Re-run step 2 with e.g. `--min-samples-per-make 20`, then run step 3.

| Option | Default | For best accuracy |
|--------|---------|--------------------|
| `--epochs` | 50 | **80–100** (early stopping will usually stop earlier). |
| `--batch-size` | 32 | **32–64** if GPU memory allows. 64 can help BatchNorm. |
| `--lr` | 0.001 | **0.0005** for more stable training; if val loss is flat, try **0.001**. |
| `--lr-reduce` | off | **On** to use ReduceLROnPlateau (factor=0.5, patience=3). |
| `--target-size` | 224 | Keep **224** (EfficientNet expectation). |

---

### 4. Learning rate schedule (ReduceLROnPlateau)

For an extra gain, use a learning rate scheduler. `03_train_model.py` supports `--lr-reduce`:

```bash
python backend/scripts/03_train_model.py --epochs 80 --lr 0.001 --lr-reduce
```

- Adds `ReduceLROnPlateau`: if `val_loss` does not improve for 3 epochs, lr is multiplied by 0.5 (min 1e-6).

---

### 5. Data augmentation (already in 03)

The script uses: rotation 15°, horizontal flip, brightness [0.8, 1.2], zoom 0.1.  
If you see **overfitting** (val loss goes up while train loss goes down), you can later increase rotation or add width/height shift in the script. For most cases, the defaults are enough.

---

### 6. Two-phase training (optional, code change)

For a further bump:

1. **Phase 1:** freeze the EfficientNetB4 base, train only the two heads for 10–15 epochs (e.g. `--freeze-base-epochs 15` if we add it).
2. **Phase 2:** unfreeze the base and train all layers with a smaller lr (e.g. 0.0001) for the remaining epochs.

This would require a `--freeze-base-epochs` (or similar) option in `03_train_model.py`; it is not there yet but can be added if you want.

---

### 7. Recommended pipeline for best accuracy

```bash
# 1) Labels: use dataset or placeholder + manual (aim for 5k–15k correct rows; no Unknown)
python backend/scripts/01_label_images.py --mode from_dataset --dataset-csv data/iqcars_cleaned.csv --filename-col image_filename --make-col make --model-col model
# If needed: edit data/car_labels.csv to remove/fix Unknown and fix typos.

# 2) Split: drop rare makes
python backend/scripts/02_prepare_dataset.py --min-samples-per-make 20

# 3) Train: more epochs, lower lr, learning-rate reduction
python backend/scripts/03_train_model.py --epochs 80 --batch-size 32 --lr 0.0005 --lr-reduce
```

---

### 8. After training

- Check `models/training_report.txt` for **val** and **test** accuracy.
- **Make** accuracy usually improves first; **model** is harder (more classes). If model is weak, add more model labels and/or increase `--min-samples-per-make` and re-run 02 and 03.

---

## 9. Troubleshooting

| Issue | Check |
|-------|--------|
| `Car classifier model not loaded` | Ensure `models/car_classifier.keras` and `models/car_classifier_label_maps.json` exist after training. |
| Low accuracy | Follow **§8 Best Recommendations**: more/better labels, `--min-samples-per-make 20`, `--epochs 80`, `--lr 0.0005`; remove `Unknown`. |
| Overfitting (val loss rises) | More data; add Dropout; stronger augmentation; or freeze part of the base. |
| OOM during training | Reduce `--batch-size` (e.g. 16 or 8). |
| Slow inference | First request loads the model; use a GPU or ensure `models/` is on a fast disk. |
| **TensorFlow GPU not detected (GPUs [])** | CPU-only TensorFlow is installed. The script exits unless you pass `--allow-cpu`. To use RTX 4060, see below. |

---

### TensorFlow GPU not detected on Windows (TF 2.11+ is CPU-only on Windows)

If you see `TF 2.20.0` and `GPUs []`, TensorFlow is **CPU-only** and cannot use an RTX 4060. Two ways to get GPU support:

#### 1) WSL2 (recommended)

- Install **WSL2** and **Ubuntu**.
- In WSL2, install **NVIDIA drivers** (CUDA in WSL2 uses the Windows host driver; ensure the host has recent Game Ready / Studio drivers).
- In WSL2: `pip install tensorflow` (or `tensorflow[and-cuda]`). Run `python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"` and confirm your GPU is listed.
- Run `03_train_model.py` from the project folder inside WSL2 (e.g. `/mnt/c/...` or a Linux path).

#### 2) Windows-native: TensorFlow 2.10.x

TensorFlow **2.10.x** is the last version with **native Windows GPU support**. Newer TF (2.11+) on Windows is CPU-only.

1. **Uninstall current TensorFlow:**
   ```powershell
   pip uninstall -y tensorflow tensorflow-intel
   ```

2. **Install TensorFlow 2.10:**
   ```powershell
   pip install "tensorflow==2.10.*"
   ```

3. **Install matching CUDA and cuDNN** (for TF 2.10 on Windows):
   - **CUDA Toolkit 11.2**  
     https://developer.nvidia.com/cuda-11.2.0-download-archive  
   - **cuDNN 8.1** for CUDA 11.x  
     https://developer.nvidia.com/cudnn  

   Add their `bin` directories to `PATH` so `nvcc` and the cuDNN DLLs are found.

4. **Check GPU:**
   ```powershell
   python -c "import tensorflow as tf; print('TF', tf.__version__); print('GPUs', tf.config.list_physical_devices('GPU'))"
   ```
   You should see `GPUs [PhysicalDevice(name='/physical_device:GPU:0', device_type='GPU')]` (or similar).

**Note:** TF 2.10 is older; some APIs may differ. If you hit incompatibilities with `03_train_model.py`, prefer **WSL2**.
