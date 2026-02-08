-- Car listings table
-- Run via: supabase db push  OR  supabase migration up
-- Using gen_random_uuid() which is built-in to PostgreSQL 13+ (no extension needed)

-- Create car_listings table
CREATE TABLE IF NOT EXISTS public.car_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    mileage INTEGER NOT NULL,
    transmission TEXT NOT NULL CHECK (transmission IN ('automatic', 'manual')),
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid')),
    "condition" TEXT NOT NULL CHECK ("condition" IN ('excellent', 'good', 'fair')),
    location TEXT NOT NULL,
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    is_sold BOOLEAN NOT NULL DEFAULT false,
    sold_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_car_listings_user_id ON public.car_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_car_listings_is_sold ON public.car_listings(is_sold);
CREATE INDEX IF NOT EXISTS idx_car_listings_status ON public.car_listings(status);
CREATE INDEX IF NOT EXISTS idx_car_listings_created_at ON public.car_listings(created_at);

-- Trigger: updated_at on row update (reuses set_updated_at from users migration)
DROP TRIGGER IF EXISTS trigger_car_listings_updated_at ON public.car_listings;
CREATE TRIGGER trigger_car_listings_updated_at
    BEFORE UPDATE ON public.car_listings
    FOR EACH ROW
    EXECUTE PROCEDURE public.set_updated_at();

-- Trigger: set sold_at when is_sold changes to true
CREATE OR REPLACE FUNCTION public.set_sold_at_on_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_sold IS NOT TRUE AND NEW.is_sold IS TRUE THEN
        NEW.sold_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_car_listings_sold_at ON public.car_listings;
CREATE TRIGGER trigger_car_listings_sold_at
    BEFORE UPDATE ON public.car_listings
    FOR EACH ROW
    WHEN (OLD.is_sold IS DISTINCT FROM NEW.is_sold AND NEW.is_sold IS TRUE)
    EXECUTE PROCEDURE public.set_sold_at_on_sold();

-- Comments
COMMENT ON TABLE public.car_listings IS 'Car listings posted by users.';
COMMENT ON COLUMN public.car_listings.images IS 'JSON array of image URLs, e.g. ["https://...", "https://..."].';
COMMENT ON COLUMN public.car_listings.mileage IS 'Odometer reading in kilometers.';
