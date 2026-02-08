# Complete Automated Setup Guide

Everything is automated! Just follow these steps.

## 🎯 One-Command Setup

### Windows (Easiest)
```bash
# From project root
SETUP_AUTH.bat

# OR from backend-node directory
cd backend-node
INSTALL.bat
```

### Cross-Platform
```bash
cd backend-node
npm run setup
```

## 📋 What Gets Set Up Automatically

1. ✅ **Dependencies** - All npm packages installed
2. ✅ **Environment File** - `.env` created from template
3. ✅ **JWT Secret** - Automatically generated and added to `.env`
4. ✅ **Database Schema** - Ready to run (you just need to create the database)

## 🔧 Manual Steps Required

You only need to do these 3 things:

### 1. Edit `.env` File

Open `backend-node/.env` and set:
- `DB_PASSWORD` - Your PostgreSQL password

Everything else is already configured!

### 2. Create PostgreSQL Database

```bash
psql -U postgres
```

Then run:
```sql
CREATE DATABASE car_price_predictor;
\q
```

### 3. Setup Database Schema

```bash
cd backend-node
npm run setup-db
```

## 🚀 Start the Server

```bash
cd backend-node
npm run dev
```

Or use the batch file:
```bash
start.bat
```

## ✅ Test Everything

```bash
npm run test-auth
```

This will test all endpoints and verify everything works!

## 📝 Frontend Configuration

Add to `frontend/.env.local`:
```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
```

## 🎉 That's It!

Your authentication system is now ready to use!

## 📚 Available Commands

```bash
npm run setup          # Run automated setup
npm run setup-db       # Setup database schema
npm run generate-secret # Generate new JWT secret
npm run test-auth      # Test all endpoints
npm run dev            # Start development server
npm start              # Start production server
```

## 🔍 Troubleshooting

### "Cannot find module"
```bash
npm install
```

### "Database connection failed"
- Check PostgreSQL is running
- Verify DB_PASSWORD in `.env`
- Ensure database exists: `CREATE DATABASE car_price_predictor;`

### "Port already in use"
- Change PORT in `.env`
- Or kill the process: `netstat -ano | findstr :3001`

## 📞 Need Help?

1. Check `README_SETUP.md` for detailed instructions
2. Check `AUTH_SETUP_GUIDE.md` for comprehensive guide
3. Run `npm run test-auth` to diagnose issues

---

**Setup Time:** ~5 minutes  
**Difficulty:** Easy (mostly automated)








