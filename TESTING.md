# Testing Checklist

Use this checklist to verify core features before release or after major changes.

---

## User Features

- [ ] User can register new account
- [ ] User can login
- [ ] User can create car listing
- [ ] User can edit only their own listings
- [ ] User can delete only their own listings
- [ ] User can mark their own car as sold
- [ ] User cannot access admin dashboard
- [ ] User cannot edit other users' listings

---

## Admin Features

- [ ] Admin can access admin dashboard
- [ ] Admin can view all listings from all users
- [ ] Admin can edit ANY car listing
- [ ] Admin can delete ANY car listing
- [ ] Admin can mark ANY car as sold/unsold
- [ ] Admin can see listing owner information

---

## Security

- [ ] Non-logged users redirected when accessing protected pages
- [ ] RLS policies prevent users from editing others' listings
- [ ] Admin pages only accessible to admin role
- [ ] API keys not exposed in client code

---

## Environment

- [ ] `.env.local` has correct Supabase credentials:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL` (project URL)
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (service role key, server-side only)

---

*Frontend loads `NEXT_PUBLIC_*` from project root or `frontend/.env.local`. Ensure Supabase keys match your project.*
