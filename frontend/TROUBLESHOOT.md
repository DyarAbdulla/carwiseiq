# Frontend Troubleshooting Guide

## If Frontend Shows Blank Page or Errors

### Step 1: Check PowerShell Window
Look at the Frontend PowerShell window and check for:
- ✅ "✓ Ready" - Server is ready
- ✅ "✓ Compiled" - Pages compiled successfully
- ❌ Red error messages - There's a problem

### Step 2: Check Browser Console
1. Open browser: http://localhost:3002
2. Press `F12` to open Developer Tools
3. Go to "Console" tab
4. Look for red error messages
5. Copy the error messages

### Step 3: Common Fixes

**If you see "Cannot read properties of undefined":**
```powershell
cd frontend
# Stop server (Ctrl+C in PowerShell window)
# Then:
npm run clean:win
npm run dev
```

**If you see module not found errors:**
```powershell
cd frontend
npm install
npm run dev
```

**If page is completely blank:**
1. Hard refresh: `Ctrl + Shift + R`
2. Clear browser cache: `Ctrl + Shift + Delete`
3. Try incognito/private mode

### Step 4: Complete Reset
```powershell
cd frontend
# Stop server first (Ctrl+C)
Get-Process node | Stop-Process -Force
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force .next-cache
Remove-Item -Recurse -Force node_modules\.cache
npm run dev
```

## Check What's Wrong

1. **What error do you see?**
   - Blank page?
   - Error message?
   - Browser console errors?

2. **What does PowerShell window show?**
   - Any red errors?
   - Does it say "Ready"?

3. **Which browser?**
   - Chrome?
   - Edge?
   - Firefox?
