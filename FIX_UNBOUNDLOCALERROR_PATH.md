# Fix: UnboundLocalError for Path in auto_detect_car

## Problem
When a user uploads 2+ images to sell a car, the AI auto-detection fails with:
```
UnboundLocalError: cannot access local variable 'Path' where it is not associated with a value
```

## Root Cause
In `backend/app/api/routes/marketplace.py`, the `auto_detect_car` function had a duplicate `from pathlib import Path` import on line 287 inside a conditional block (`if listing.get('auto_detect'):`). 

When this block doesn't execute (for new listings without existing detection), Python treats `Path` as a local variable that was never assigned, even though it's already imported at the top of the file (line 8).

Python's scoping rules: If a name is assigned anywhere in a function, Python treats it as a local variable for the entire function. The duplicate import inside the conditional block made Python think `Path` was a local variable, causing the error when the block didn't execute.

## Fix Applied

### 1. Removed Duplicate Import
**File**: `backend/app/api/routes/marketplace.py`

**Line 287**: Removed `from pathlib import Path` (duplicate)
- `Path` is already imported at the top of the file (line 8)
- Now uses the top-level import throughout the function

### 2. Removed Redundant Import
**Line 255**: Removed `import os` (redundant)
- `os` is already imported at the top of the file (line 10)
- Kept `import traceback` as it's not imported at the top

## Files Changed

1. ✅ `backend/app/api/routes/marketplace.py`
   - Removed duplicate `from pathlib import Path` on line 287
   - Removed redundant `import os` on line 255

## Testing

### Expected Behavior After Fix:
- ✅ When user uploads 2+ photos in Step 2, clicking Continue triggers auto-detection
- ✅ AI detects and prefills: Make, Model, Color, and Year
- ✅ Detection results appear in Step 4 (Car Details) form fields
- ✅ No more `UnboundLocalError` when creating new listings

### Test Steps:
1. Start backend:
   ```powershell
   cd backend
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. Test the flow:
   - Go to `/sell/step1` → Select location → Continue
   - Upload 2+ car photos in Step 2
   - Click Continue (or wait for auto-detection)
   - Should see detection results without errors
   - Go to Step 4 → Should see prefilled Make/Model/Color/Year

## Status: ✅ FIXED

The duplicate import has been removed, and `Path` now correctly uses the top-level import throughout the function.
