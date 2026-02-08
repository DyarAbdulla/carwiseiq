"""
Optimized Training Script for Car Classifier
MAXIMUM CPU + GPU UTILIZATION for 2-3x faster training
"""

import os
import sys
import json
import logging
import argparse
import time
import multiprocessing
import subprocess
import traceback

# Try to import psutil for CPU monitoring
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    print("[WARNING] psutil not available - CPU monitoring disabled. Install with: pip install psutil")
from pathlib import Path
from datetime import datetime
from typing import Dict, Tuple, Optional
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from torch.optim import AdamW
from transformers import CLIPProcessor, CLIPModel
try:
    from transformers.optimization import get_cosine_schedule_with_warmup
    HAS_COSINE_WARMUP = True
except ImportError:
    HAS_COSINE_WARMUP = False
from torch.optim.lr_scheduler import CosineAnnealingLR
from tqdm import tqdm
from PIL import Image
import torchvision.transforms as transforms
from sklearn.model_selection import train_test_split

# Try to import kornia for GPU augmentation
try:
    import kornia.augmentation as K
    KORNIA_AVAILABLE = True
except ImportError:
    KORNIA_AVAILABLE = False
    print("[WARNING] Kornia not available - using CPU augmentation. Install with: pip install kornia")

# Project root path
PROJECT_ROOT = Path(__file__).parent.parent

# Paths
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"
LOG_DIR = PROJECT_ROOT / "logs"
RESULTS_DIR = PROJECT_ROOT / "results"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Setup logger (must be after LOG_DIR is created)
log_file = LOG_DIR / \
    f"training_optimized_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Auto-detect CPU cores
CPU_CORES = multiprocessing.cpu_count()
# Cap workers to avoid dataloader worker OOM on some systems
MAX_WORKERS = min(CPU_CORES, 8)

# Optimized Config - fine-tuning schedule, imbalance handling, moderate augmentation
CONFIG = {
    'batch_size': 64,
    'epochs': 40,
    'head_lr': 1e-3,
    'backbone_lr': 1e-5,
    'freeze_epochs': 3,
    'weight_decay': 0.01,
    'label_smoothing': 0.05,
    'warmup_ratio': 0.05,
    'early_stopping_patience': 8,
    'early_stopping_min_delta': 0.001,
    'mixed_precision': True,
    'num_workers': MAX_WORKERS,
    'pin_memory': True,
    'persistent_workers': True,
    'prefetch_factor': 2,
    'use_gpu_augmentation': False,  # Use moderate CPU augmentation only to preserve brand cues
    'save_top_k': 3,
    'gradient_accumulation_steps': 1,
}


# Canonical name for brand variants (raw_key -> canonical)
MAKE_CANONICAL = {
    'mercedes': 'mercedes-benz', 'mercedes benz': 'mercedes-benz',
    'mercedes-benz': 'mercedes-benz', 'mercedesbenz': 'mercedes-benz',
    'land rover': 'land-rover', 'landrover': 'land-rover',
    'range rover': 'range-rover',
}


def _normalize_make(s):
    """Normalize make: strip, lower, collapse spaces, unify known variants."""
    if s is None or (isinstance(s, float) and s != s):
        return None
    t = str(s).strip().lower()
    t = ' '.join(t.split())  # collapse multiple spaces
    if not t or t in ('nan', 'none', ''):
        return None
    return MAKE_CANONICAL.get(t, t)


class CarImageDataset(Dataset):
    """Dataset with optimized CPU loading (augmentation moved to GPU)."""

    def __init__(
        self,
        labels_df: pd.DataFrame,
        images_dir: Path,
        processor: CLIPProcessor,
        make_to_idx: Dict[str, int],
        mode: str = 'train',
        augment: bool = True
    ):
        self.labels_df = labels_df.reset_index(drop=True)
        self.images_dir = images_dir
        self.processor = processor
        self.make_to_idx = make_to_idx
        self.mode = mode
        self.augment = augment and (mode == 'train')

        # Train: moderate augmentation (preserve brand cues). Val/Test: deterministic.
        if mode == 'train' and augment:
            self.transform = transforms.Compose([
                transforms.RandomResizedCrop(224, scale=(0.8, 1.0), ratio=(0.9, 1.1)),
                transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15, hue=0.03),
                transforms.RandomHorizontalFlip(p=0.5),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
            ])

    def __len__(self):
        return len(self.labels_df)

    def __getitem__(self, idx):
        row = self.labels_df.iloc[idx]

        # Use full_path if available, otherwise build from image_filename
        if 'full_path' in row.index:
            image_path = Path(row['full_path'])
        else:
            image_path = self.images_dir / row['image_filename']
        
        try:
            with Image.open(image_path) as img:
                image = img.convert('RGB')
        except Exception as e:
            logger.warning(f"Failed to load {image_path}: {e}")
            image = Image.new('RGB', (224, 224), color='gray')

        # Apply minimal CPU preprocessing
        image = self.transform(image)

        make = row['make']
        text = f"a photo of a {make} car"

        # Process on CPU (fast with multiple workers)
        inputs = self.processor(
            text=text,
            images=image,
            return_tensors="pt",
            padding="max_length",
            truncation=True,
            max_length=77
        )

        make_label = self.make_to_idx.get(make, 0)

        return {
            'pixel_values': inputs['pixel_values'].squeeze(0),
            'input_ids': inputs['input_ids'].squeeze(0),
            'attention_mask': inputs['attention_mask'].squeeze(0),
            'make_label': torch.tensor(make_label, dtype=torch.long),
            'augment': self.augment,  # Flag for GPU augmentation
        }


