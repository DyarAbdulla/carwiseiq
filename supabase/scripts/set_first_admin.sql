-- One-time script: set first admin account
-- Run after the user has registered (auth + public.users row exists).
-- Change the email below if needed.
--
-- Usage:
--   psql "postgresql://..." -f supabase/scripts/set_first_admin.sql
--   or paste in Supabase Dashboard → SQL Editor and run.

UPDATE public.users
SET role = 'admin'
WHERE email = 'dyarabdulla319@gmail.com';

-- Optional: verify (run separately if you want to check)
-- SELECT id, email, role FROM public.users WHERE email = 'dyarabdulla319@gmail.com';
