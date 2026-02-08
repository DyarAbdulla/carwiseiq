# Fix: Allow NULL for Draft Listing Fields

## Problem
`sqlite3.IntegrityError: NOT NULL constraint failed: listings.make`

Draft listings are created before AI fills make/model/year, but the database schema requires these fields to be NOT NULL.

## Solution

### 1. Database Migration
**File**: `backend/scripts/migrate_listings_nullable.py`

Makes `make`, `model`, `year`, and `color` nullable in the `listings` table:
- Creates new table with nullable columns
- Copies existing data
- Drops old table
- Renames new table
- Recreates indexes

**Command to run**:
```powershell
cd backend
python scripts/migrate_listings_nullable.py
```

### 2. Schema Update
**File**: `backend/app/services/marketplace_service.py`

Updated `init_marketplace_db()` to create table with nullable columns:
- `make TEXT` (was `TEXT NOT NULL`)
- `model TEXT` (was `TEXT NOT NULL`)
- `year INTEGER` (was `INTEGER NOT NULL`)
- `color TEXT` (was `TEXT NOT NULL`)
- Also made `price`, `mileage`, `condition`, `transmission`, `fuel_type` nullable for drafts

### 3. Draft Creation
**File**: `backend/app/services/marketplace_service.py`

`create_draft_listing()` already inserts `None` for missing fields - no changes needed.

### 4. Validation on Publish
**File**: `backend/app/api/routes/marketplace.py`

Added validation to `publish_listing()` endpoint:
- Checks required fields: `make`, `model`, `year`, `price`, `mileage`, `condition`, `transmission`, `fuel_type`, `color`
- Returns `400 Bad Request` with message "Complete car details required. Missing: ..." if fields are missing
- Only validates when publishing (not when creating drafts)

## Files Changed

1. ✅ `backend/scripts/migrate_listings_nullable.py` (NEW)
2. ✅ `backend/app/services/marketplace_service.py` (Schema update)
3. ✅ `backend/app/api/routes/marketplace.py` (Publish validation)

## Testing

### 1. Run Migration
```powershell
cd backend
python scripts/migrate_listings_nullable.py
```

Expected output:
```
Starting migration: Making make/model/year/color nullable...
Creating new table structure...
Copying data from old table...
Dropping old table...
Renaming new table...
Recreating indexes...
[OK] Migration completed successfully
```

### 2. Test Draft Creation
```powershell
# Start backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Test endpoint:
```powershell
# PowerShell
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/marketplace/listings/draft" -Method POST -ContentType "application/json" -Body '{}'
$response | ConvertTo-Json
```

Expected: `200 OK` with `listing_id` (no 500 error)

### 3. Test Publish Validation
```powershell
# Try to publish draft without required fields
$response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/marketplace/listings/1/publish" -Method PUT -Headers @{Authorization="Bearer YOUR_TOKEN"}
```

Expected: `400 Bad Request` with message "Complete car details required. Missing: make, model, year, ..."

## Status: ✅ COMPLETE

All changes implemented:
- ✅ Migration script created
- ✅ Schema updated to allow NULLs
- ✅ Draft creation allows NULLs
- ✅ Validation only on publish
