"""
Test script to verify model_v3 files can be loaded correctly
"""

import pickle
import json
import numpy as np
from pathlib import Path

MODELS_DIR = Path("models")

def test_model_loading():
    """Test loading all v3 models."""
    print("=" * 80)
    print("TESTING MODEL V3 LOADING")
    print("=" * 80)

    # Test XGBoost model
    print("\n1. Testing XGBoost model loading...")
    xgb_path = MODELS_DIR / "xgboost_model_v3.pkl"
    if xgb_path.exists():
        try:
            with open(xgb_path, 'rb') as f:
                xgb_data = pickle.load(f)
            print(f"   [OK] XGBoost model loaded successfully")
            print(f"   Model name: {xgb_data.get('model_name', 'N/A')}")
            print(f"   Version: {xgb_data.get('version', 'N/A')}")
            print(f"   Features: {len(xgb_data.get('features', []))}")
            print(f"   Metrics R²: {xgb_data.get('metrics', {}).get('r2_score', 'N/A'):.4f}")

            # Test prediction
            model = xgb_data['model']
            test_X = np.random.rand(1, len(xgb_data['features']) + 2048)  # tabular + image features
            pred = model.predict(test_X)
            print(f"   [OK] Test prediction works: ${pred[0]:,.2f}")
        except Exception as e:
            print(f"   [ERROR] Failed to load XGBoost model: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"   [SKIP] XGBoost model not found: {xgb_path}")

    # Test Ensemble model
    print("\n2. Testing Ensemble model loading...")
    ensemble_path = MODELS_DIR / "ensemble_model_v3.pkl"
    if ensemble_path.exists():
        try:
            with open(ensemble_path, 'rb') as f:
                ensemble_data = pickle.load(f)
            print(f"   [OK] Ensemble model loaded successfully")
            print(f"   Model name: {ensemble_data.get('model_name', 'N/A')}")
            print(f"   Version: {ensemble_data.get('version', 'N/A')}")
            print(f"   Features: {len(ensemble_data.get('features', []))}")
            print(f"   Metrics R²: {ensemble_data.get('metrics', {}).get('r2_score', 'N/A'):.4f}")

            # Test prediction
            model = ensemble_data['model']
            test_X = np.random.rand(1, len(ensemble_data['features']) + 2048)
            pred = model.predict(test_X)
            print(f"   [OK] Test prediction works: ${pred[0]:,.2f}")
        except Exception as e:
            print(f"   [ERROR] Failed to load Ensemble model: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"   [SKIP] Ensemble model not found: {ensemble_path}")

    # Test Best model
    print("\n3. Testing Best model loading...")
    best_path = MODELS_DIR / "best_model_v3.pkl"
    if best_path.exists():
        try:
            with open(best_path, 'rb') as f:
                best_data = pickle.load(f)
            print(f"   [OK] Best model loaded successfully")
            print(f"   Model name: {best_data.get('model_name', 'N/A')}")
            print(f"   Version: {best_data.get('version', 'N/A')}")
            print(f"   Features: {len(best_data.get('features', []))}")
            print(f"   Metrics R²: {best_data.get('metrics', {}).get('r2_score', 'N/A'):.4f}")

            # Test prediction
            model = best_data['model']
            test_X = np.random.rand(1, len(best_data['features']) + 2048)
            pred = model.predict(test_X)
            print(f"   [OK] Test prediction works: ${pred[0]:,.2f}")
        except Exception as e:
            print(f"   [ERROR] Failed to load Best model: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"   [SKIP] Best model not found: {best_path}")

    # Test Model Info JSON
    print("\n4. Testing Model Info JSON...")
    info_path = MODELS_DIR / "model_v3_info.json"
    if info_path.exists():
        try:
            with open(info_path, 'r', encoding='utf-8') as f:
                info = json.load(f)
            print(f"   [OK] Model info loaded successfully")
            print(f"   Best Model: {info.get('model_name', 'N/A')}")
            print(f"   Version: {info.get('version', 'N/A')}")
            print(f"   Best R²: {info.get('best_model_metrics', {}).get('r2', 'N/A'):.4f}")
            print(f"   Best RMSE: ${info.get('best_model_metrics', {}).get('rmse', 'N/A'):,.2f}")
            print(f"\n   All Models Performance:")
            for name, metrics in info.get('all_models_metrics', {}).items():
                print(f"     {name}: R² = {metrics.get('r2', 'N/A'):.4f}, RMSE = ${metrics.get('rmse', 'N/A'):,.2f}")
        except Exception as e:
            print(f"   [ERROR] Failed to load Model Info: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"   [SKIP] Model info not found: {info_path}")

    print("\n" + "=" * 80)
    print("TESTING COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    test_model_loading()
