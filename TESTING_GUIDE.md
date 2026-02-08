# 🧪 Batch Prediction Features - Testing Guide

## 🚀 Server Status
Dev server should be running on: `http://localhost:3002`

## 📋 Step-by-Step Testing Checklist

### 1. Navigate to Batch Page ✅
**URL**: `http://localhost:3002/en/batch` (or your locale)

**Expected**: 
- Page loads without errors
- All sections visible (Bulk URL, URL Prediction, CSV Upload, Price Alerts)
- No console errors

**Check Console**: Open DevTools (F12) → Console tab
- Should see no red errors
- Any warnings are acceptable

---

### 2. Test URL Prediction with Platform Detection ✅

**Steps**:
1. Scroll to "Predict Price from Car Listing URL" section
2. Paste a URL: `https://www.iqcars.net/en/car/example`
3. Watch for platform badge to appear immediately

**Expected**:
- ✅ Platform badge appears (IQCars logo + name)
- ✅ Badge shows on right side of input field
- ✅ Loading stages appear when clicking "Analyze"
- ✅ 3 stages: Scraping → Extracting → Calculating
- ✅ Progress bar animates smoothly
- ✅ Results card appears with:
  - Predicted price (large, highlighted)
  - Comparison table (if listing price available)
  - View Original Listing button
  - Full car details grid

**Test Multiple Platforms**:
- `https://www.iqcars.net/...` → IQCars badge
- `https://www.dubizzle.com/...` → Dubizzle badge
- `https://www.syarah.com/...` → Syarah badge

---

### 3. Test CSV Upload & Batch Processing ✅

**Steps**:
1. Scroll to "Upload CSV File" section
2. Drag & drop a CSV file OR click to browse
3. File should validate automatically
4. Click "Process" button
5. Watch progress bar

**Expected**:
- ✅ Drag & drop zone highlights on hover
- ✅ File validation (size, extension, columns)
- ✅ Progress bar shows: "Processing X/Y cars..."
- ✅ Percentage updates in real-time
- ✅ Results table appears when complete

**Create Test CSV** (save as `test_cars.csv`):
```csv
year,mileage,engine_size,cylinders,make,model,condition,fuel_type,location
2020,30000,2.5,4,Toyota,Camry,Good,Gasoline,California
2019,45000,3.5,6,Honda,Accord,Excellent,Gasoline,New York
2021,15000,2.0,4,Ford,Fusion,Very Good,Hybrid,Texas
```

---

### 4. Verify Charts Rendering ✅

**After processing CSV**:

**Expected Charts**:
1. ✅ **Price Distribution Bar Chart**
   - X-axis: Price ranges ($0-10k, $10k-20k, etc.)
   - Y-axis: Number of cars
   - Blue gradient bars
   - Interactive tooltip on hover

2. ✅ **Deal Quality Pie Chart**
   - Segments: Good (green), Fair (yellow), Poor (red)
   - Shows percentages
   - Hover tooltips work

3. ✅ **Confidence Score Histogram**
   - X-axis: Confidence ranges (0-20%, 20-40%, etc.)
   - Y-axis: Count
   - Purple bars

4. ✅ **Best/Worst Deals Cards**
   - Best Deal: Green card with ⭐
   - Worst Deal: Red card with ⚠️
   - Shows car details

**Check**: Scroll to "Analytics Dashboard" section

---

### 5. Test Search & Filters ✅

**Steps**:
1. Click "Filters & Search" button (collapsible)
2. Test each filter:

**Search Box**:
- Type "Toyota" → Results filter in real-time
- Type "Camry" → Should show only Camry results

**Make Filter**:
- Select "Toyota" from dropdown
- Badge appears
- Results filter to Toyota only

**Model Filter** (appears after selecting make):
- Select "Camry"
- Multiple models can be selected

**Condition Checkboxes**:
- Click "Good", "Excellent"
- Multiple can be selected

**Price Range Slider**:
- Drag sliders to set min/max price
- Results update instantly

**Year Range Slider**:
- Set year range (e.g., 2019-2021)

**Reset Button**:
- Click "Reset" → All filters clear

**Expected**:
- ✅ All filters work independently
- ✅ Multiple filters combine (AND logic)
- ✅ Results update in real-time
- ✅ Reset clears everything

---

### 6. Test Compare Mode (Select 2-4 Cars) ✅

**Steps**:
1. In results table, check 2 checkboxes in "Compare" column
2. Compare banner appears at top
3. Click "Compare Selected" button
4. Side-by-side comparison view opens

**Expected**:
- ✅ Checkbox column visible (hidden on mobile)
- ✅ Can select 2-4 cars maximum
- ✅ Compare banner shows: "2 cars selected"
- ✅ "Compare Selected" button appears
- ✅ Side-by-side cards show:
  - Make, Model, Year
  - Price (highlighted)
  - Mileage, Condition
  - Confidence, Deal rating
- ✅ Close button (X) works
- ✅ Clear button clears selection

**Test Limits**:
- Try selecting 5th car → Should not add (max 4)
- Unselect cars → Banner disappears

