# How to Start Servers Manually

## Backend (FastAPI)

Open a new terminal and run:
```powershell
cd "C:\Car prices definer program local C\backend"
.\venv\Scripts\activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Backend URL:** http://localhost:8000
**API Docs:** http://localhost:8000/docs

## Frontend (Next.js)

Open a **separate** terminal and run:
```powershell
cd "C:\Car prices definer program local C\frontend"
npm run dev
```

**Frontend URL:** http://localhost:3000 (or 3001 if 3000 is in use)

## Troubleshooting

### Port 8000 already in use:
```powershell
netstat -ano | findstr ":8000"
# Find the PID and kill it:
Stop-Process -Id <PID> -Force
```

### Port 3000 already in use:
```powershell
netstat -ano | findstr ":3000"
# Find the PID and kill it:
Stop-Process -Id <PID> -Force
```

### Backend won't start:
1. Make sure virtual environment is activated
2. Check that all dependencies are installed: `pip install -r requirements.txt`
3. Verify email-validator is installed: `pip install email-validator`

### Frontend won't start:
1. Make sure you're in the frontend directory
2. Install dependencies: `npm install`
3. Check for port conflicts









