# Fix car_listings INSERT Timeout - RLS Policy Check

## Problem
Insert operations on `car_listings` table are timing out after 10 seconds. This is typically caused by:
1. Missing or incorrect RLS (Row Level Security) INSERT policy
2. `user_id` not matching `auth.uid()` 
3. RLS enabled but no INSERT policy exists

## Solution Steps

### Step 1: Check Current RLS Policies

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run the diagnostic script: `supabase/scripts/check_car_listings_rls.sql`

This will show:
- Whether RLS is enabled
- All existing policies
- Column definitions
- Triggers that might interfere

### Step 2: Fix RLS Policy

1. In **Supabase SQL Editor**, run: `supabase/migrations/20250126000001_fix_car_listings_insert_rls.sql`

This migration will:
- ✅ Ensure RLS is enabled
- ✅ Drop and recreate the INSERT policy
- ✅ Verify the policy was created
- ✅ Check column types match

### Step 3: Verify Policy Exists

Run this query to confirm the INSERT policy exists:

```sql
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'car_listings'
  AND cmd = 'INSERT';
```

Expected result:
```
policyname: "Authenticated users can create their own listings"
cmd: "INSERT"
with_check: "auth.uid() = user_id"
```

### Step 4: Test Insert

The frontend code (`frontend/app/[locale]/sell/step5/page.tsx`) has been updated to:
- ✅ Fetch fresh Supabase session before insert
- ✅ Use `session.user.id` directly (matches `auth.uid()`)
- ✅ Log user ID for debugging

## Expected RLS Policy

The INSERT policy should be:

```sql
CREATE POLICY "Authenticated users can create their own listings"
  ON public.car_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

## Troubleshooting

### If inserts still timeout:

1. **Check session is valid:**
   ```sql
   SELECT auth.uid() as current_user_id;
   ```
   Should return a UUID, not NULL.

2. **Verify user_id column type:**
   ```sql
   SELECT data_type 
   FROM information_schema.columns
   WHERE table_name = 'car_listings' 
     AND column_name = 'user_id';
   ```
   Should be `uuid`.

3. **Check for blocking triggers:**
   ```sql
   SELECT trigger_name, action_statement
   FROM information_schema.triggers
   WHERE event_object_table = 'car_listings';
   ```

4. **Test insert manually:**
   ```sql
   -- Replace 'YOUR_USER_UUID' with actual auth.uid()
   INSERT INTO car_listings (
     user_id, title, make, model, year, price, mileage,
     transmission, fuel_type, condition, location, status
   ) VALUES (
     auth.uid(), 'Test', 'Toyota', 'Camry', 2020, 25000, 50000,
     'automatic', 'petrol', 'good', 'Baghdad, Iraq', 'active'
   );
   ```

## Files Changed

1. **`supabase/migrations/20250126000001_fix_car_listings_insert_rls.sql`** - Migration to fix RLS policy
2. **`supabase/scripts/check_car_listings_rls.sql`** - Diagnostic script
3. **`frontend/app/[locale]/sell/step5/page.tsx`** - Updated to use fresh session

## Notes

- The RLS policy requires `auth.uid() = user_id` for INSERT operations
- Frontend now fetches session directly before insert to ensure freshness
- All authenticated users can insert their own listings (where `user_id` matches their `auth.uid()`)
