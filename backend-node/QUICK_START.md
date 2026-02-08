# Quick Start Guide

Get the authentication system running in 5 minutes!

## Prerequisites Check

- [ ] Node.js 16+ installed (`node --version`)
- [ ] PostgreSQL installed and running
- [ ] npm installed (`npm --version`)

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Database
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE car_price_predictor;
\q
```

### 3. Configure Environment
```bash
# Copy example file
cp .env.example .env

# Edit .env and set:
# - DB_PASSWORD (your PostgreSQL password)
# - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
```

### 4. Setup Database Schema
```bash
npm run setup-db
```

### 5. Start Server
```bash
npm run dev
```

Server should be running on `http://localhost:3001` ✅

## Test It

```bash
# Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Frontend Configuration

Add to your frontend `.env.local`:
```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
```

That's it! 🎉








