# Quick Start Commands

## Start Backend
```bash
cd backend
python -m app.main
```

**Expected:** Server running on http://127.0.0.1:8000

## Start Frontend
```bash
cd frontend
npm run dev
```

**Expected:** Server running on http://localhost:3002 (no warnings)

## Test Health Endpoint
```bash
curl http://localhost:8000/api/health
```

## Test Prediction Endpoint
```bash
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "make": "Toyota",
      "model": "Corolla",
      "year": 2020,
      "mileage": 50000,
      "engine_size": 1.8,
      "cylinders": 4,
      "condition": "Good",
      "fuel_type": "Gasoline",
      "location": "Erbil"
    }
  }'
```

**Expected:** 200 OK with `predicted_price` field

## Files Changed

### Backend
- `backend/app/models/schemas.py` - Added default for location
- `backend/app/api/routes/predict.py` - Comprehensive fixes

### Frontend  
- `frontend/next.config.js` - Added _next_intl_trailing_slash to env

## Verification

✅ `/api/health` returns 200
✅ `/api/predict` returns 200 (not 500)
✅ No Next.js config warnings
✅ No console errors
