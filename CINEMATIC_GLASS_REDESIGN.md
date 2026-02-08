# Cinematic Glass Design System - Services Directory Redesign

## 🎨 Overview
Complete redesign of the Services Directory page (`/services`) implementing a premium "Cinematic Glass" design system with glassmorphism effects, ambient lighting, and responsive mobile-first approach.

## ✨ Key Design Changes

### 1. **Hero Section with Ambient Light Glow**
- Added subtle gradient glow behind the main title using `bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl`
- Creates depth and visual hierarchy
- Title positioned with `relative z-10` to appear above the glow

### 2. **Glass Inputs (Search & Location Filter)**
- **Search Bar:**
  - `h-12` height for better touch targets
  - `rounded-full` for modern pill shape
  - `backdrop-blur-xl bg-white/5 border border-white/10` for glass effect
  - Focus states: `focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20`

- **Location Dropdown:**
  - Matching glass styling
  - Consistent rounded-full shape
  - Glass backdrop for dropdown content

### 3. **Service Cards - Glass Morphism**
**Before:** Solid dark background (`bg-[#1a1a2e]`)

**After:**
- `backdrop-blur-xl bg-white/5 border border-white/10` - Glass effect
- `hover:border-indigo-500/50` - Glowing border on hover
- `hover:-translate-y-1` - Subtle lift animation
- `hover:shadow-xl hover:shadow-indigo-500/20` - Glowing shadow

**Icon Box:**
- `bg-gradient-to-br from-indigo-500/20 to-purple-500/20` - Gradient background
- `border border-indigo-500/30` - Glowing border
- Enhanced hover states with color transitions

### 4. **Service Detail Modal - Premium Layout**

#### **Desktop (Center Modal):**
- **Large Colorful Header:**
  - `bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600`
  - Large provider logo/icon with white backdrop
  - Service name and rating prominently displayed

- **Two-Column Layout:**
  - **Left Column:** Contact Info, Working Hours, Price Range
  - **Right Column:** Large Map View (full height)
  - Responsive grid: `grid-cols-1 md:grid-cols-2`

- **Glass Cards for Info:**
  - Contact info, hours, and price in glass containers
  - `backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl`

- **Full-Width Gradient Action Buttons:**
  - `h-12` height for better touch targets
  - Gradient backgrounds:
    - Call: `from-indigo-600 to-purple-600`
    - WhatsApp: `from-green-600 to-emerald-600`
    - Directions: `from-blue-600 to-cyan-600`
  - `shadow-lg shadow-[color]/30` for depth
  - `rounded-xl` for modern appearance

#### **Mobile (Bottom Sheet):**
- Uses new `Sheet` component (Radix UI Dialog styled as bottom sheet)
- Slides up from bottom: `side="bottom"`
- `max-h-[90vh]` with scrollable content
- Rounded top corners: `rounded-t-2xl`
- Same premium header and layout (stacked on mobile)

### 5. **Provider Cards (List View)**
- Updated to glass design: `backdrop-blur-xl bg-white/5 border border-white/10`
- Hover effects: `hover:border-indigo-500/50 hover:-translate-y-1`
- Gradient icon boxes matching main cards
- Updated button styles with gradients

### 6. **Accessibility Fixes**
- Added `DialogTitle` and `DialogDescription` (visually hidden with `sr-only` on desktop)
- Proper ARIA labels and descriptions
- Keyboard navigation support
- Screen reader friendly

## 📱 Responsive Behavior

### Mobile (< 768px):
- Bottom Sheet modal instead of center dialog
- Stacked layout (no columns)
- Full-width buttons
- Optimized touch targets (`h-12`)

### Desktop (≥ 768px):
- Center modal dialog
- Two-column layout
- Side-by-side map and info
- Hover effects and animations

## 🎯 Design Tokens

### Colors:
- **Glass Background:** `bg-white/5` with `backdrop-blur-xl`
- **Glass Border:** `border-white/10`
- **Accent:** `indigo-500/50` for hover states
- **Gradients:**
  - Primary: `from-indigo-600 via-purple-600 to-pink-600`
  - Success: `from-green-600 to-emerald-600`
  - Info: `from-blue-600 to-cyan-600`

### Spacing:
- Input height: `h-12` (48px)
- Button height: `h-12` (48px)
- Card padding: `p-6`
- Border radius: `rounded-xl` (12px) or `rounded-full` for inputs

### Effects:
- Backdrop blur: `backdrop-blur-xl`
- Shadows: `shadow-lg shadow-[color]/30`
- Transitions: `transition-all duration-300`

## 📁 Files Modified

1. **`frontend/app/[locale]/services/page.tsx`**
   - Hero section with ambient glow
   - Glass input styling
   - Service cards with glassmorphism

2. **`frontend/components/services/ServiceDetailModal.tsx`**
   - Premium header design
   - Two-column desktop layout
   - Mobile bottom sheet
   - Glass info cards
   - Gradient action buttons
   - Accessibility improvements

3. **`frontend/components/ui/sheet.tsx`** (NEW)
   - Bottom sheet component for mobile
   - Radix UI Dialog based
   - Smooth slide animations

## ✅ Checklist

- [x] Glass cards with backdrop blur
- [x] Hover effects (lift + glow)
- [x] Gradient icon boxes
- [x] Ambient light glow on hero
- [x] Glass inputs (rounded-full, h-12)
- [x] Premium modal header
- [x] Two-column desktop layout
- [x] Mobile bottom sheet
- [x] Full-width gradient buttons
- [x] Accessibility fixes (DialogTitle)
- [x] Responsive design
- [x] Consistent glass styling throughout

## 🚀 Result

A premium, modern Services Directory with:
- **Visual Depth:** Glassmorphism creates layered, floating elements
- **Better UX:** Larger touch targets, clear hierarchy, smooth animations
- **Mobile-First:** Bottom sheet for better mobile reachability
- **Accessible:** Proper ARIA labels and keyboard navigation
- **Cohesive:** Consistent design language throughout

The design now feels premium, modern, and cinematic while maintaining excellent usability and accessibility standards.
