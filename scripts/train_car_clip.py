"""
Train Car CLIP Model
Fine-tunes CLIP for car make/model recognition using the local car_images dataset.
"""

import os
import sys
import json
import logging
import argparse
import time
import torch.cuda
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import pandas as pd
import numpy as np
from PIL import Image
from tqdm import tqdm

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR, OneCycleLR
import torchvision.transforms as transforms

from transformers import CLIPProcessor, CLIPModel
from sklearn.utils.class_weight import compute_class_weight

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"

# Training config - AGGRESSIVE MEMORY OPTIMIZATION for RTX 4060 8GB
DEFAULT_CONFIG = {
    'batch_size': 8,  # Reduced to 8 for maximum stability (use gradient accumulation for larger effective batch)
    'epochs': 20,  # More epochs for better accuracy (increased from 15)
    'learning_rate': 2e-5,  # Lower LR for better convergence (tuned)
    'warmup_steps': 100,
    'max_text_length': 77,
    'image_size': 224,
    'train_split': 0.8,  # 80% train, 20% val (test split handled separately)
    'min_samples_per_class': 10,  # Minimum samples for a make to be included
    'gradient_accumulation_steps': 16,  # Effective batch size = 8 * 16 = 128
    'save_every_epoch': True,
    'mixed_precision': True,  # FP16 - REQUIRED for memory efficiency
    'num_workers': 2,  # Reduced to 2 to save RAM
    'pin_memory': True,  # Faster GPU transfer
    'use_compile': False,  # torch.compile (PyTorch 2.0+) - can increase memory usage
    'use_class_weights': True,  # Enable class balancing
    'use_augmentation': True,  # Enable data augmentation
    'empty_cache_frequency': 5,  # Clear GPU cache every 5 batches (more aggressive)
    'use_gradient_checkpointing': True,  # Enable gradient checkpointing to save memory
}


class CarImageDataset(Dataset):
    """Dataset for car images with make/model labels and data augmentation."""
    
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
        
        # Data augmentation transforms (only for training)
        if self.augment:
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
        
        # Load image (optimized: use faster I/O)
        image_path = self.images_dir / row['image_filename']
        try:
            # Use PIL's lazy loading for faster I/O
            with Image.open(image_path) as img:
                image = img.convert('RGB')
        except Exception as e:
            logger.warning(f"Failed to load image {image_path}: {e}")
            # Return a blank image
            image = Image.new('RGB', (224, 224), color='gray')
        
        # Apply augmentation (if training) - do this before processing
        if self.transform:
            image = self.transform(image)
        
        # Create text description
        make = row['make']
        model = row['model']
        text = f"a photo of a {make} {model} car"
        
        # Process inputs (this is CPU-bound but necessary)
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
        # Get CLIP outputs
        outputs = self.clip(
            pixel_values=pixel_values,
            input_ids=input_ids,
            attention_mask=attention_mask,
            return_dict=True
        )
        
        # Get image and text embeddings
        image_embeds = outputs.image_embeds
        text_embeds = outputs.text_embeds
        
        # Compute similarity
        logits_per_image = outputs.logits_per_image
        
        # Make classification from image embeddings
        make_logits = self.make_classifier(image_embeds)
        
        return {
            'logits_per_image': logits_per_image,
            'logits_per_text': outputs.logits_per_text,
            'make_logits': make_logits,
            'image_embeds': image_embeds,
            'text_embeds': text_embeds
        }


