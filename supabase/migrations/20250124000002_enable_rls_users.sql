-- Enable RLS on public.users and create policies
-- Run after: 20250124000000_create_users_table.sql

-- 1. Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. SECURITY DEFINER helper: is the current user an admin?
-- Bypasses RLS so we can check role when evaluating admin policies.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
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

-- 3. Trigger: users cannot change their own role
CREATE OR REPLACE FUNCTION public.users_prevent_self_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_users_prevent_role_change ON public.users;
CREATE TRIGGER trigger_users_prevent_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.users_prevent_self_role_change();

-- 4. Policies

-- "Users can view their own profile"
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- "Users can update their own profile"
-- (role change blocked by trigger above)
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- "Admins can view all users"
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  USING (public.current_user_is_admin());

-- Comments
COMMENT ON FUNCTION public.current_user_is_admin() IS 'Returns true if current user has role admin. SECURITY DEFINER for RLS policy use.';