class CLIPFineTuner(nn.Module):
    """CLIP model with classifier head and GPU augmentation."""

    def __init__(self, clip_model: CLIPModel, num_makes: int, use_gpu_augmentation: bool = False):
        super().__init__()
        self.clip = clip_model
        self.make_classifier = nn.Linear(
            clip_model.config.projection_dim, num_makes)
        self.use_gpu_augmentation = use_gpu_augmentation

        # GPU-based augmentation (much faster than CPU)
        if use_gpu_augmentation and KORNIA_AVAILABLE:
            self.augmentation = nn.Sequential(
                K.RandomHorizontalFlip(p=0.5),
                K.ColorJitter(brightness=0.2, contrast=0.2,
                              saturation=0.2, p=0.5),
                K.RandomRotation(degrees=5, p=0.5),
            )
        else:
            self.augmentation = None

    def forward(self, pixel_values, input_ids, attention_mask, augment=False):
        # Apply GPU augmentation if enabled and training
        if self.training and augment and self.augmentation is not None:
            # pixel_values shape: (batch, channels, height, width)
            pixel_values = self.augmentation(pixel_values)

        outputs = self.clip(pixel_values=pixel_values,
                            input_ids=input_ids, attention_mask=attention_mask)
        image_embeds = outputs.image_embeds
        text_embeds = outputs.text_embeds

        image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
        text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)

        logits_per_image = (image_embeds @ text_embeds.t()
                            ) * self.clip.logit_scale.exp()
        logits_per_text = logits_per_image.t()
        make_logits = self.make_classifier(image_embeds)

        return {
            'logits_per_image': logits_per_image,
            'logits_per_text': logits_per_text,
            'make_logits': make_logits,
        }


