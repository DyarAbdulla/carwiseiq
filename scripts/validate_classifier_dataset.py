"""
Comprehensive Dataset Validation for Car Classifier
Checks for imbalanced classes, mislabeled images, duplicates, and brand accuracy
"""

import pandas as pd
import numpy as np
from pathlib import Path
import hashlib
import logging
from PIL import Image
from collections import Counter, defaultdict
import torch
from tqdm import tqdm
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
LABELS_FILE = DATA_DIR / "image_labels.csv"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"

def calculate_image_hash(image_path: Path) -> str:
    """Calculate MD5 hash of image file."""
    try:
        with open(image_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception as e:
        logger.warning(f"Failed to hash {image_path}: {e}")
        return None

def check_image_corruption(image_path: Path) -> tuple:
    """Check if image is corrupted or invalid."""
    try:
        img = Image.open(image_path)
        img.verify()  # Verify image integrity
        img = Image.open(image_path)  # Reopen after verify (verify closes it)
        
        # Check basic properties
        width, height = img.size
        if width < 32 or height < 32:
            return False, f"Too small: {width}x{height}"
        
        if img.mode != 'RGB':
            return False, f"Wrong mode: {img.mode}"
        
        return True, "OK"
    except Exception as e:
        return False, str(e)

def analyze_class_distribution(labels_df: pd.DataFrame) -> dict:
    """Analyze distribution of images per make/brand."""
    logger.info("\n" + "=" * 80)
    logger.info("1. CLASS DISTRIBUTION ANALYSIS")
    logger.info("=" * 80)
    
    make_counts = labels_df['make'].value_counts().sort_values(ascending=False)
    
    logger.info(f"\nTotal makes: {len(make_counts)}")
    logger.info(f"Total images: {len(labels_df)}")
    
    # Statistics
    mean_images = make_counts.mean()
    median_images = make_counts.median()
    std_images = make_counts.std()
    
    logger.info(f"\nImages per make:")
    logger.info(f"  Mean: {mean_images:.1f}")
    logger.info(f"  Median: {median_images:.1f}")
    logger.info(f"  Std: {std_images:.1f}")
    logger.info(f"  Min: {make_counts.min()}")
    logger.info(f"  Max: {make_counts.max()}")
    
    # Imbalance analysis
    imbalance_threshold = mean_images * 0.1  # Less than 10% of mean
    rare_makes = make_counts[make_counts < imbalance_threshold]
    common_makes = make_counts[make_counts > mean_images * 2]
    
    logger.info(f"\n⚠️  RARE MAKES (<{imbalance_threshold:.1f} images): {len(rare_makes)}")
    if len(rare_makes) > 0:
        logger.info("  Top 10 rarest:")
        for make, count in rare_makes.head(10).items():
            logger.info(f"    {make}: {count} images")
    
    logger.info(f"\n📊 COMMON MAKES (>{mean_images*2:.1f} images): {len(common_makes)}")
    if len(common_makes) > 0:
        logger.info("  Top 10 most common:")
        for make, count in common_makes.head(10).items():
            logger.info(f"    {make}: {count} images")
    
    return {
        'make_counts': make_counts.to_dict(),
        'rare_makes': rare_makes.to_dict(),
        'common_makes': common_makes.to_dict(),
        'statistics': {
            'mean': float(mean_images),
            'median': float(median_images),
            'std': float(std_images),
            'min': int(make_counts.min()),
            'max': int(make_counts.max())
        }
    }

def find_duplicate_images(labels_df: pd.DataFrame) -> dict:
    """Find duplicate images using file hash."""
    logger.info("\n" + "=" * 80)
    logger.info("2. DUPLICATE IMAGE DETECTION")
    logger.info("=" * 80)
    
    logger.info("Calculating image hashes...")
    image_hashes = {}
    hash_to_images = defaultdict(list)
    
    for idx, row in tqdm(labels_df.iterrows(), total=len(labels_df), desc="Hashing images"):
        image_path = IMAGES_DIR / row['image_filename']
        if image_path.exists():
            img_hash = calculate_image_hash(image_path)
            if img_hash:
                image_hashes[row['image_filename']] = img_hash
                hash_to_images[img_hash].append({
                    'filename': row['image_filename'],
                    'make': row['make'],
                    'model': row['model'],
                    'index': idx
                })
    
    # Find duplicates
    duplicates = {h: imgs for h, imgs in hash_to_images.items() if len(imgs) > 1}
    
    logger.info(f"\nTotal unique images: {len(image_hashes)}")
    logger.info(f"Duplicate groups: {len(duplicates)}")
    
    if duplicates:
        total_duplicate_images = sum(len(imgs) for imgs in duplicates.values())
        logger.warning(f"\n⚠️  Found {total_duplicate_images} duplicate images in {len(duplicates)} groups")
        
        # Check for label inconsistencies in duplicates
        inconsistent_labels = []
        for hash_val, imgs in list(duplicates.items())[:20]:  # Show first 20
            makes = [img['make'] for img in imgs]
            if len(set(makes)) > 1:
                inconsistent_labels.append({
                    'hash': hash_val,
                    'images': imgs,
                    'makes': makes
                })
                logger.warning(f"\n  Duplicate with different labels:")
                logger.warning(f"    Hash: {hash_val[:16]}...")
                for img in imgs:
                    logger.warning(f"      {img['filename']}: {img['make']} {img['model']}")
        
        if inconsistent_labels:
            logger.warning(f"\n⚠️  Found {len(inconsistent_labels)} duplicate groups with INCONSISTENT LABELS!")
            logger.warning("This is a critical issue - same image labeled as different makes!")
    
    return {
        'total_unique': len(image_hashes),
        'duplicate_groups': len(duplicates),
        'duplicate_details': {h: imgs for h, imgs in list(duplicates.items())[:50]},
        'inconsistent_labels': inconsistent_labels
    }

def check_corrupted_images(labels_df: pd.DataFrame) -> dict:
    """Check for corrupted or invalid images."""
    logger.info("\n" + "=" * 80)
    logger.info("3. CORRUPTED IMAGE DETECTION")
    logger.info("=" * 80)
    
    corrupted = []
    missing = []
    
    logger.info("Checking image files...")
    for idx, row in tqdm(labels_df.iterrows(), total=len(labels_df), desc="Checking images"):
        image_path = IMAGES_DIR / row['image_filename']
        
        if not image_path.exists():
            missing.append({
                'filename': row['image_filename'],
                'make': row['make'],
                'model': row['model']
            })
        else:
            is_valid, reason = check_image_corruption(image_path)
            if not is_valid:
                corrupted.append({
                    'filename': row['image_filename'],
                    'make': row['make'],
                    'model': row['model'],
                    'reason': reason
                })
    
    logger.info(f"\nMissing images: {len(missing)}")
    if missing:
        logger.warning(f"⚠️  {len(missing)} images are missing from disk")
        logger.warning("  Sample missing images:")
        for img in missing[:10]:
            logger.warning(f"    {img['filename']}: {img['make']} {img['model']}")
    
    logger.info(f"\nCorrupted images: {len(corrupted)}")
    if corrupted:
        logger.warning(f"⚠️  {len(corrupted)} images are corrupted or invalid")
        logger.warning("  Sample corrupted images:")
        for img in corrupted[:10]:
            logger.warning(f"    {img['filename']}: {img['reason']}")
    
    return {
        'missing': missing,
        'corrupted': corrupted,
        'total_valid': len(labels_df) - len(missing) - len(corrupted)
    }

def analyze_brand_accuracy(labels_df: pd.DataFrame) -> dict:
    """Analyze accuracy per brand using model predictions."""
    logger.info("\n" + "=" * 80)
    logger.info("4. BRAND ACCURACY ANALYSIS")
    logger.info("=" * 80)
    
    # Try to load model if available
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from test_car_classifier import load_finetuned_model, predict_make_model
        
        logger.info("Loading model for accuracy analysis...")
        model, processor, mappings = load_finetuned_model(MODELS_DIR)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)
        
        makes = list(mappings['make_to_idx'].keys())
        models_by_make = mappings.get('models_by_make', {})
        
        logger.info(f"Model loaded. Analyzing accuracy per brand...")
        
    except Exception as e:
        logger.warning(f"Could not load model: {e}")
        logger.warning("Skipping brand accuracy analysis (requires trained model)")
        return {'error': str(e)}
    
    # Sample images per make for analysis
    make_accuracy = defaultdict(lambda: {'correct': 0, 'total': 0, 'top5_correct': 0})
    
    # Analyze a sample of images per make
    samples_per_make = 50  # Analyze up to 50 images per make
    total_to_analyze = min(1000, len(labels_df))  # Limit total analysis
    
    logger.info(f"Analyzing {total_to_analyze} images...")
    
    analyzed = 0
    for make in makes:
        make_df = labels_df[labels_df['make'] == make].head(samples_per_make)
        
        for idx, row in make_df.iterrows():
            if analyzed >= total_to_analyze:
                break
            
            image_path = IMAGES_DIR / row['image_filename']
            if not image_path.exists():
                continue
            
            try:
                pred = predict_make_model(
                    str(image_path),
                    model,
                    processor,
                    makes,
                    models_by_make,
                    device,
                    top_k=5,
                    use_classifier=True
                )
                
                true_make = row['make']
                pred_make = pred['make']['best']
                top5_makes = [m[0] for m in pred['make']['top_k']]
                
                make_accuracy[true_make]['total'] += 1
                if pred_make == true_make:
                    make_accuracy[true_make]['correct'] += 1
                if true_make in top5_makes:
                    make_accuracy[true_make]['top5_correct'] += 1
                
                analyzed += 1
                
            except Exception as e:
                logger.debug(f"Error analyzing {row['image_filename']}: {e}")
                continue
    
    # Calculate accuracies
    brand_accuracies = {}
    for make, stats in make_accuracy.items():
        if stats['total'] > 0:
            brand_accuracies[make] = {
                'top1_accuracy': stats['correct'] / stats['total'],
                'top5_accuracy': stats['top5_correct'] / stats['total'],
                'samples': stats['total']
            }
    
    # Sort by accuracy
    sorted_brands = sorted(brand_accuracies.items(), key=lambda x: x[1]['top1_accuracy'])
    
    logger.info(f"\nAnalyzed {analyzed} images across {len(brand_accuracies)} brands")
    logger.info(f"\n📉 LOWEST ACCURACY BRANDS (Top-1):")
    for make, acc in sorted_brands[:10]:
        logger.warning(f"  {make}: {acc['top1_accuracy']*100:.1f}% (Top-5: {acc['top5_accuracy']*100:.1f}%, Samples: {acc['samples']})")
    
    logger.info(f"\n📈 HIGHEST ACCURACY BRANDS (Top-1):")
    for make, acc in sorted_brands[-10:]:
        logger.info(f"  {make}: {acc['top1_accuracy']*100:.1f}% (Top-5: {acc['top5_accuracy']*100:.1f}%, Samples: {acc['samples']})")
    
    return {
        'brand_accuracies': brand_accuracies,
        'total_analyzed': analyzed
    }

