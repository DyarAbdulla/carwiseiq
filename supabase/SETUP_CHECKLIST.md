# Supabase database setup checklist

This checklist confirms the database meets all requirements. Run migrations in order (see [README](./README.md)).

---

## Requirements

| # | Requirement | Status | Migration / Script |
|---|-------------|--------|--------------------|
| 1 | **Users table** with `role` (`user` / `admin`) | ✅ | `20250124000000_create_users_table.sql` |
| 2 | **Car listings table** with all car details, `is_sold`, `sold_at` | ✅ | `20250124000001_create_car_listings_table.sql` |
| 3 | **RLS**: Users can only **edit / delete** their **own** cars | ✅ | `20250124000003_enable_rls_car_listings.sql` |
| 4 | **RLS**: Admins can **edit / delete / mark as sold** **any** car | ✅ | `20250124000004` + `20250124000005` (uses `is_admin()`) |
| 5 | **Storage bucket** for car images with correct permissions | ✅ | `20250124000006_create_car_images_storage_bucket.sql` |
| 6 | **Triggers** to auto-update timestamps | ✅ | `20250124000007_triggers_auto_update_and_sold_timestamp.sql` |
| 7 | **`is_admin()`** function to check if current user is admin | ✅ | `20250124000005_create_is_admin_and_update_policies.sql` |
| 8 | **First admin**: Update first user’s `role` to `admin` | ✅ | `scripts/set_first_admin.sql` (run manually) |

---

## Key rules (enforced by RLS + triggers)

| Rule | How it’s enforced |
|------|-------------------|
| **Users must be logged in to create listings** | INSERT policy: `WITH CHECK (auth.uid() = user_id)`. Anon has `auth.uid() = null` → insert blocked. |
| **Users can only edit / delete / mark as sold their OWN listings** | UPDATE/DELETE: `auth.uid() = user_id`. Owner trigger restricts changes to `user_id`, `status`, `created_at`; owners can still set `is_sold`. |
| **Admins can edit / delete / mark as sold ANY listing** | Admin policies use `is_admin()`. Owner trigger does not apply to admins (`auth.uid() != OLD.user_id`). |
| **Everyone can VIEW active listings (no login)** | SELECT: `status = 'active'`. No auth required; anon + authenticated. |
| **Car images in Storage with public read** | `car-images` bucket is **public**. Policy: “Anyone can view car images” (SELECT on `storage.objects` for `car-images`). |

---

## Quick reference

### Run all migrations

```bash
supabase db push
# or, per file:
# 000 → 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008
```

### Promote first user to admin

1. User registers via Supabase Auth (and has a row in `public.users`).
2. Edit `supabase/scripts/set_first_admin.sql`: set `WHERE email = '...'` to their email.
3. Run the script (Dashboard SQL Editor or `psql ... -f supabase/scripts/set_first_admin.sql`).

### Car images

- **Bucket:** `car-images` (public, 5MB/file, jpg/jpeg/png/webp).
- **Paths:** `user_id/filename.ext` (e.g. `uuid/photo.jpg`).
- **Read:** Anyone. **Write:** Own folder (users) or any path (admins).

---

## Tables overview

| Table | Purpose |
|-------|---------|
| `public.users` | Profiles; `role` = `user` \| `admin`. Extends `auth.users`. |
| `public.car_listings` | Listings; `user_id`, car fields, `is_sold`, `sold_at`, `status`, etc. |
| `public.favorites` | User‑saved listings; `(user_id, listing_id)` unique. |
| `storage.buckets` | `car-images` bucket. |
| `storage.objects` | Files in `car-images`; RLS for per‑folder access. |

Triggers keep `updated_at` and `sold_at` in sync; `is_admin()` is used in RLS for admin checks.
