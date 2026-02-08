-- Add phone and whatsapp to car_listings for Contact Seller (stored separately, never in description)
-- Run after: 20250124000001_create_car_listings_table.sql (and any later migrations)

ALTER TABLE public.car_listings
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

COMMENT ON COLUMN public.car_listings.phone IS 'Seller phone for Contact Seller card; never embedded in description.';
COMMENT ON COLUMN public.car_listings.whatsapp IS 'Seller WhatsApp; falls back to phone if not set.';
