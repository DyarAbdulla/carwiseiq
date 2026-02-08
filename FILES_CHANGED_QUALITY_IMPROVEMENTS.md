# Files Changed - Auto-Detection Quality & UX Improvements

## Summary
Improved auto-detection quality, UX, and safety with better filtering, normalization, user override tracking, and polished frontend experience.

---

## Files Changed

### Backend:

#### 1. `backend/app/services/car_detection_service.py` (MAJOR UPDATE)
**Changes**:
- ✅ Added label filtering:
  - Model length <= 25 characters
  - Normalization (trim, lowercase, collapse spaces, remove special chars)
  - Drop rare models (count < 10 in dataset)
  - Separate filtered list for "best", full list for "topk"
- ✅ Improved prompts:
  - Make: `"a photo of a {make} vehicle"`
  - Model: `"a photo of a {make} {model} vehicle"`
  - Color: `"a photo of a {color} car in daylight"`
  - Year: `"a photo of a car from the {range}"`
- ✅ Low confidence fallback:
  - If `best_make.confidence < 0.55`: Set `status = "low_confidence"`
  - Don't prefill if low confidence
- ✅ Prediction normalization:
  - `_normalize_prediction()` function
  - Maps to exact dropdown values (exact → case-insensitive → similarity)
  - Stores `original` if normalized differs
- ✅ Cache improvements:
  - `get_labels_version()` function (dataset mtime + size)
  - Cache key includes `image_hash + labels_version`
- ✅ Debug mode:
  - `AUTO_DETECT_DEBUG=1` env var
  - Includes per-image results and aggregated logits in response

**Key Functions Added**:
- `_normalize_model_name()` - Normalize for deduplication
- `get_labels_version()` - Get version hash for labels
- `_normalize_prediction()` - Map prediction to dropdown value
- `get_labels_version()` - Public function for labels version

---

#### 2. `backend/app/api/routes/marketplace.py` (UPDATED)
**Changes**:
- ✅ Updated `auto_detect_car()` endpoint:
  - Loads valid makes/models from dataset for normalization
  - Passes `valid_makes` and `valid_models_by_make` to detection service
  - Checks `labels_version` in cache validation
  - Only prefills if `status != "low_confidence"`
- ✅ Added `PUT /api/marketplace/listings/{id}/user-overrides` endpoint:
  - Updates `selected_by_user` and `user_overrode` in `auto_detect` JSON
  - Called when user changes AI-filled fields

**Lines Changed**: ~60 lines

---

#### 3. `backend/app/services/marketplace_service.py` (UPDATED)
**Changes**:
- ✅ Added `update_listing_auto_detect_user_overrides()` function:
  - Updates `auto_detect` JSON field
  - Stores `selected_by_user` dict and `user_overrode` flag

**Lines Added**: ~30 lines

---

### Frontend:

#### 4. `frontend/app/[locale]/sell/step2/page.tsx` (MAJOR UPDATE)
**Changes**:
- ✅ **Live Detection Card**:
  - Loading state: Skeleton + "Analyzing 1/3..." progress
  - Result card: Compact display with Make/Model/Color/Year
  - Confidence badges (HIGH/MED/LOW)
  - "Re-run" button (small)
  - "Continue" button (always enabled)
- ✅ **Strict Auto-Continue Rules**:
  - Only auto-navigate if:
    - `make.conf >= 0.80` AND
    - `model.conf >= 0.75` AND
    - (`year.conf >= 0.70` OR `year is null`)
  - Otherwise: Show result, let user click Continue
- ✅ Progress tracking: Shows current/total images being analyzed

**Lines Changed**: ~150 lines

---

#### 5. `frontend/app/[locale]/sell/step4/page.tsx` (MAJOR UPDATE)
**Changes**:
- ✅ **AI Suggestions Pills**:
  - Badge next to Make/Model/Color/Year when topk available
  - Shows "AI Suggestions" with sparkle icon
- ✅ **Top-5 Dropdowns**:
  - Shows suggestions with confidence % at top
  - Separated from regular options
- ✅ **User Override Tracking**:
  - Tracks initial AI-filled values (`aiPrefilledValues`)
  - Detects when user changes them (`handleFieldChange`)
  - Saves to backend via `updateListingUserOverrides()`
  - Stores `selected_by_user` and `user_overrode` in listing
- ✅ Loads detection data from listing API or sessionStorage
- ✅ Properly handles `detection.best` and `detection.topk` structure

**Lines Changed**: ~100 lines

---

#### 6. `frontend/lib/api.ts` (UPDATED)
**Changes**:
- ✅ Added `updateListingUserOverrides()` method:
  - Calls `PUT /api/marketplace/listings/{id}/user-overrides`
  - Sends `selected_by_user` and `user_overrode`

**Lines Added**: ~10 lines

---

## Test Steps

### 1. Install Dependencies
```powershell
cd backend
pip install transformers==4.35.2 torch==2.1.0 pillow==10.1.0
```

### 2. Start Backend
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Start Frontend
```powershell
cd frontend
npm run dev
```

### 4. Test Flow

**Step 1**: `/sell/step1` → Select location → Continue

**Step 2**: Upload 2+ car photos
- ✅ See "Analyzing photos..." with progress ("Analyzing 1/3...")
- ✅ See detection result card with:
  - Make / Model / Color / Year
  - Confidence badges (HIGH/MED/LOW)
  - "Re-run" button
- ✅ **Auto-navigate ONLY if**:
  - make.conf >= 0.80 AND model.conf >= 0.75 AND (year.conf >= 0.70 OR null)
- ✅ Otherwise: Show result, user clicks Continue

**Step 4**: Car Details form
- ✅ See AI suggestions pills next to Make/Model/Color/Year
- ✅ Dropdowns show top-5 suggestions with confidence %
- ✅ Prefilled values match dropdown options exactly
- ✅ Change an AI-filled field → Saved as override

### 5. Test Debug Mode
```powershell
$env:AUTO_DETECT_DEBUG="1"
# Restart backend, then test detection
# Response includes meta.debug with per-image results
```

### 6. Verify User Overrides
- Change AI-filled field in Step 4
- Check database: `listing.auto_detect.selected_by_user` should contain changes
- Check database: `listing.auto_detect.user_overrode` should be `true`

---

## Expected Behavior

### Quality:
- ✅ No garbage model names (filtered)
- ✅ Predictions match dropdown values exactly
- ✅ Low confidence detections don't prefill

### UX:
- ✅ Clear progress indication
- ✅ Compact result card
- ✅ Confidence badges
- ✅ Strict auto-navigate rules
- ✅ AI suggestions visible

### Safety:
- ✅ No invalid values
- ✅ User changes tracked
- ✅ Cache invalidates on dataset change

---

## Status: ✅ COMPLETE

All improvements implemented and tested.

**Ready for production!**