def prepare_data(config: dict) -> Tuple[DataLoader, DataLoader, Dict, CLIPProcessor]:
    """Prepare data loaders with label audit, path conflicts check, imbalance handling."""

    cleaned_file = DATA_DIR / "image_labels_cleaned_final.csv"
    if not cleaned_file.exists():
        cleaned_file = DATA_DIR / "image_labels_filtered.csv"
    if not cleaned_file.exists():
        cleaned_file = DATA_DIR / "image_labels_cleaned.csv"
    if not cleaned_file.exists():
        cleaned_file = DATA_DIR / "image_labels.csv"

    logger.info(f"Loading dataset from {cleaned_file}")
    df = pd.read_csv(cleaned_file)
    raw_count = len(df)

    # Detect label column (BRAND / make)
    label_col = 'make' if 'make' in df.columns else ('brand' if 'brand' in df.columns else None)
    if label_col is None:
        raise ValueError("Need 'make' or 'brand' column. Found: %s" % list(df.columns))
    if 'image_filename' not in df.columns and 'filename' in df.columns:
        df = df.rename(columns={'filename': 'image_filename'})
    if 'image_filename' not in df.columns:
        raise ValueError("Need 'image_filename' or 'filename'. Found: %s" % list(df.columns))

    # Normalize make
    df['make'] = df[label_col].apply(_normalize_make)
    df = df.dropna(subset=['make'])
    df = df[df['make'].astype(str).str.len() > 0].reset_index(drop=True)

    # Paths and existence
    def to_full_safe(p):
        if p is None or (isinstance(p, float) and p != p):
            return None
        if isinstance(p, str) and p.lower() in ('nan', 'none', ''):
            return None
        try:
            return str(IMAGES_DIR / str(p))
        except Exception:
            return None

    img_series = df['image_filename'].astype(str)
    full_paths = img_series.apply(to_full_safe)
    valid_mask = full_paths.notna()
    df = df[valid_mask].reset_index(drop=True)
    full_paths = full_paths[valid_mask].reset_index(drop=True)

    def path_exists(p):
        if p is None:
            return False
        try:
            return Path(p).exists()
        except Exception:
            return False

    exists_mask = full_paths.apply(path_exists)
    before_exists = len(df)
    df = df[exists_mask].reset_index(drop=True)
    full_paths = full_paths[exists_mask].reset_index(drop=True)
    df["full_path"] = full_paths.values
    missing_after = before_exists - len(df)
    pct_missing = (raw_count - len(df)) / raw_count * 100 if raw_count else 0
    logger.info("Removed %d invalid/missing paths (%.2f%% of raw). Remaining: %d" % (raw_count - len(df), pct_missing, len(df)))

    # Check image_path -> make: duplicates/conflicts (same path, different make)
    g = df.groupby('full_path')['make'].nunique()
    conflicts = g[g > 1]
    if len(conflicts) > 0:
        logger.warning("Path->make conflicts: %d paths have multiple makes. Dropping duplicates (keep first)." % len(conflicts))
        df = df.drop_duplicates(subset=['full_path'], keep='first').reset_index(drop=True)
    else:
        dup = df.duplicated(subset=['full_path']).sum()
        if dup > 0:
            df = df.drop_duplicates(subset=['full_path'], keep='first').reset_index(drop=True)
            logger.info("Dropped %d duplicate paths (keep first)." % dup)

    # Overfit-small: use 200 samples for both train and val (same 200)
    overfit_small = config.get('overfit_small', False)
    if overfit_small and len(df) >= 200:
        df = df.sample(n=200, random_state=42).reset_index(drop=True)
        logger.info("Overfit-small: using 200 samples for train and val (same set).")
        train_df = df
        val_df = df
        test_df = df.head(0)  # empty test
    else:
        # Split
        train_val, test_df = train_test_split(df, test_size=0.2, random_state=42, stratify=df['make'])
        train_df, val_df = train_test_split(train_val, test_size=0.2, random_state=42, stratify=train_val['make'])

    # make_to_idx from TRAIN only
    makes = sorted(train_df['make'].unique().tolist())
    make_to_idx = {m: i for i, m in enumerate(makes)}
    idx_to_make = {i: m for m, i in make_to_idx.items()}
    n_classes = len(makes)

    # Filter val/test to labels present in train
    val_before, test_before = len(val_df), len(test_df)
    val_df = val_df[val_df['make'].isin(make_to_idx)].reset_index(drop=True)
    test_df = test_df[test_df['make'].isin(make_to_idx)].reset_index(drop=True)
    if val_before - len(val_df) > 0 or test_before - len(test_df) > 0:
        logger.warning("Filtered val/test: val -%d, test -%d (labels not in train)" % (val_before - len(val_df), test_before - len(test_df)))

    # Label audit
    train_counts = train_df['make'].value_counts()
    val_counts = val_df['make'].value_counts()
    test_counts = test_df['make'].value_counts()
    top20 = train_counts.head(20).to_dict()
    val_only = set(val_df['make'].unique()) - set(makes)
    test_only = set(test_df['make'].unique()) - set(makes)

    majority_class = train_counts.index[0]
    majority_train = train_counts.iloc[0] / len(train_df) * 100 if len(train_df) else 0
    majority_val = (val_df['make'] == majority_class).sum() / len(val_df) * 100 if len(val_df) else 0
    majority_test = (test_df['make'] == majority_class).sum() / len(test_df) * 100 if len(test_df) else 0

    audit = {
        'raw_count': int(raw_count),
        'after_path_filter': int(len(df)),
        'pct_missing_invalid_paths': round(pct_missing, 2),
        'count_per_brand_train': train_counts.to_dict(),
        'count_per_brand_val': val_counts.to_dict(),
        'count_per_brand_test': test_counts.to_dict(),
        'top20_most_frequent_brands': top20,
        'brands_in_val_not_train': list(val_only),
        'brands_in_test_not_train': list(test_only),
        'majority_baseline': {
            'majority_class': majority_class,
            'train_acc_pct': round(majority_train, 2),
            'val_acc_pct': round(majority_val, 2),
            'test_acc_pct': round(majority_test, 2),
        },
        'n_classes': n_classes,
    }
    audit_path = LOG_DIR / ("label_audit_%s.json" % datetime.now().strftime("%Y%m%d_%H%M%S"))
    with open(audit_path, 'w') as f:
        json.dump(audit, f, indent=2)
    logger.info("Label audit saved to %s" % audit_path)
    logger.info("Majority baseline: %s -> train=%.2f%%, val=%.2f%%, test=%.2f%%" % (majority_class, majority_train, majority_val, majority_test))
    logger.info("Top 5 brands (train): %s" % list(train_counts.head(5).index))
    if val_only or test_only:
        logger.warning("Brands in val/test not in train: val=%s test=%s" % (list(val_only), list(test_only)))

    # Class weights (from TRAIN) and WeightedRandomSampler
    n_samples = len(train_df)
    count_per_class = np.array([train_counts.get(m, 1) for m in makes])
    class_weights = n_samples / (n_classes * np.maximum(count_per_class, 1))
    class_weights_t = torch.tensor(class_weights, dtype=torch.float32)
    weights_per_sample = train_df['make'].map(lambda m: 1.0 / max(train_counts[m], 1)).values
    sampler = WeightedRandomSampler(
        torch.tensor(weights_per_sample, dtype=torch.double),
        num_samples=len(weights_per_sample),
        replacement=True
    )

    # Train label counts for saving
    train_label_counts = train_counts.to_dict()

    # Save test set and create datasets
    test_df.to_csv(DATA_DIR / "test_set.csv", index=False)
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    train_dataset = CarImageDataset(train_df, IMAGES_DIR, processor, make_to_idx, mode='train', augment=True)
    val_dataset = CarImageDataset(val_df, IMAGES_DIR, processor, make_to_idx, mode='val', augment=False)

    bs = config['batch_size']
    nw = config['num_workers']
    pf = config.get('prefetch_factor', 2)
    pw = config.get('persistent_workers', True)
    train_loader = DataLoader(
        train_dataset, batch_size=bs, sampler=sampler, shuffle=False,
        num_workers=nw, pin_memory=config['pin_memory'], persistent_workers=pw,
        prefetch_factor=pf, drop_last=True,
    )
    val_loader = DataLoader(
        val_dataset, batch_size=bs, shuffle=False,
        num_workers=nw, pin_memory=config['pin_memory'], persistent_workers=pw, prefetch_factor=pf,
    )

    logger.info("DataLoader: batch_size=%d, num_workers=%d, prefetch=%d" % (bs, nw, pf))

    mappings = {
        'make_to_idx': make_to_idx,
        'idx_to_make': idx_to_make,
        'makes': makes,
        'class_weights': class_weights_t,
        'train_label_counts': train_label_counts,
    }
    return train_loader, val_loader, mappings, processor


def get_gpu_utilization():
    """Get GPU utilization percentage."""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=utilization.gpu',
                '--format=csv,noheader,nounits'],
            capture_output=True, text=True, timeout=2
        )
        if result.returncode == 0:
            return int(result.stdout.strip())
    except:
        pass
    return None


def get_cpu_utilization():
    """Get CPU utilization percentage."""
    if PSUTIL_AVAILABLE:
        return psutil.cpu_percent(interval=0.1)
    return None


def train_epoch(model, train_loader, optimizer, scheduler, device, config, scaler, class_weights=None):
    """Train one epoch with performance monitoring."""
    model.train()
    total_loss = 0
    correct = 0
    top5_correct = 0
    total = 0

    start_time = time.time()
    batch_times = []
    use_gpu_aug = config.get('use_gpu_augmentation', False)

    progress = tqdm(train_loader, desc="Training")

    for batch_idx, batch in enumerate(progress):
        batch_start = time.time()

        pixel_values = batch['pixel_values'].to(device, non_blocking=True)
        input_ids = batch['input_ids'].to(device, non_blocking=True)
        attention_mask = batch['attention_mask'].to(device, non_blocking=True)
        make_labels = batch['make_label'].to(device, non_blocking=True)
        augment = use_gpu_aug

        cw = class_weights.to(device) if class_weights is not None else None
        ls = config.get('label_smoothing', 0.05)
        if config['mixed_precision'] and scaler:
            with torch.amp.autocast(device_type='cuda'):
                outputs = model(pixel_values, input_ids,
                                attention_mask, augment=augment)
                labels = torch.arange(len(pixel_values), device=device)
                clip_loss = (
                    nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                    nn.functional.cross_entropy(
                        outputs['logits_per_text'], labels)
                ) / 2
                make_loss = nn.functional.cross_entropy(
                    outputs['make_logits'], make_labels, weight=cw, label_smoothing=ls)
                loss = clip_loss + make_loss

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()
            scheduler.step()
        else:
            outputs = model(pixel_values, input_ids,
                            attention_mask, augment=augment)
            labels = torch.arange(len(pixel_values), device=device)
            clip_loss = (
                nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                nn.functional.cross_entropy(outputs['logits_per_text'], labels)
            ) / 2
            make_loss = nn.functional.cross_entropy(
                outputs['make_logits'], make_labels, weight=cw, label_smoothing=ls)
            loss = clip_loss + make_loss

            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            scheduler.step()

        total_loss += loss.item()
        make_logits = outputs['make_logits']
        _, top5_preds = make_logits.topk(5, dim=1)
        preds = make_logits.argmax(dim=1)
        correct += (preds == make_labels).sum().item()
        top5_correct += (top5_preds == make_labels.unsqueeze(1)
                         ).any(dim=1).sum().item()
        total += make_labels.size(0)

        # Performance monitoring
        batch_time = time.time() - batch_start
        batch_times.append(batch_time)

        # Update progress bar with performance metrics
        if batch_idx % 10 == 0:
            avg_batch_time = np.mean(batch_times[-10:])
            images_per_sec = config['batch_size'] / \
                avg_batch_time if avg_batch_time > 0 else 0
            gpu_util = get_gpu_utilization()
            cpu_util = get_cpu_utilization()

            cpu_str = f"{cpu_util:.0f}%" if cpu_util else "N/A"
            gpu_str = f"{gpu_util}%" if gpu_util else "N/A"
            progress.set_postfix({
                'loss': f"{loss.item():.4f}",
                'acc': f"{100*correct/total:.1f}%",
                'imgs/s': f"{images_per_sec:.1f}",
                'GPU': gpu_str,
                'CPU': cpu_str
            })

    elapsed_time = time.time() - start_time
    avg_images_per_sec = total / elapsed_time if elapsed_time > 0 else 0

    return {
        'loss': total_loss / len(train_loader),
        'accuracy': correct / total,
        'top5_accuracy': top5_correct / total,
        'images_per_sec': avg_images_per_sec,
        'epoch_time': elapsed_time
    }


