# Fix: _get_labels_version Typo in car_detection_service

## Problem
`NameError: name '_get_labels_version' is not defined`

## Root Cause
In `backend/app/services/car_detection_service.py`:
- Function is defined as `get_labels_version()` on line 84 (public function)
- But it was incorrectly called as `_get_labels_version()` on line 513 (with underscore prefix)

The underscore prefix `_` in Python typically indicates a private/internal function, but this function is meant to be public and is already exported/used elsewhere.

## Fix Applied

**File**: `backend/app/services/car_detection_service.py`

**Line 513**: Changed `_get_labels_version()` to `get_labels_version()`

```python
# Before:
labels_version = _get_labels_version()

# After:
labels_version = get_labels_version()
```

## Verification

✅ Searched entire codebase for `_get_labels_version` - no other occurrences found
✅ Function `get_labels_version()` is correctly defined on line 84
✅ Function is correctly imported and used in `backend/app/api/routes/marketplace.py` (line 26, 301)
✅ No linter errors

## Files Changed

1. ✅ `backend/app/services/car_detection_service.py`
   - Fixed typo on line 513: `_get_labels_version()` → `get_labels_version()`

## Status: ✅ FIXED

The typo has been corrected, and the function now correctly calls `get_labels_version()` as defined.
