"""
Test Car Classifier
Evaluates the fine-tuned CLIP model for car make/model recognition.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
import numpy as np
from PIL import Image
from tqdm import tqdm

import torch
from transformers import CLIPProcessor, CLIPModel

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"


def load_finetuned_model(model_dir: Path = MODELS_DIR):
    """Load the fine-tuned CLIP model with classifier head. Tries best.pt then best_model.pt. Uses label_map.json for class order when present."""
    
    checkpoint_path = model_dir / "best.pt"
    if not checkpoint_path.exists():
        checkpoint_path = model_dir / "best_model.pt"
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Model not found: {model_dir / 'best.pt'} or best_model.pt")
    
    logger.info(f"Loading model from {checkpoint_path}")
    
    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    clip_model.load_state_dict(checkpoint['clip_state_dict'])
    
    processor_path = model_dir / "processor"
    if processor_path.exists():
        processor = CLIPProcessor.from_pretrained(processor_path)
    else:
        processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    
    mappings = checkpoint.get('mappings', {})
    
    # Prefer label_map.json for same class order as training
    label_map_path = model_dir / "label_map.json"
    if label_map_path.exists():
        with open(label_map_path) as f:
            makes = json.load(f)
        make_to_idx = {m: i for i, m in enumerate(makes)}
        idx_to_make = {i: m for i, m in enumerate(makes)}
        mappings = dict(mappings, make_to_idx=make_to_idx, idx_to_make=idx_to_make, makes=makes)
    
    num_makes = len(mappings['make_to_idx'])
    
    sys.path.insert(0, str(Path(__file__).parent))
    try:
        from train_optimized import CLIPFineTuner
    except ImportError:
        from train_car_clip import CLIPFineTuner
    model = CLIPFineTuner(clip_model, num_makes)
    
    # Load full model state (including classifier)
    # CRITICAL: Handle DataParallel state_dict (keys have 'module.' prefix)
    if 'model_state_dict' in checkpoint:
        state_dict = checkpoint['model_state_dict']
        
        # Check if state_dict was saved with DataParallel
        has_module_prefix = any(k.startswith('module.') for k in state_dict.keys())
        
        if has_module_prefix:
            # Remove 'module.' prefix if model wasn't wrapped in DataParallel
            new_state_dict = {}
            for k, v in state_dict.items():
                if k.startswith('module.'):
                    new_state_dict[k[7:]] = v  # Remove 'module.' prefix
                else:
                    new_state_dict[k] = v
            state_dict = new_state_dict
            logger.info("Removed 'module.' prefix from state_dict (DataParallel -> single GPU)")
        
        try:
            model.load_state_dict(state_dict, strict=False)
            logger.info("Loaded model state_dict successfully")
        except Exception as e:
            logger.error(f"Error loading model state_dict: {e}")
            logger.info("Attempting to load classifier separately...")
            # Fallback: try loading classifier only
            if 'classifier_state_dict' in checkpoint:
                classifier_state = checkpoint['classifier_state_dict']
                if any(k.startswith('module.') for k in classifier_state.keys()):
                    classifier_state = {k[7:] if k.startswith('module.') else k: v 
                                      for k, v in classifier_state.items()}
                model.make_classifier.load_state_dict(classifier_state)
                logger.warning("Loaded classifier weights only (CLIP weights may be mismatched)")
            else:
                logger.error("CRITICAL: Could not load classifier weights!")
                raise
    elif 'classifier_state_dict' in checkpoint:
        # Fallback: load classifier separately
        classifier_state = checkpoint['classifier_state_dict']
        # Handle DataParallel prefix
        if any(k.startswith('module.') for k in classifier_state.keys()):
            classifier_state = {k[7:] if k.startswith('module.') else k: v 
                              for k, v in classifier_state.items()}
        model.make_classifier.load_state_dict(classifier_state)
        logger.warning("Loaded classifier weights only (CLIP weights not loaded)")
    else:
        logger.error("CRITICAL: No classifier weights found in checkpoint!")
        raise ValueError("Checkpoint missing classifier weights - model cannot be used")
    
    # Verify classifier was loaded
    with torch.no_grad():
        test_input = torch.randn(1, 512)  # CLIP projection dim
        test_output = model.make_classifier(test_input)
        if test_output.sum().item() == 0:
            logger.error("CRITICAL: Classifier appears to be uninitialized (all zeros)!")
            raise ValueError("Classifier weights not loaded properly")
    
    model.eval()
    
    return model, processor, mappings


def predict_make_model(
    image_path: str,
    model,  # CLIPFineTuner model (not base CLIPModel)
    processor: CLIPProcessor,
    makes: List[str],
    models_by_make: Dict[str, List[str]],
    device: torch.device,
    top_k: int = 5,
    use_classifier: bool = True
) -> Dict:
    """
    Predict make and model from image.
    
    Args:
        model: CLIPFineTuner model with trained classifier head
        use_classifier: If True, use trained classifier head. If False, use zero-shot CLIP.
    """
    
    # Load image
    try:
        image = Image.open(image_path).convert('RGB')
    except Exception as e:
        logger.error(f"Failed to load image {image_path}: {e}")
        return {'error': str(e)}
    
    model.eval()
    
    with torch.no_grad():
        # Process image
        inputs = processor(
            text=["dummy"],  # Dummy text, we only need image
            images=image,
            return_tensors="pt",
            padding=True
        )
        pixel_values = inputs['pixel_values'].to(device)
        input_ids = inputs['input_ids'].to(device)
        attention_mask = inputs['attention_mask'].to(device)
        
        if use_classifier and hasattr(model, 'make_classifier'):
            # Use trained classifier head (CORRECT METHOD)
            outputs = model(pixel_values, input_ids, attention_mask)
            make_logits = outputs['make_logits']
            make_probs = torch.softmax(make_logits, dim=1).cpu().numpy()[0]
            
            # Get top-k makes
            # CRITICAL: Ensure indices are valid
            if len(make_probs) != len(makes):
                logger.error(f"CRITICAL: make_probs length ({len(make_probs)}) != makes length ({len(makes)})")
                logger.error("This indicates a mismatch between model and mappings!")
                raise ValueError("Model output size doesn't match makes list")
            
            top_make_indices = np.argsort(make_probs)[::-1][:top_k]
            top_makes = []
            for idx in top_make_indices:
                if 0 <= idx < len(makes):
                    top_makes.append((makes[idx], float(make_probs[idx])))
                else:
                    logger.error(f"Invalid index {idx} for makes list of length {len(makes)}")
            
            if not top_makes:
                logger.error("CRITICAL: No valid predictions!")
                return {'error': 'Invalid model output'}
            
            best_make = top_makes[0][0]
            best_make_conf = top_makes[0][1]
        else:
            # Fallback: zero-shot CLIP (for comparison)
            make_labels = [f"a photo of a {make} car" for make in makes]
            inputs = processor(
                text=make_labels,
                images=image,
                return_tensors="pt",
                padding=True
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            outputs = model.clip(**inputs)
            make_probs = outputs.logits_per_image.softmax(dim=1).cpu().numpy()[0]
            
            top_make_indices = np.argsort(make_probs)[::-1][:top_k]
            top_makes = [(makes[i], float(make_probs[i])) for i in top_make_indices]
            best_make = top_makes[0][0]
            best_make_conf = top_makes[0][1]
        
        # 2. Predict Model (for top make) - using zero-shot CLIP for model
        if best_make in models_by_make and models_by_make[best_make]:
            model_options = models_by_make[best_make]
            model_labels = [f"a photo of a {best_make} {model} car" for model in model_options]
            
            inputs = processor(
                text=model_labels,
                images=image,
                return_tensors="pt",
                padding=True
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            outputs = model.clip(**inputs)
            model_probs = outputs.logits_per_image.softmax(dim=1).cpu().numpy()[0]
            
            top_model_indices = np.argsort(model_probs)[::-1][:top_k]
            top_models = [(model_options[i], float(model_probs[i])) for i in top_model_indices]
            best_model = top_models[0][0]
            best_model_conf = top_models[0][1]
        else:
            top_models = []
            best_model = "Unknown"
            best_model_conf = 0.0
    
    return {
        'make': {
            'best': best_make,
            'confidence': best_make_conf,
            'top_k': top_makes
        },
        'model': {
            'best': best_model,
            'confidence': best_model_conf,
            'top_k': top_models
        }
    }


def evaluate_on_dataset(
    labels_df: pd.DataFrame,
    model,  # CLIPFineTuner model
    processor: CLIPProcessor,
    makes: List[str],
    models_by_make: Dict[str, List[str]],
    device: torch.device,
    sample_size: Optional[int] = None,
    split: str = 'all'  # 'all', 'train', 'val', 'test'
) -> Dict:
    """
    Evaluate model on dataset with proper train/val/test split.
    
    Args:
        split: 'all' (entire dataset), 'train', 'val', or 'test'
    """
    
    from sklearn.model_selection import train_test_split
    
    # Create proper train/val/test split (same as training)
    labels_df = labels_df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # First split: train+val (80%) vs test (20%)
    train_val_df, test_df = train_test_split(
        labels_df, test_size=0.2, random_state=42, stratify=labels_df['make']
    )
    
    # Second split: train (64%) vs val (16%)
    train_df, val_df = train_test_split(
        train_val_df, test_size=0.2, random_state=42, stratify=train_val_df['make']
    )
    
    # Select split
    if split == 'train':
        eval_df = train_df
    elif split == 'val':
        eval_df = val_df
    elif split == 'test':
        eval_df = test_df
    else:
        eval_df = labels_df
    
    logger.info(f"Evaluating on {split} split: {len(eval_df)} images")
    logger.info(f"  Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")
    
    # Sample if needed
    if sample_size and len(eval_df) > sample_size:
        eval_df = eval_df.sample(n=sample_size, random_state=42)
        logger.info(f"Sampled to {len(eval_df)} images for evaluation")
    
    make_correct = 0
    model_correct = 0
    make_top5_correct = 0
    model_top5_correct = 0
    total = 0
    
    results = []
    
    for idx, row in tqdm(eval_df.iterrows(), total=len(eval_df), desc=f"Evaluating {split}"):
        image_path = IMAGES_DIR / row['image_filename']
        
        if not image_path.exists():
            continue
        
        true_make = row['make']
        true_model = row['model']
        
        pred = predict_make_model(
            str(image_path), model, processor, 
            makes, models_by_make, device,
            use_classifier=True  # Use trained classifier
        )
        
        if 'error' in pred:
            continue
        
        total += 1
        
        # Make accuracy (Top-1)
        pred_make = pred['make']['best']
        if pred_make == true_make:
            make_correct += 1
        
        # Make top-5 accuracy
        top5_makes = [m[0] for m in pred['make']['top_k']]
        if true_make in top5_makes:
            make_top5_correct += 1
        
        # Model accuracy (only if make is correct)
        if pred_make == true_make:
            pred_model = pred['model']['best']
            if pred_model == true_model:
                model_correct += 1
            
            top5_models = [m[0] for m in pred['model']['top_k']]
            if true_model in top5_models:
                model_top5_correct += 1
        
        results.append({
            'image': row['image_filename'],
            'true_make': true_make,
            'pred_make': pred_make,
            'make_correct': pred_make == true_make,
            'make_top5_correct': true_make in top5_makes,
            'true_model': true_model,
            'pred_model': pred['model']['best'],
            'make_confidence': pred['make']['confidence'],
            'model_confidence': pred['model']['confidence']
        })
    
    # Calculate metrics
    make_accuracy = make_correct / total if total > 0 else 0
    make_top5_accuracy = make_top5_correct / total if total > 0 else 0
    model_accuracy = model_correct / make_correct if make_correct > 0 else 0
    model_top5_accuracy = model_top5_correct / make_correct if make_correct > 0 else 0
    
    return {
        'split': split,
        'total_samples': total,
        'make_accuracy': make_accuracy,
        'make_top5_accuracy': make_top5_accuracy,
        'model_accuracy': model_accuracy,
        'model_top5_accuracy': model_top5_accuracy,
        'make_correct': make_correct,
        'model_correct': model_correct,
        'results': results
    }


def main():
    """Main evaluation function."""
    
    logger.info("=" * 60)
    logger.info("CAR CLASSIFIER EVALUATION")
    logger.info("=" * 60)
    
    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")
    
    # Load model
    try:
        model, processor, mappings = load_finetuned_model()
        model.to(device)
        logger.info("Loaded fine-tuned model with classifier head")
    except FileNotFoundError as e:
        logger.error(f"Fine-tuned model not found: {e}")
        logger.error("Please train the model first: python scripts/train_car_clip.py")
        return
    except Exception as e:
        logger.error(f"Error loading model: {e}", exc_info=True)
        return
    
    # Get makes and models - CRITICAL: Ensure consistent ordering
    if 'make_to_idx' in mappings:
        # Sort by index to ensure consistent order
        make_to_idx = mappings['make_to_idx']
        makes = [make for make, idx in sorted(make_to_idx.items(), key=lambda x: x[1])]
        logger.info(f"Loaded {len(makes)} makes from make_to_idx mapping")
        
        # Verify mapping consistency
        if len(makes) != len(set(makes)):
            logger.error("CRITICAL: Duplicate makes found in make_to_idx!")
            raise ValueError("make_to_idx contains duplicate makes")
        
        # Verify indices are sequential (0, 1, 2, ...)
        indices = sorted(make_to_idx.values())
        expected_indices = list(range(len(makes)))
        if indices != expected_indices:
            logger.error(f"CRITICAL: make_to_idx indices are not sequential!")
            logger.error(f"Expected: {expected_indices[:10]}...")
            logger.error(f"Got: {indices[:10]}...")
            raise ValueError("make_to_idx indices must be sequential starting from 0")
    else:
        makes = mappings.get('makes', [])
        logger.warning("No make_to_idx found, using makes list (may have ordering issues)")
    
    models_by_make = mappings.get('models_by_make', {})
    
    logger.info(f"Number of makes: {len(makes)}")
    logger.info(f"Sample makes: {makes[:10]}")
    
    # CRITICAL: Verify make list matches model classifier output size
    if hasattr(model, 'make_classifier'):
        classifier_output_size = model.make_classifier.out_features
        if classifier_output_size != len(makes):
            logger.error(f"CRITICAL: Classifier output size ({classifier_output_size}) != number of makes ({len(makes)})")
            logger.error("This will cause incorrect predictions!")
            raise ValueError(f"Model classifier expects {classifier_output_size} classes but mappings have {len(makes)} makes")
    
    # Load labels
    labels_file = DATA_DIR / "image_labels.csv"
    if not labels_file.exists():
        logger.error(f"Labels file not found: {labels_file}")
        logger.info("Run create_image_labels.py first")
        return
    
    labels_df = pd.read_csv(labels_file)
    
    # Filter to valid makes
    labels_df = labels_df[labels_df['make'].isin(makes)]
    logger.info(f"Total images in dataset: {len(labels_df)}")
    
    # Evaluate on validation and test sets separately
    logger.info("\n" + "=" * 60)
    logger.info("EVALUATION RESULTS")
    logger.info("=" * 60)
    
    # Validation set
    val_results = evaluate_on_dataset(
        labels_df, model, processor,
        makes, models_by_make, device,
        split='val'
    )
    
    logger.info(f"\n--- VALIDATION SET ---")
    logger.info(f"Total samples: {val_results['total_samples']}")
    logger.info(f"Make Accuracy (Top-1): {val_results['make_accuracy']*100:.2f}%")
    logger.info(f"Make Accuracy (Top-5): {val_results['make_top5_accuracy']*100:.2f}%")
    logger.info(f"Model Accuracy (Top-1, given correct make): {val_results['model_accuracy']*100:.2f}%")
    logger.info(f"Model Accuracy (Top-5, given correct make): {val_results['model_top5_accuracy']*100:.2f}%")
    
    # Test set
    test_results = evaluate_on_dataset(
        labels_df, model, processor,
        makes, models_by_make, device,
        split='test'
    )
    
    logger.info(f"\n--- TEST SET ---")
    logger.info(f"Total samples: {test_results['total_samples']}")
    logger.info(f"Make Accuracy (Top-1): {test_results['make_accuracy']*100:.2f}%")
    logger.info(f"Make Accuracy (Top-5): {test_results['make_top5_accuracy']*100:.2f}%")
    logger.info(f"Model Accuracy (Top-1, given correct make): {test_results['model_accuracy']*100:.2f}%")
    logger.info(f"Model Accuracy (Top-5, given correct make): {test_results['model_top5_accuracy']*100:.2f}%")
    
    # Save results
    val_results_df = pd.DataFrame(val_results['results'])
    val_results_file = DATA_DIR / "evaluation_results_val.csv"
    val_results_df.to_csv(val_results_file, index=False)
    logger.info(f"\nValidation results saved to {val_results_file}")
    
    test_results_df = pd.DataFrame(test_results['results'])
    test_results_file = DATA_DIR / "evaluation_results_test.csv"
    test_results_df.to_csv(test_results_file, index=False)
    logger.info(f"Test results saved to {test_results_file}")
    
    # Per-make accuracy (validation set)
    if len(val_results['results']) > 0:
        make_acc = val_results_df.groupby('true_make')['make_correct'].mean()
        make_top5_acc = val_results_df.groupby('true_make')['make_top5_correct'].mean()
        logger.info("\nPer-Make Accuracy - Validation Set (Top 10):")
        for make in make_acc.sort_values(ascending=False).head(10).index:
            acc1 = make_acc[make] * 100
            acc5 = make_top5_acc[make] * 100
            logger.info(f"  {make}: Top-1={acc1:.1f}%, Top-5={acc5:.1f}%")


if __name__ == "__main__":
    main()
