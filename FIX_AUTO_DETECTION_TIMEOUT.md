# Fix: Auto-Detection Timeout and Reliability Improvements

## Problem
Auto-detection was failing with "timeout of 10000ms exceeded" because:
1. The 10-second timeout in frontend was too short for AI inference
2. CLIP model loaded on first request instead of at startup
3. No progress feedback during long operations

## Fixes Applied

### 1. Increased Timeout for Auto-Detect Endpoint
**File**: `frontend/lib/api.ts`

- Created separate `longRunningApi` axios instance with 120 second (2 minutes) timeout
- Updated `autoDetectCar()` to use `longRunningApi` instead of default `api` instance
- Added specific timeout error handling with helpful message

**Changes**:
```typescript
// New axios instance for long-running operations
const longRunningApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 seconds (2 minutes)
  ...
})

// Updated autoDetectCar to use longRunningApi
const response = await longRunningApi.post(`/api/marketplace/listings/${listingId}/auto-detect`)
```

### 2. Pre-load CLIP Model on Backend Startup
**File**: `backend/app/main.py`

- Added CLIP model warmup call in `startup_event()`
- Model now loads during server startup instead of first request
- Non-critical failure (logs warning, allows server to start)

**Changes**:
```python
# Pre-load CLIP model for auto-detection (warmup)
try:
    from app.services.car_detection_service import warmup_clip_model
    warmup_clip_model()
    logging.info("CLIP model pre-loaded successfully at startup")
except Exception as e:
    logging.warning(f"Failed to pre-load CLIP model at startup: {e}")
    # Non-critical - model will load on first request instead
```

### 3. Added Warmup Function
**File**: `backend/app/services/car_detection_service.py`

- Added `warmup_clip_model()` function that:
  - Loads CLIP model and processor
  - Loads labels from dataset
  - Runs a dummy inference to warm up GPU/CPU
  - Validates everything works before first request

**Function**:
```python
def warmup_clip_model():
    """Warmup function to pre-load CLIP model and run a dummy inference"""
    # Loads model, labels, and runs test inference
```

### 4. Improved Frontend Error Handling
**File**: `frontend/app/[locale]/sell/step2/page.tsx`

- Added `isModelLoading` state to track model loading phase
- Shows "Loading AI model..." message for first 3 seconds
- Shows "This may take up to 30 seconds on first use..." message
- Better timeout error messages with retry suggestion
- Tracks detection start time for debugging

**Changes**:
- Added state: `isModelLoading`, `detectionStartTime`
- Updated UI to show model loading message
- Improved timeout error handling with retry suggestion

## Files Changed

1. ✅ `frontend/lib/api.ts`
   - Added `longRunningApi` instance with 120s timeout
   - Updated `autoDetectCar()` to use long-running API
   - Added timeout-specific error handling

2. ✅ `backend/app/main.py`
   - Added CLIP model warmup in startup event

3. ✅ `backend/app/services/car_detection_service.py`
   - Added `warmup_clip_model()` function

4. ✅ `frontend/app/[locale]/sell/step2/page.tsx`
   - Added `isModelLoading` and `detectionStartTime` state
   - Updated UI to show model loading message
   - Improved error handling for timeouts

## Expected Behavior After Fix

### Backend Startup:
- ✅ CLIP model pre-loads during server startup
- ✅ Logs show: "CLIP model pre-loaded successfully at startup"
- ✅ First request doesn't need to wait for model loading

### Frontend:
- ✅ Auto-detection has 120 second timeout (was 10 seconds)
- ✅ Shows "Loading AI model..." message during first few seconds
- ✅ Shows progress: "Analyzing 1/3..." during detection
- ✅ Clear timeout error with retry suggestion if timeout occurs
- ✅ Detection completes without timeout errors

### User Experience:
- ✅ First detection works without timeout (model pre-loaded)
- ✅ User sees clear progress during detection
- ✅ Helpful error messages if something goes wrong
- ✅ Can retry if timeout occurs

## Testing

### 1. Test Backend Startup
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Expected logs:
```
INFO: CLIP model pre-loaded successfully at startup
```

### 2. Test Frontend Flow
1. Start backend (model should pre-load)
2. Go to `/sell/step1` → Select location → Continue
3. Upload 2+ car photos in Step 2
4. Should see:
   - "Loading AI model..." for first 3 seconds (if first use)
   - Then "Analyzing photos..." with progress
   - Detection completes without timeout

### 3. Test Timeout Handling
- If timeout occurs (unlikely with 120s), should see:
  - "Detection timed out. The AI model may still be loading. Please wait a moment and try again, or continue manually."

## Status: ✅ COMPLETE

All fixes implemented:
- ✅ Increased timeout to 120 seconds
- ✅ Pre-load CLIP model on startup
- ✅ Added warmup function
- ✅ Improved frontend error handling and UI feedback
