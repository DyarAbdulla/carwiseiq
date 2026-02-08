# Repository Scan Report

## 📁 File Paths

### Frontend Files

**Budget Finder Page:**
- `frontend/app/[locale]/budget/page.tsx` (Line 1-56)

**Stats Page:**
- `frontend/app/[locale]/stats/page.tsx` (Line 1-314)
- `frontend/app/stats/page.tsx` (Alternative/legacy)

**Sidebar Component:**
- `frontend/components/layout/Sidebar.tsx` (Line 1-339)

**Header / Navbar Component:**
- `frontend/components/layout/Header.tsx` (Line 1-102)

**i18n Translation Files:**
- `frontend/messages/en.json` (English)
- `frontend/messages/ar.json` (Arabic)
- `frontend/messages/ku.json` (Kurdish)
- `frontend/i18n.ts` (Translation configuration)

**Frontend API Client:**
- `frontend/lib/api.ts` (API wrapper with axios)

### Backend Files

**Dataset Loader:**
- `backend/app/services/dataset_loader.py` (Line 1-91)

**Dataset File Paths (from config.py):**
- Primary: `backend/data/cleaned_car_data.csv`
- Fallback: `data/cleaned_car_data.csv` (project root)
- Actual found: `data/cleaned_car_data.csv` (project root)

**Backend Router Registration:**
- `backend/app/main.py` (Line 61-64)
  - Health router: `app.include_router(health.router, prefix="/api", tags=["Health"])`
  - Predict router: `app.include_router(predict.router, prefix="/api", tags=["Prediction"])`
  - Cars router: `app.include_router(cars.router, prefix="/api/cars", tags=["Cars"])`

## 🌐 i18n Translation Loading

**How translations are loaded:**
1. Configuration: `frontend/i18n.ts`
   - Locales: `['en', 'ku', 'ar']`
   - Default: `'en'`
   - Uses `getRequestConfig` from `next-intl/server`
   - Messages loaded: `await import(\`./messages/${locale}.json\`)`

2. Layout: `frontend/app/[locale]/layout.tsx`
   - Uses `getMessages()` from `next-intl/server`
   - Wraps app with `NextIntlClientProvider`
   - Sets locale and RTL direction for Arabic

3. Usage in components:
   - `useTranslations('namespace')` hook
   - Example: `const t = useTranslations('stats')`
   - Access: `t('title')`, `t('description')`, etc.

## 🛣️ Frontend Route Structure

**Under `/frontend/app/[locale]/...`:**

```
app/[locale]/
├── batch/
│   └── page.tsx          (Batch prediction page)
├── budget/
│   └── page.tsx           (Budget Finder page - Coming Soon)
├── compare/
│   └── page.tsx           (Compare cars page)
├── docs/
│   └── page.tsx           (API documentation page)
├── predict/
│   └── page.tsx           (Single prediction page)
├── stats/
│   └── page.tsx           (Statistics page)
├── error.tsx              (Error boundary)
├── layout.tsx             (Locale layout with Sidebar/Header/Footer)
├── loading.tsx            (Loading component)
└── page.tsx               (Home page)
```

**Available Pages:**
- `/` - Home page
- `/predict` - Single car prediction
- `/batch` - Batch prediction
- `/compare` - Compare multiple cars
- `/budget` - Budget finder (Coming Soon)
- `/stats` - Dataset statistics
- `/docs` - API documentation

## 🔍 "Coming Soon" Occurrences

| File | Line | Context |
|------|------|---------|
| `frontend/app/[locale]/stats/page.tsx` | 62 | Toast notification |
| `frontend/app/[locale]/stats/page.tsx` | 254 | "Top Car Makes" section |
| `frontend/app/[locale]/stats/page.tsx` | 271 | "Fuel Type Distribution" section |
| `frontend/app/[locale]/stats/page.tsx` | 288 | "Price Trends by Year" section |
| `frontend/app/[locale]/stats/page.tsx` | 305 | "Price by Condition" section |
| `frontend/components/layout/Sidebar.tsx` | 29 | Login toast |
| `frontend/components/layout/Sidebar.tsx` | 36 | Register toast |
| `frontend/app/[locale]/budget/page.tsx` | 28 | Badge text "Coming Soon" |
| `frontend/components/prediction/SmartTips.tsx` | 55 | Export feature message |
| `frontend/components/prediction/PredictionResult.tsx` | 30 | Save car toast |
| `frontend/messages/en.json` | 125 | Translation key `budget.comingSoon` |
| `frontend/messages/en.json` | 270 | Translation key `smartTips.export.content` |

## 🔑 Visible i18n Keys in UI

**Stats Page (`frontend/app/[locale]/stats/page.tsx`):**
- Line 71: `t('title')` → Should show "Dataset Statistics"
- Line 72: `t('description')` → Should show "Overview of the car price dataset"
- Line 79: `t('totalCars')` → Should show "Total Cars"
- Line 87: `t('averagePrice')` → Should show "Average Price"
- Line 95: `t('medianPrice')` → Should show "Median Price"
- Line 103: `t('yearRange')` → Should show "Year Range"
- Line 115: `t('tabs.statistics')` → Should show "Statistics"
- Line 116: `t('tabs.visualizations')` → Should show "Visualizations"
- Line 122: `t('priceDistribution')` → Should show "Price Distribution"

**All keys are properly defined in `frontend/messages/en.json` under `stats` namespace.**

## ✅ Summary

- **Total "Coming Soon" occurrences:** 12
- **Stats page sections with "Coming soon...":** 4 (Top Makes, Fuel Type, Price Trends, Price by Condition)
- **Budget page:** Full "Coming Soon" implementation
- **Sidebar:** Login/Register toasts show "Coming Soon"
- **i18n keys:** All translation keys are properly defined and should work
- **Dataset path:** `data/cleaned_car_data.csv` (project root) or `backend/data/cleaned_car_data.csv`
- **Routes:** All 7 pages are available under `/[locale]/` structure










