# Car Price Predictor Pro - Frontend

Next.js 14 frontend application with TypeScript, React, and internationalization support.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Backend services running:
  - ML Backend (Python FastAPI) on `http://localhost:8000`
  - Auth Backend (Node.js Express) on `http://localhost:3001`

### First Time Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm ci
   ```

2. **Set up environment variables:**
   ```bash
   # Copy the example file
   copy .env.example .env.local

   # Edit .env.local if your backend URLs differ from defaults
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3002`

## 📋 Available Scripts

- `npm run dev` - Start development server (cleans cache first)
- `npm run build` - Build for production (cleans cache first)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run clean:win` - Clean Next.js cache (Windows)

## 🔄 After Reboot

**IMPORTANT:** Follow these steps every time you restart your PC or reopen the project:

### Step 1: Navigate to Frontend Directory
```bash
cd "C:\Car price prection program Local E\frontend"
```

### Step 2: Install Dependencies (if needed)
```bash
# Use npm ci for exact versions (recommended if package-lock.json exists)
npm ci

# OR if npm ci fails, use:
npm install
```

### Step 3: Clean Cache (if experiencing issues)
```bash
# Delete .next folder manually or use:
npm run clean:win
```

### Step 4: Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:3002`

### Troubleshooting After Reboot

**If you see "module not found" errors:**
```bash
# Delete node_modules and reinstall
rmdir /s /q node_modules
npm ci
```

**If build fails:**
```bash
# Clean all caches
npm run clean:win
rmdir /s /q node_modules\.cache
npm run build
```

**If port 3002 is already in use:**
- Stop any running Node.js processes
- Or change the port in `package.json` dev script

## 🌐 Environment Variables

Required environment variables (see `.env.example`):

- `NEXT_PUBLIC_API_BASE_URL` - ML Backend API URL (default: `http://localhost:8000`)
- `NEXT_PUBLIC_AUTH_API_URL` - Auth Backend API URL (default: `http://localhost:3001`)

**Note:** `.env.local` is gitignored. Copy `.env.example` to `.env.local` and update values as needed.

## 🏗️ Project Structure

```
frontend/
├── app/                    # Next.js app directory
│   └── [locale]/          # Internationalized routes
│       ├── page.tsx       # Home page
│       ├── predict/       # Prediction page
│       ├── batch/         # Batch prediction
│       ├── compare/       # Car comparison
│       ├── budget/        # Budget finder
│       ├── stats/         # Statistics
│       └── sell/          # Sell car page
├── components/            # React components
├── lib/                   # Utilities and API client
├── messages/              # i18n translation files
├── public/                # Static assets
├── middleware.ts         # Next.js middleware for i18n
├── next.config.js        # Next.js configuration
└── package.json          # Dependencies
```

## 🔧 Build & Deployment

### Production Build
```bash
npm run build
```

### Start Production Server
```bash
npm run start
```

## 📝 Notes

- The app uses `next-intl` for internationalization (English, Kurdish, Arabic)
- All routes are prefixed with locale (`/en`, `/ku`, `/ar`)
- React Hooks must be called unconditionally (no hooks after conditional returns)
- The build process automatically cleans cache before building

## 🐛 Common Issues

**"Rendered more hooks than during the previous render"**
- Ensure all hooks are called before any conditional returns
- Check that hooks are not inside if/for/while blocks

**404 errors for Next.js chunks**
- Middleware is configured to exclude `/_next` paths
- Clear cache: `npm run clean:win`

**Build warnings about `env._next_intl_trailing_slash`**
- This is a harmless warning from next-intl v3
- Can be safely ignored
