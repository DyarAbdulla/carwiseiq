# Model V3 Deployment Checklist

## Model Details
- **Algorithm**: XGBoost + Image Features
- **R² Score**: 0.8378 (83.78%)
- **RMSE**: $6,080
- **MAE**: (from model metrics)
- **Dataset**: 57,603 cars with images
- **Model File**: `models/best_model_v3.pkl`

## Pre-Deployment

- [x] **Model Training Complete**
  - [x] XGBoost model trained (R² = 0.8378)
  - [x] Ensemble model trained (R² = 0.8353)
  - [x] Models saved successfully
  - [x] Model info JSON created

- [x] **Code Updates**
  - [x] Updated `core/predict_price.py` to load v3 models
  - [x] Added image feature support (zero vector fallback)
  - [x] Updated confidence intervals to use model RMSE ($6,080)
  - [x] Added version management (v3 → v2 fallback)
  - [x] Updated model caching

## Deployment Steps

### 1. Model Loading
- [ ] **Test model loading**
  ```bash
  python -c "from core.predict_price import load_model; load_model()"
  ```
  Expected: Should load `best_model_v3.pkl` successfully

- [ ] **Verify model metadata**
  - Model name: XGBoost
  - Version: v3
  - Image features enabled: True
  - Scaler present: True
  - RMSE: $6,080

### 2. Prediction Testing
- [ ] **Test basic prediction**
  ```python
  from core.predict_price import predict_price
  car_data = {
      'year': 2020,
      'mileage': 30000,
      'engine_size': 2.5,
      'cylinders': 4,
      'make': 'Toyota',
      'model': 'Camry',
      'trim': 'LE',
      'condition': 'Good',
      'fuel_type': 'Gasoline',
      'location': 'California'
  }
  result = predict_price(car_data)
  print(f"Prediction: ${result:,.2f}")
  ```
  Expected: Should return reasonable price prediction

- [ ] **Test with confidence intervals**
  ```python
  price, intervals = predict_price(car_data, return_confidence=True)
  print(f"Price: ${price:,.2f}")
  print(f"95% CI: ${intervals['lower_95']:,.2f} - ${intervals['upper_95']:,.2f}")
  ```
  Expected: Confidence intervals should use RMSE = $6,080

- [ ] **Test 10 different car configurations**
  - Different makes/models
  - Different years (2010-2024)
  - Different conditions
  - Different locations
  Expected: All predictions should be reasonable ($1,000 - $200,000)

### 3. Performance Testing
- [ ] **Test prediction speed**
  - First prediction: <2 seconds (model loading)
  - Subsequent predictions: <0.1 seconds
  Expected: Fast predictions after initial load

- [ ] **Test model caching**
  - Load model twice
  - Second load should be instant (from cache)
  Expected: Model cached correctly

### 4. Web Application Testing
- [ ] **Test prediction endpoint**
  ```bash
  curl -X POST http://localhost:8000/api/predict \
    -H "Content-Type: application/json" \
    -d '{"features": {"year": 2020, "mileage": 30000, ...}}'
  ```
  Expected: Returns prediction with new accuracy

- [ ] **Test model info endpoint**
  ```bash
  curl http://localhost:8000/api/model-info
  ```
  Expected: Shows v3 model with R² = 0.8378, RMSE = $6,080

- [ ] **Test health endpoint**
  ```bash
  curl http://localhost:8000/api/health
  ```
  Expected: Shows model loaded, v3 version

### 5. Frontend Updates
- [ ] **Update model info display**
  - Show "83% accuracy" instead of "53%"
  - Update confidence intervals display
  - Show model version (v3)

- [ ] **Test prediction form**
  - Fill out form with car details
  - Submit prediction
  - Verify prediction shows
  - Verify confidence intervals display correctly

### 6. Error Handling
- [ ] **Test fallback to v2 model**
  - Temporarily rename `best_model_v3.pkl`
  - Test prediction
  - Should fallback to v2 model
  - Restore v3 model

- [ ] **Test missing image features**
  - Prediction without image
  - Should use zero vector (mean image features)
  - Should still work correctly

- [ ] **Test invalid input**
  - Missing required fields
  - Invalid values
  - Should show clear error messages

### 7. Comparison Testing
- [ ] **Compare v2 vs v3 predictions**
  - Same car data
  - v3 should be more accurate
  - v3 predictions should be closer to actual prices

### 8. Documentation
- [ ] **Update API documentation**
  - Document new model version
  - Update accuracy metrics
  - Update RMSE values

- [ ] **Update README**
  - Document model v3 deployment
  - Update accuracy metrics
  - Add deployment notes

## Post-Deployment

- [ ] **Monitor predictions**
  - Check prediction logs
  - Monitor for errors
  - Track prediction accuracy

- [ ] **User feedback**
  - Collect user feedback
  - Monitor prediction quality
  - Track any issues

## Rollback Plan

If issues occur:
1. Rename `best_model_v3.pkl` to `best_model_v3.pkl.backup`
2. System will automatically fallback to `best_model_v2.pkl`
3. Monitor system stability
4. Fix issues and redeploy v3

## Success Criteria

- ✅ Model loads successfully
- ✅ Predictions work correctly
- ✅ Performance is acceptable (<1s)
- ✅ Error handling works
- ✅ Fallback to v2 works
- ✅ Accuracy improved (83% vs 53%)
- ✅ Confidence intervals use new RMSE

## Notes

- Image features currently use zero vector (mean features)
- Can be enhanced later with actual image extraction
- Model works without images (uses mean image features)
- Scaler is required for v3 models (RobustScaler)
- Model version is tracked and displayed
