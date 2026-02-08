# Authentication Testing Guide

## 🚀 Quick Start

### 1. Install Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

**New dependencies will be installed:**
- `python-jose[cryptography]` - For JWT tokens
- `passlib[bcrypt]` - For password hashing

### 2. Start Backend Server
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will:
- Create `users.db` SQLite database automatically
- Initialize users table on first run
- Start on `http://localhost:8000`

### 3. Start Frontend Server
```bash
cd frontend
npm run dev
```

Frontend will start on `http://localhost:3000`

## 🧪 Testing Steps

### Test 1: Registration
1. Navigate to: `http://localhost:3000/en/register`
2. Fill in the form:
   - Email: `test@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
3. Click "Register"
4. **Expected:**
   - Success toast appears
   - Redirects to home page (`/en`)
   - Sidebar lock icon shows dropdown with email
   - Token stored in localStorage (check DevTools → Application → Local Storage)

### Test 2: Login
1. Navigate to: `http://localhost:3000/en/login`
2. Fill in the form:
   - Email: `test@example.com`
   - Password: `password123`
3. Click "Login"
4. **Expected:**
   - Success toast appears
   - Redirects to home page
   - Sidebar shows email in account dropdown
   - Token stored in localStorage

### Test 3: Logout
1. While logged in, click the lock icon in sidebar
2. Click "Logout"
3. **Expected:**
   - Success toast: "Logged out successfully"
   - Account dropdown shows "Login" and "Register" again
   - Token removed from localStorage
   - User state cleared

### Test 4: Token Persistence
1. Login with valid credentials
2. Refresh the page (F5)
3. **Expected:**
   - Still logged in
   - Sidebar still shows email
   - Token persists in localStorage

### Test 5: Invalid Credentials
1. Navigate to login page
2. Enter wrong password
3. Click "Login"
4. **Expected:**
   - Error toast: "Incorrect email or password"
   - Stays on login page
   - Not logged in

### Test 6: Password Validation (Register)
1. Navigate to register page
2. Enter passwords that don't match
3. Click "Register"
4. **Expected:**
   - Error toast: "Passwords do not match"
   - Form not submitted

### Test 7: Password Length Validation
1. Navigate to register page
2. Enter password less than 6 characters
3. Click "Register"
4. **Expected:**
   - Error toast: "Password must be at least 6 characters"
   - Form not submitted

### Test 8: Duplicate Email
1. Try to register with an email that already exists
2. Click "Register"
3. **Expected:**
   - Error toast: "Email already registered"
   - Form not submitted

### Test 9: API Token in Requests
1. Login successfully
2. Open browser DevTools → Network tab
3. Make any API call (e.g., navigate to Predict page)
4. Check request headers
5. **Expected:**
   - `Authorization: Bearer <token>` header present
   - Token matches localStorage value

### Test 10: Protected Endpoint
1. While logged in, check browser console
2. API calls should succeed
3. Logout
4. Try to access protected features
5. **Expected:**
   - `/api/auth/me` returns 401 if called without token
   - Frontend handles auth errors gracefully

## 🔍 Verification Checklist

### Backend
- [ ] Database file created: `backend/users.db`
- [ ] Users table exists with columns: `id`, `email`, `password_hash`, `created_at`, `updated_at`
- [ ] Passwords are hashed (not plain text) in database
- [ ] Endpoints accessible:
  - [ ] `POST /api/auth/register` - Returns token and user
  - [ ] `POST /api/auth/login` - Returns token and user
  - [ ] `POST /api/auth/logout` - Clears cookie
  - [ ] `GET /api/auth/me` - Returns user info when authenticated

### Frontend
- [ ] Login page accessible: `/[locale]/login`
- [ ] Register page accessible: `/[locale]/register`
- [ ] Forms validate input correctly
- [ ] Loading states show during API calls
- [ ] Error messages display properly
- [ ] Success redirects work
- [ ] Sidebar reflects login state:
  - [ ] Shows email when logged in
  - [ ] Shows Login/Register when logged out
- [ ] Token stored in localStorage
- [ ] Token included in API requests
- [ ] No "Coming Soon" messages

## 🐛 Troubleshooting

### Backend Issues

**ModuleNotFoundError: No module named 'jose'**
```bash
cd backend
pip install -r requirements.txt
```

**Database locked error**
- Close any other processes accessing `users.db`
- Restart backend server

**Port 8000 already in use**
- Change port in `backend/app/config.py` or use: `uvicorn app.main:app --port 8001`

### Frontend Issues

**Build errors about missing translations**
- Ensure `auth` section exists in all language files (`en.json`, `ar.json`, `ku.json`)

**Token not persisting**
- Check browser localStorage (DevTools → Application → Local Storage)
- Ensure `withCredentials: true` in axios config

**CORS errors**
- Ensure backend CORS middleware allows frontend origin
- Check `backend/app/main.py` CORS settings

## 📝 API Endpoints Reference

### POST /api/auth/register
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
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

### POST /api/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as register

### POST /api/auth/logout
**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/auth/me
**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com"
}
```

## ✅ Success Criteria

All tests pass when:
1. ✅ Users can register with email/password
2. ✅ Users can login and receive JWT tokens
3. ✅ Tokens persist across page refreshes
4. ✅ Sidebar shows real login state
5. ✅ Logout clears tokens and state
6. ✅ API requests include Authorization header
7. ✅ No "Coming Soon" notifications appear
8. ✅ Forms validate input correctly
9. ✅ Error messages are user-friendly
10. ✅ Database stores hashed passwords

## 🎯 Next Steps (Optional Enhancements)

- [ ] Add password reset functionality
- [ ] Add email verification
- [ ] Add remember me option
- [ ] Add social login (Google, Facebook)
- [ ] Add user profile page
- [ ] Add saved cars per user
- [ ] Add prediction history per user









