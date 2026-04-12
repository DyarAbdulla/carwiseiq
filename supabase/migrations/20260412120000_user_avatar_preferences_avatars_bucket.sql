-- Profile: avatar URL, location, JSON preferences; avatars storage bucket.
-- Run after existing users / storage migrations.

-- 1) Columns on public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS profile_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.avatar_url IS 'Public URL of profile image (Supabase Storage avatars bucket).';
COMMENT ON COLUMN public.users.location IS 'User location / city from profile.';
COMMENT ON COLUMN public.users.profile_settings IS 'JSON: { security?: object, privacy?: object } for UI preferences.';

-- 2) New user row: include location and avatar from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone_number, location, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    ),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL),
    COALESCE(NEW.raw_user_meta_data->>'location', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'Inserts into public.users on auth signup; profile fields from raw_user_meta_data.';

-- 3) Storage: avatars bucket (public read, 2MB max, jpg/png/webp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies (paths: {user_id}/… so folder matches auth.uid())
DROP POLICY IF EXISTS "Users upload avatars to own folder or admins" ON storage.objects;
CREATE POLICY "Users upload avatars to own folder or admins"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users update own avatars or admins" ON storage.objects;
CREATE POLICY "Users update own avatars or admins"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Users delete own avatars or admins" ON storage.objects;
CREATE POLICY "Users delete own avatars or admins"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );
