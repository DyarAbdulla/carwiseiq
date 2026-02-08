"""
Overnight Training Script for Car Classifier
Optimized for 15-hour training session with early stopping and checkpointing
Enhanced with MixUp, AutoAugment, Label Smoothing, and GPU monitoring
"""

import os
import sys
import json
import logging
import argparse
import time
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from transformers import CLIPProcessor, CLIPModel
from tqdm import tqdm
from PIL import Image
import torchvision.transforms as transforms
from torchvision.transforms import AutoAugment, AutoAugmentPolicy
from sklearn.model_selection import train_test_split

# Setup logging to both console and file
PROJECT_ROOT = Path(__file__).parent.parent
LOG_DIR = PROJECT_ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

log_file = LOG_DIR / f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

logger.info("=" * 80)
logger.info("OVERNIGHT TRAINING SESSION - 15 HOURS")
logger.info("=" * 80)
logger.info(f"Log file: {log_file}")

# Paths
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"
CHECKPOINT_DIR = MODELS_DIR / "checkpoints_overnight"
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

# Overnight Training Config - 15 HOURS
OVERNIGHT_CONFIG = {
    'batch_size': 128,  # Larger batch for better GPU utilization
    'epochs': 100,  # Enough for 15 hours
    'learning_rate': 2e-5,
    'warmup_steps': 200,
    'max_text_length': 77,
    'image_size': 224,
    'min_samples_per_class': 50,  # Already filtered
    'gradient_accumulation_steps': 1,  # No accumulation needed with batch_size 128
    'save_every_epoch': False,
    'save_every_n_epochs': 5,  # Save checkpoint every 5 epochs
    'mixed_precision': True,
    'num_workers': 12,  # More workers for faster data loading
    'pin_memory': True,
    'use_class_weights': True,
    'use_augmentation': True,
    'augmentation_strength': 'strong',  # Stronger augmentation with MixUp and AutoAugment
    'use_mixup': True,  # Enable MixUp augmentation
    'mixup_alpha': 0.2,  # MixUp alpha parameter
    'use_autoaugment': True,  # Enable AutoAugment
    'label_smoothing': 0.1,  # Label smoothing factor
    'early_stopping_patience': 15,  # Stop if no improvement for 15 epochs
    'early_stopping_min_delta': 0.001,  # Minimum improvement to count
    'monitor_interval_minutes': 10,  # Log progress every 10 minutes
    'gpu_temp_threshold': 85,  # Auto-stop if GPU temp exceeds 85°C
}


def get_gpu_temperature():
    """Get GPU temperature using nvidia-smi."""
    try:
        result = subprocess.run(
            ['nvidia-smi', '--query-gpu=temperature.gpu', '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            temp = int(result.stdout.strip())
            return temp
    except Exception as e:
        logger.debug(f"Could not get GPU temperature: {e}")
    return None


def mixup_data(x, y, alpha=1.0):
    """Apply MixUp augmentation to batch."""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1
    
    batch_size = x.size(0)
    index = torch.randperm(batch_size).to(x.device)
    
    mixed_x = lam * x + (1 - lam) * x[index, :]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam


def mixup_criterion(criterion, pred, y_a, y_b, lam):
    """Compute MixUp loss."""
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


class CarImageDataset(Dataset):
    """Dataset with strong augmentation (MixUp, AutoAugment) for overnight training."""
    
    def __init__(
        self,
        labels_df: pd.DataFrame,
        images_dir: Path,
        processor: CLIPProcessor,
        make_to_idx: Dict[str, int],
        mode: str = 'train',
        augment: bool = True,
        augmentation_strength: str = 'strong',
        use_autoaugment: bool = True
    ):
        self.labels_df = labels_df.reset_index(drop=True)
        self.images_dir = images_dir
        self.processor = processor
        self.make_to_idx = make_to_idx
        self.mode = mode
        self.augment = augment and (mode == 'train')
        self.augmentation_strength = augmentation_strength
        self.use_autoaugment = use_autoaugment
        
        # Strong augmentation transforms with AutoAugment
        if self.augment and augmentation_strength == 'strong':
            transform_list = [
                transforms.RandomHorizontalFlip(p=0.5),
            ]
            
            # Add AutoAugment if enabled
            if use_autoaugment:
                try:
                    transform_list.append(AutoAugment(AutoAugmentPolicy.IMAGENET))
                except Exception as e:
                    logger.warning(f"AutoAugment not available: {e}, using standard augmentation")
                    transform_list.extend([
                        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.15),
                        transforms.RandomRotation(degrees=10),
                        transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1)),
                        transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
                    ])
            else:
                transform_list.extend([
                    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.15),
                    transforms.RandomRotation(degrees=10),
                    transforms.RandomAffine(degrees=0, translate=(0.1, 0.1), scale=(0.9, 1.1)),
                    transforms.RandomPerspective(distortion_scale=0.2, p=0.3),
                ])
            
            self.transform = transforms.Compose(transform_list)
        elif self.augment:
            # Standard augmentation
            self.transform = transforms.Compose([
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
                transforms.RandomRotation(degrees=5),
                transforms.RandomAffine(degrees=0, translate=(0.05, 0.05)),
            ])
        else:
            self.transform = None
        
    def __len__(self):
        return len(self.labels_df)
    
    def __getitem__(self, idx):
        row = self.labels_df.iloc[idx]
        
        # Load image
        image_path = self.images_dir / row['image_filename']
        try:
            with Image.open(image_path) as img:
                image = img.convert('RGB')
        except Exception as e:
            logger.warning(f"Failed to load image {image_path}: {e}")
            image = Image.new('RGB', (224, 224), color='gray')
        
        # Apply augmentation
        if self.transform:
            image = self.transform(image)
        
        # Create text description
        make = row['make']
        model = row['model']
        text = f"a photo of a {make} {model} car"
        
        # Process inputs
        inputs = self.processor(
            text=text,
            images=image,
            return_tensors="pt",
            padding="max_length",
            truncation=True,
            max_length=77
        )
        
        # Get make label
        make_label = self.make_to_idx.get(make, 0)
        
        return {
            'pixel_values': inputs['pixel_values'].squeeze(0),
            'input_ids': inputs['input_ids'].squeeze(0),
            'attention_mask': inputs['attention_mask'].squeeze(0),
            'make_label': torch.tensor(make_label, dtype=torch.long),
            'make': make,
            'model': model
        }


class CLIPFineTuner(nn.Module):
    """CLIP model with fine-tuning head for car classification."""
    
    def __init__(self, clip_model: CLIPModel, num_makes: int):
        super().__init__()
        self.clip = clip_model
        
        # Classification head for make prediction
        self.make_classifier = nn.Linear(
            clip_model.config.projection_dim, 
            num_makes
        )
    
    def forward(self, pixel_values, input_ids, attention_mask):
        # Get image and text embeddings
        outputs = self.clip(
            pixel_values=pixel_values,
            input_ids=input_ids,
            attention_mask=attention_mask
        )
        
        image_embeds = outputs.image_embeds
        text_embeds = outputs.text_embeds
        
        # Normalize embeddings
        image_embeds = image_embeds / image_embeds.norm(dim=-1, keepdim=True)
        text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)
        
        # CLIP logits
        logits_per_image = (image_embeds @ text_embeds.t()) * self.clip.logit_scale.exp()
        logits_per_text = logits_per_image.t()
        
        # Make classification from image embeddings
        make_logits = self.make_classifier(image_embeds)
        
        return {
            'logits_per_image': logits_per_image,
            'logits_per_text': logits_per_text,
            'make_logits': make_logits,
            'image_embeds': image_embeds,
            'text_embeds': text_embeds
        }


