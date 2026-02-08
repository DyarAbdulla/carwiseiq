"""
Check if model labels match dataset labels
Critical validation to ensure predictions map to correct makes
"""

import torch
import json
from pathlib import Path
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"

def check_model_labels():
    """Check if saved model labels match current dataset labels."""
    
    logger.info("=" * 80)
    logger.info("MODEL LABEL VALIDATION")
    logger.info("=" * 80)
    
    # 1. Load saved model mappings
    checkpoint_path = MODELS_DIR / "best_model.pt"
    if not checkpoint_path.exists():
        logger.error(f"Model not found: {checkpoint_path}")
        logger.info("Train model first: python scripts/train_car_clip.py")
        return False
    
    logger.info(f"\n[1/4] Loading model checkpoint...")
    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    
    if 'mappings' not in checkpoint:
        logger.error("CRITICAL: No mappings found in checkpoint!")
        return False
    
    saved_mappings = checkpoint['mappings']
    saved_makes = []
    
    if 'make_to_idx' in saved_mappings:
        # Sort by index to get correct order
        make_to_idx = saved_mappings['make_to_idx']
        saved_makes = [make for make, idx in sorted(make_to_idx.items(), key=lambda x: x[1])]
        logger.info(f"Saved model has {len(saved_makes)} makes")
    else:
        saved_makes = saved_mappings.get('makes', [])
        logger.warning("No make_to_idx in saved model, using makes list")
    
    logger.info(f"Sample saved makes: {saved_makes[:10]}")
    
    # 2. Load current dataset labels
    logger.info(f"\n[2/4] Loading current dataset labels...")
    labels_file = DATA_DIR / "image_labels.csv"
    if not labels_file.exists():
        logger.error(f"Labels file not found: {labels_file}")
        return False
    
    labels_df = pd.read_csv(labels_file)
    current_makes = sorted(labels_df['make'].unique().tolist())
    logger.info(f"Current dataset has {len(current_makes)} makes")
    logger.info(f"Sample current makes: {current_makes[:10]}")
    
    # 3. Compare
    logger.info(f"\n[3/4] Comparing saved vs current labels...")
    
    saved_set = set(saved_makes)
    current_set = set(current_makes)
    
    missing_in_current = saved_set - current_set
    new_in_current = current_set - saved_set
    
    if missing_in_current:
        logger.warning(f"Makes in saved model but not in current dataset: {len(missing_in_current)}")
        logger.warning(f"  Examples: {list(missing_in_current)[:5]}")
    
    if new_in_current:
        logger.warning(f"Makes in current dataset but not in saved model: {len(new_in_current)}")
        logger.warning(f"  Examples: {list(new_in_current)[:5]}")
    
    # 4. Check ordering
    logger.info(f"\n[4/4] Checking make ordering...")
    
    if len(saved_makes) == len(current_makes):
        # Check if order matches
        order_matches = saved_makes == current_makes
        if not order_matches:
            logger.error("CRITICAL: Make order mismatch!")
            logger.error("This will cause incorrect predictions (BMW predicted as Acura, etc.)")
            
            # Show first few mismatches
            mismatches = [(s, c) for s, c in zip(saved_makes[:10], current_makes[:10]) if s != c]
            if mismatches:
                logger.error("\nFirst mismatches:")
                for saved, current in mismatches[:5]:
                    logger.error(f"  Position: saved='{saved}' vs current='{current}'")
            
            return False
        else:
            logger.info("✅ Make order matches!")
    else:
        logger.error(f"CRITICAL: Different number of makes!")
        logger.error(f"  Saved: {len(saved_makes)}, Current: {len(current_makes)}")
        return False
    
    # 5. Check classifier output size
    if 'num_makes' in checkpoint:
        saved_num_makes = checkpoint['num_makes']
        if saved_num_makes != len(saved_makes):
            logger.error(f"CRITICAL: Checkpoint num_makes ({saved_num_makes}) != makes list length ({len(saved_makes)})")
            return False
        logger.info(f"✅ Classifier output size matches: {saved_num_makes}")
    
    logger.info("\n" + "=" * 80)
    logger.info("✅ VALIDATION PASSED")
    logger.info("=" * 80)
    logger.info("Model labels match current dataset labels")
    
    return True

if __name__ == "__main__":
    success = check_model_labels()
    if not success:
        logger.error("\n❌ VALIDATION FAILED")
        logger.error("Model labels do not match dataset - predictions will be wrong!")
        logger.error("Solution: Retrain model with current dataset")
        exit(1)
