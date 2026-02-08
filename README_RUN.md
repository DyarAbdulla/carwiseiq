# Quick Start Guide - Car Price Predictor

## Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

## Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment** (recommended):
   ```bash
   python -m venv venv

   # Windows
   venv\Scripts\activate

   # Linux/Mac
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt

   # REQUIRED: For image analysis (ResNet50 feature extraction)
   pip install tensorflow pillow
   # OR (alternative - PyTorch)
   pip install torch torchvision pillow

   # Note: Without TensorFlow/PyTorch, image_features will be None
   # Verify installation:
   python -c "from tensorflow.keras.applications import ResNet50; print('TensorFlow ResNet50 available')"
   ```

4. **Start backend server**:
   ```bash
   # Using uvicorn directly
   uvicorn app.main:app --reload --port 8000 --host 0.0.0.0

   # OR using Python module
   python -m app.main
   ```

   Backend will be available at: `http://localhost:8000`

## Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   Frontend will be available at: `http://localhost:3002`

## Using the Sell Car Flow

1. **Open the application**: Navigate to `http://localhost:3002/en/sell`

2. **Step 1 - Upload Images**:
   - Click or drag & drop car images (up to 10 images, 5MB each)
   - Click "Analyze Images" to get AI analysis
   - Review AI suggestions (make, model, color, condition)

3. **Step 2 - Enter Car Details**:
   - Fill in car information (auto-filled from Step 1 if available)
   - Required: Make, Model, Year, Mileage, Location, Condition
   - Optional: Trim, Accident history

4. **Step 3 - Review & Predict**:
   - Review all information
   - Click "Predict Price" to get price estimate
   - View detailed results with adjustments and recommendations

## API Endpoints

### Health Check
```bash
GET http://localhost:8000/api/health
```

### Analyze Images
```bash
POST http://localhost:8000/api/analyze-images
Content-Type: multipart/form-data
Body: images (File[])
```

### Predict Price
```bash
POST http://localhost:8000/api/predict
Content-Type: application/json
Body: {
  "features": { ... },
  "image_features": [optional array of 2048 numbers]
}
```

### Sell Car Prediction
```bash
POST http://localhost:8000/api/sell/predict
Content-Type: application/json
Body: {
  "make": "Toyota",
  "model": "Camry",
  "year": 2020,
  "mileage": 30000,
  "location": "California",
  "condition": "Good",
  "image_features": [optional]
}
```

## Testing Image Features

### Quick Test Script
```bash
# Start backend first (in one terminal)
cd backend
uvicorn app.main:app --reload --port 8000

# In another terminal, run test script
cd backend
python scripts/test_image_features.py
```

**Expected Output**:
```
Using test image: car-hero-1.jpg
API Base URL: http://localhost:8000

TEST 1: Extract Image Features
PASS: Image features extracted successfully
   Feature length: 2048
PASS: Feature length is correct (2048)
   First 5 features: [0.1234, 0.5678, ...]
   Feature range: min=-2.3456, max=5.6789

TEST 2: Predict Price with Image Features
PASS: Prediction successful
   Predicted price: $XX,XXX.XX
```

## Troubleshooting

### Backend Issues

1. **Port 8000 already in use**:
   - Change port in `backend/app/config.py` or use: `uvicorn app.main:app --port 8001`

2. **Model not found**:
   - Ensure `models/production_model_v1.0.pkl` exists
   - Check `backend/app/config.py` for correct model paths

3. **Image analysis not working / image_features is None**:
   - **REQUIRED**: Install TensorFlow: `pip install tensorflow pillow`
   - OR install PyTorch: `pip install torch torchvision pillow`
   - Verify: `python -c "from tensorflow.keras.applications import ResNet50; print('OK')"`
   - Without these, image_features will be None and multimodal prediction won't work

### Frontend Issues

1. **Cannot connect to backend**:
   - Ensure backend is running on port 8000
   - Check `NEXT_PUBLIC_API_BASE_URL` in `.env` (defaults to `http://localhost:8000`)

2. **Images not uploading**:
   - Check browser console for errors
   - Ensure images are < 5MB each
   - Maximum 10 images allowed

## Model Files

### Required
- `models/production_model_v1.0.pkl` - Tabular prediction model

### Optional
- `models/multimodal_model.pkl` - Multimodal model (tabular + images)
- If not present, system uses tabular-only prediction

## Features

✅ Multi-step sell car form
✅ Image upload with drag & drop
✅ AI image analysis (color, condition, make/model guessing)
✅ Auto-fill form from AI analysis
✅ Multimodal price prediction (if model available)
✅ Tabular-only fallback
✅ Image gallery preview
✅ Production-safe validation
✅ Error handling and loading states

## Development

### Backend Logs
Backend logs are printed to console. Check for:
- Model loading messages
- Image analysis progress
- Prediction results

### Frontend Logs
Open browser DevTools (F12) to see:
- API calls
- Form validation errors
- Image upload progress

## Next Steps

1. Train multimodal model (see `train_multimodal_model.py`)
2. Improve make/model detection from images
3. Add damage detection
4. Implement image storage (currently deleted after analysis)