def prepare_data(config: dict) -> Tuple[DataLoader, DataLoader, Dict, CLIPProcessor, pd.DataFrame]:
    """Prepare training and validation data."""
    
    # Load labels - prioritize filtered dataset
    filtered_file = DATA_DIR / "image_labels_filtered.csv"
    cleaned_file = DATA_DIR / "image_labels_cleaned.csv"
    labels_file = DATA_DIR / "image_labels.csv"
    
    if filtered_file.exists():
        logger.info(f"Using filtered dataset: {filtered_file}")
        labels_df = pd.read_csv(filtered_file)
    elif cleaned_file.exists():
        logger.info(f"Using cleaned dataset: {cleaned_file}")
        labels_df = pd.read_csv(cleaned_file)
        make_counts = labels_df['make'].value_counts()
        valid_makes = make_counts[make_counts >= config['min_samples_per_class']].index.tolist()
        labels_df = labels_df[labels_df['make'].isin(valid_makes)]
    elif labels_file.exists():
        logger.info(f"Using standard labels file: {labels_file}")
        labels_df = pd.read_csv(labels_file)
        make_counts = labels_df['make'].value_counts()
        valid_makes = make_counts[make_counts >= config['min_samples_per_class']].index.tolist()
        labels_df = labels_df[labels_df['make'].isin(valid_makes)]
    else:
        raise FileNotFoundError("No labels file found!")
    
    logger.info(f"Loaded {len(labels_df)} labeled images")
    
    # Create make to index mapping
    makes = sorted(labels_df['make'].unique().tolist())
    make_to_idx = {make: idx for idx, make in enumerate(makes)}
    idx_to_make = {idx: make for make, idx in make_to_idx.items()}
    
    logger.info(f"Total makes: {len(makes)}")
    
    # Split data with stratification
    labels_df_shuffled = labels_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Train+Val (80%) vs Test (20%)
    train_val_df, test_df = train_test_split(
        labels_df_shuffled,
        test_size=0.2,
        random_state=42,
        stratify=labels_df_shuffled['make']
    )
    
    # Train (64%) vs Val (16%)
    train_df, val_df = train_test_split(
        train_val_df,
        test_size=0.2,
        random_state=42,
        stratify=train_val_df['make']
    )
    
    logger.info(f"Train: {len(train_df)} ({len(train_df)/len(labels_df)*100:.1f}%)")
    logger.info(f"Validation: {len(val_df)} ({len(val_df)/len(labels_df)*100:.1f}%)")
    logger.info(f"Test: {len(test_df)} ({len(test_df)/len(labels_df)*100:.1f}%)")
    
    # Save test set
    test_file = DATA_DIR / "test_set.csv"
    test_df.to_csv(test_file, index=False)
    
    # Load processor
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    # Create datasets
    augmentation_strength = config.get('augmentation_strength', 'strong')
    use_autoaugment = config.get('use_autoaugment', True)
    train_dataset = CarImageDataset(
        train_df, IMAGES_DIR, processor, make_to_idx, 
        mode='train', augment=True, augmentation_strength=augmentation_strength,
        use_autoaugment=use_autoaugment
    )
    val_dataset = CarImageDataset(
        val_df, IMAGES_DIR, processor, make_to_idx, 
        mode='val', augment=False
    )
    
    # Create dataloaders
    batch_size = config['batch_size']
    num_workers = config.get('num_workers', 12)
    pin_memory = config.get('pin_memory', True)
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=pin_memory,
        drop_last=True,
        persistent_workers=True if num_workers > 0 else False,
        prefetch_factor=2 if num_workers > 0 else None,
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=True if num_workers > 0 else False,
        prefetch_factor=2 if num_workers > 0 else None,
    )
    
    # Build mappings
    mappings = {
        'make_to_idx': make_to_idx,
        'idx_to_make': idx_to_make,
        'makes': makes,
        'models_by_make': {}
    }
    
    for make in makes:
        models = sorted(labels_df[labels_df['make'] == make]['model'].unique().tolist())
        mappings['models_by_make'][make] = models
    
    logger.info(f"Created mappings: {len(makes)} makes")
    
    return train_loader, val_loader, mappings, processor, train_df


