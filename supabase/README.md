# Supabase migrations

**Setup checklist:** See [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) for a requirement-by-requirement checklist (users, car listings, RLS, storage, triggers, `is_admin()`, first admin).

## Users table migration

The migration `20250124000000_create_users_table.sql` creates:

- **`public.users`** — extends `auth.users` with:
  - `id` (UUID, PK, references `auth.users(id)` ON DELETE CASCADE)
  - `email` (text, unique, not null)
  - `full_name` (text)
  - `phone_number` (text)
  - `role` (text, default `'user'`, either `'user'` or `'admin'`)
  - `created_at` (timestamptz, default `now()`)
  - `updated_at` (timestamptz, default `now()`)
  - `is_verified` (boolean, default `false`)

- **Trigger** `trigger_users_updated_at` — sets `updated_at = now()` on every `UPDATE` to `public.users`.

## Users RLS migration

The migration `20250124000002_enable_rls_users.sql` enables Row Level Security on `public.users` and adds:

- **RLS** enabled on `public.users`.

- **Policies:**
  1. **"Users can view their own profile"** (SELECT) — `auth.uid() = id`.
  2. **"Users can update their own profile"** (UPDATE) — `auth.uid() = id` for USING and WITH CHECK. Users cannot change their own `role` (enforced by trigger).
  3. **"Admins can view all users"** (SELECT) — `is_admin()` (user’s `role = 'admin'`).

- **Note:** Admin check uses `is_admin()` (see is_admin migration).

- **Trigger** `trigger_users_prevent_role_change` — before UPDATE, if `auth.uid() = id`, resets `NEW.role` to `OLD.role` so users cannot change their own role.

**Run after:** `20250124000000_create_users_table.sql`.

## Car listings table migration

The migration `20250124000001_create_car_listings_table.sql` creates:

- **`public.car_listings`** — car listings posted by users:
  - `id` (UUID, PK, default `uuid_generate_v4()`)
  - `user_id` (UUID, FK → `auth.users(id)`, not null)
  - `title`, `make`, `model`, `year`, `price`, `mileage`, `transmission`, `fuel_type`, `condition`, `location` (all not null)
  - `description` (text, nullable)
  - `images` (JSONB, default `[]`) — JSON array of image URLs
  - `is_sold` (boolean, default `false`), `sold_at` (timestamptz, nullable)
  - `status` (text, default `'active'`) — `'active'`, `'pending'`, `'rejected'`
  - `created_at`, `updated_at` (timestamptz, default `now()`)

- **Indexes** on `user_id`, `is_sold`, `status`, `created_at`.

- **Trigger** `trigger_car_listings_updated_at` — sets `updated_at = now()` on every `UPDATE`.
- **Trigger** `trigger_car_listings_sold_at` — sets `sold_at = now()` when `is_sold` changes from `false` to `true`.

**Note:** Run the users migration first; `car_listings` reuses `set_updated_at()`.

## Car listings RLS migration

The migration `20250124000003_enable_rls_car_listings.sql` enables Row Level Security on `public.car_listings` and adds USER policies:

- **RLS** enabled on `public.car_listings`.

- **Policies:**
  1. **"Anyone can view active car listings"** (SELECT) — `status = 'active'`. Anon and authenticated; no login required.
  2. **"Authenticated users can create their own listings"** (INSERT) — `auth.uid() = user_id`. Must be logged in; can only create with own `user_id`.
  3. **"Users can update only their own listings"** (UPDATE) — `auth.uid() = user_id`. Allowed: title, make, model, year, price, mileage, transmission, fuel_type, condition, location, description, images, is_sold (e.g. mark as sold). Trigger blocks changes to `user_id`, `status`, `created_at`.
  4. **"Users can delete only their own listings"** (DELETE) — `auth.uid() = user_id`.

- **Trigger** `trigger_car_listings_owner_update_columns` — before UPDATE by owner, keeps `user_id`, `status`, `created_at` unchanged.

**Run after:** `20250124000001_create_car_listings_table.sql`.

## Car listings ADMIN policies migration

The migration `20250124000004_add_admin_policies_car_listings.sql` adds ADMIN policies to `public.car_listings`. Migration 005 switches them to use `is_admin()`.

- **Policies** (use `is_admin()` after 005):
  1. **"Admins can view all listings"** (SELECT) — `is_admin()`. Admins see all listings regardless of status.
  2. **"Admins can update any listing"** (UPDATE) — `is_admin()`. Admins can update any field (car details, `is_sold`, `status`, `user_id`, etc.); owner-update trigger does not apply.
  3. **"Admins can delete any listing"** (DELETE) — `is_admin()`.

**Run after:** `20250124000003_enable_rls_car_listings.sql`.

## is_admin() migration

The migration `20250124000005_create_is_admin_and_update_policies.sql` creates `public.is_admin()` and updates all admin RLS policies to use it:

- **`public.is_admin()`** — returns `BOOLEAN`:
  - `true` if the current user (`auth.uid()`) has `role = 'admin'` in `public.users`
  - `false` otherwise (including when not authenticated)
  - `SECURITY DEFINER`, `STABLE`, `SET search_path = public` — bypasses RLS when checking `users`; use in RLS policies for admin checks.

- Recreates **"Admins can view all users"** on `users` and **"Admins can view/update/delete all listings"** on `car_listings` to use `is_admin()`.
- Drops **`current_user_is_admin()`** (replaced by `is_admin()`).

**Run after:** `20250124000004_add_admin_policies_car_listings.sql`.

## car-images storage bucket migration

The migration `20250124000006_create_car_images_storage_bucket.sql` creates the **`car-images`** storage bucket and RLS policies on `storage.objects`:

