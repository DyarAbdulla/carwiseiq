# Car Price Predictor - Authentication API

Node.js/Express authentication backend with PostgreSQL for the Car Price Predictor application.

## Features

- ✅ User registration with email validation
- ✅ Secure password hashing with bcryptjs (10 salt rounds)
- ✅ JWT token authentication (24h expiration)
- ✅ Token verification endpoint
- ✅ Rate limiting for auth endpoints
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configuration
- ✅ Security headers (Helmet)
- ✅ Input validation (express-validator)

## Prerequisites

- Node.js 16+ and npm
- PostgreSQL 12+ installed and running
- PostgreSQL database created

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and configure:
- Database connection (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
- JWT_SECRET (generate a strong random string)
- PORT (default: 3001)
- FRONTEND_URL (for CORS)

3. **Create database:**
```bash
# Connect to PostgreSQL and create database
psql -U postgres
CREATE DATABASE car_price_predictor;
\q
```

4. **Run database schema:**
```bash
# Option 1: Using the setup script
npm run setup-db

# Option 2: Using psql directly
psql -U postgres -d car_price_predictor -f schema.sql
```

## Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3001` (or your configured PORT).

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
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### GET /api/auth/verify
Verify JWT token (requires Authorization header).

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
Get current authenticated user information (requires Authorization header).

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

1. **Password Requirements:**
   - Minimum 6 characters
   - Bcrypt hashing with 10 salt rounds

2. **Email Validation:**
   - Format validation using express-validator
   - Email normalization (lowercase, trimmed)
   - Unique constraint in database

3. **SQL Injection Prevention:**
   - All queries use parameterized statements
   - No string concatenation in SQL queries

4. **Rate Limiting:**
   - 5 requests per 15 minutes per IP for auth endpoints
   - Prevents brute force attacks

5. **CORS Configuration:**
   - Configurable allowed origins
   - Credentials support

6. **Security Headers:**
   - Helmet.js for security headers
   - XSS protection
   - Content Security Policy

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_NAME | Database name | car_price_predictor |
| DB_USER | Database user | postgres |
| DB_PASSWORD | Database password | (required) |
| JWT_SECRET | Secret key for JWT | (required) |
| PORT | Server port | 3001 |
| HOST | Server host | 0.0.0.0 |
| NODE_ENV | Environment | development |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:3000 |

## Generating JWT Secret

Generate a strong random secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Testing

Test the API using curl:

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Verify token (replace TOKEN with actual token)
curl -X GET http://localhost:3001/api/auth/verify \
  -H "Authorization: Bearer TOKEN"
```

## Project Structure

```
backend-node/
├── config/
│   └── db.js              # Database configuration and connection pool
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   └── auth.js            # Authentication routes
├── scripts/
│   └── setup-db.js        # Database setup script
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore file
├── package.json          # Dependencies and scripts
├── schema.sql            # Database schema
├── server.js             # Main server file
└── README.md             # This file
```

## Troubleshooting

**Database connection error:**
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists: `CREATE DATABASE car_price_predictor;`

**JWT_SECRET not set:**
- Generate a secret and add it to `.env`
- Never commit `.env` to version control

**Port already in use:**
- Change PORT in `.env` or kill the process using the port

**CORS errors:**
- Verify FRONTEND_URL matches your frontend URL
- Check browser console for specific CORS error

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a strong, unique `JWT_SECRET`
3. Configure proper CORS origins (not `*`)
4. Use HTTPS
5. Set up proper database backups
6. Configure rate limiting appropriately
7. Monitor logs and errors
8. Use environment-specific `.env` files

## License

MIT








