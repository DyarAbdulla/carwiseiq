"""
Archive old model artifacts to models/_archive/<timestamp>/
Only keeps production_model.pkl, model_info.json, model_performance.json, encoders.pkl, scaler.pkl
"""

import shutil
from pathlib import Path
from datetime import datetime

def archive_old_models():
    """Move old model files to archive"""
    models_dir = Path('models')
    archive_dir = models_dir / '_archive' / datetime.now().strftime('%Y%m%d_%H%M%S')
    archive_dir.mkdir(parents=True, exist_ok=True)
    
    # Files to keep (production bundle)
    keep_files = {
        'production_model.pkl',
        'model_info.json',
        'model_performance.json',
        'encoders.pkl',
        'scaler.pkl',
    }
    
    # Files to archive
    old_files = [
        'production_model_v1.0.pkl',
        'best_model_v2.pkl',
        'best_model_v3.pkl',
        'best_model_v4.pkl',
        'best_model.pkl',
        'xgboost_model_v3.pkl',
        'ensemble_model_v3.pkl',
        'advanced_car_price_model.pkl',
        'car_price_model.pkl',
        'encoders_v4.pkl',
        'scaler_v4.pkl',
        'make_encoder.pkl',
        'model_encoder.pkl',
        'make_encoder_v1.0_backup.pkl',
        'feature_info.pkl',
        'image_pca_transformer.pkl',
        'model_v4_info.json',
    ]
    
    print("Archiving old model files...")
    archived_count = 0
    for old_file in old_files:
        src = models_dir / old_file
        if src.exists():
            dst = archive_dir / old_file
            try:
                shutil.move(str(src), str(dst))
                print(f"  Archived: {old_file}")
                archived_count += 1
            except Exception as e:
                print(f"  ⚠️ Failed to archive {old_file}: {e}")
    
    print(f"\n[OK] Archived {archived_count} files to {archive_dir}")
    print(f"\nKept production bundle:")
    for keep_file in keep_files:
        if (models_dir / keep_file).exists():
            print(f"  [OK] {keep_file}")

if __name__ == "__main__":
    archive_old_models()
