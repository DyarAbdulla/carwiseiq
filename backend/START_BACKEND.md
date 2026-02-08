# How to Start the Backend Server

## ✅ Quick Start (Easiest Method)

### Windows Batch File:
Double-click `start_backend.bat` or run:
```bash
cd backend
start_backend.bat
```

### PowerShell:
```powershell
cd backend
.\start_backend.ps1
```

## 🔧 Manual Start (For Debugging)

### Step 1: Navigate to backend directory
```bash
cd "C:\Car price prection program Local E\backend"
```

### Step 2: Activate virtual environment (if exists)
```bash
venv\Scripts\activate
```

### Step 3: Install/Update dependencies (if needed)
```bash
pip install -r requirements.txt
```

### Step 4: Start the server
**IMPORTANT: Must run from backend directory!**
```bash
# From backend directory:
python -m app.main
# OR
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## ✅ Verify It's Working

1. **Check console output** - You should see:
   ```
   INFO:     Started server process
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   INFO:     Uvicorn running on http://127.0.0.1:8000
   ```

2. **Test health endpoint** - Open browser:
   - http://127.0.0.1:8000/api/health
   - Should return: `{"ok": true}`

3. **Check API docs**:
   - http://127.0.0.1:8000/docs

## 🐛 Common Issues & Fixes

### Issue: "ModuleNotFoundError: No module named 'app'"
**Fix:** Make sure you're in the `backend` directory when running the command

### Issue: "ModuleNotFoundError: No module named 'pydantic_settings'"
**Fix:** Install dependencies:
```bash
pip install -r requirements.txt
```

### Issue: "Port 8000 already in use"
**Fix:** Change port:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Issue: "Failed to activate virtual environment"
**Fix:** Create virtual environment:
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## 📝 Important Notes

- Server runs on `127.0.0.1:8000` (not `localhost:8000`)
- Frontend expects backend at `http://127.0.0.1:8000`
- Press `Ctrl+C` to stop the server
- Use `--reload` flag for auto-reload during development

## 🔒 Stability and Reload

To avoid constant restarts, the reload watcher **excludes**:
- `__pycache__`, `*.pyc`, `*.pyo`, `logs`, `*.log`, `uploads`, `data`, `models`, `*.db`, `.git`, `venv`, `.venv`, `.env`

**TensorFlow oneDNN warnings** are suppressed by setting `TF_ENABLE_ONEDNN_OPTS=0` and `TF_CPP_MIN_LOG_LEVEL=2` (in `start_backend.bat`/`.ps1` and at the top of `app/main.py`).

For **production** (no auto-reload), either:
- Set `DEBUG=false` in `.env` and run `python -m app.main`, or
- Run: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (without `--reload`)