def find_potential_mislabels(labels_df: pd.DataFrame, model=None) -> dict:
    """Find potentially mislabeled images using model predictions."""
    logger.info("\n" + "=" * 80)
    logger.info("5. POTENTIAL MISLABEL DETECTION")
    logger.info("=" * 80)
    
    if model is None:
        logger.warning("Model not available - skipping mislabel detection")
        return {'error': 'Model not available'}
    
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from test_car_classifier import load_finetuned_model, predict_make_model
        
        if model is True:  # Load if not provided
            model, processor, mappings = load_finetuned_model(MODELS_DIR)
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model.to(device)
        else:
            processor = mappings = None
            device = None
        
        makes = list(mappings['make_to_idx'].keys())
        models_by_make = mappings.get('models_by_make', {})
        
        logger.info("Finding potentially mislabeled images...")
        
        potential_mislabels = []
        
        # Check a sample of images
        sample_size = min(500, len(labels_df))
        sample_df = labels_df.sample(n=sample_size, random_state=42)
        
        for idx, row in tqdm(sample_df.iterrows(), total=len(sample_df), desc="Checking labels"):
            image_path = IMAGES_DIR / row['image_filename']
            if not image_path.exists():
                continue
            
            try:
                pred = predict_make_model(
                    str(image_path),
                    model,
                    processor,
                    makes,
                    models_by_make,
                    device,
                    top_k=5,
                    use_classifier=True
                )
                
                true_make = row['make']
                pred_make = pred['make']['best']
                confidence = pred['make']['confidence']
                top5_makes = [m[0] for m in pred['make']['top_k']]
                
                # Flag if prediction is wrong but high confidence
                if pred_make != true_make and confidence > 0.7:
                    if true_make not in top5_makes:  # Not even in top-5
                        potential_mislabels.append({
                            'filename': row['image_filename'],
                            'true_make': true_make,
                            'true_model': row['model'],
                            'pred_make': pred_make,
                            'pred_confidence': confidence,
                            'top5_makes': top5_makes
                        })
            
            except Exception as e:
                continue
        
        logger.info(f"\nFound {len(potential_mislabels)} potentially mislabeled images")
        logger.info("(High confidence wrong predictions, true label not in top-5)")
        
        if potential_mislabels:
            logger.warning("\n⚠️  Sample potential mislabels:")
            for item in potential_mislabels[:20]:
                logger.warning(f"  {item['filename']}:")
                logger.warning(f"    Labeled as: {item['true_make']} {item['true_model']}")
                logger.warning(f"    Predicted as: {item['pred_make']} (confidence: {item['pred_confidence']:.2f})")
                logger.warning(f"    Top-5: {', '.join(item['top5_makes'][:3])}")
        
        return {
            'potential_mislabels': potential_mislabels,
            'total_checked': len(sample_df)
        }
    
    except Exception as e:
        logger.error(f"Error in mislabel detection: {e}")
        return {'error': str(e)}

