-- Create 'car-images' storage bucket and policies
-- Run after: 20250124000005_create_is_admin_and_update_policies.sql (uses is_admin())
--
-- Store images as user_id/filename.ext (e.g. uuid/img.jpg) so folder-based policies apply.

-- 1. Create bucket
-- Public bucket; 5MB max per file; jpg, jpeg, png, webp only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'car-images',
  'car-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage policies on storage.objects

-- INSERT: Authenticated users upload to own folder (user_id/*) OR admins upload anywhere
CREATE POLICY "Users upload to own folder or admins upload any"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'car-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- SELECT: Anyone can view images (public read)
CREATE POLICY "Anyone can view car images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'car-images');

-- UPDATE: Users update only own folder OR admins update any
CREATE POLICY "Users update own folder or admins update any"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'car-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'car-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- DELETE: Users delete only own folder OR admins delete any
CREATE POLICY "Users delete own folder or admins delete any"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'car-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );
