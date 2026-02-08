-- Fix car_listings INSERT RLS policy
-- This migration ensures the INSERT policy exists and is correctly configured
-- Run this in Supabase SQL Editor if inserts are timing out

-- 1. Check current RLS status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'car_listings'
  ) THEN
    RAISE EXCEPTION 'Table car_listings does not exist';
  END IF;
END $$;

-- 2. Ensure RLS is enabled
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing INSERT policy if it exists (to recreate it)
DROP POLICY IF EXISTS "Authenticated users can create their own listings" ON public.car_listings;
DROP POLICY IF EXISTS "Users can insert own listings" ON public.car_listings;

-- 4. Create/Recreate the INSERT policy
-- This policy allows authenticated users to insert listings where user_id = auth.uid()
CREATE POLICY "Authenticated users can create their own listings"
  ON public.car_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Verify the policy was created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'car_listings'
    AND policyname = 'Authenticated users can create their own listings'
    AND cmd = 'INSERT';
  
  IF policy_count = 0 THEN
    RAISE EXCEPTION 'Failed to create INSERT policy';
  ELSE
    RAISE NOTICE 'INSERT policy created successfully';
  END IF;
END $$;

-- 6. Check for any triggers that might block inserts
-- List all triggers on car_listings
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'car_listings'
ORDER BY trigger_name;

-- 7. Verify user_id column exists and is UUID type
DO $$
DECLARE
  col_type TEXT;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'car_listings'
    AND column_name = 'user_id';
  
  IF col_type IS NULL THEN
    RAISE EXCEPTION 'Column user_id does not exist in car_listings';
  ELSIF col_type != 'uuid' THEN
    RAISE WARNING 'user_id column type is % (expected uuid)', col_type;
  ELSE
    RAISE NOTICE 'user_id column exists and is UUID type';
  END IF;
END $$;
