"""
Comprehensive Evaluation Script
Shows Top-1, Top-3, Top-5, Top-10 accuracy and per-brand breakdown
"""

import pandas as pd
import numpy as np
import torch
from pathlib import Path
import logging
from collections import defaultdict, Counter
from tqdm import tqdm
import json
from datetime import datetime
from sklearn.metrics import confusion_matrix
import sys

sys.path.insert(0, str(Path(__file__).parent))
from test_car_classifier import load_finetuned_model, predict_make_model

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = PROJECT_ROOT / "car_images"
MODELS_DIR = PROJECT_ROOT / "models" / "car_clip_finetuned"
RESULTS_DIR = PROJECT_ROOT / "results"
RESULTS_DIR.mkdir(exist_ok=True)

def calculate_topk_accuracy(pred_probs, true_labels, k_values=[1, 3, 5, 10]):
    """Calculate Top-K accuracy."""
    topk_accuracies = {}
    
    for k in k_values:
        if k > len(pred_probs[0]):
            continue
        topk_preds = np.argsort(pred_probs, axis=1)[:, -k:]
        correct = np.sum([true_labels[i] in topk_preds[i] for i in range(len(true_labels))])
        topk_accuracies[f'top{k}'] = correct / len(true_labels)
    
    return topk_accuracies