def prepare_data(config: dict) -> Tuple[DataLoader, DataLoader, Dict, CLIPProcessor, pd.DataFrame]:
    """Prepare training and validation data."""
    
    # Load labels - prioritize filtered dataset if available
    filtered_file = DATA_DIR / "image_labels_filtered.csv"
    cleaned_file = DATA_DIR / "image_labels_cleaned.csv"
    labels_file = DATA_DIR / "image_labels.csv"
    
    if filtered_file.exists():
        logger.info(f"Using filtered dataset: {filtered_file}")
        labels_df = pd.read_csv(filtered_file)
        logger.info(f"Loaded {len(labels_df)} labeled images from filtered dataset")
    elif cleaned_file.exists():
        logger.info(f"Using cleaned dataset: {cleaned_file}")
        labels_df = pd.read_csv(cleaned_file)
        logger.info(f"Loaded {len(labels_df)} labeled images from cleaned dataset")
        # Apply additional filtering if needed
        make_counts = labels_df['make'].value_counts()
        valid_makes = make_counts[make_counts >= config['min_samples_per_class']].index.tolist()
        labels_df = labels_df[labels_df['make'].isin(valid_makes)]
        logger.info(f"After filtering: {len(labels_df)} images, {len(valid_makes)} makes")
    elif labels_file.exists():
        logger.info(f"Using standard labels file: {labels_file}")
        labels_df = pd.read_csv(labels_file)
        logger.info(f"Loaded {len(labels_df)} labeled images")
        # Filter makes with minimum samples
        make_counts = labels_df['make'].value_counts()
        valid_makes = make_counts[make_counts >= config['min_samples_per_class']].index.tolist()
        labels_df = labels_df[labels_df['make'].isin(valid_makes)]
        logger.info(f"After filtering: {len(labels_df)} images, {len(valid_makes)} makes")
    else:
        logger.info("Labels file not found, creating it...")
        from create_image_labels import create_image_labels
        create_image_labels()
        labels_df = pd.read_csv(labels_file)
        logger.info(f"Loaded {len(labels_df)} labeled images")
        # Filter makes with minimum samples
        make_counts = labels_df['make'].value_counts()
        valid_makes = make_counts[make_counts >= config['min_samples_per_class']].index.tolist()
        labels_df = labels_df[labels_df['make'].isin(valid_makes)]
        logger.info(f"After filtering: {len(labels_df)} images, {len(valid_makes)} makes")
    
    # Create make to index mapping - CRITICAL: Must be consistent and sequential
    makes = sorted(labels_df['make'].unique().tolist())
    make_to_idx = {make: idx for idx, make in enumerate(makes)}
    idx_to_make = {idx: make for make, idx in make_to_idx.items()}
    
    # Verify mapping consistency
    if len(makes) != len(set(makes)):
        logger.error("CRITICAL: Duplicate makes found!")
        raise ValueError("Dataset contains duplicate make names")
    
    # Verify indices are sequential (0, 1, 2, ...)
    indices = sorted(make_to_idx.values())
    expected_indices = list(range(len(makes)))
    if indices != expected_indices:
        logger.error("CRITICAL: make_to_idx indices are not sequential!")
        raise ValueError("make_to_idx must have sequential indices starting from 0")
    
    logger.info(f"Created make_to_idx mapping: {len(makes)} makes, indices 0-{len(makes)-1}")
    
    # Split data with stratification for balanced distribution
    from sklearn.model_selection import train_test_split
    
    labels_df = labels_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # First split: train+val (80%) vs test (20%) - test set kept separate
    train_val_df, test_df = train_test_split(
        labels_df, 
        test_size=0.2, 
        random_state=42, 
        stratify=labels_df['make']
    )
    
    # Second split: train (64%) vs val (16%)
    train_df, val_df = train_test_split(
        train_val_df,
        test_size=0.2,  # 20% of 80% = 16% of total
        random_state=42,
        stratify=train_val_df['make']
    )
    
    logger.info(f"Train: {len(train_df)} ({len(train_df)/len(labels_df)*100:.1f}%)")
    logger.info(f"Validation: {len(val_df)} ({len(val_df)/len(labels_df)*100:.1f}%)")
    logger.info(f"Test: {len(test_df)} ({len(test_df)/len(labels_df)*100:.1f}%)")
    
    # Save test set for final evaluation
    test_file = DATA_DIR / "test_set.csv"
    test_df.to_csv(test_file, index=False)
    logger.info(f"Test set saved to {test_file} for final evaluation")
    
    # Load processor
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    # Create datasets (with augmentation for training)
    train_dataset = CarImageDataset(train_df, IMAGES_DIR, processor, make_to_idx, mode='train', augment=True)
    val_dataset = CarImageDataset(val_df, IMAGES_DIR, processor, make_to_idx, mode='val', augment=False)
    
    # Create dataloaders with GPU optimization
    num_workers = config.get('num_workers', 8)
    pin_memory = config.get('pin_memory', True)
    batch_size = config['batch_size']
    
    logger.info(f"\nDataLoader Configuration:")
    logger.info(f"  Batch size: {batch_size}")
    logger.info(f"  Num workers: {num_workers}")
    logger.info(f"  Pin memory: {pin_memory}")
    logger.info(f"  Gradient accumulation: {config.get('gradient_accumulation_steps', 1)}")
    logger.info(f"  Effective batch size: {batch_size * config.get('gradient_accumulation_steps', 1)}")
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=pin_memory,
        drop_last=True,
        persistent_workers=True if num_workers > 0 else False,
        prefetch_factor=2 if num_workers > 0 else None,  # Reduced to 2 for memory efficiency
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=True if num_workers > 0 else False,
        prefetch_factor=2 if num_workers > 0 else None,  # Reduced to 2 for memory efficiency
    )
    
    logger.info(f"  Train batches per epoch: {len(train_loader)}")
    logger.info(f"  Val batches per epoch: {len(val_loader)}")
    
    # CRITICAL: Build mappings dict with consistent ordering
    mappings = {
        'make_to_idx': make_to_idx,
        'idx_to_make': idx_to_make,
        'makes': makes,  # Keep sorted list for compatibility
        'models_by_make': {}
    }
    
    # Build models_by_make mapping
    for make in makes:
        models = sorted(labels_df[labels_df['make'] == make]['model'].unique().tolist())
        mappings['models_by_make'][make] = models
    
    logger.info(f"Created mappings: {len(makes)} makes, {sum(len(v) for v in mappings['models_by_make'].values())} total models")
    
    return train_loader, val_loader, mappings, processor, train_df


