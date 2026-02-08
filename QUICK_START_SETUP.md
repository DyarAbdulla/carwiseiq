# 🚀 Quick Start Guide - After Setup

## ✅ What's Already Done

- ✅ Python dependencies installed (Backend)
- ✅ Node.js dependencies installed (Frontend)
- ✅ Node.js dependencies installed (Backend-Node)
- ✅ Configuration files created (.env files)
- ✅ Virtual environment created

## ⚠️ One More Step: PostgreSQL

The **Authentication Backend** needs PostgreSQL database.

### Install PostgreSQL (if not installed):

1. **Download:** https://www.postgresql.org/download/windows/
2. **Install** and remember your password
3. **Set password** in `backend-node/.env`:
   ```
   DB_PASSWORD=your_postgresql_password_here
   ```
4. **Create database:**
   ```powershell
   cd backend-node
   npm run setup-db
   ```

---

## 🎯 Start All Services

### Method 1: Use Batch Files

1. **ML Backend:** Double-click `backend/START_ML_API.bat`
2. **Auth Backend:** Double-click `backend-node/start.bat`
3. **Frontend:** Open terminal in `frontend/` and run `npm run dev`

### Method 2: Manual (3 Terminals)

**Terminal 1 - ML Backend:**
```powershell
cd "C:\Car price prection program Local E\backend"
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Auth Backend:**
```powershell
cd "C:\Car price prection program Local E\backend-node"
npm start
```

**Terminal 3 - Frontend:**
```powershell
cd "C:\Car price prection program Local E\frontend"
npm run dev
```

---

## 🌐 Access URLs

- **Frontend:** http://localhost:3002
- **ML API Docs:** http://localhost:8000/docs
- **Auth API:** http://localhost:3001/health

---

## 📝 Configuration Files

- `backend-node/.env` - Set `DB_PASSWORD` here
- `frontend/.env.local` - Already configured ✅

---

**Ready to go!** 🎉
