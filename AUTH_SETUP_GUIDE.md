# Authentication System Setup Guide

Complete guide for setting up the Node.js/Express authentication system with PostgreSQL for the Car Price Predictor app.

## Overview

This authentication system provides:
- User registration with email validation
- Secure password hashing (bcryptjs, 10 salt rounds)
- JWT token authentication (24h expiration)
- Token verification endpoint
- Rate limiting for security
- SQL injection prevention
- CORS configuration
- Security headers

## Architecture

- **Backend**: Node.js/Express API (`backend-node/`)
- **Database**: PostgreSQL
- **Frontend**: Next.js (existing frontend updated to use new API)

## Prerequisites

1. **Node.js** 16+ installed
2. **PostgreSQL** 12+ installed and running
3. **npm** or **yarn** package manager

## Step 1: Install PostgreSQL

### Windows
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the postgres user password you set during installation

### macOS
```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## Step 2: Create Database

1. **Open PostgreSQL command line:**
```bash
psql -U postgres
```

2. **Create database:**
```sql
CREATE DATABASE car_price_predictor;
\q
```

## Step 3: Setup Backend

1. **Navigate to backend directory:**
```bash
cd backend-node
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

4. **Edit `.env` file** with your configuration:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=car_price_predictor
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

5. **Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output and paste it as `JWT_SECRET` in your `.env` file.

## Step 4: Setup Database Schema

Run the database setup script:
```bash
npm run setup-db
```

Or manually run the SQL file:
```bash
psql -U postgres -d car_price_predictor -f schema.sql
```

## Step 5: Start the Authentication Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server should start on `http://localhost:3001`

## Step 6: Configure Frontend

1. **Add environment variable** to your frontend `.env.local`:
```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
```

2. **The frontend is already configured** to use the new authentication API. The login and register pages will automatically use the Node.js backend.

## Step 7: Test the Setup

### Test Registration
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected response:
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Token Verification
```bash
# Replace TOKEN with the actual token from registration/login
curl -X GET http://localhost:3001/api/auth/verify \
  -H "Authorization: Bearer TOKEN"
```

### Test Health Check
```bash
curl http://localhost:3001/health
```

## API Endpoints

### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### POST /api/auth/login
Authenticate user and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /api/auth/verify
Verify JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /api/auth/me
Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

## Security Features

### Password Requirements
- Minimum 6 characters
- Bcrypt hashing with 10 salt rounds

### Email Validation
- Format validation using express-validator
- Email normalization (lowercase, trimmed)
- Unique constraint in database

### SQL Injection Prevention
- All queries use parameterized statements
- No string concatenation in SQL queries

### Rate Limiting
- 5 requests per 15 minutes per IP for auth endpoints
- Prevents brute force attacks

### CORS Configuration
- Configurable allowed origins
- Credentials support

### Security Headers
- Helmet.js for security headers
- XSS protection
- Content Security Policy

## Troubleshooting

### Database Connection Error
**Error:** `Connection refused` or `password authentication failed`

**Solutions:**
1. Verify PostgreSQL is running:
   ```bash
   # Windows
   services.msc (look for PostgreSQL service)
   
   # Linux/macOS
   sudo systemctl status postgresql
   ```

2. Check database credentials in `.env`
3. Verify database exists:
   ```sql
   psql -U postgres -l
   ```

4. Test connection manually:
   ```bash
   psql -U postgres -d car_price_predictor
   ```

### Port Already in Use
**Error:** `EADDRINUSE: address already in use :::3001`

**Solutions:**
1. Change PORT in `.env` to a different port (e.g., 3002)
2. Or kill the process using port 3001:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   
   # Linux/macOS
   lsof -ti:3001 | xargs kill
   ```

### JWT_SECRET Not Set
**Error:** `JWT_SECRET is not defined`

**Solution:**
1. Generate a secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Add it to `.env` file

### CORS Errors in Browser
**Error:** `Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**Solutions:**
1. Verify `FRONTEND_URL` in `.env` matches your frontend URL
2. Check browser console for specific CORS error
3. Ensure frontend is making requests to correct API URL

### Token Verification Fails
**Error:** `Invalid token` or `Token expired`

**Solutions:**
1. Check token is being sent in Authorization header:
   ```
   Authorization: Bearer <token>
   ```
2. Verify token hasn't expired (24h expiration)
3. Check JWT_SECRET matches between server restarts

## Production Deployment

### Environment Variables
Set these in your production environment:
```env
NODE_ENV=production
DB_HOST=your_production_db_host
DB_NAME=car_price_predictor
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
JWT_SECRET=your_production_jwt_secret
FRONTEND_URL=https://your-frontend-domain.com
PORT=3001
```

### Security Checklist
- [ ] Use strong, unique JWT_SECRET
- [ ] Use HTTPS in production
- [ ] Configure proper CORS origins (not `*`)
- [ ] Set up database backups
- [ ] Use environment-specific `.env` files
- [ ] Enable rate limiting appropriately
- [ ] Monitor logs and errors
- [ ] Use connection pooling (already configured)
- [ ] Set up SSL for PostgreSQL in production

### Database Backups
```bash
# Backup database
pg_dump -U postgres car_price_predictor > backup.sql

# Restore database
psql -U postgres car_price_predictor < backup.sql
```

## File Structure

```
backend-node/
├── config/
│   └── db.js              # Database configuration
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   └── auth.js            # Authentication routes
├── scripts/
│   └── setup-db.js        # Database setup script
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore file
├── package.json          # Dependencies
├── schema.sql            # Database schema
├── server.js             # Main server file
└── README.md             # Backend documentation

frontend/
├── lib/
│   └── api.ts            # Updated to use Node.js auth API
├── hooks/
│   └── use-auth.ts       # Auth hook (updated)
└── app/[locale]/
    ├── login/
    │   └── page.tsx      # Login page (uses new API)
    └── register/
        └── page.tsx      # Register page (uses new API)
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify all environment variables are set correctly
4. Test database connection independently

## Next Steps

After setup is complete:
1. Test registration and login through the frontend
2. Verify token storage in localStorage
3. Test protected routes (if any)
4. Set up production environment
5. Configure monitoring and logging