def train_epoch(
    model: CLIPFineTuner,
    train_loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler._LRScheduler,
    device: torch.device,
    config: dict,
    scaler: Optional[torch.cuda.amp.GradScaler] = None,
    class_weights: Optional[torch.Tensor] = None
) -> Dict[str, float]:
    """Train for one epoch with Top-5 accuracy tracking."""
    
    model.train()
    total_loss = 0
    total_clip_loss = 0
    total_make_loss = 0
    correct = 0
    top5_correct = 0
    total = 0
    
    # Weighted loss if class weights provided
    criterion = nn.CrossEntropyLoss(weight=class_weights.to(device) if class_weights is not None else None)
    
    progress = tqdm(train_loader, desc="Training")
    
    # GPU memory monitoring
    initial_memory = torch.cuda.memory_allocated(device) / 1024**3 if torch.cuda.is_available() else 0
    empty_cache_frequency = config.get('empty_cache_frequency', 10)
    
    for batch_idx, batch in enumerate(progress):
        # Move to GPU (non-blocking for better pipelining)
        pixel_values = batch['pixel_values'].to(device, non_blocking=True)
        input_ids = batch['input_ids'].to(device, non_blocking=True)
        attention_mask = batch['attention_mask'].to(device, non_blocking=True)
        make_labels = batch['make_label'].to(device, non_blocking=True)
        
        # Log GPU memory usage on first batch
        if batch_idx == 0 and torch.cuda.is_available():
            current_memory = torch.cuda.memory_allocated(device) / 1024**3
            peak_memory = torch.cuda.max_memory_allocated(device) / 1024**3
            logger.info(f"GPU Memory - Allocated: {current_memory:.2f} GB, Peak: {peak_memory:.2f} GB")
            logger.info(f"Batch size: {pixel_values.shape[0]} (expected: {config['batch_size']})")
            logger.info(f"Gradient accumulation: {config['gradient_accumulation_steps']} (effective batch: {config['batch_size'] * config['gradient_accumulation_steps']})")
        
        # Forward pass with mixed precision
        if config['mixed_precision'] and scaler is not None:
            with torch.cuda.amp.autocast():
                outputs = model(pixel_values, input_ids, attention_mask)
                
                # CLIP contrastive loss
                labels = torch.arange(len(pixel_values), device=device)
                clip_loss = (
                    nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                    nn.functional.cross_entropy(outputs['logits_per_text'], labels)
                ) / 2
                
                # Make classification loss (with class weights)
                make_loss = criterion(outputs['make_logits'], make_labels)
                
                # Combined loss - divide by accumulation steps for correct averaging
                loss = (clip_loss + make_loss) / config['gradient_accumulation_steps']
            
            # Track metrics before backward pass
            loss_value = loss.item() * config['gradient_accumulation_steps']
            clip_loss_value = clip_loss.item()
            make_loss_value = make_loss.item()
            
            # Calculate accuracy before backward pass
            make_logits = outputs['make_logits']
            _, top5_preds = make_logits.topk(5, dim=1)
            preds = make_logits.argmax(dim=1)
            
            correct += (preds == make_labels).sum().item()
            top5_correct += (top5_preds == make_labels.unsqueeze(1)).any(dim=1).sum().item()
            total += make_labels.size(0)
            
            # Accumulate losses
            total_loss += loss_value
            total_clip_loss += clip_loss_value
            total_make_loss += make_loss_value
            
            # Backward pass
            scaler.scale(loss).backward()
            
            if (batch_idx + 1) % config['gradient_accumulation_steps'] == 0:
                # Gradient clipping for stability
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()
                scheduler.step()
            
            # Free intermediate tensors immediately to save memory
            del pixel_values, input_ids, attention_mask, make_labels, outputs, loss, clip_loss, make_loss, make_logits, top5_preds, preds, labels
            
            # Clear cache more aggressively (every 5 batches)
            if (batch_idx + 1) % empty_cache_frequency == 0:
                torch.cuda.empty_cache()
        else:
            outputs = model(pixel_values, input_ids, attention_mask)
            
            labels = torch.arange(len(pixel_values), device=device)
            clip_loss = (
                nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                nn.functional.cross_entropy(outputs['logits_per_text'], labels)
            ) / 2
            
            make_loss = criterion(outputs['make_logits'], make_labels)
            # Divide by accumulation steps for correct averaging
            loss = (clip_loss + make_loss) / config['gradient_accumulation_steps']
            
            # Track metrics before backward pass
            loss_value = loss.item() * config['gradient_accumulation_steps']
            clip_loss_value = clip_loss.item()
            make_loss_value = make_loss.item()
            
            # Calculate accuracy before backward pass
            make_logits = outputs['make_logits']
            _, top5_preds = make_logits.topk(5, dim=1)
            preds = make_logits.argmax(dim=1)
            
            correct += (preds == make_labels).sum().item()
            top5_correct += (top5_preds == make_labels.unsqueeze(1)).any(dim=1).sum().item()
            total += make_labels.size(0)
            
            # Accumulate losses
            total_loss += loss_value
            total_clip_loss += clip_loss_value
            total_make_loss += make_loss_value
            
            loss.backward()
            
            if (batch_idx + 1) % config['gradient_accumulation_steps'] == 0:
                # Gradient clipping for stability
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                
                optimizer.step()
                optimizer.zero_grad()
                scheduler.step()
            
            # Free intermediate tensors immediately to save memory
            del pixel_values, input_ids, attention_mask, make_labels, outputs, loss, clip_loss, make_loss, make_logits, top5_preds, preds, labels
            
            # Clear cache more aggressively (every 5 batches)
            if (batch_idx + 1) % empty_cache_frequency == 0:
                torch.cuda.empty_cache()
        
        progress.set_postfix({
            'loss': f"{loss_value:.4f}",
            'acc': f"{100*correct/total:.1f}%",
            'top5': f"{100*top5_correct/total:.1f}%"
        })
    
    return {
        'loss': total_loss / len(train_loader),
        'clip_loss': total_clip_loss / len(train_loader),
        'make_loss': total_make_loss / len(train_loader),
        'accuracy': correct / total,
        'top5_accuracy': top5_correct / total
    }