def generate_report(results: dict, output_file: Path):
    """Generate comprehensive validation report."""
    logger.info("\n" + "=" * 80)
    logger.info("GENERATING VALIDATION REPORT")
    logger.info("=" * 80)
    
    report = []
    report.append("# Car Classifier Dataset Validation Report\n\n")
    report.append(f"Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
    
    # Class Distribution
    if 'class_distribution' in results:
        dist = results['class_distribution']
        report.append("## 1. Class Distribution\n\n")
        report.append(f"- Total makes: {len(dist['make_counts'])}\n")
        report.append(f"- Mean images per make: {dist['statistics']['mean']:.1f}\n")
        report.append(f"- Rare makes (<10% of mean): {len(dist['rare_makes'])}\n")
        report.append(f"- Common makes (>2x mean): {len(dist['common_makes'])}\n\n")
    
    # Duplicates
    if 'duplicates' in results:
        dup = results['duplicates']
        report.append("## 2. Duplicate Images\n\n")
        report.append(f"- Duplicate groups: {dup['duplicate_groups']}\n")
        report.append(f"- Inconsistent labels in duplicates: {len(dup.get('inconsistent_labels', []))}\n\n")
    
    # Corrupted
    if 'corrupted' in results:
        corr = results['corrupted']
        report.append("## 3. Corrupted/Missing Images\n\n")
        report.append(f"- Missing images: {len(corr['missing'])}\n")
        report.append(f"- Corrupted images: {len(corr['corrupted'])}\n")
        report.append(f"- Valid images: {corr['total_valid']}\n\n")
    
    # Brand Accuracy
    if 'brand_accuracy' in results and 'error' not in results['brand_accuracy']:
        acc = results['brand_accuracy']
        report.append("## 4. Brand Accuracy Analysis\n\n")
        report.append(f"- Brands analyzed: {len(acc['brand_accuracies'])}\n")
        report.append(f"- Total images analyzed: {acc['total_analyzed']}\n\n")
        
        sorted_brands = sorted(acc['brand_accuracies'].items(), key=lambda x: x[1]['top1_accuracy'])
        report.append("### Lowest Accuracy Brands:\n\n")
        for make, stats in sorted_brands[:10]:
            report.append(f"- **{make}**: {stats['top1_accuracy']*100:.1f}% Top-1, {stats['top5_accuracy']*100:.1f}% Top-5 ({stats['samples']} samples)\n")
        report.append("\n")
    
    # Mislabels
    if 'mislabels' in results and 'error' not in results['mislabels']:
        mis = results['mislabels']
        report.append("## 5. Potential Mislabeled Images\n\n")
        report.append(f"- Potential mislabels found: {len(mis.get('potential_mislabels', []))}\n")
        report.append(f"- Images checked: {mis.get('total_checked', 0)}\n\n")
    
    # Recommendations
    report.append("## Recommendations\n\n")
    report.append("See the console output for detailed recommendations.\n\n")
    
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(''.join(report))
    
    logger.info(f"Report saved to {output_file}")

def main():
    """Main validation function."""
    logger.info("=" * 80)
    logger.info("CAR CLASSIFIER DATASET VALIDATION")
    logger.info("=" * 80)
    
    # Load labels
    if not LABELS_FILE.exists():
        logger.error(f"Labels file not found: {LABELS_FILE}")
        logger.info("Run create_image_labels.py first")
        return
    
    logger.info(f"Loading labels from {LABELS_FILE}")
    labels_df = pd.read_csv(LABELS_FILE)
    logger.info(f"Loaded {len(labels_df)} labeled images")
    
    results = {}
    
    # 1. Class distribution
    results['class_distribution'] = analyze_class_distribution(labels_df)
    
    # 2. Duplicate images
    results['duplicates'] = find_duplicate_images(labels_df)
    
    # 3. Corrupted images
    results['corrupted'] = check_corrupted_images(labels_df)
    
    # 4. Brand accuracy (requires model)
    results['brand_accuracy'] = analyze_brand_accuracy(labels_df)
    
    # 5. Potential mislabels (requires model)
    if 'error' not in results['brand_accuracy']:
        results['mislabels'] = find_potential_mislabels(labels_df, model=True)
    
    # Generate report
    report_file = DATA_DIR / "dataset_validation_report.md"
    generate_report(results, report_file)
    
    # Save detailed results as JSON
    json_file = DATA_DIR / "dataset_validation_results.json"
    # Convert to JSON-serializable format
    json_results = {}
    for key, value in results.items():
        if isinstance(value, dict):
            json_results[key] = {k: v for k, v in value.items() if k != 'make_counts'}  # Skip large dicts
        else:
            json_results[key] = value
    
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(json_results, f, indent=2, default=str)
    
    logger.info(f"\nDetailed results saved to {json_file}")
    
    logger.info("\n" + "=" * 80)
    logger.info("VALIDATION COMPLETE")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()