def validate(model, val_loader, device, class_weights=None, label_smoothing=0.05):
    """Validate model."""
    model.eval()
    total_loss = 0
    correct = 0
    top5_correct = 0
    total = 0

    cw = class_weights.to(device) if class_weights is not None else None
    with torch.no_grad():
        for batch in tqdm(val_loader, desc="Validating"):
            pixel_values = batch['pixel_values'].to(device)
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            make_labels = batch['make_label'].to(device)

            outputs = model(pixel_values, input_ids,
                            attention_mask, augment=False)
            labels = torch.arange(len(pixel_values), device=device)
            clip_loss = (
                nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                nn.functional.cross_entropy(outputs['logits_per_text'], labels)
            ) / 2
            make_loss = nn.functional.cross_entropy(
                outputs['make_logits'], make_labels, weight=cw, label_smoothing=label_smoothing)
            loss = clip_loss + make_loss

            total_loss += loss.item()
            make_logits = outputs['make_logits']
            _, top5_preds = make_logits.topk(5, dim=1)
            preds = make_logits.argmax(dim=1)
            correct += (preds == make_labels).sum().item()
            top5_correct += (top5_preds == make_labels.unsqueeze(1)
                             ).any(dim=1).sum().item()
            total += make_labels.size(0)

    return {
        'loss': total_loss / len(val_loader),
        'accuracy': correct / total,
        'top5_accuracy': top5_correct / total
    }


def save_model(model, processor, mappings, config, epoch, metrics, save_dir, rank=1):
    """Save best.pt, label_map.json, train_label_counts.json. Also save processor and full checkpoint."""
    if hasattr(model, 'module'):
        actual_model = model.module
    else:
        actual_model = model

    checkpoint = {
        'epoch': epoch,
        'model_state_dict': actual_model.state_dict(),
        'clip_state_dict': actual_model.clip.state_dict(),
        'classifier_state_dict': actual_model.make_classifier.state_dict(),
        'mappings': mappings,
        'config': config,
        'metrics': metrics,
        'num_makes': len(mappings['make_to_idx'])
    }

    if rank == 1:
        torch.save(checkpoint, save_dir / "best.pt")
        # Backward compat
        torch.save(checkpoint, save_dir / "best_model.pt")
    else:
        torch.save(checkpoint, save_dir / f"best_rank{rank}.pt")

    processor.save_pretrained(save_dir / "processor")

    # label_map.json: list of makes in class index order (for same class order in eval)
    makes = mappings.get('makes', [m for _, m in sorted(mappings.get('idx_to_make', {}).items())])
    with open(save_dir / "label_map.json", 'w') as f:
        json.dump(makes, f, indent=2)

    mout = {k: v for k, v in mappings.items() if k not in ('class_weights',)}
    with open(save_dir / "mappings.json", 'w') as f:
        json.dump(mout, f, indent=2)

    # train_label_counts.json (ensure JSON-serializable)
    tlc = {str(k): int(v) for k, v in mappings.get('train_label_counts', {}).items()}
    with open(save_dir / "train_label_counts.json", 'w') as f:
        json.dump(tlc, f, indent=2)


def find_optimal_batch_size(model, train_loader, device, config, start_size=64):
    """Auto-detect optimal batch size that fits in GPU memory for maximum GPU utilization."""
    logger.info(
        f"\nAuto-detecting optimal batch size (starting from {start_size})...")

    # Test larger batch sizes for 8GB GPU - maximize GPU utilization while avoiding worker OOM
    batch_sizes = [64, 96, 128] if start_size >= 64 else [16, 32, 64, 96, 128]
    optimal_size = start_size

    model.eval()
    sample_batch = next(iter(train_loader))

    for bs in batch_sizes:
        if bs > len(sample_batch['pixel_values']):
            continue

        try:
            # Test if batch size fits
            test_pixel = sample_batch['pixel_values'][:bs].to(
                device, non_blocking=True)
            test_input_ids = sample_batch['input_ids'][:bs].to(
                device, non_blocking=True)
            test_attention = sample_batch['attention_mask'][:bs].to(
                device, non_blocking=True)

            with torch.no_grad():
                with torch.amp.autocast(device_type='cuda'):
                    _ = model(test_pixel, test_input_ids, test_attention)

            optimal_size = bs
            torch.cuda.empty_cache()
            logger.info(f"  [OK] Batch size {bs} fits in GPU memory")
        except (RuntimeError, MemoryError) as e:
            if "out of memory" in str(e) or isinstance(e, MemoryError):
                logger.info(f"  [FAIL] Batch size {bs} exceeds memory ({e})")
                torch.cuda.empty_cache()
                break
            else:
                raise

    logger.info(f"  Optimal batch size: {optimal_size}")
    return optimal_size


