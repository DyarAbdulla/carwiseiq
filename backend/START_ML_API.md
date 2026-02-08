# 🚀 Start ML Prediction API Server

## Quick Start (Easiest Method)

### Windows (Double-Click)
1. **Double-click** `START_ML_API.bat` in the `backend` folder
2. Wait for the server to start
3. Server will be available at: **http://localhost:8000**

### Windows (PowerShell)
```powershell
cd backend
.\START_ML_API.ps1
```

---

## Manual Start (Step-by-Step)

### Prerequisites
- Python 3.8 or higher installed
- Python added to PATH

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Create Virtual Environment (First Time Only)
```bash
# Windows
python -m venv venv

# Linux/Mac
python3 -m venv venv
```

### Step 3: Activate Virtual Environment

**Windows (Command Prompt):**
```bash
venv\Scripts\activate
```

**Windows (PowerShell):**
```powershell
venv\Scripts\Activate.ps1
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### Step 4: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 5: Start the Server
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Verify Server is Running

Once started, you should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Test the API

1. **Health Check:**
   - Open: http://localhost:8000/api/health
   - Should return JSON with status

2. **API Documentation:**
   - Open: http://localhost:8000/docs
   - Interactive Swagger UI

3. **Available Endpoints:**
   - `GET /api/health` - Health check
   - `GET /api/cars/makes` - Get all car makes
   - `GET /api/cars/models/{make}` - Get models for a make
   - `GET /api/cars/locations` - Get all locations
   - `GET /api/cars/metadata` - Get metadata (year range, etc.)
   - `POST /api/predict` - Predict car price
   - `POST /api/sell` - Sell car endpoint
   - `GET /api/stats` - Statistics

---

## Troubleshooting

### Error: "Python is not recognized"
**Solution:** Install Python from https://www.python.org/ and make sure to check "Add Python to PATH" during installation.

### Error: "ModuleNotFoundError: No module named 'fastapi'"
**Solution:** Make sure you activated the virtual environment and installed dependencies:
```bash
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### Error: "Port 8000 is already in use"
**Solution:** Either:
1. Stop the other application using port 8000
2. Or run on a different port:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
   ```
   Then update frontend `.env.local` to use port 8001

### Error: "Failed to load model"
**Solution:** Make sure the model file exists:
- Check if `models/best_model_v2.pkl` exists in the root directory
- If missing, you may need to train the model first (the API will still work but predictions won't be available)

### PowerShell Execution Policy Error
If you get an execution policy error in PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Server Configuration

The server is configured in `backend/app/config.py`:
- **Host:** 127.0.0.1 (localhost)
- **Port:** 8000
- **Debug Mode:** True (auto-reload on code changes)

---

## Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

---

## Next Steps

Once the ML API is running:
1. ✅ Frontend (port 3002) - Already running
2. ✅ Backend Auth API (port 3001) - Already running  
3. ✅ ML Prediction API (port 8000) - Now running!

Your full application stack is now complete! 🎉







