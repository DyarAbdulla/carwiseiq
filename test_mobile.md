# Mobile Testing Guide for Streamlit App

## Quick Test Commands

### 1. Run with Network Access (for real device testing)
```bash
streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

Then access from your phone at: `http://YOUR_COMPUTER_IP:8501`

### 2. Find Your IP Address

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" (e.g., 192.168.1.100)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```
or
```bash
hostname -I
```

## Browser DevTools Testing

### Chrome/Edge:
1. Press `F12` to open DevTools
2. Press `Ctrl+Shift+M` (Windows) or `Cmd+Option+M` (Mac)
3. Select device from dropdown or set custom width

### Firefox:
1. Press `F12` to open DevTools
2. Press `Ctrl+Shift+M` (Windows) or `Cmd+Option+M` (Mac)
3. Select device preset

## Test These Screen Sizes:

- **Small Phone:** 320px, 360px
- **Standard Phone:** 375px (iPhone SE), 390px (iPhone 12/13)
- **Large Phone:** 414px (iPhone Plus), 428px (iPhone Pro Max)
- **Tablet:** 768px (iPad), 1024px (iPad Pro)

## What to Check:

✅ Buttons are tappable (min 44px height)
✅ Text is readable (16px+ font size)
✅ Columns stack vertically
✅ No horizontal scrolling
✅ Forms are easy to use
✅ Sidebar works properly
✅ Images scale correctly

## Mobile-Specific Features to Test:

1. **Touch Targets:** All buttons/inputs should be at least 44x44px
2. **Font Size:** Inputs should be 16px+ to prevent iOS zoom
3. **Column Stacking:** 3-column layouts should stack on mobile
4. **Sidebar:** Should be accessible and usable
5. **Scrolling:** Should be smooth and natural