def validate(
    model: CLIPFineTuner,
    val_loader: DataLoader,
    device: torch.device
) -> Dict[str, float]:
    """Validate the model with Top-5 accuracy."""
    
    model.eval()
    total_loss = 0
    correct = 0
    top5_correct = 0
    total = 0
    
    with torch.no_grad():
        for batch in tqdm(val_loader, desc="Validating"):
            pixel_values = batch['pixel_values'].to(device)
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            make_labels = batch['make_label'].to(device)
            
            outputs = model(pixel_values, input_ids, attention_mask)
            
            # Loss
            labels = torch.arange(len(pixel_values), device=device)
            clip_loss = (
                nn.functional.cross_entropy(outputs['logits_per_image'], labels) +
                nn.functional.cross_entropy(outputs['logits_per_text'], labels)
            ) / 2
            make_loss = nn.functional.cross_entropy(outputs['make_logits'], make_labels)
            loss = clip_loss + make_loss
            
            total_loss += loss.item()
            
            # Top-1 and Top-5 accuracy
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


def save_model(
    model: CLIPFineTuner,
    processor: CLIPProcessor,
    mappings: dict,
    config: dict,
    epoch: int,
    metrics: dict,
    save_dir: Path
):
    """Save model checkpoint."""
    
    save_dir.mkdir(parents=True, exist_ok=True)
    
    # CRITICAL: Handle DataParallel - save model.module.state_dict() if wrapped
    if hasattr(model, 'module'):
        # Model is wrapped in DataParallel
        actual_model = model.module
        logger.debug("Saving model wrapped in DataParallel")
    else:
        actual_model = model
    
    # Verify mappings consistency
    if 'make_to_idx' in mappings:
        make_to_idx = mappings['make_to_idx']
        num_makes = len(make_to_idx)
        if actual_model.make_classifier.out_features != num_makes:
            logger.error(f"CRITICAL: Classifier output size ({actual_model.make_classifier.out_features}) != mappings makes ({num_makes})")
            raise ValueError("Model and mappings mismatch!")
    
    # Save model (always save unwrapped version for easier loading)
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
    
    torch.save(checkpoint, save_dir / f"checkpoint_epoch_{epoch}.pt")
    
    # Save best model
    torch.save(checkpoint, save_dir / "best_model.pt")
    
    # Save processor
    processor.save_pretrained(save_dir / "processor")
    
    # Save mappings as JSON
    with open(save_dir / "mappings.json", 'w') as f:
        json.dump(mappings, f, indent=2)
    
    # Save config
    with open(save_dir / "config.json", 'w') as f:
        json.dump(config, f, indent=2)
    
    logger.info(f"Saved model to {save_dir}")


