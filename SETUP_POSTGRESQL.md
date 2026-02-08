# 🔧 PostgreSQL Setup Guide

## ⚠️ Required for Authentication Backend

The **Auth Backend** (backend-node) requires PostgreSQL to work.

---

## 📥 Install PostgreSQL

### Step 1: Download PostgreSQL
- **Windows:** https://www.postgresql.org/download/windows/
- Download the installer (recommended: PostgreSQL 14 or newer)

### Step 2: Install PostgreSQL
1. Run the installer
2. **Important:** Remember the password you set for the `postgres` user
3. Complete the installation

### Step 3: Verify Installation
Open PowerShell and check:
```powershell
psql --version
```

If you see a version number, PostgreSQL is installed!

---

## 🗄️ Create Database

### Method 1: Using psql Command Line

```powershell
# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL prompt, run:
CREATE DATABASE car_price_predictor;

# Exit
\q
```

### Method 2: Using pgAdmin (GUI)

1. Open **pgAdmin** (installed with PostgreSQL)
2. Connect to PostgreSQL server
3. Right-click on "Databases" → "Create" → "Database"
4. Name: `car_price_predictor`
5. Click "Save"

---

## ⚙️ Configure Backend

### Step 1: Edit `.env` File

Open `backend-node/.env` and set your PostgreSQL password:

```env
DB_PASSWORD=your_postgresql_password_here
```

Replace `your_postgresql_password_here` with the password you set during PostgreSQL installation.

### Step 2: Setup Database Schema

```powershell
cd backend-node
npm run setup-db
```

This will create the `users` table and all necessary indexes.

---

## ✅ Verify Setup

### Test Database Connection

```powershell
cd backend-node
node -e "require('dotenv').config(); const {Pool} = require('pg'); const pool = new Pool({host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD}); pool.query('SELECT NOW()').then(() => {console.log('✅ Database connection successful!'); process.exit(0);}).catch(err => {console.error('❌ Connection failed:', err.message); process.exit(1);});"
```

### Test Auth Backend

```powershell
cd backend-node
npm start
```

Then open: http://localhost:3001/health

You should see:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## 🔍 Troubleshooting

### "psql: command not found"
- PostgreSQL is not in PATH
- Add PostgreSQL bin directory to PATH, or use full path:
  ```powershell
  "C:\Program Files\PostgreSQL\14\bin\psql.exe" -U postgres
  ```

### "password authentication failed"
- Wrong password in `.env` file
- Check `DB_PASSWORD` in `backend-node/.env`

### "database does not exist"
- Create the database:
  ```sql
  CREATE DATABASE car_price_predictor;
  ```

### "connection refused"
- PostgreSQL service is not running
- Start PostgreSQL service:
  ```powershell
  # Check services
  Get-Service | Where-Object {$_.Name -like "*postgres*"}

  # Start service (if found)
  Start-Service postgresql-x64-14
  ```

---

## 🚀 After Setup

Once PostgreSQL is configured:

1. **Restart Auth Backend:**
   ```powershell
   cd backend-node
   npm start
   ```

2. **Verify it's working:**
   - Open: http://localhost:3001/health
   - Should show: `"database": "connected"`

3. **Test registration:**
   - Use the frontend at http://localhost:3002
   - Try registering a new user

---

## 📝 Quick Reference

**Database Name:** `car_price_predictor`
**Default User:** `postgres`
**Default Port:** `5432`
**Config File:** `backend-node/.env`

---

**Need Help?** Check the error message in the Auth Backend PowerShell window for specific issues.
