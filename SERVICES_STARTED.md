# All Services Started

## ✅ Services Status

### Database
- **PostgreSQL** (postgresql-x64-16) - ✅ **RUNNING**
  - Service is running as a Windows service
  - Default port: 5432

### Backend Services

1. **ML Backend (Python FastAPI)**
   - Port: **8000**
   - URL: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - Status: Started in separate PowerShell window

2. **Auth Backend (Node.js Express)**
   - Port: **3001**
   - URL: http://localhost:3001
   - Health Check: http://localhost:3001/health
   - Status: Started in separate PowerShell window

3. **Frontend (Next.js)**
   - Port: **3002**
   - URL: http://localhost:3002
   - Status: Started in separate PowerShell window

## 📋 Service Details

All services have been started using `START_ALL_SERVICES.bat`, which opens separate PowerShell windows for each service. Check those windows to see:
- Service logs
- Any startup errors
- Service status

## 🔍 Verify Services

To verify all services are running:

1. **Frontend**: Open http://localhost:3002 in your browser
2. **ML Backend**: Open http://localhost:8000/docs for API documentation
3. **Auth Backend**: Check http://localhost:3001/health for health status

## 🛠️ Manual Start Commands

If you need to restart any service manually:

### ML Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Auth Backend
```powershell
cd backend-node
npm start
```

### Frontend
```powershell
cd frontend
npm run dev
```

## ⚠️ Troubleshooting

If services don't start:
1. Check the PowerShell windows that opened for error messages
2. Verify PostgreSQL is running: `Get-Service postgresql-x64-16`
3. Check if ports are already in use
4. Verify dependencies are installed (venv for Python, node_modules for Node.js)