def train_epoch(
    model: CLIPFineTuner,
    train_loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    device: torch.device,
    config: dict,
    scaler: Optional[torch.cuda.amp.GradScaler] = None,
    class_weights: Optional[torch.Tensor] = None,
    last_monitor_time: float = None
) -> Tuple[Dict[str, float], float]:
    """Train for one epoch."""
    
    model.train()
    total_loss = 0
    total_clip_loss = 0
    total_make_loss = 0
    correct = 0
    top5_correct = 0
    total = 0
    
    # Label smoothing loss
    label_smoothing = config.get('label_smoothing', 0.0)
    num_classes = len(train_loader.dataset.make_to_idx)
    
    if label_smoothing > 0:
        criterion = nn.CrossEntropyLoss(weight=class_weights.to(device) if class_weights is not None else None, 
                                        label_smoothing=label_smoothing)
    else:
        criterion = nn.CrossEntropyLoss(weight=class_weights.to(device) if class_weights is not None else None)
    
    use_mixup = config.get('use_mixup', False)
    mixup_alpha = config.get('mixup_alpha', 0.2)
    monitor_interval = config.get('monitor_interval_minutes', 10) * 60  # Convert to seconds
    gpu_temp_threshold = config.get('gpu_temp_threshold', 85)
    
    progress = tqdm(train_loader, desc="Training")
    current_time = time.time()
    
    for batch_idx, batch in enumerate(progress):
        # Check GPU temperature
        gpu_temp = get_gpu_temperature()
        if gpu_temp is not None and gpu_temp > gpu_temp_threshold:
            logger.error(f"⚠️ GPU OVERHEATING: {gpu_temp}°C (threshold: {gpu_temp_threshold}°C)")
            logger.error("Stopping training to prevent damage!")
            raise RuntimeError(f"GPU temperature {gpu_temp}°C exceeds threshold {gpu_temp_threshold}°C")
        
        pixel_values = batch['pixel_values'].to(device, non_blocking=True)
        input_ids = batch['input_ids'].to(device, non_blocking=True)
        attention_mask = batch['attention_mask'].to(device, non_blocking=True)
        make_labels = batch['make_label'].to(device, non_blocking=True)
        
        # Apply MixUp if enabled
        if use_mixup and model.training:
            pixel_values, make_labels_a, make_labels_b, lam = mixup_data(
                pixel_values, make_labels, alpha=mixup_alpha
            )
        else:
            make_labels_a = make_labels
            make_labels_b = None
            lam = 1.0
        
        if config['mixed_precision'] and scaler is not None:
            with torch.cuda.amp.autocast():
                outputs = model(pixel_values, input_ids, attention_mask)
                
                labels = torch.arange(len(pixel_values), device=device)
                clip_loss = (
                    nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                    nn.functional.cross_entropy(outputs['logits_per_text'], labels)
                ) / 2
                
                # Make loss with MixUp if enabled
                if use_mixup and make_labels_b is not None:
                    make_loss = mixup_criterion(criterion, outputs['make_logits'], make_labels_a, make_labels_b, lam)
                else:
                    make_loss = criterion(outputs['make_logits'], make_labels)
                
                loss = clip_loss + make_loss
            
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad()
            scheduler.step()
            
            loss_value = loss.item()
        else:
            outputs = model(pixel_values, input_ids, attention_mask)
            
            labels = torch.arange(len(pixel_values), device=device)
            clip_loss = (
                nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                nn.functional.cross_entropy(outputs['logits_per_text'], labels)
            ) / 2
            
            # Make loss with MixUp if enabled
            if use_mixup and make_labels_b is not None:
                make_loss = mixup_criterion(criterion, outputs['make_logits'], make_labels_a, make_labels_b, lam)
            else:
                make_loss = criterion(outputs['make_logits'], make_labels)
            
            loss = clip_loss + make_loss
            
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
            scheduler.step()
            
            loss_value = loss.item()
        
        # Track metrics (use original labels for accuracy)
        total_loss += loss_value
        total_clip_loss += clip_loss.item()
        total_make_loss += make_loss.item()
        
        # Calculate accuracy (use original labels, not mixed)
        make_logits = outputs['make_logits']
        _, top5_preds = make_logits.topk(5, dim=1)
        preds = make_logits.argmax(dim=1)
        
        # For MixUp, use original labels for accuracy
        true_labels = make_labels_a if not use_mixup else make_labels_a
        correct += (preds == true_labels).sum().item()
        top5_correct += (top5_preds == true_labels.unsqueeze(1)).any(dim=1).sum().item()
        total += true_labels.size(0)
        
        progress.set_postfix({
            'loss': f"{loss_value:.4f}",
            'acc': f"{100*correct/total:.1f}%",
            'top5': f"{100*top5_correct/total:.1f}%",
            'temp': f"{gpu_temp}°C" if gpu_temp else "N/A"
        })
        
        # Periodic monitoring
        if last_monitor_time is not None:
            elapsed = time.time() - last_monitor_time
            if elapsed >= monitor_interval:
                logger.info(f"📊 Progress Update - Batch {batch_idx+1}/{len(train_loader)}, "
                          f"Loss: {loss_value:.4f}, Acc: {100*correct/total:.1f}%, "
                          f"GPU Temp: {gpu_temp}°C" if gpu_temp else "N/A")
                last_monitor_time = time.time()
        else:
            last_monitor_time = time.time()
        
        # Clear cache periodically
        if (batch_idx + 1) % 50 == 0:
            torch.cuda.empty_cache()
    
    return {
        'loss': total_loss / len(train_loader),
        'clip_loss': total_clip_loss / len(train_loader),
        'make_loss': total_make_loss / len(train_loader),
        'accuracy': correct / total,
        'top5_accuracy': top5_correct / total
    }, last_monitor_time


