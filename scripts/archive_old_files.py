"""
Archive old datasets and models
Moves old files to _archive directories
"""

import shutil
from pathlib import Path

def archive_old_files():
    """Move old datasets and models to archive directories"""
    
    # Archive old datasets
    data_dir = Path('data')
    archive_data_dir = data_dir / '_archive'
    archive_data_dir.mkdir(exist_ok=True)
    
    old_datasets = [
        'cleaned_car_data.csv',
        'final_dataset_with_images.csv',
    ]
    
    print("Archiving old datasets...")
    for dataset in old_datasets:
        src = data_dir / dataset
        if src.exists():
            dst = archive_data_dir / dataset
            shutil.move(str(src), str(dst))
            print(f"  Moved {dataset} -> _archive/")
    
    # Archive old models (keep production_model.pkl)
    models_dir = Path('models')
    archive_models_dir = models_dir / '_archive'
    archive_models_dir.mkdir(exist_ok=True)
    
    old_models = [
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
        'scaler.pkl',
        'encoders.pkl',
        'make_encoder.pkl',
        'model_encoder.pkl',
    ]
    
    print("\nArchiving old models...")
    for model in old_models:
        src = models_dir / model
        if src.exists():
            dst = archive_models_dir / model
            shutil.move(str(src), str(dst))
            print(f"  Moved {model} -> _archive/")
    
    print("\n✅ Archive complete!")

if __name__ == "__main__":
    archive_old_files()
