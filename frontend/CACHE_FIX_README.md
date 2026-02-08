# Next.js Build Cache Error Fix

## Problem
If you see errors like:
```
Error: Cannot find module './869.js'
Error: Cannot find module './329.js'
```

This is a Next.js build cache corruption issue.

## Quick Fix

### Option 1: Manual cleanup (recommended when you see cache errors)
```powershell
npm run clean:win
npm run dev
```

### Option 2: Clean build (for production when cache is corrupted)
```powershell
npm run build:clean
```

## What Changed (Performance)

- **`npm run dev`** no longer clears cache or runs kill-port — faster startup and hot reload. Use `npm run dev:with-kill` if port 3002 is stuck.
- **`npm run build`** no longer clears cache — faster production builds. Use `npm run build:clean` only when you see cache corruption.
- Webpack watch and snapshot options are tuned to reduce unnecessary recompiles.
- Use `npm run dev:turbo` for Turbopack (faster HMR when compatible).

## If Errors Still Occur

1. Stop the dev server (Ctrl+C)
2. Run: `npm run clean:win`
3. Run: `npm run dev`

This should resolve cache-related errors. Do **not** run clean before every dev or build; it slows everything down.









