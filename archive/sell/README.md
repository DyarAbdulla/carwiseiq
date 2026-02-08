# Archived Sell Section

This directory contains archived files from the standalone "Sell" section that has been removed from the application.

## Archive Date
January 16, 2026

## Purpose
These files have been archived for migration to the new Buy&Sell section. All Sell functionality will be integrated into the unified Buy&Sell feature.

## Archived Files

### Backend
- `backend/sell.py` - FastAPI route handler for sell car predictions

### Frontend
- `frontend/app/sell/` - Sell page component
- `frontend/components/sell/` - All sell-related components (forms, results, etc.)

## Migration Notes
- All Sell schemas have been commented out in `backend/app/models/schemas.py`
- Sell types have been commented out in `frontend/lib/types.ts`
- Sell API method has been removed from `frontend/lib/api.ts`
- Navigation links have been removed from `frontend/components/layout/Header.tsx`
- Translations have been removed from all message files

## Next Steps
When implementing the new Buy&Sell section, reference these archived files for:
- Form structure and validation logic
- Price calculation algorithms
- UI/UX patterns
- Translation keys (if needed)
