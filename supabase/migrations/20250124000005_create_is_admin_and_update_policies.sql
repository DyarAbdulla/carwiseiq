-- Create is_admin() and switch RLS policies to use it
-- Run after: 20250124000004_add_admin_policies_car_listings.sql

-- 1. Create is_admin()
-- Returns true if current user (auth.uid()) has role = 'admin' in public.users, false otherwise.
-- SECURITY DEFINER so it bypasses RLS when checking users; used in admin RLS policies.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if current user has role = admin in public.users, false otherwise. Use in RLS policies for admin checks.';

-- 2. Update users table: drop old admin policy, recreate with is_admin()
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (public.is_admin());

-- 3. Update car_listings: drop old admin policies, recreate with is_admin()
DROP POLICY IF EXISTS "Admins can view all listings" ON public.car_listings;
CREATE POLICY "Admins can view all listings"
  ON public.car_listings
  FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any listing" ON public.car_listings;
CREATE POLICY "Admins can update any listing"
  ON public.car_listings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any listing" ON public.car_listings;
CREATE POLICY "Admins can delete any listing"
  ON public.car_listings
  FOR DELETE
  USING (public.is_admin());

-- 4. Remove legacy helper (replaced by is_admin)
DROP FUNCTION IF EXISTS public.current_user_is_admin();