---

### 7. Test Export PDF ✅

**Steps**:
1. With results visible, click "Export PDF" button
2. Wait for PDF generation
3. PDF should download automatically

**Expected**:
- ✅ Button shows loading spinner while generating
- ✅ PDF downloads with filename: `car-predictions-YYYY-MM-DD.pdf`
- ✅ PDF contains:
  - Title page with date
  - Summary statistics
  - Charts (if dashboard was visible)
  - Predictions table (first 20 cars)
  - Page numbers in footer
- ✅ Toast notification: "PDF exported successfully"

**Note**: Charts only included if dashboard section is visible when exporting

---

### 8. Test Bulk URL Processing ✅

**Steps**:
1. Scroll to top → "Bulk URL Processing" section
2. Paste 3 URLs (one per line):
   ```
   https://www.iqcars.net/en/car/1
   https://www.iqcars.net/en/car/2
   https://www.iqcars.net/en/car/3
   ```
3. Click "Process URLs" button
4. Watch status updates

**Expected**:
- ✅ URL counter shows: "3 valid URLs detected"
- ✅ Status list appears showing each URL
- ✅ Status badges: ⏳ Pending → 🔄 Processing → ✅ Success
- ✅ 3 URLs process concurrently (not one-by-one)
- ✅ Each shows: URL, platform name, price (on success)
- ✅ Results added to main results table
- ✅ Toast: "Processing Complete"

**Test Limits**:
- Try pasting 11 URLs → Shows "Max 10 URLs"

---

### 9. Test Price Alerts ✅

**Steps**:
1. Scroll to "Price Alerts" section
2. Click "New Alert" button
3. Fill in form:
   - Make: "Toyota"
   - Model: "Camry"
   - Max Price: "25000"
   - Location (optional): "California"
4. Click "Create Alert"
5. Alert appears in list below

**Expected**:
- ✅ Form appears (collapsible)
- ✅ Alert created and saved
- ✅ Alert shows in list with:
  - Make, Model
  - Max price
  - Active badge (green)
  - Toggle button (bell icon)
  - Delete button (trash icon)
- ✅ Can toggle active/inactive
- ✅ Can delete alerts
- ✅ Alerts persist after page refresh (localStorage)

**Test Limits**:
- Create 10 alerts → 11th should show "Maximum 10 alerts allowed"

---

### 10. Test Mobile Responsive View ✅

**Steps**:
1. Open DevTools (F12)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select "iPhone 12 Pro" or set width to 375px
4. Refresh page
5. Navigate to batch page

**Expected**:
- ✅ Mobile card view appears instead of table
- ✅ Each car shows as vertical card:
  - Photo (if available)
  - Make, Model, Year (large)
  - Price (highlighted)
  - Mileage, Condition, Confidence
  - Deal badge
  - Heart icon (favorites)
  - "View Details" button
- ✅ Cards stack vertically
- ✅ Touch-friendly buttons (44x44px minimum)
- ✅ No horizontal scrolling
- ✅ Charts stack vertically
- ✅ Filters panel works on mobile

**Desktop Breakpoints**:
- < 768px: Card view
- ≥ 768px: Table view

---

## 🔍 Additional Feature Tests

### Confidence Breakdown ✅
- Click any confidence percentage in table
- Modal opens showing:
  - Overall confidence
  - Individual factors (Data Completeness, Historical Accuracy, Market Data)
  - Missing information warnings
  - Suggestions to improve accuracy

### Deal Quality Tooltips ✅
- Click on "Good", "Fair", or "Poor" badge
- Tooltip shows:
  - Why it's rated that way
  - Percentage difference from market
  - Action recommendation

### Error Handling ✅
- Paste invalid URL → Error message with suggestion
- Upload wrong file type → Validation error
- API timeout → Retry button appears

---

## 🐛 Common Issues & Fixes

### Issue: Charts not rendering
**Fix**: Check browser console for Recharts errors. Ensure data is valid.

### Issue: PDF export fails
**Fix**: Make sure dashboard section is visible. html2canvas needs element to be in viewport.

### Issue: Mobile view not switching
**Fix**: Check window width detection. May need to refresh after resize.

### Issue: Filters not working
**Fix**: Check if filteredResults state is updating. Look for console errors.

### Issue: Compare mode not showing
**Fix**: Ensure 2+ cars are selected. Check selectedForCompare state.

---

## ✅ Final Verification

After all tests, verify:
- [ ] No console errors (red)
- [ ] All components render
- [ ] All interactions work
- [ ] Mobile view works
- [ ] PDF exports successfully
- [ ] Data persists (favorites, alerts)
- [ ] Performance is good (no lag)

---

## 📸 What to Screenshot

If taking screenshots, capture:
1. Platform detection working (badge visible)
2. Loading stages animation
3. Charts dashboard (all 3 charts)
4. Compare mode (side-by-side view)
5. Filter panel open
6. Mobile card view
7. PDF export (the downloaded file)
8. Bulk URL processing (with status badges)
9. Price alerts list

---

**🎉 If all tests pass, the implementation is complete and working!**