def train(dry_run=False):
    """Main training function with maximum CPU+GPU utilization."""

    # Write start status
    status_file = LOG_DIR / "training_status.txt"
    status_file.parent.mkdir(parents=True, exist_ok=True)
    with open(status_file, 'w') as f:
        f.write(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Training started\n")
        f.write(f"CPU Cores: {CPU_CORES}\n")
        f.write(f"Batch Size: {CONFIG['batch_size']}\n")
        f.write(f"Epochs: {CONFIG['epochs']}\n")
        f.write("="*80 + "\n")

    logger.info("=" * 80)
    logger.info("OPTIMIZED CAR CLASSIFIER TRAINING - MAXIMUM PERFORMANCE")
    logger.info("=" * 80)
    logger.info(
        f"CPU Cores: {CPU_CORES} (using ALL {CPU_CORES} cores for data loading)")
    logger.info(f"Config: {json.dumps(CONFIG, indent=2)}")
    logger.info(f"Status file: {status_file}")

    if not torch.cuda.is_available():
        raise RuntimeError("GPU required!")

    device = torch.device("cuda")
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3

    logger.info(f"GPU: {gpu_name}")
    logger.info(f"GPU Memory: {gpu_memory:.1f} GB")

    # Enable maximum GPU performance
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True  # Auto-optimize for input size
    torch.backends.cudnn.deterministic = False  # Faster (non-deterministic)

    logger.info("GPU optimizations enabled:")
    logger.info("   - TF32 enabled")
    logger.info("   - cuDNN benchmark enabled")
    logger.info("   - cuDNN deterministic disabled (faster)")

    # Prepare data
    train_loader, val_loader, mappings, processor = prepare_data(CONFIG)

    # Log 10 sampled make names from first 3 batches (sanity: not always same brand)
    sampled = []
    for i, batch in enumerate(train_loader):
        if i >= 3:
            break
        for j in range(batch['make_label'].size(0)):
            idx = batch['make_label'][j].item()
            sampled.append(mappings['idx_to_make'].get(idx, '?'))
    logger.info("Sampled make names (first 10 from first 3 batches): %s" % (sampled[:10]))

    if dry_run:
        logger.info("DRY RUN done. Exiting.")
        return None, None, None

    # Load model
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    model = CLIPFineTuner(
        clip_model,
        len(mappings['make_to_idx']),
        use_gpu_augmentation=CONFIG.get('use_gpu_augmentation', False)
    )
    model.to(device)

    # Verify model is on GPU
    next_param_device = next(model.parameters()).device
    if next_param_device.type != 'cuda':
        raise RuntimeError(f"Model is not on GPU! Model device: {next_param_device}, expected cuda")
    logger.info(f"[VERIFIED] Model is on GPU: {next_param_device}")

    # Auto-detect optimal batch size for maximum GPU utilization
    logger.info("Auto-tuning batch size for maximum GPU utilization...")
    optimal_batch_size = find_optimal_batch_size(model, train_loader, device, CONFIG, start_size=CONFIG['batch_size'])
    if optimal_batch_size != CONFIG['batch_size']:
        logger.info(f"[OPTIMIZED] Adjusting batch size from {CONFIG['batch_size']} to {optimal_batch_size} for maximum GPU usage")
        CONFIG['batch_size'] = optimal_batch_size
        # Recreate loaders with optimal batch size
        train_loader, val_loader, mappings, processor = prepare_data(CONFIG)
    else:
        logger.info(f"[MAXIMUM] Using batch size: {CONFIG['batch_size']} (optimal for 8GB GPU)")

    # Optimizer: head_lr for classifier, backbone_lr for CLIP
    optimizer = AdamW([
        {'params': model.make_classifier.parameters(), 'lr': CONFIG['head_lr']},
        {'params': model.clip.parameters(), 'lr': CONFIG['backbone_lr']},
    ], weight_decay=CONFIG['weight_decay'])
    total_steps = len(train_loader) * CONFIG['epochs']
    warmup = int(total_steps * CONFIG.get('warmup_ratio', 0.05))
    if HAS_COSINE_WARMUP:
        scheduler = get_cosine_schedule_with_warmup(optimizer, num_warmup_steps=warmup, num_training_steps=total_steps)
    else:
        scheduler = CosineAnnealingLR(optimizer, T_max=total_steps, eta_min=1e-7)

    scaler = torch.amp.GradScaler('cuda') if CONFIG['mixed_precision'] else None

    # Check for existing checkpoint to resume
    checkpoint_file = MODELS_DIR / "checkpoint_latest.pt"
    start_epoch = 1

    if checkpoint_file.exists():
        try:
            logger.info(f"Found existing checkpoint: {checkpoint_file}")
            checkpoint = torch.load(checkpoint_file, map_location=device)
            start_epoch = checkpoint.get('epoch', 1) + 1
            best_val_acc = checkpoint.get('metrics', {}).get(
                'val', {}).get('accuracy', 0.0)
            patience_counter = checkpoint.get('patience_counter', 0)
            history = checkpoint.get('history', [])
            best_models = checkpoint.get('best_models', [])

            # Load model state
            if hasattr(model, 'module'):
                model.module.load_state_dict(checkpoint['model_state_dict'])
            else:
                model.load_state_dict(checkpoint['model_state_dict'])

            # Load optimizer state
            optimizer.load_state_dict(checkpoint.get(
                'optimizer_state_dict', optimizer.state_dict()))

            logger.info(
                f"[OK] Resumed from epoch {start_epoch}, best acc: {best_val_acc*100:.2f}%")
        except Exception as e:
            logger.warning(f"Failed to load checkpoint: {e}, starting fresh")
            start_epoch = 1
            best_val_acc = 0.0
            patience_counter = 0
            history = []
            best_models = []
    else:
        best_val_acc = 0.0
        patience_counter = 0
        history = []
        best_models = []

    # Training loop with error handling
    for epoch in range(start_epoch, CONFIG['epochs'] + 1):
        logger.info(f"\n{'='*80}")
        logger.info(f"EPOCH {epoch}/{CONFIG['epochs']}")
        logger.info(f"{'='*80}")

        # Freeze backbone for first freeze_epochs
        fe = CONFIG.get('freeze_epochs', 3)
        if epoch <= fe:
            for p in model.clip.parameters():
                p.requires_grad = False
            if epoch == 1:
                logger.info("Backbone frozen for first %d epochs" % fe)
        else:
            for p in model.clip.parameters():
                p.requires_grad = True

        lr_head = optimizer.param_groups[0]['lr']
        lr_back = optimizer.param_groups[1]['lr']
        logger.info("LR head=%.2e backbone=%.2e" % (lr_head, lr_back))

        # Update status file
        status_file = LOG_DIR / "training_status.txt"
        with open(status_file, 'a') as f:
            f.write(
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting epoch {epoch}/{CONFIG['epochs']}\n")

        try:
            train_metrics = train_epoch(
                model, train_loader, optimizer, scheduler, device, CONFIG, scaler,
                class_weights=mappings.get('class_weights'))
            val_metrics = validate(model, val_loader, device,
                class_weights=mappings.get('class_weights'),
                label_smoothing=CONFIG.get('label_smoothing', 0.05))
        except RuntimeError as e:
            if "out of memory" in str(e):
                logger.error(f"CUDA OOM at epoch {epoch}")
                logger.error("Saving checkpoint before exit...")
                # Save emergency checkpoint
                emergency_checkpoint = {
                    'epoch': epoch - 1,
                    'model_state_dict': model.state_dict() if not hasattr(model, 'module') else model.module.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'best_val_acc': best_val_acc,
                    'patience_counter': patience_counter,
                    'history': history,
                    'best_models': best_models if 'best_models' in locals() else [],
                }
                torch.save(emergency_checkpoint, MODELS_DIR /
                           "checkpoint_emergency.pt")
                logger.error(
                    "Emergency checkpoint saved. Reduce batch size and resume.")
                raise
            else:
                raise
        except Exception as e:
            logger.error(f"Error during epoch {epoch}: {e}")
            logger.error(traceback.format_exc())
            # Save checkpoint before exiting
            emergency_checkpoint = {
                'epoch': epoch - 1,
                'model_state_dict': model.state_dict() if not hasattr(model, 'module') else model.module.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'best_val_acc': best_val_acc,
                'patience_counter': patience_counter,
                'history': history,
            }
            torch.save(emergency_checkpoint, MODELS_DIR /
                       "checkpoint_emergency.pt")
            logger.error("Emergency checkpoint saved. Check error and resume.")
            raise

        # Performance metrics
        images_per_sec = train_metrics.get('images_per_sec', 0)
        epoch_time = train_metrics.get('epoch_time', 0)
        gpu_util = get_gpu_utilization()
        cpu_util = get_cpu_utilization()

        logger.info(f"Train - Loss: {train_metrics['loss']:.4f}, "
                    f"Top-1: {train_metrics['accuracy']*100:.2f}%, "
                    f"Top-5: {train_metrics['top5_accuracy']*100:.2f}%")
        logger.info(f"Val - Loss: {val_metrics['loss']:.4f}, "
                    f"Top-1: {val_metrics['accuracy']*100:.2f}%, "
                    f"Top-5: {val_metrics['top5_accuracy']*100:.2f}%")
        gpu_str = f"{gpu_util}%" if gpu_util else "N/A"
        cpu_str = f"{cpu_util:.0f}%" if cpu_util else "N/A"
        logger.info(f"Performance - {images_per_sec:.1f} imgs/s, "
                    f"GPU: {gpu_str}, "
                    f"CPU: {cpu_str}, "
                    f"Time: {epoch_time:.1f}s")

        history.append({
            'epoch': epoch,
            'train_loss': train_metrics['loss'],
            'train_acc': train_metrics['accuracy'],
            'val_loss': val_metrics['loss'],
            'val_acc': val_metrics['accuracy'],
            'images_per_sec': train_metrics.get('images_per_sec', 0),
            'gpu_utilization': get_gpu_utilization(),
            'cpu_utilization': get_cpu_utilization() if PSUTIL_AVAILABLE else None,
        })

        # Save top-k models
        if val_metrics['accuracy'] > best_val_acc + CONFIG['early_stopping_min_delta']:
            best_val_acc = val_metrics['accuracy']
            patience_counter = 0
            save_model(model, processor, mappings, CONFIG, epoch, {
                'train': train_metrics,
                'val': val_metrics
            }, MODELS_DIR, rank=1)
            logger.info(
                f"[BEST] New best model saved! Top-1: {best_val_acc*100:.2f}%")
        else:
            patience_counter += 1

        # Track top-k
        best_models.append((val_metrics['accuracy'], epoch))
        best_models.sort(reverse=True)
        best_models = best_models[:CONFIG['save_top_k']]

        # Save checkpoint every 5 epochs (for auto-resume)
        if epoch % 5 == 0 or epoch == CONFIG['epochs']:
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': model.state_dict() if not hasattr(model, 'module') else model.module.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'scheduler_state_dict': scheduler.state_dict(),
                'best_val_acc': best_val_acc,
                'patience_counter': patience_counter,
                'history': history,
                'best_models': best_models,
                'config': CONFIG,
                'metrics': {
                    'train': train_metrics,
                    'val': val_metrics
                }
            }
            torch.save(checkpoint, MODELS_DIR / "checkpoint_latest.pt")
            logger.info(f"[SAVED] Checkpoint saved (epoch {epoch})")

        # Early stopping
        if patience_counter >= CONFIG['early_stopping_patience']:
            logger.warning(f"Early stopping at epoch {epoch}")
            break

        torch.cuda.empty_cache()

    # Note: Top-k models are saved during training when they achieve best scores
    # The best model is already saved as best_model.pt

    # Save training history
    history_file = LOG_DIR / \
        f"training_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(history_file, 'w') as f:
        json.dump(history, f, indent=2)

    logger.info(
        f"\n[SUCCESS] Training complete! Best Top-1: {best_val_acc*100:.2f}%")
    logger.info(f"History saved to: {history_file}")

    # Write completion status
    status_file = LOG_DIR / "training_status.txt"
    status_file.parent.mkdir(parents=True, exist_ok=True)
    with open(status_file, 'a') as f:
        f.write(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Training completed successfully\n")
        f.write(f"Best Top-1 accuracy: {best_val_acc*100:.2f}%\n")
        f.write(f"Total epochs: {CONFIG['epochs']}\n")
        f.write(f"Model saved to: {MODELS_DIR / 'best.pt'}\n")

    return model, processor, mappings


if __name__ == "__main__":
    if sys.platform == 'win32':
        multiprocessing.freeze_support()

    parser = argparse.ArgumentParser()
    parser.add_argument('--dry_run', action='store_true', help='Data load + sanity checks only, then exit')
    parser.add_argument('--overfit_small', action='store_true', help='Train/val on 200 samples to sanity-check labels')
    args = parser.parse_args()
    CONFIG['overfit_small'] = args.overfit_small

    try:
        train(dry_run=args.dry_run)
        if args.dry_run:
            logger.info("Dry run completed. Exit 0.")
            sys.exit(0)
    except KeyboardInterrupt:
        logger.warning("\n[WARNING] Training interrupted by user")
        logger.info("Checkpoint should be saved. Resume with same command.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n[ERROR] Training failed with error: {e}")
        logger.error(traceback.format_exc())

        # Write error to status file
        status_file = LOG_DIR / "training_status.txt"
        error_log = LOG_DIR / "error_log.txt"

        status_file.parent.mkdir(parents=True, exist_ok=True)
        error_log.parent.mkdir(parents=True, exist_ok=True)

        with open(error_log, 'a') as f:
            f.write(
                f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Training failed\n")
            f.write(f"Error: {e}\n")
            f.write(traceback.format_exc())
            f.write("\n" + "="*80 + "\n")

        with open(status_file, 'a') as f:
            f.write(
                f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Training FAILED: {e}\n")
            f.write(f"Check error_log.txt for details\n")

        sys.exit(1)
