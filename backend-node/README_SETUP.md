# Complete Setup Guide - Do It Yourself

This guide will help you set up the authentication system completely.

## 🚀 Quick Setup (Automated)

### Windows
```bash
# Run the automated setup script
setup.bat
```

### PowerShell
```powershell
# Run PowerShell setup script
.\setup.ps1
```

### Cross-Platform (Node.js)
```bash
# Run Node.js setup script
npm run setup
```

## 📋 Manual Setup Steps

### Step 1: Install Dependencies

```bash
cd backend-node
npm install
```

### Step 2: Configure Environment

1. Copy the example environment file:
   ```bash
   # Windows
   copy .env.example .env
   
   # Linux/macOS
   cp .env.example .env
   ```

2. Generate JWT Secret:
   ```bash
   npm run generate-secret
   ```
   Copy the generated secret.

3. Edit `.env` file and set:
   - `DB_PASSWORD` - Your PostgreSQL password
   - `JWT_SECRET` - Paste the generated secret
   - Other settings as needed

### Step 3: Setup PostgreSQL Database

1. **Install PostgreSQL** (if not installed):
   - Windows: Download from https://www.postgresql.org/download/windows/
   - macOS: `brew install postgresql`
   - Linux: `sudo apt-get install postgresql`

2. **Start PostgreSQL service**:
   - Windows: Check Services (services.msc) for PostgreSQL service
   - macOS: `brew services start postgresql`
   - Linux: `sudo systemctl start postgresql`

3. **Create database**:
   ```bash
   psql -U postgres
   ```
   Then in PostgreSQL:
   ```sql
   CREATE DATABASE car_price_predictor;
   \q
   ```

### Step 4: Setup Database Schema

```bash
npm run setup-db
```

This will create the `users` table with all necessary indexes.

### Step 5: Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Or use the Windows batch file:
```bash
start.bat
```

The server will start on `http://localhost:3001`

### Step 6: Test the Setup

```bash
npm run test-auth
```

This will test all endpoints and verify everything is working.

### Step 7: Configure Frontend

Add to your frontend `.env.local` file:
```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
```

## ✅ Verification Checklist

- [ ] Node.js installed (`node --version`)
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created and configured
- [ ] JWT_SECRET generated and set
- [ ] PostgreSQL installed and running
- [ ] Database `car_price_predictor` created
- [ ] Database schema setup (`npm run setup-db`)
- [ ] Server starts without errors (`npm run dev`)
- [ ] Health check passes (`curl http://localhost:3001/health`)
- [ ] Test suite passes (`npm run test-auth`)
- [ ] Frontend `.env.local` configured

## 🔧 Troubleshooting

### Database Connection Error

**Error:** `Connection refused` or `password authentication failed`

**Solution:**
1. Verify PostgreSQL is running
2. Check credentials in `.env`
3. Test connection: `psql -U postgres -d car_price_predictor`

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
1. Change PORT in `.env` to a different port
2. Or kill the process using port 3001

### Module Not Found

**Error:** `Cannot find module 'express'`

**Solution:**
```bash
npm install
```

### JWT_SECRET Not Set

**Error:** `JWT_SECRET is not defined`

**Solution:**
```bash
npm run generate-secret
# Copy the output and add to .env
```

## 📝 Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| DB_HOST | PostgreSQL host | No | localhost |
| DB_PORT | PostgreSQL port | No | 5432 |
| DB_NAME | Database name | No | car_price_predictor |
| DB_USER | Database user | No | postgres |
| DB_PASSWORD | Database password | **Yes** | - |
| JWT_SECRET | JWT signing secret | **Yes** | - |
| PORT | Server port | No | 3001 |
| HOST | Server host | No | 0.0.0.0 |
| NODE_ENV | Environment | No | development |
| FRONTEND_URL | Frontend URL for CORS | No | http://localhost:3000 |

## 🎯 Next Steps After Setup

1. ✅ Test registration: `curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}'`
2. ✅ Test login: `curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}'`
3. ✅ Test in frontend: Go to login/register pages
4. ✅ Integrate with your application

## 📚 Additional Resources

- **Full Setup Guide**: `AUTH_SETUP_GUIDE.md`
- **Backend README**: `README.md`
- **Quick Start**: `QUICK_START.md`
- **System Summary**: `../AUTH_SYSTEM_SUMMARY.md`

---

**Need Help?** Check the troubleshooting section or review the logs for specific error messages.