def train(config: dict = None):
    """Main training function."""
    
    if config is None:
        config = DEFAULT_CONFIG.copy()
    
    logger.info("=" * 60)
    logger.info("CAR CLIP FINE-TUNING - GPU OPTIMIZED")
    logger.info("=" * 60)
    
    # Check GPU availability
    if not torch.cuda.is_available():
        logger.error("=" * 60)
        logger.error("ERROR: CUDA/GPU NOT AVAILABLE!")
        logger.error("This training requires a GPU for reasonable speed.")
        logger.error("Please ensure you have:")
        logger.error("  1. NVIDIA GPU with CUDA support")
        logger.error("  2. CUDA toolkit installed")
        logger.error("  3. PyTorch with CUDA: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118")
        logger.error("=" * 60)
        raise RuntimeError("GPU not available. Training requires CUDA.")
    
    # GPU Info
    device = torch.device("cuda")
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
    
    logger.info(f"\nGPU DETECTED:")
    logger.info(f"  Name: {gpu_name}")
    logger.info(f"  Memory: {gpu_memory:.1f} GB")
    logger.info(f"  CUDA Version: {torch.version.cuda}")
    
    # Only suggest batch size if not explicitly set from command line
    # Don't override user's batch_size choice - let them experiment
    suggested_batch_size = config['batch_size']
    if gpu_memory < 4:
        suggested_batch_size = 16
    elif gpu_memory < 6:
        suggested_batch_size = 32
    elif gpu_memory < 8:
        suggested_batch_size = 64
    elif gpu_memory < 12:
        suggested_batch_size = 96  # RTX 4060 8GB
    else:
        suggested_batch_size = 128  # 12GB+ GPUs
    
    if config['batch_size'] != suggested_batch_size:
        logger.info(f"  Suggested batch size for {gpu_memory:.1f}GB GPU: {suggested_batch_size}")
        logger.info(f"  Using batch size: {config['batch_size']} (from command line)")
    else:
        logger.info(f"  Using batch size: {config['batch_size']}")
    
    # Calculate effective batch size with gradient accumulation
    effective_batch_size = config['batch_size'] * config.get('gradient_accumulation_steps', 1)
    logger.info(f"  Effective batch size (with accumulation): {effective_batch_size}")
    
    logger.info(f"\nConfig: {json.dumps(config, indent=2)}")
    
    # Enable TF32 for faster training on Ampere GPUs
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True  # Auto-tune for best performance
    
    # Memory optimization settings
    torch.cuda.empty_cache()  # Clear cache before starting
    if hasattr(torch.cuda, 'set_per_process_memory_fraction'):
        # Reserve some GPU memory for system (optional)
        torch.cuda.set_per_process_memory_fraction(0.95, device=0)
    
    logger.info("\nMemory Optimization Settings:")
    logger.info(f"  Mixed Precision (FP16): {config['mixed_precision']}")
    logger.info(f"  Batch size: {config['batch_size']}")
    logger.info(f"  Gradient accumulation: {config['gradient_accumulation_steps']}")
    logger.info(f"  Effective batch size: {config['batch_size'] * config['gradient_accumulation_steps']}")
    logger.info(f"  Cache clearing frequency: every {config.get('empty_cache_frequency', 5)} batches")
    logger.info(f"  Gradient checkpointing: {config.get('use_gradient_checkpointing', False)}")
    
    logger.info(f"\nUsing device: {device}")
    
    # Prepare data
    logger.info("\nPreparing data...")
    train_loader, val_loader, mappings, processor, train_df = prepare_data(config)
    
    num_makes = len(mappings['make_to_idx'])
    logger.info(f"Number of makes: {num_makes}")
    
    # Compute class weights for balanced training
    if config.get('use_class_weights', True):
        logger.info("\nComputing class weights for balanced training...")
        make_labels = train_df['make'].map(mappings['make_to_idx']).values
        class_weights = compute_class_weight('balanced', classes=np.unique(make_labels), y=make_labels)
        class_weights = torch.tensor(class_weights, dtype=torch.float32)
        logger.info(f"Class weights computed (min={class_weights.min():.3f}, max={class_weights.max():.3f})")
    else:
        class_weights = None
        logger.info("Class weights disabled")
    
    # Load CLIP model
    logger.info("\nLoading CLIP model...")
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    
    # Enable gradient checkpointing if requested (saves memory at cost of speed)
    if config.get('use_gradient_checkpointing', False):
        if hasattr(clip_model, 'gradient_checkpointing_enable'):
            clip_model.gradient_checkpointing_enable()
            logger.info("✅ Gradient checkpointing enabled (saves memory)")
        else:
            logger.warning("⚠️ Gradient checkpointing not available for this model")
    
    # Create fine-tuner
    model = CLIPFineTuner(clip_model, num_makes)
    model.to(device)
    
    # Multi-GPU support
    num_gpus = torch.cuda.device_count()
    if num_gpus > 1:
        logger.info(f"Using {num_gpus} GPUs with DataParallel")
        model = nn.DataParallel(model)
    
    # Optional: torch.compile for PyTorch 2.0+ (faster training)
    if config.get('use_compile', False) and hasattr(torch, 'compile'):
        logger.info("Using torch.compile() for optimized training")
        model = torch.compile(model, mode='reduce-overhead')
    
    # Optimizer with weight decay
    optimizer = AdamW(
        model.parameters(), 
        lr=config['learning_rate'],
        weight_decay=0.01,
        betas=(0.9, 0.999)
    )
    
    # Improved scheduler: OneCycleLR for better convergence
    # Falls back to CosineAnnealingLR if OneCycleLR not available
    total_steps = len(train_loader) * config['epochs']
    try:
        scheduler = OneCycleLR(
            optimizer,
            max_lr=config['learning_rate'],
            total_steps=total_steps,
            pct_start=0.1,  # Warmup for 10% of training
            anneal_strategy='cos'
        )
        logger.info("Using OneCycleLR scheduler")
    except:
        scheduler = CosineAnnealingLR(optimizer, T_max=total_steps)
        logger.info("Using CosineAnnealingLR scheduler")
    
    # Mixed precision scaler for faster training
    scaler = None
    if config['mixed_precision']:
        scaler = torch.cuda.amp.GradScaler()
        logger.info("Using mixed precision (FP16) for faster training")
    
    # Training loop
    best_val_acc = 0
    
    # Log GPU memory before training
    logger.info(f"\nGPU Memory before training: {torch.cuda.memory_allocated()/1024**3:.2f} GB allocated")
    
    for epoch in range(1, config['epochs'] + 1):
        epoch_start_time = time.time()
        logger.info(f"\n{'='*60}")
        logger.info(f"Epoch {epoch}/{config['epochs']}")
        logger.info(f"GPU Memory: {torch.cuda.memory_allocated()/1024**3:.2f} GB / {torch.cuda.max_memory_allocated()/1024**3:.2f} GB peak")
        logger.info(f"{'='*60}")
        
        # Train
        train_metrics = train_epoch(
            model, train_loader, optimizer, scheduler, device, config, scaler, class_weights
        )
        logger.info(f"Train - Loss: {train_metrics['loss']:.4f}, "
                   f"Top-1 Acc: {train_metrics['accuracy']*100:.2f}%, "
                   f"Top-5 Acc: {train_metrics['top5_accuracy']*100:.2f}%")
        
        # Validate
        val_metrics = validate(model, val_loader, device)
        logger.info(f"Val - Loss: {val_metrics['loss']:.4f}, "
                   f"Top-1 Acc: {val_metrics['accuracy']*100:.2f}%, "
                   f"Top-5 Acc: {val_metrics['top5_accuracy']*100:.2f}%")
        
        # Aggressive memory clearing after each epoch
        torch.cuda.empty_cache()
        logger.info(f"GPU Memory after epoch: {torch.cuda.memory_allocated()/1024**3:.2f} GB / {torch.cuda.max_memory_allocated()/1024**3:.2f} GB peak")
        
        # Epoch timing
        epoch_time = time.time() - epoch_start_time
        samples_per_sec = len(train_loader.dataset) / epoch_time
        batches_per_sec = len(train_loader) / epoch_time
        
        logger.info(f"Epoch time: {epoch_time:.1f}s ({samples_per_sec:.1f} samples/sec, {batches_per_sec:.2f} batches/sec)")
        
        # GPU memory stats
        if torch.cuda.is_available():
            peak_memory = torch.cuda.max_memory_allocated(device) / 1024**3
            current_memory = torch.cuda.memory_allocated(device) / 1024**3
            logger.info(f"GPU Memory - Peak: {peak_memory:.2f} GB, Current: {current_memory:.2f} GB")
        
        # Clear GPU cache
        torch.cuda.empty_cache()
        
        # Save if best (using Top-1 accuracy)
        if val_metrics['accuracy'] > best_val_acc:
            best_val_acc = val_metrics['accuracy']
            logger.info(f"New best validation accuracy: Top-1={best_val_acc*100:.2f}%, Top-5={val_metrics['top5_accuracy']*100:.2f}%")
            
            save_model(
                model, processor, mappings, config, epoch,
                {'train': train_metrics, 'val': val_metrics},
                MODELS_DIR
            )
        
        # Save checkpoint
        if config['save_every_epoch']:
            save_model(
                model, processor, mappings, config, epoch,
                {'train': train_metrics, 'val': val_metrics},
                MODELS_DIR / "checkpoints"
            )
    
    logger.info("\n" + "=" * 60)
    logger.info("TRAINING COMPLETE")
    logger.info(f"Best validation accuracy: {best_val_acc*100:.2f}%")
    logger.info(f"Model saved to: {MODELS_DIR}")
    logger.info("=" * 60)
    
    return model, processor, mappings


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Car CLIP Model - GPU Optimized")
    parser.add_argument('--epochs', type=int, default=5, help='Number of epochs')
    parser.add_argument('--batch_size', type=int, default=8, help='Batch size (8 default for 8GB VRAM, use gradient_accumulation for larger effective batch)')
    parser.add_argument('--lr', type=float, default=2e-5, help='Learning rate')
    parser.add_argument('--min_samples', type=int, default=10, help='Min samples per class')
    parser.add_argument('--num_workers', type=int, default=2, help='Number of data loading workers (reduced to 2 to save RAM)')
    parser.add_argument('--gradient_accumulation', type=int, default=16, help='Gradient accumulation steps (default: 16, effective batch = batch_size * accumulation)')
    parser.add_argument('--no_mixed_precision', action='store_true', help='Disable mixed precision (FP16)')
    parser.add_argument('--compile', action='store_true', help='Use torch.compile (PyTorch 2.0+)')
    
    args = parser.parse_args()
    
    config = DEFAULT_CONFIG.copy()
    config['epochs'] = args.epochs
    config['batch_size'] = args.batch_size
    config['learning_rate'] = args.lr
    config['min_samples_per_class'] = args.min_samples
    config['num_workers'] = args.num_workers
    config['gradient_accumulation_steps'] = args.gradient_accumulation
    config['mixed_precision'] = not args.no_mixed_precision
    config['use_compile'] = args.compile
    
    # Print GPU info
    if torch.cuda.is_available():
        print(f"\n{'='*60}")
        print("GPU TRAINING MODE")
        print(f"{'='*60}")
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        print(f"CUDA Version: {torch.version.cuda}")
        print(f"PyTorch Version: {torch.__version__}")
        print(f"{'='*60}\n")
    else:
        print("\nWARNING: No GPU detected! Training will fail.")
        print("Install CUDA-enabled PyTorch: pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118\n")
    
    train(config)