def evaluate_comprehensive():
    """Comprehensive evaluation."""
    
    logger.info("=" * 80)
    logger.info("COMPREHENSIVE MODEL EVALUATION")
    logger.info("=" * 80)
    
    # Load model
    logger.info("\nLoading model...")
    model, processor, mappings = load_finetuned_model(MODELS_DIR)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    
    # Load test set
    test_file = DATA_DIR / "test_set.csv"
    if not test_file.exists():
        logger.warning("Test set not found, creating from dataset...")
        cleaned_file = DATA_DIR / "image_labels_cleaned_final.csv"
        if not cleaned_file.exists():
            cleaned_file = DATA_DIR / "image_labels_filtered.csv"
        labels_df = pd.read_csv(cleaned_file)
        from sklearn.model_selection import train_test_split
        _, test_df = train_test_split(labels_df, test_size=0.2, random_state=42, stratify=labels_df['make'])
    else:
        test_df = pd.read_csv(test_file)
    
    logger.info(f"Test set: {len(test_df):,} images")
    
    # Get makes
    if 'make_to_idx' in mappings:
        make_to_idx = mappings['make_to_idx']
        makes = [make for make, idx in sorted(make_to_idx.items(), key=lambda x: x[1])]
    else:
        makes = mappings.get('makes', [])
    
    models_by_make = mappings.get('models_by_make', {})
    
    logger.info(f"Number of brands: {len(makes)}")
    
    # Evaluate
    logger.info("\nEvaluating on test set...")
    
    all_predictions = []
    all_true_labels = []
    all_pred_probs = []
    brand_stats = defaultdict(lambda: {'correct': 0, 'total': 0, 'top3': 0, 'top5': 0, 'top10': 0})
    
    for idx, row in tqdm(test_df.iterrows(), total=len(test_df), desc="Evaluating"):
        if 'full_path' in test_df.columns and row.get('full_path'):
            image_path = Path(str(row['full_path']))
        else:
            image_path = IMAGES_DIR / row['image_filename']
        if not image_path.exists():
            continue
        
        try:
            pred = predict_make_model(
                str(image_path), model, processor, makes, models_by_make, device,
                top_k=10, use_classifier=True
            )
            
            true_make = row['make']
            pred_make = pred['make']['best']
            top_makes = [m[0] for m in pred['make']['top_k']]
            
            true_idx = make_to_idx.get(true_make, -1)
            if true_idx == -1:
                continue
            
            all_predictions.append(pred_make)
            all_true_labels.append(true_make)
            
            # Create probability array
            prob_array = np.zeros(len(makes))
            for make_name, prob in pred['make']['top_k']:
                if make_name in make_to_idx:
                    prob_array[make_to_idx[make_name]] = prob
            all_pred_probs.append(prob_array)
            
            # Brand stats
            brand_stats[true_make]['total'] += 1
            if pred_make == true_make:
                brand_stats[true_make]['correct'] += 1
            if true_make in top_makes[:3]:
                brand_stats[true_make]['top3'] += 1
            if true_make in top_makes[:5]:
                brand_stats[true_make]['top5'] += 1
            if true_make in top_makes[:10]:
                brand_stats[true_make]['top10'] += 1
        
        except Exception as e:
            logger.debug(f"Error evaluating {row['image_filename']}: {e}")
            continue
    
    # Majority baseline (if train_label_counts.json exists)
    tlc_path = MODELS_DIR / "train_label_counts.json"
    if tlc_path.exists() and all_true_labels:
        with open(tlc_path) as f:
            tlc = json.load(f)
        majority_class = max(tlc, key=tlc.get)
        majority_baseline = 100.0 * sum(1 for t in all_true_labels if t == majority_class) / len(all_true_labels)
        logger.info("\nMajority baseline (always predict %s): %.2f%%" % (majority_class, majority_baseline))
    
    # Calculate overall accuracies
    logger.info("\n" + "=" * 80)
    logger.info("OVERALL ACCURACY METRICS")
    logger.info("=" * 80)
    
    true_indices = [make_to_idx[label] for label in all_true_labels]
    pred_indices = [make_to_idx[pred] if pred in make_to_idx else -1 for pred in all_predictions]
    
    valid_mask = np.array([idx != -1 for idx in pred_indices])
    true_indices = np.array(true_indices)[valid_mask]
    pred_indices = np.array(pred_indices)[valid_mask]
    all_pred_probs = np.array(all_pred_probs)[valid_mask]
    
    topk_accuracies = calculate_topk_accuracy(all_pred_probs, true_indices, k_values=[1, 3, 5, 10])
    
    logger.info(f"\nTest Set Size: {len(all_true_labels):,} images")
    logger.info(f"\nTop-K Accuracy:")
    for k_name, acc in topk_accuracies.items():
        logger.info(f"  {k_name.upper()}: {acc*100:.2f}%")
    
    # Per-brand accuracy
    logger.info("\n" + "=" * 80)
    logger.info("PER-BRAND ACCURACY BREAKDOWN")
    logger.info("=" * 80)
    
    brand_accuracies = []
    for make, stats in sorted(brand_stats.items(), key=lambda x: x[1]['total'], reverse=True):
        if stats['total'] > 0:
            top1_acc = stats['correct'] / stats['total']
            top3_acc = stats['top3'] / stats['total']
            top5_acc = stats['top5'] / stats['total']
            top10_acc = stats['top10'] / stats['total']
            
            brand_accuracies.append({
                'make': make,
                'samples': stats['total'],
                'top1': top1_acc,
                'top3': top3_acc,
                'top5': top5_acc,
                'top10': top10_acc
            })
    
    # Find confused pairs
    confusion_pairs = []
    for i, true_label in enumerate(all_true_labels):
        if i < len(all_predictions) and all_predictions[i] != true_label:
            confusion_pairs.append((true_label, all_predictions[i]))
    
    confusion_counter = Counter(confusion_pairs)
    top_confusions = confusion_counter.most_common(20)
    
    logger.info("\n" + "=" * 80)
    logger.info("MOST CONFUSED BRAND PAIRS")
    logger.info("=" * 80)
    for (true_brand, pred_brand), count in top_confusions:
        logger.info(f"  {true_brand} → {pred_brand}: {count} times")
    
    # Generate report
    report_file = RESULTS_DIR / f"evaluation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("COMPREHENSIVE MODEL EVALUATION REPORT\n")
        f.write("=" * 80 + "\n")
        f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Test Set Size: {len(all_true_labels):,} images\n")
        f.write(f"Number of Brands: {len(makes)}\n\n")
        
        f.write("OVERALL ACCURACY METRICS\n")
        f.write("-" * 80 + "\n")
        for k_name, acc in topk_accuracies.items():
            f.write(f"{k_name.upper()}: {acc*100:.2f}%\n")
        f.write("\n")
        
        f.write("PER-BRAND ACCURACY BREAKDOWN\n")
        f.write("-" * 80 + "\n")
        for brand_acc in brand_accuracies:
            f.write(f"\n{brand_acc['make']} ({brand_acc['samples']} samples):\n")
            f.write(f"  Top-1:  {brand_acc['top1']*100:.2f}%\n")
            f.write(f"  Top-3:  {brand_acc['top3']*100:.2f}%\n")
            f.write(f"  Top-5:  {brand_acc['top5']*100:.2f}%\n")
            f.write(f"  Top-10: {brand_acc['top10']*100:.2f}%\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("MOST CONFUSED BRAND PAIRS\n")
        f.write("-" * 80 + "\n")
        for (true_brand, pred_brand), count in top_confusions:
            f.write(f"{true_brand} → {pred_brand}: {count} times\n")
        
        # Recommendation
        f.write("\n" + "=" * 80 + "\n")
        f.write("RECOMMENDATION\n")
        f.write("-" * 80 + "\n")
        
        top1_acc = topk_accuracies.get('top1', 0)
        top5_acc = topk_accuracies.get('top5', 0)
        
        if top1_acc >= 0.25:
            f.write("✅ GOOD: Top-1 accuracy >= 25%. Model is usable for production.\n")
        elif top1_acc >= 0.15:
            f.write("⚠️  MODERATE: Top-1 accuracy 15-25%. Consider collecting more data or training longer.\n")
        else:
            f.write("❌ POOR: Top-1 accuracy < 15%. Model needs significant improvement.\n")
            f.write("   Recommendations:\n")
            f.write("   1. Collect more training data (especially for low-accuracy brands)\n")
            f.write("   2. Train for more epochs (50-100)\n")
            f.write("   3. Check for label quality issues\n")
            f.write("   4. Consider using a larger model\n")
    
    logger.info(f"\n✅ Report saved to: {report_file}")
    
    # Save JSON
    json_file = RESULTS_DIR / f"evaluation_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    results = {
        'overall_accuracy': topk_accuracies,
        'brand_accuracies': brand_accuracies,
        'test_set_size': len(all_true_labels),
        'num_brands': len(makes),
        'top_confusions': [{'true': t, 'pred': p, 'count': c} for (t, p), c in top_confusions]
    }
    
    with open(json_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"✅ JSON results saved to: {json_file}")
    
    logger.info("\n" + "=" * 80)
    logger.info("EVALUATION COMPLETE")
    logger.info("=" * 80)

if __name__ == "__main__":
    evaluate_comprehensive()
