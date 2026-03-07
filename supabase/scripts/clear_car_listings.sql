-- Clear all car listings from the marketplace
-- Run this in Supabase SQL Editor to remove test/fake car listings
--
-- WARNING: This deletes ALL car_listings. Favorites referencing them will
-- be automatically removed (ON DELETE CASCADE). Run only when you want
-- to reset the marketplace to empty.

-- Delete all car listings (favorites cascade automatically)
DELETE FROM public.car_listings;

-- Optional: verify the table is empty
-- SELECT COUNT(*) FROM public.car_listings;
