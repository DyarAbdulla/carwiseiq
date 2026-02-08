# 🔧 URGENT FIX: Port 3001 → 8000

## ✅ What I Fixed:

1. ✅ **frontend/lib/api.ts** - `AUTH_API_BASE_URL` now defaults to port 8000
2. ✅ **frontend/js/auth.js** - Updated to port 8000
3. ✅ **frontend/env.example** - Updated to port 8000
4. ✅ **Backend database** - Initialized successfully
5. ✅ **Backend server** - Started on port 8000

## 🚨 IMPORTANT: Clear Cache and Restart

The browser might be using **cached JavaScript**. You need to:

### Step 1: Stop the Frontend Dev Server
- Press `Ctrl+C` in the terminal running `npm run dev`

### Step 2: Clear All Caches
```powershell
cd frontend
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
```

### Step 3: Hard Refresh Browser
- Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or open DevTools → Right-click refresh button → "Empty Cache and Hard Reload"

### Step 4: Restart Frontend
```powershell
cd frontend
npm run dev
```

## ✅ Verify Backend is Running

Check if backend is running:
```powershell
# Test backend health
curl http://localhost:8000/api/health
# Or open in browser: http://localhost:8000/docs
```

If backend is NOT running, start it:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## 🔍 Verify the Fix

After restarting, check the browser console:
1. Open DevTools (F12)
2. Go to Network tab
3. Try to register
4. Check the request URL - it should be `http://localhost:8000/api/auth/register` NOT `3001`

## 📝 Code Verification

The code in `frontend/lib/api.ts` is correct:
- Line 15: `AUTH_API_BASE_URL = ... || 'http://localhost:8000'`
- Line 28: `authApi.baseURL = AUTH_API_BASE_URL`
- Line 546: `authApi.post('/api/auth/register')` → Uses authApi which points to port 8000

The issue is **browser cache** or **Next.js build cache**. Clear both!
