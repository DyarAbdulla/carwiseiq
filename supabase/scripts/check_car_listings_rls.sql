-- Diagnostic script to check car_listings RLS policies
-- Run this in Supabase SQL Editor to diagnose INSERT timeout issues

-- 1. Check if RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'car_listings';

-- 2. List all RLS policies on car_listings
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'car_listings'
ORDER BY cmd, policyname;

-- 3. Check user_id column definition
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'car_listings'
  AND column_name = 'user_id';

-- 4. Check foreign key constraint on user_id
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'car_listings'
  AND kcu.column_name = 'user_id'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 5. List all triggers on car_listings
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'car_listings'
ORDER BY trigger_name;

-- 6. Test current user's auth.uid() (if authenticated)
-- This will return NULL if not authenticated
SELECT auth.uid() as current_user_id;
