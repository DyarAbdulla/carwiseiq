-- Enable RLS on public.car_listings and create USER policies
-- Run after: 20250124000001_create_car_listings_table.sql

-- 1. Enable Row Level Security
ALTER TABLE public.car_listings ENABLE ROW LEVEL SECURITY;

-- 2. Trigger: owners cannot change user_id, status, or created_at
CREATE OR REPLACE FUNCTION public.car_listings_owner_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() = OLD.user_id THEN
    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_car_listings_owner_update_columns ON public.car_listings;
CREATE TRIGGER trigger_car_listings_owner_update_columns
  BEFORE UPDATE ON public.car_listings
  FOR EACH ROW
  EXECUTE PROCEDURE public.car_listings_owner_update_columns();

-- 3. Policies

-- "Anyone can view active car listings"
-- Anon + authenticated can read; no auth required. Only status = 'active'.
CREATE POLICY "Anyone can view active car listings"
  ON public.car_listings
  FOR SELECT
  USING (status = 'active');

-- "Authenticated users can create their own listings"
-- Must be logged in (auth.uid() non-null). Can only set user_id = own id.
CREATE POLICY "Authenticated users can create their own listings"
  ON public.car_listings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- "Users can update only their own listings"
-- Owner only. Allowed: title, make, model, year, price, mileage,
-- transmission, fuel_type, condition, location, description, images, is_sold.
-- Trigger above blocks changes to user_id, status, created_at.
CREATE POLICY "Users can update only their own listings"
  ON public.car_listings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- "Users can delete only their own listings"
CREATE POLICY "Users can delete only their own listings"
  ON public.car_listings
  FOR DELETE
  USING (auth.uid() = user_id);