def validate(
    model: CLIPFineTuner,
    val_loader: DataLoader,
    device: torch.device,
    label_smoothing: float = 0.0
) -> Dict[str, float]:
    """Validate the model."""
    
    model.eval()
    total_loss = 0
    correct = 0
    top5_correct = 0
    total = 0
    
    criterion = nn.CrossEntropyLoss(label_smoothing=label_smoothing) if label_smoothing > 0 else nn.CrossEntropyLoss()
    
    with torch.no_grad():
        for batch in tqdm(val_loader, desc="Validating"):
            pixel_values = batch['pixel_values'].to(device)
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            make_labels = batch['make_label'].to(device)
            
            outputs = model(pixel_values, input_ids, attention_mask)
            
            labels = torch.arange(len(pixel_values), device=device)
            clip_loss = (
                nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                nn.functional.cross_entropy(outputs['logits_per_text'], labels)
            ) / 2
            make_loss = criterion(outputs['make_logits'], make_labels)
            loss = clip_loss + make_loss
            
            total_loss += loss.item()
            
            make_logits = outputs['make_logits']
            _, top5_preds = make_logits.topk(5, dim=1)
            preds = make_logits.argmax(dim=1)
            
            correct += (preds == make_labels).sum().item()
            top5_correct += (top5_preds == make_labels.unsqueeze(1)).any(dim=1).sum().item()
            total += make_labels.size(0)
    
    return {
        'loss': total_loss / len(val_loader),
        'accuracy': correct / total,
        'top5_accuracy': top5_correct / total
    }


def save_checkpoint(
    model: CLIPFineTuner,
    processor: CLIPProcessor,
    mappings: dict,
    config: dict,
    epoch: int,
    metrics: dict,
    is_best: bool = False
):
    """Save model checkpoint."""
    
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
        'num_makes': len(mappings.get('make_to_idx', {}))
    }
    
    # Save checkpoint
    checkpoint_file = CHECKPOINT_DIR / f"checkpoint_epoch_{epoch}.pt"
    torch.save(checkpoint, checkpoint_file)
    
    # Save best model
    if is_best:
        best_file = MODELS_DIR / "best_model_overnight.pt"
        torch.save(checkpoint, best_file)
        logger.info(f"💾 Saved best model to {best_file}")
        
        # Also save as standard best_model.pt for compatibility (so evaluation script can load it)
        standard_best = MODELS_DIR / "best_model.pt"
        # Backup existing if it exists
        if standard_best.exists():
            import shutil
            shutil.copy2(standard_best, MODELS_DIR / "best_model_previous.pt")
        torch.save(checkpoint, standard_best)
        logger.info(f"💾 Also saved as {standard_best} for compatibility")
    
    # Save processor (only for best model)
    if is_best:
        processor.save_pretrained(MODELS_DIR / "processor")
    
    # Save mappings
    mappings_file = CHECKPOINT_DIR / "mappings.json"
    with open(mappings_file, 'w') as f:
        json.dump(mappings, f, indent=2)
    
    # Also save mappings in main model dir for compatibility
    if is_best:
        main_mappings_file = MODELS_DIR / "mappings.json"
        with open(main_mappings_file, 'w') as f:
            json.dump(mappings, f, indent=2)


