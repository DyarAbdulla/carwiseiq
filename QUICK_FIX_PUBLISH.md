# Quick Fix: Can't Publish Listing

## Problem
The "Publish Listing" button starts the process (`=== STARTING PUBLISH ===` in console) but fails or times out.

## Most Likely Cause
**Missing or incorrect RLS (Row Level Security) INSERT policy** on the `car_listings` table in Supabase.

## Quick Fix Steps

### Step 1: Check Current RLS Policies
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:
```sql
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'car_listings'
  AND cmd = 'INSERT';
```

**Expected Result:** Should show a policy named "Authenticated users can create their own listings" with `with_check: "auth.uid() = user_id"`

**If no results:** The INSERT policy is missing → Go to Step 2

### Step 2: Create/Fix the INSERT Policy
Run this SQL in Supabase SQL Editor:

```sql
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create their own listings" ON public.car_listings;

-- Create the INSERT policy
CREATE POLICY "Authenticated users can create their own listings"
  ON public.car_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

### Step 3: Verify RLS is Enabled
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'car_listings';
```

**Expected:** `rowsecurity = true`

If false, enable it:
```sql
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;
```

### Step 4: Test Again
1. Refresh your browser
2. Try publishing a listing again
3. Check the browser console for detailed error messages

## What Was Fixed in Code

The frontend code (`frontend/app/[locale]/sell/step5/page.tsx`) has been updated to:
- ✅ Fetch fresh Supabase session before insert
- ✅ Use session user ID directly (matches `auth.uid()`)
- ✅ Better error logging (check browser console)
- ✅ Improved timeout handling (20 seconds)
- ✅ User-friendly error messages

## Console Logs to Check

When you click "Publish Listing", check the browser console for:
- `=== STARTING PUBLISH ===`
- `Current Supabase user ID: <uuid>`
- `Inserting to database...`
- `Payload: {...}`

If it fails, you'll see:
- `=== PUBLISH FAILED - Supabase Error ===` (with error details)
- OR `=== PUBLISH FAILED - Timeout ===` (RLS policy issue)

## Common Error Codes

- **PGRST301**: Permission denied (RLS policy blocking)
- **23503**: Foreign key constraint (user_id doesn't exist in auth.users)
- **Timeout**: Usually means RLS policy is missing or incorrect

## Still Not Working?

1. **Check browser console** for the exact error message
2. **Verify you're signed in** - the session must be active
3. **Check Supabase logs** - Dashboard → Logs → API Logs
4. **Run the diagnostic script**: `supabase/scripts/check_car_listings_rls.sql`
