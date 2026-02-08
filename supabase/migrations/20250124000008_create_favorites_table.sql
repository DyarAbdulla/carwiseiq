-- Favorites table: users save car listings
-- Run after: 20250124000007_triggers_auto_update_and_sold_timestamp.sql
-- Using gen_random_uuid() which is built-in to PostgreSQL 13+ (no extension needed)

CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.car_listings(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON public.favorites(listing_id);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Users can insert their own favorites
CREATE POLICY "Users can insert own favorites"
  ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view only their own favorites
CREATE POLICY "Users can view own favorites"
  ON public.favorites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete only their own favorites
CREATE POLICY "Users can delete own favorites"
  ON public.favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.favorites IS 'User-saved car listings. Unique (user_id, listing_id) prevents duplicates.';
