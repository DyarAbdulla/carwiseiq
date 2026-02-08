-- Triggers: auto_update_timestamp, set_sold_timestamp, auto_update_user_timestamp
-- Run after: 20250124000006_create_car_images_storage_bucket.sql
-- Reuses public.set_updated_at() from users migration.

-- 1. car_listings: auto_update_timestamp
-- Sets updated_at = now() on every UPDATE.
DROP TRIGGER IF EXISTS trigger_car_listings_updated_at ON public.car_listings;
CREATE TRIGGER auto_update_timestamp
  BEFORE UPDATE ON public.car_listings
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

-- 2. car_listings: set_sold_timestamp
-- sold_at = now() when is_sold false -> true; sold_at = null when is_sold true -> false.
CREATE OR REPLACE FUNCTION public.set_sold_at_on_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_sold IS NOT TRUE AND NEW.is_sold IS TRUE THEN
    NEW.sold_at := now();
  ELSIF OLD.is_sold IS TRUE AND NEW.is_sold IS NOT TRUE THEN
    NEW.sold_at := null;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_car_listings_sold_at ON public.car_listings;
DROP TRIGGER IF EXISTS set_sold_timestamp ON public.car_listings;
CREATE TRIGGER set_sold_timestamp
  BEFORE UPDATE ON public.car_listings
  FOR EACH ROW
  WHEN (OLD.is_sold IS DISTINCT FROM NEW.is_sold)
  EXECUTE PROCEDURE public.set_sold_at_on_sold();

-- 3. users: auto_update_user_timestamp
-- Sets updated_at = now() whenever user profile is updated.
DROP TRIGGER IF EXISTS trigger_users_updated_at ON public.users;
CREATE TRIGGER auto_update_user_timestamp
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();
