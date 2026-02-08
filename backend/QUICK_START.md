# Backend Quick Start Guide

## ✅ Fixed Issues
- Added missing `__init__.py` files for proper Python package structure
- Created startup scripts for easy server launch
- Improved error messages in main.py

## 🚀 How to Start the Backend

### Option 1: Using Batch File (Windows)
```bash
cd backend
start_backend.bat
```

### Option 2: Using PowerShell Script
```powershell
cd backend
.\start_backend.ps1
```

### Option 3: Manual Start (Recommended for debugging)
```bash
cd backend

# Activate virtual environment (if exists)
venv\Scripts\activate

# Start server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Option 4: Direct Python Module
```bash
cd backend
python -m app.main
```

## 🔍 Troubleshooting

### If you get "ModuleNotFoundError":
1. Make sure you're in the `backend` directory
2. Activate virtual environment: `venv\Scripts\activate`
3. Install dependencies: `pip install -r requirements.txt`

### If port 8000 is already in use:
- Change port in `backend/app/config.py` or use:
  ```bash
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
  ```

### If you get import errors:
- Make sure all `__init__.py` files exist (they've been created)
- Check that you're running from the `backend` directory

## ✅ Verify Backend is Running

Once started, you should see:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Test the health endpoint:
- Open browser: http://127.0.0.1:8000/api/health
- Should return: `{"ok": true}`

## 📝 Notes

- Server runs on `127.0.0.1:8000` (not `localhost:8000`)
- API docs available at: http://127.0.0.1:8000/docs
- Press `Ctrl+C` to stop the server
