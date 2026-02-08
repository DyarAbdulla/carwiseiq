-- Add ADMIN policies to public.car_listings
-- Run after: 20250124000003_enable_rls_car_listings.sql
-- Reuses public.current_user_is_admin() from users RLS migration.

-- 1. "Admins can view all listings"
-- Admins see all listings regardless of status (active, pending, rejected).
CREATE POLICY "Admins can view all listings"
  ON public.car_listings
  FOR SELECT
  USING (public.current_user_is_admin());

-- 2. "Admins can update any listing"
-- Admins can update any field: car details, is_sold, status, user_id, etc.
-- Owner-update trigger does not apply to admins (auth.uid() != OLD.user_id).
CREATE POLICY "Admins can update any listing"
  ON public.car_listings
  FOR UPDATE
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 3. "Admins can delete any listing"
CREATE POLICY "Admins can delete any listing"
  ON public.car_listings
  FOR DELETE
  USING (public.current_user_is_admin());
