# Model V3 Saving Fix

## Problem
The training script was failing with:
```
AttributeError: Can't get local object 'train_models.<locals>.Ensemble'
```

This occurred because the `Ensemble` class was defined inside the `train_models()` function, which pickle cannot serialize.

## Solution

### 1. Moved Ensemble Class to Module Level
- **Before**: `Ensemble` class was defined inside `train_models()` function
- **After**: `Ensemble` class is now defined at module level (line 563)
- **Why**: Pickle can serialize module-level classes but not local classes

### 2. Enhanced Model Saving
The script now saves:
- **XGBoost Model**: `models/xgboost_model_v3.pkl`
- **Ensemble Model**: `models/ensemble_model_v3.pkl`
- **Best Model**: `models/best_model_v3.pkl` (XGBoost, since R² = 0.8378 > 0.8353)

Each model file contains:
- The trained model object
- Model metadata (name, version, type)
- Feature names
- Performance metrics (R², RMSE, MAE, MAPE)
- Scaler and encoders
- Image feature settings
- Training date

### 3. Created Model Info JSON
- **File**: `models/model_v3_info.json`
- Contains all model performance metrics, feature information, and file paths
- Easy to read and parse for monitoring/debugging

### 4. Added Model Loading Test
After saving, the script automatically:
- Loads the best model
- Makes a test prediction
- Verifies everything works correctly

## Files Created

1. **models/xgboost_model_v3.pkl** - XGBoost model (R² = 0.8378)
2. **models/ensemble_model_v3.pkl** - Ensemble model (R² = 0.8353)
3. **models/best_model_v3.pkl** - Best model (XGBoost)
4. **models/model_v3_info.json** - Model metadata and metrics
5. **models/cnn_feature_extractor.pt** - CNN feature extractor (if using images)
6. **models/encoders.pkl** - Label encoders (backward compatibility)
7. **models/scaler.pkl** - Feature scaler (backward compatibility)

## How to Load Models

### Option 1: Load Best Model
```python
import pickle
from pathlib import Path

model_path = Path("models/best_model_v3.pkl")
with open(model_path, 'rb') as f:
    model_data = pickle.load(f)

model = model_data['model']
scaler = model_data['scaler']
encoders = model_data['encoders']
features = model_data['features']
metrics = model_data['metrics']

print(f"Model: {model_data['model_name']}")
print(f"R²: {metrics['r2_score']:.4f}")
print(f"RMSE: ${metrics['rmse']:,.2f}")
```

### Option 2: Load Specific Model
```python
# Load XGBoost
with open("models/xgboost_model_v3.pkl", 'rb') as f:
    xgb_data = pickle.load(f)
xgb_model = xgb_data['model']

# Load Ensemble
with open("models/ensemble_model_v3.pkl", 'rb') as f:
    ensemble_data = pickle.load(f)
ensemble_model = ensemble_data['model']
```

### Option 3: Load Model Info
```python
import json

with open("models/model_v3_info.json", 'r') as f:
    info = json.load(f)

print(f"Best Model: {info['model_name']}")
print(f"R²: {info['best_model_metrics']['r2']:.4f}")
```

## Important Notes

### Ensemble Class Import
When loading the Ensemble model, make sure `train_model.py` is in your Python path, or import the Ensemble class:

```python
# Option 1: Add to path
import sys
sys.path.insert(0, '/path/to/train_model.py')

# Option 2: Import directly
from train_model import Ensemble
```

### Feature Dimensions
- **Tabular features**: Check `model_data['features']` for count
- **Image features**: 2048 dimensions (ResNet50)
- **Total**: `len(features) + 2048` features after scaling

### Model Performance
- **XGBoost**: R² = 0.8378, RMSE = $6,080
- **Ensemble**: R² = 0.8353, RMSE = $6,080
- **Best**: XGBoost (saved as `best_model_v3.pkl`)

## Testing

Run the test script to verify models load correctly:
```bash
python test_model_loading_v3.py
```

This will:
1. Load all three model files
2. Test predictions work
3. Display model metrics
4. Verify model info JSON

## Next Steps

1. ✅ **Fixed**: Model saving code
2. ✅ **Fixed**: Ensemble class serialization
3. ✅ **Added**: Model info JSON
4. ✅ **Added**: Loading test
5. 📋 **Next**: Update `core/predict_price.py` to load v3 models
6. 📋 **Next**: Test predictions in web application

## Troubleshooting

### Error: "Can't get attribute 'Ensemble'"
**Solution**: Make sure `train_model.py` is in Python path or import Ensemble class:
```python
from train_model import Ensemble
```

### Error: "Feature dimension mismatch"
**Solution**: Check that you're using the correct feature count:
- Tabular: `len(model_data['features'])`
- Image: 2048 (if enabled)
- Total: Apply scaler to combined features

### Error: "Model file not found"
**Solution**: Run the training script again to generate model files.