- **Bucket:**
  - **`car-images`** — public bucket; images viewable by anyone.
  - **Max file size:** 5MB per image.
  - **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp` (jpg, jpeg, png, webp).

- **Folder structure:** Store images as `user_id/filename.ext` (e.g. `uuid/img.jpg`) so folder-based policies apply.

- **Policies:**
  1. **INSERT** — Authenticated users can upload only to their own folder (`user_id/*`); admins can upload anywhere.
  2. **SELECT** — Anyone can view images (public read; anon + authenticated).
  3. **UPDATE** — Users can update only objects in their own folder; admins can update any.
  4. **DELETE** — Users can delete only objects in their own folder; admins can delete any.

**Run after:** `20250124000005_create_is_admin_and_update_policies.sql`.

## Triggers migration (auto_update, set_sold_timestamp)

The migration `20250124000007_triggers_auto_update_and_sold_timestamp.sql` defines:

- **`auto_update_timestamp`** (on `car_listings`) — `BEFORE UPDATE`; sets `updated_at = now()` on every row update (uses `set_updated_at()`).
- **`set_sold_timestamp`** (on `car_listings`) — `BEFORE UPDATE` when `is_sold` changes; sets `sold_at = now()` when `is_sold` goes `false` → `true`, and `sold_at = null` when `is_sold` goes `true` → `false`.
- **`auto_update_user_timestamp`** (on `users`) — `BEFORE UPDATE`; sets `updated_at = now()` whenever a user profile is updated (uses `set_updated_at()`).

Replaces `trigger_car_listings_updated_at`, `trigger_car_listings_sold_at`, and `trigger_users_updated_at` with the above.

**Run after:** `20250124000006_create_car_images_storage_bucket.sql`.

## Favorites table migration

The migration `20250124000008_create_favorites_table.sql` creates **`public.favorites`**:

- **Columns:** `id` (UUID, PK, default `uuid_generate_v4()`), `user_id` (UUID, FK → `public.users(id)`, not null), `listing_id` (UUID, FK → `public.car_listings(id)`, not null), `created_at` (timestamptz, default `now()`).
- **Unique constraint** on `(user_id, listing_id)` to prevent duplicate favorites.
- **Indexes** on `user_id`, `listing_id`.
- **RLS** enabled. **Policies:**
  - **INSERT** — Users can insert only their own favorites (`auth.uid() = user_id`).
  - **SELECT** — Users can view only their own favorites.
  - **DELETE** — Users can delete only their own favorites.

**Run after:** `20250124000007_triggers_auto_update_and_sold_timestamp.sql`.

## How to run

**Option 1: `supabase db push` (CLI, recommended)**

1. **Link your project** (one-time, if not already linked):
   ```bash
   npx supabase link
   ```
   When prompted:
   - **Project ref:** From [Supabase Dashboard](https://supabase.com/dashboard) → your project → Settings → General → Reference ID.
   - **Database password:** The password you set when creating the project (or reset it in Settings → Database).

2. **Push migrations:**
   ```bash
   npx supabase db push
   ```
   Or run `.\supabase\db-push.ps1` from the project root (PowerShell).

   All migrations in `supabase/migrations/` are applied in order to your linked Supabase project.

**Option 2: Supabase Dashboard**

1. Project → **SQL Editor**
2. Run migrations in order: `20250124000000_create_users_table.sql`, `20250124000001_create_car_listings_table.sql`, `20250124000002_enable_rls_users.sql`, `20250124000003_enable_rls_car_listings.sql`, `20250124000004_add_admin_policies_car_listings.sql`, `20250124000005_create_is_admin_and_update_policies.sql`, `20250124000006_create_car_images_storage_bucket.sql`, `20250124000007_triggers_auto_update_and_sold_timestamp.sql`, then `20250124000008_create_favorites_table.sql`.

**Option 3: `psql`**

```bash
psql "postgresql://..." -f supabase/migrations/20250124000000_create_users_table.sql
psql "postgresql://..." -f supabase/migrations/20250124000001_create_car_listings_table.sql
psql "postgresql://..." -f supabase/migrations/20250124000002_enable_rls_users.sql
psql "postgresql://..." -f supabase/migrations/20250124000003_enable_rls_car_listings.sql
psql "postgresql://..." -f supabase/migrations/20250124000004_add_admin_policies_car_listings.sql
psql "postgresql://..." -f supabase/migrations/20250124000005_create_is_admin_and_update_policies.sql
psql "postgresql://..." -f supabase/migrations/20250124000006_create_car_images_storage_bucket.sql
psql "postgresql://..." -f supabase/migrations/20250124000007_triggers_auto_update_and_sold_timestamp.sql
psql "postgresql://..." -f supabase/migrations/20250124000008_create_favorites_table.sql
```

## Syncing new auth users (optional)

To auto-create a `public.users` row when someone signs up via Supabase Auth, add a trigger on `auth.users` that inserts into `public.users` (e.g. using `auth.users.id` and `auth.users.email`). You can add this as a separate migration if needed.

## First admin (one-time script)

After the first user registers through Auth (and has a row in `public.users`), promote them to admin:

1. **Edit** `supabase/scripts/set_first_admin.sql` and set the `WHERE email = '...'` to the user’s email (or keep `dyarabdulla319@gmail.com`).
2. **Run** the script:
   - **Supabase Dashboard:** SQL Editor → paste script → Run.
   - **psql:** `psql "postgresql://..." -f supabase/scripts/set_first_admin.sql`

This runs `UPDATE public.users SET role = 'admin' WHERE email = '...';`. Run it once per admin you promote.
