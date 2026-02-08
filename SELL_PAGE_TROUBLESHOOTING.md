# Sell Page Blank Screen - Troubleshooting Guide

## Issue
The `/en/sell` page at `localhost:3000/en/sell` is showing a blank/black screen.

## Changes Made

### 1. Added Backend Availability Check
- The sell page now checks if the backend is available on mount
- Shows a warning banner if the backend is not running
- Prevents the page from crashing if the API is unavailable

### 2. Improved Error Handling in SellCarForm
- Added fallback to use constants from `@/lib/constants` if API fails
- Form will still render even if backend is unavailable
- Shows warning toast instead of crashing

### 3. Created Diagnostic Scripts
- `check_servers.ps1` (Windows PowerShell)
- `check_servers.sh` (Linux/Mac)
- Run these to quickly check if both servers are running

## Diagnostic Steps

### Step 1: Check if Frontend Dev Server is Running

**Windows:**
```powershell
# Check if port 3000 is in use
netstat -ano | findstr :3000
```

**Linux/Mac:**
```bash
# Check if port 3000 is in use
lsof -i :3000
```

**If NOT running, start it:**
```bash
cd frontend
npm run dev
```

You should see:
```
✓ Ready in X ms
○ Compiling /en/sell ...
✓ Compiled successfully
```

### Step 2: Check if Backend Server is Running

**Windows:**
```powershell
# Check if port 8000 is in use
netstat -ano | findstr :8000
```

**Linux/Mac:**
```bash
# Check if port 8000 is in use
lsof -i :8000
```

**If NOT running, start it:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Step 3: Use Diagnostic Script

**Windows:**
```powershell
.\check_servers.ps1
```

**Linux/Mac:**
```bash
chmod +x check_servers.sh
./check_servers.sh
```

### Step 4: Check Browser Console

1. Open the page: `http://localhost:3000/en/sell`
2. Press `F12` to open DevTools
3. Check the **Console** tab for errors
4. Check the **Network** tab for failed requests

**Common Errors:**
- `Failed to fetch` - Backend not running
- `404 Not Found` - Route doesn't exist
- `500 Internal Server Error` - Backend error
- `CORS error` - Backend CORS configuration issue

### Step 5: Check Terminal Output

Look at the terminal running `npm run dev` for:
- Compilation errors
- TypeScript errors
- Module not found errors

## Expected Behavior After Fix

1. **If Backend is Running:**
   - Page loads normally
   - Form shows with all dropdowns populated
   - No warning banner

2. **If Backend is NOT Running:**
   - Page still loads (no blank screen)
   - Yellow warning banner appears at top
   - Form shows with fallback data (constants)
   - Warning toast appears

## Manual Testing

1. **Test with Backend Running:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   uvicorn app.main:app --reload --port 8000
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```
   Visit: `http://localhost:3000/en/sell`
   - Should see form with data loaded from API

2. **Test without Backend:**
   - Stop backend server
   - Refresh page
   - Should see warning banner and form with fallback data

## Common Issues and Solutions

### Issue: Page still blank after fixes
**Solution:**
1. Clear Next.js cache:
   ```bash
   cd frontend
   npm run clean:win  # Windows
   # or
   rm -rf .next .next-cache node_modules/.cache  # Linux/Mac
   ```
2. Restart dev server
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: "Module not found" errors
**Solution:**
```bash
cd frontend
npm install
```

### Issue: TypeScript errors
**Solution:**
```bash
cd frontend
npm run build  # This will show all TypeScript errors
```

### Issue: CORS errors
**Solution:**
Check `backend/app/main.py` has CORS middleware configured:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Next Steps

1. Run the diagnostic script to check server status
2. Check browser console for errors
3. Check terminal output for compilation errors
4. Report back with:
   - Are both servers running? (Yes/No)
   - Any errors in browser console? (Copy/paste errors)
   - Any errors in terminal? (Copy/paste errors)
   - Is the page showing now? (Yes/No)

## Files Modified

1. `frontend/app/[locale]/sell/page.tsx` - Added backend check and error handling
2. `frontend/components/sell/SellCarForm.tsx` - Added fallback data loading
3. `check_servers.ps1` - Windows diagnostic script
4. `check_servers.sh` - Linux/Mac diagnostic script