def train_overnight(config: dict = None):
    """Main overnight training function."""
    
    if config is None:
        config = OVERNIGHT_CONFIG.copy()
    
    start_time = time.time()
    
    logger.info("=" * 80)
    logger.info("OVERNIGHT TRAINING - CAR CLASSIFIER (15 HOURS)")
    logger.info("=" * 80)
    logger.info(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Config: {json.dumps(config, indent=2)}")
    
    # Check GPU
    if not torch.cuda.is_available():
        logger.error("CUDA/GPU NOT AVAILABLE!")
        raise RuntimeError("GPU required for training")
    
    device = torch.device("cuda")
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
    
    logger.info(f"\nGPU: {gpu_name}")
    logger.info(f"GPU Memory: {gpu_memory:.1f} GB")
    
    # Check initial GPU temperature
    initial_temp = get_gpu_temperature()
    if initial_temp:
        logger.info(f"Initial GPU Temperature: {initial_temp}°C")
        if initial_temp > config['gpu_temp_threshold']:
            logger.warning(f"⚠️ GPU temperature already high: {initial_temp}°C")
    
    # Adjust batch size if needed
    if gpu_memory < 8:
        if config['batch_size'] > 64:
            config['batch_size'] = 64
            logger.warning(f"Reduced batch size to {config['batch_size']} for {gpu_memory:.1f}GB GPU")
    
    # Enable optimizations
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True
    
    # Prepare data
    logger.info("\nPreparing data...")
    train_loader, val_loader, mappings, processor, train_df = prepare_data(config)
    
    num_makes = len(mappings['make_to_idx'])
    logger.info(f"Number of makes: {num_makes}")
    
    # Compute class weights
    if config.get('use_class_weights', True):
        from sklearn.utils.class_weight import compute_class_weight
        make_labels = train_df['make'].map(mappings['make_to_idx']).values
        class_weights = compute_class_weight('balanced', classes=np.unique(make_labels), y=make_labels)
        class_weights = torch.tensor(class_weights, dtype=torch.float32)
        logger.info("Computed balanced class weights")
    else:
        class_weights = None
    
    # Load CLIP model
    logger.info("\nLoading CLIP model...")
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    
    model = CLIPFineTuner(clip_model, num_makes)
    model.to(device)
    
    # Optimizer and scheduler
    optimizer = AdamW(model.parameters(), lr=config['learning_rate'], weight_decay=0.01)
    
    total_steps = len(train_loader) * config['epochs']
    scheduler = CosineAnnealingLR(optimizer, T_max=total_steps, eta_min=1e-7)
    
    # Mixed precision
    scaler = torch.cuda.amp.GradScaler() if config['mixed_precision'] else None
    
    # Training loop with early stopping
    best_val_acc = 0.0
    best_epoch = 0
    patience_counter = 0
    training_history = []
    last_monitor_time = None
    
    logger.info("\n" + "=" * 80)
    logger.info("STARTING TRAINING")
    logger.info("=" * 80)
    logger.info(f"Label Smoothing: {config.get('label_smoothing', 0.0)}")
    logger.info(f"MixUp: {config.get('use_mixup', False)} (alpha={config.get('mixup_alpha', 0.2)})")
    logger.info(f"AutoAugment: {config.get('use_autoaugment', False)}")
    logger.info(f"GPU Temp Monitoring: Enabled (threshold: {config['gpu_temp_threshold']}°C)")
    logger.info(f"Progress Monitoring: Every {config['monitor_interval_minutes']} minutes")
    
    for epoch in range(1, config['epochs'] + 1):
        epoch_start_time = time.time()
        
        logger.info(f"\n{'='*80}")
        logger.info(f"EPOCH {epoch}/{config['epochs']}")
        logger.info(f"{'='*80}")
        
        # Train
        train_metrics, last_monitor_time = train_epoch(
            model, train_loader, optimizer, scheduler, device, config, scaler, class_weights, last_monitor_time
        )
        
        logger.info(f"Train - Loss: {train_metrics['loss']:.4f}, "
                   f"Top-1 Acc: {train_metrics['accuracy']*100:.2f}%, "
                   f"Top-5 Acc: {train_metrics['top5_accuracy']*100:.2f}%")
        
        # Validate
        val_metrics = validate(model, val_loader, device, config.get('label_smoothing', 0.0))
        logger.info(f"Val - Loss: {val_metrics['loss']:.4f}, "
                   f"Top-1 Acc: {val_metrics['accuracy']*100:.2f}%, "
                   f"Top-5 Acc: {val_metrics['top5_accuracy']*100:.2f}%")
        
        # Epoch timing
        epoch_time = time.time() - epoch_start_time
        elapsed_time = time.time() - start_time
        remaining_epochs = config['epochs'] - epoch
        estimated_remaining = (elapsed_time / epoch) * remaining_epochs if epoch > 0 else 0
        
        logger.info(f"Epoch time: {epoch_time:.1f}s ({epoch_time/60:.1f} min)")
        logger.info(f"Elapsed: {elapsed_time/3600:.2f}h, Estimated remaining: {estimated_remaining/3600:.2f}h")
        
        # GPU memory and temperature
        if torch.cuda.is_available():
            peak_memory = torch.cuda.max_memory_allocated(device) / 1024**3
            current_memory = torch.cuda.memory_allocated(device) / 1024**3
            gpu_temp = get_gpu_temperature()
            logger.info(f"GPU Memory - Peak: {peak_memory:.2f} GB, Current: {current_memory:.2f} GB")
            if gpu_temp:
                logger.info(f"GPU Temperature: {gpu_temp}°C")
                if gpu_temp > config['gpu_temp_threshold'] - 5:
                    logger.warning(f"⚠️ GPU temperature approaching threshold: {gpu_temp}°C")
        
        # Save history
        training_history.append({
            'epoch': epoch,
            'train_loss': train_metrics['loss'],
            'train_acc': train_metrics['accuracy'],
            'train_top5': train_metrics['top5_accuracy'],
            'val_loss': val_metrics['loss'],
            'val_acc': val_metrics['accuracy'],
            'val_top5': val_metrics['top5_accuracy'],
            'epoch_time': epoch_time,
            'gpu_temp': get_gpu_temperature()
        })
        
        # Check for improvement
        is_best = False
        if val_metrics['accuracy'] > best_val_acc + config['early_stopping_min_delta']:
            best_val_acc = val_metrics['accuracy']
            best_epoch = epoch
            patience_counter = 0
            is_best = True
            logger.info(f"✨ New best validation accuracy: {best_val_acc*100:.2f}%")
        else:
            patience_counter += 1
            logger.info(f"No improvement ({patience_counter}/{config['early_stopping_patience']})")
        
        # Save checkpoint
        if epoch % config['save_every_n_epochs'] == 0 or is_best:
            save_checkpoint(model, processor, mappings, config, epoch, {
                'train': train_metrics,
                'val': val_metrics
            }, is_best=is_best)
            logger.info(f"💾 Saved checkpoint (epoch {epoch})")
        
        # Early stopping
        if patience_counter >= config['early_stopping_patience']:
            logger.warning(f"\n⚠️  Early stopping triggered after {epoch} epochs")
            logger.warning(f"Best validation accuracy: {best_val_acc*100:.2f}% at epoch {best_epoch}")
            break
        
        torch.cuda.empty_cache()
    
    # Final summary
    total_time = time.time() - start_time
    logger.info("\n" + "=" * 80)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total training time: {total_time/3600:.2f} hours")
    logger.info(f"Best validation accuracy: {best_val_acc*100:.2f}% (epoch {best_epoch})")
    logger.info(f"Final validation accuracy: {val_metrics['accuracy']*100:.2f}%")
    logger.info(f"Model saved to: {MODELS_DIR / 'best_model_overnight.pt'}")
    
    # Save training history
    history_file = LOG_DIR / f"training_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(history_file, 'w') as f:
        json.dump(training_history, f, indent=2)
    logger.info(f"Training history saved to: {history_file}")
    
    return model, processor, mappings


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Overnight training for car classifier (15 hours)")
    parser.add_argument('--epochs', type=int, default=100, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=128, help='Batch size')
    parser.add_argument('--lr', type=float, default=2e-5, help='Learning rate')
    parser.add_argument('--num_workers', type=int, default=12, help='Data loading workers')
    parser.add_argument('--patience', type=int, default=15, help='Early stopping patience')
    parser.add_argument('--label_smoothing', type=float, default=0.1, help='Label smoothing factor')
    parser.add_argument('--mixup_alpha', type=float, default=0.2, help='MixUp alpha parameter')
    parser.add_argument('--gpu_temp_threshold', type=int, default=85, help='GPU temperature threshold (°C)')
    
    args = parser.parse_args()
    
    config = OVERNIGHT_CONFIG.copy()
    config['epochs'] = args.epochs
    config['batch_size'] = args.batch_size
    config['learning_rate'] = args.lr
    config['num_workers'] = args.num_workers
    config['early_stopping_patience'] = args.patience
    config['label_smoothing'] = args.label_smoothing
    config['mixup_alpha'] = args.mixup_alpha
    config['gpu_temp_threshold'] = args.gpu_temp_threshold
    
    train_overnight(config)
