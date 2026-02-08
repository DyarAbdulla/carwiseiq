"""
Check Current Model Metrics
This script loads the current model and displays its accuracy metrics
"""

import pickle
import sys
from pathlib import Path

def check_model_metrics():
    """Check metrics of the currently loaded model"""
    print("=" * 80)
    print("CURRENT MODEL METRICS CHECK")
    print("=" * 80)
    
    BASE_DIR = Path(__file__).parent
    MODEL_DIR = BASE_DIR / "models"
    
    # Model files to check (in priority order)
    model_files = [
        MODEL_DIR / "best_model_v4.pkl",
        MODEL_DIR / "best_model_v3.pkl",
        MODEL_DIR / "best_model_v2.pkl",
        MODEL_DIR / "car_price_model.pkl",
        MODEL_DIR / "best_model.pkl",
    ]
    
    print(f"\nChecking models directory: {MODEL_DIR}")
    
    found_models = []
    for model_path in model_files:
        if model_path.exists():
            try:
                print(f"\n{'='*80}")
                print(f"Loading: {model_path.name}")
                print(f"Path: {model_path}")
                
                with open(model_path, 'rb') as f:
                    model_data = pickle.load(f)
                
                model_name = model_data.get('model_name', 'Unknown')
                model_version = model_data.get('version', 'unknown')
                metrics = model_data.get('metrics', {})
                
                print(f"\nModel Information:")
                print(f"  Name: {model_name}")
                print(f"  Version: {model_version}")
                print(f"  Type: {type(model_data.get('model')).__name__}")
                
                print(f"\nModel Metrics:")
                if metrics:
                    r2 = metrics.get('r2', 'N/A')
                    rmse = metrics.get('rmse', 'N/A')
                    mae = metrics.get('mae', 'N/A')
                    mape = metrics.get('mape', 'N/A')
                    
                    print(f"  R² Score: {r2:.4f}" if isinstance(r2, (int, float)) else f"  R² Score: {r2}")
                    print(f"  RMSE: ${rmse:,.2f}" if isinstance(rmse, (int, float)) else f"  RMSE: {rmse}")
                    print(f"  MAE: ${mae:,.2f}" if isinstance(mae, (int, float)) else f"  MAE: {mae}")
                    print(f"  MAPE: {mape:.2f}%" if isinstance(mape, (int, float)) else f"  MAPE: {mape}")
                else:
                    print("  No metrics found in model file")
                
                # Check transformation
                target_transform = model_data.get('target_transform', None)
                print(f"\nTransformation:")
                print(f"  Target Transform: {target_transform}")
                print(f"  Transform Offset: {model_data.get('transform_offset', 'N/A')}")
                
                # Check features
                features = model_data.get('features', [])
                original_features = model_data.get('original_features', [])
                print(f"\nFeatures:")
                print(f"  Total Features: {len(features)}")
                print(f"  Original Features: {len(original_features) if original_features else 'N/A'}")
                print(f"  Has Polynomial Transformer: {model_data.get('poly_transformer') is not None}")
                
                # File info
                import os
                from datetime import datetime
                file_size = os.path.getsize(model_path) / (1024*1024)  # MB
                mod_time = datetime.fromtimestamp(os.path.getmtime(model_path))
                print(f"\nFile Info:")
                print(f"  Size: {file_size:.2f} MB")
                print(f"  Modified: {mod_time}")
                
                found_models.append({
                    'path': model_path,
                    'name': model_name,
                    'version': model_version,
                    'metrics': metrics
                })
                
            except Exception as e:
                print(f"  ERROR loading {model_path.name}: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"\n[NOT FOUND] {model_path.name}")
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    if found_models:
        print(f"\nFound {len(found_models)} model file(s):")
        for i, model in enumerate(found_models, 1):
            print(f"\n{i}. {model['path'].name}")
            print(f"   Version: {model['version']}")
            print(f"   Name: {model['name']}")
            if model['metrics']:
                rmse = model['metrics'].get('rmse', 'N/A')
                r2 = model['metrics'].get('r2', 'N/A')
                print(f"   RMSE: ${rmse:,.2f}" if isinstance(rmse, (int, float)) else f"   RMSE: {rmse}")
                print(f"   R²: {r2:.4f}" if isinstance(r2, (int, float)) else f"   R²: {r2}")
        
        # Determine which model will be loaded (priority order)
        print(f"\n⚠️ Model Loading Priority:")
        print(f"   The system will load models in this order:")
        print(f"   1. best_model_v4.pkl (highest priority)")
        print(f"   2. best_model_v3.pkl")
        print(f"   3. best_model_v2.pkl")
        print(f"   4. car_price_model.pkl")
        print(f"   5. best_model.pkl (lowest priority)")
        
        if found_models[0]['path'].name == 'best_model_v4.pkl':
            print(f"\n✅ Current active model: {found_models[0]['path'].name}")
        else:
            print(f"\n⚠️ Current active model: {found_models[0]['path'].name}")
            print(f"   (Not the highest priority model)")
    else:
        print("\n❌ No model files found!")
        print("   Please train a model first using: python core/model_training.py")
    
    return found_models

if __name__ == "__main__":
    check_model_metrics()
