# Split-Glass Directory Redesign - Services Page

## 🎯 Goal
Transform the `/services` page from a generic card grid with modals into a **Directory-style interface** where clicking a category immediately shows a list of real companies.

## ✨ Key Changes

### 1. **Layout Strategy**

#### **Desktop (≥ 1024px):**
- **Split View:**
  - **Left Column (w-1/4):** Vertical glass menu of service categories
  - **Right Column (w-3/4):** Grid of company cards for selected category
- **Active Category:** Glows with indigo gradient and shows provider count

#### **Mobile (< 1024px):**
- **Stacked View:**
  - **Top:** Horizontal scrollable "Pills/Tabs" for categories
  - **Bottom:** Grid of company cards (1 column on mobile, 2 columns on tablet)

### 2. **Category Selection**
- **No Modal:** Companies display immediately when a category is selected
- **Auto-select:** First category is automatically selected on page load
- **Real-time Loading:** Providers load when category changes
- **Visual Feedback:** Active category has gradient background and glow effect

### 3. **Company Card Design**

**Glass Morphism Style:**
- `backdrop-blur-xl bg-white/5 border border-white/10`
- Hover effects: lift (`-translate-y-1`) + glowing border (`border-indigo-500/50`)

**Card Structure:**
1. **Header:**
   - Company logo/icon (16x16 rounded-xl with gradient background)
   - Company name (bold, white)
   - Star rating (if available)

2. **Body:**
   - **Badges:**
     - "Authorized Dealer" badge (indigo)
     - Location badges (purple) - shows "All Iraq" or specific locations
   - **Location:** Full address with map pin icon
   - **Phone:** Phone number with phone icon
   - **Working Hours:** (if available)

3. **Footer:**
   - **Call Now Button:** Full-width, green gradient (`from-green-600 to-emerald-600`)
   - **Get Location Button:** Full-width, indigo-purple gradient (`from-indigo-600 to-purple-600`)
   - Both buttons: `h-11`, rounded-xl, with shadow glow

### 4. **Search Functionality**
- **Global Search Bar:** Search across all companies in the selected category
- **Real-time Filtering:** Filters company name and address
- **Placeholder:** "Search companies..."
- **Glass Input:** Matches the design system

### 5. **Empty States**
- **No Category Selected:** "Select a category to view companies"
- **No Companies:** "No companies available for [Category] yet."
- **No Search Results:** "No companies match '[query]'"
- **Loading State:** "Loading companies..."

## 🎨 Design Tokens

### Colors:
- **Glass Background:** `bg-white/5` with `backdrop-blur-xl`
- **Glass Border:** `border-white/10`
- **Active Category:** `from-indigo-600 to-purple-600` gradient
- **Call Button:** `from-green-600 to-emerald-600` gradient
- **Location Button:** `from-indigo-600 to-purple-600` gradient

### Spacing:
- Card padding: `p-6`
- Button height: `h-11` (44px)
- Gap between cards: `gap-4 md:gap-6`
- Border radius: `rounded-xl` (12px)

### Effects:
- Hover lift: `hover:-translate-y-1`
- Shadow glow: `shadow-lg shadow-[color]/30`
- Transitions: `transition-all duration-300`

## 📱 Responsive Breakpoints

- **Mobile:** `< 768px` - Single column grid, horizontal tabs
- **Tablet:** `768px - 1023px` - Two column grid, horizontal tabs
- **Desktop:** `≥ 1024px` - Split view (sidebar + grid), vertical menu

## 🔄 Data Flow

1. **Page Load:**
   - Fetch all services (categories)
   - Fetch locations
   - Auto-select first category
   - Load providers for selected category

2. **Category Selection:**
   - Update `selectedCategory` state
   - Trigger `loadProviders()` effect
   - Display loading state
   - Show company cards when loaded

3. **Search:**
   - Filter `providers` array client-side
   - Update `filteredProviders` via `useMemo`
   - Re-render company cards

## 🗑️ Removed Features

- ❌ Service Detail Modal (`ServiceDetailModal` component)
- ❌ Generic service cards that open modals
- ❌ Location filter dropdown (simplified to search only)
- ❌ Service description display (focus on companies)

## ✅ New Features

- ✅ Split-view directory layout
- ✅ Category sidebar menu (desktop)
- ✅ Horizontal scrollable tabs (mobile)
- ✅ Company cards with real provider data
- ✅ Direct action buttons (Call, Get Location)
- ✅ Real-time search filtering
- ✅ Provider count display
- ✅ Authorized dealer badges
- ✅ Location badges

## 📁 Files Modified

1. **`frontend/app/[locale]/services/page.tsx`**
   - Complete rewrite
   - Split-view layout
   - Company card components
   - Category selection logic
   - Search functionality

## 🎯 User Experience

**Before:**
1. User sees grid of service categories
2. Clicks a category card
3. Modal opens with provider list
4. User clicks provider to see details

**After:**
1. User sees split view: categories on left, companies on right
2. Clicks a category → Companies appear immediately
3. User can search/filter companies
4. User clicks "Call Now" or "Get Location" directly from card

**Benefits:**
- ✅ Faster access to companies
- ✅ No modal interruptions
- ✅ Better mobile experience (bottom sheet → horizontal tabs)
- ✅ Clear visual hierarchy
- ✅ Direct actions (call, directions)

## 🚀 Result

A modern, directory-style interface that:
- **Feels Fast:** Immediate company display on category select
- **Looks Premium:** Glass morphism with gradients and glows
- **Works Great on Mobile:** Horizontal tabs + responsive grid
- **Provides Direct Actions:** Call and location buttons on every card
- **Enables Quick Search:** Real-time filtering across companies

The page now functions as a true **Services Directory** where users can quickly browse and contact real companies.
