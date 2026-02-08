# Fixes and Setup Guide

This document explains common errors and what to do.

---

## 1. Migrations: `uuid_generate_v4() does not exist`

**Fix:** `car_listings` and `favorites` now use `gen_random_uuid()` (built-in in PostgreSQL 13+). No extension is needed.

**If you still see the error:**

- **Option A – Reset and re-run (local / dev):**
  ```bash
  supabase db reset
  supabase db push
  ```
- **Option B – Remote DB:** Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` once in the Supabase SQL Editor if you have any older objects that use `uuid_generate_v4()`. Your current migrations do **not** require it.

---

## 2. Email not confirmed (cannot login)

**What it is:** Supabase requires email verification by default. The user must click the link in the signup email before they can log in.

**What to do:**

1. **User:** Check inbox and **spam/junk** for the Supabase verification email and click the link.
2. **Resend:** On the Login page, after a failed login with “Email not confirmed”, use **“Resend verification email”**.
3. **For quick testing only:** In Supabase → **Authentication** → **Providers** → **Email**, you can disable **“Confirm email”**. Use only in development.

---

## 3. Email rate limit exceeded

**What it is:** Supabase limits how many emails (e.g. verification) can be sent in a short time.

**What to do:**

1. **Wait** 30–60 minutes before trying again.
2. **Fewer attempts:** Avoid repeated signup/resend in a short time.
3. **Higher limits (production):** In Supabase → **Authentication** → **Notifications**, set up **Custom SMTP** so your own provider’s limits apply instead.

---

## 4. Google Sign-In: redirect or “Redirect URL” errors

**What it is:** Supabase and Google need to know the exact URL(s) where users are sent after OAuth.

**What to do in Supabase:**

1. Open **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, click **Add URL** and add:
   - `http://localhost:3002/*/auth/callback`  
     (app runs on **3002** in dev; `*` covers `en`, `ar`, `ku`, etc.)
3. If you also run on port 3000, add:
   - `http://localhost:3000/*/auth/callback`
4. For production, add your real URL, e.g.:
   - `https://yourdomain.com/*/auth/callback`
5. **Save changes.**

**In Google Cloud Console** (for the OAuth client used by Supabase):

- **Authorized redirect URIs** must include Supabase’s callback, e.g.  
  `https://fehkzrrahgyesxzrwlme.supabase.co/auth/v1/callback`  
- Supabase docs: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google).

---

## 5. React: “Checkbox is changing from uncontrolled to controlled”

**Fix:** The Login and Register forms use:

- `defaultValues: { rememberMe: false }` / `defaultValues: { terms_accepted: false }`
- `checked={!!watch('rememberMe')}` / `checked={!!watch('terms_accepted')}`

so the checkboxes stay controlled. If the warning persists, do a hard refresh or clear the Next.js cache (`npm run clean:win` or remove `.next`) and restart.

---

## 6. Supabase “Redirect URLs” (URL Configuration)

For **email + password** auth you only need the **Site URL** (e.g. `http://localhost:3002` or `http://localhost:3000`).

For **Google (and other OAuth)**, you must also add **Redirect URLs** as in **§4** above. The callback route in the app is: `/[locale]/auth/callback` (e.g. `/en/auth/callback`).

---

## 7. 429 (Too Many Requests) on signup/login

Same as **§3**: you’re hitting Supabase’s auth rate limits.

- **Short term:** Wait 15–60 minutes, then try again.
- **Long term:** Use **Custom SMTP** (Supabase → Authentication → Notifications) and avoid bursts of signup/resend.

---

## Quick checklist

| Issue                        | Action |
|-----------------------------|--------|
| `uuid_generate_v4` error    | Migrations use `gen_random_uuid()`. Run `supabase db reset` then `supabase db push` if needed. |
| Email not confirmed         | Click verification link in email, or use “Resend” on Login, or turn off “Confirm email” in Supabase (dev only). |
| Email rate limit exceeded   | Wait; use Custom SMTP for higher limits. |
| Google redirect / 400       | Add `http://localhost:3002/*/auth/callback` (and prod URL) in **Redirect URLs** and in Google OAuth client. |
| 429 on auth                 | Wait; reduce signup/resend; consider Custom SMTP. |
| Checkbox warning            | Already handled with `defaultValues` and `!!watch()`. Clean build if it still appears. |

---

*For full feature testing, see [TESTING.md](./TESTING.md).*
