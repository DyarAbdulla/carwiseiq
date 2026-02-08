# Dataset Management UI Flow Guide

## Complete User Flow

### 1. **First Time Setup - Scan Your Dataset**

**Location:** Top of the right column on the Predict page

**What you see:**
- A prominent blue card titled "Dataset Management"
- Large "Scan Dataset" button with scan icon
- Message: "First time? Click 'Scan Dataset' to index your 600,000+ car images"

**Steps:**
1. Click the **"Scan Dataset"** button
2. Button changes to "Scanning Dataset..." (disabled)
3. Progress message appears: "Scanning in progress... This may take several minutes"
4. Status updates show: "X images indexed" and "Last scan: [date/time]"
5. Click "Refresh Status" to check progress

**Note:** Scanning runs in the background. For 600K+ images, this may take 10-30 minutes.

---

### 2. **Using Images in Predictions**

**When it appears:**
- The "Car Images" section appears **after** you start filling out the form (Step 1: Car Basics)
- It shows once you've entered at least a Make in the form

**Location:** Right column, below the "Dataset Management" card

**What you see:**
- Card titled "Car Images (Optional)"
- Two tabs:
  - **"Upload Image"** tab (default)
  - **"Choose from Dataset"** tab

---

### 3. **Tab 1: Upload Image**

**Features:**
- Drag & drop area for uploading images
- Click to browse files
- Supports: PNG, JPG, WEBP (max 5MB each, up to 10 images)
- Shows preview grid of selected images
- Remove individual images with × button

---

### 4. **Tab 2: Choose from Dataset**

**Prerequisites:**
- Dataset must be scanned first (see Step 1)
- If not scanned, you'll see a tip: "💡 Tip: Scan your dataset first..."

**Features:**
- Search bar: Search by filename or folder path
- View modes: Grid view (default) or List view
- Pagination: 100 images per page
- Status: Shows total images indexed at top
- Click any image to select it
- Selected image automatically:
  - Converts to File object
  - Goes through background removal
  - Appears in the preview grid
  - Switches back to "Upload Image" tab to show it

**How to browse:**
1. Click "Choose from Dataset" tab
2. Use search to find specific images (e.g., "toyota", "camry")
3. Browse pages using pagination controls
4. Click any image thumbnail to select it
5. Image appears in your preview grid

---

## Visual Layout

```
┌─────────────────────────────────────────────────┐
│  Left Column (Form)    │  Right Column (Content)│
│                        │                        │
│  [CompactWizardCard]   │  ┌──────────────────┐ │
│  - Step 1: Car Basics  │  │ Dataset Mgmt Card│ │
│  - Step 2: Specs       │  │ [Scan Dataset]   │ │
│  - Step 3: Condition   │  │ Status: X images │ │
│                        │  └──────────────────┘ │
│                        │                        │
│                        │  ┌──────────────────┐ │
│                        │  │ Car Images Card  │ │
│                        │  │ [Upload][Dataset]│ │
│                        │  │                  │ │
│                        │  │ [Tab Content]    │ │
│                        │  └──────────────────┘ │
│                        │                        │
│                        │  [Results appear here]│
└────────────────────────┴────────────────────────┘
```

---

## Quick Reference

### Where is the Scan Dataset button?
- **Location:** Top of right column
- **Card:** "Dataset Management" (blue highlighted card)
- **Button:** Large blue button with scan icon

### When does image upload appear?
- **Condition:** After you enter at least a Make in Step 1
- **Location:** Right column, below Dataset Management card
- **Always visible:** Dataset Management card (for scanning)

### How to browse dataset images?
1. Fill out at least Make in the form
2. Go to "Car Images" card
3. Click "Choose from Dataset" tab
4. Search or browse pages
5. Click image to select

### What happens when I select a dataset image?
1. Image is fetched from your indexed dataset
2. Converted to File object
3. Added to your image previews
4. Goes through background removal (if enabled)
5. Appears in preview grid
6. Can be used in prediction

---

## Troubleshooting

**Q: I don't see "Choose from Dataset" tab**
- Make sure you've scanned the dataset first
- Check that you've entered at least a Make in the form

**Q: Scan button doesn't work**
- Check backend server is running
- Check console for errors
- Verify dataset paths in config.py are correct

**Q: No images in dataset browser**
- Click "Scan Dataset" first
- Wait for scanning to complete
- Click "Refresh Status" to update count

**Q: Images not loading**
- Check backend API is accessible
- Verify image files exist at configured paths
- Check browser console for CORS errors
