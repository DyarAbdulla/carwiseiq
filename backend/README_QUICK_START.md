# Quick Start Guide - Backend Setup

Simple steps to get the backend running.

## Step 1: Stop Old Backend (if running)

**Option A - Using Task Manager:**
1. Open Task Manager (Ctrl+Shift+Esc)
2. Find any "python.exe" processes
3. Right-click and "End Task"

**Option B - Using Command:**
1. Open Command Prompt
2. Run: `netstat -ano | findstr :8000`
3. Note the PID number (last number in the line)
4. Run: `taskkill /PID [PID_NUMBER] /F`
   - Replace [PID_NUMBER] with the actual number

**Or simply restart your computer** (easiest option!)

---

## Step 2: Start New Backend

1. Open Command Prompt or PowerShell
2. Navigate to the backend folder:
   ```
   cd "C:\Car price prection program Local E\backend"
   ```
3. Run the startup script:
   ```
   start.bat
   ```

You should see:
```
========================================
Starting Car Price Predictor Backend
========================================

Activating virtual environment...
Starting FastAPI server...
Server will be available at: http://localhost:8000
```

**Keep this window open!** The server runs here.

---

## Step 3: Test It Works

**In a NEW Command Prompt window:**

1. Navigate to backend folder:
   ```
   cd "C:\Car price prection program Local E\backend"
   ```
2. Run the test script:
   ```
   quick_test.bat
   ```

You should see test results showing:
- Health check: [OK]
- Platforms: [OK]
- URL Prediction: [OK]

If all tests pass, your backend is working!

---

## Step 4: Connect Frontend

1. Make sure backend is running (Step 2)
2. Open your frontend (should already be running)
3. Go to: http://localhost:3002 (or your frontend port)
4. Try analyzing a car URL

The frontend will connect to: http://localhost:8000

---

## Troubleshooting

**"Port 8000 already in use"**
- Stop the old backend (Step 1)
- Or change port in `main.py` (line 487): `port=8001`

**"Module not found" errors**
- Make sure you activated the virtual environment
- Run: `pip install -r requirements.txt`

**"Virtual environment not found"**
- Create it first:
  ```
  python -m venv venv
  venv\Scripts\activate
  pip install -r requirements.txt
  ```

**Tests fail with "Connection refused"**
- Make sure backend is running (Step 2)
- Check if port 8000 is in use: `netstat -ano | findstr :8000`

---

## Need Help?

Check the main README.md for more detailed information.
