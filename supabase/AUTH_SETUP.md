# Supabase Auth Setup (CarWiseIQ)

**Confirm email is kept ON.** Users must verify their email before they can log in. This guide helps with **"Email not confirmed"**, **"email rate limit exceeded"**, and **429 Too Many Requests**.

---

## 1. Keep "Confirm email" ON

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project **CarWiseIQ**.
2. Go to **Authentication** → **Providers** → **Email**.
3. Ensure **"Confirm email"** is **ON** (default).

New signups receive a verification email and must click the link before logging in.

---

## 2. Confirm an existing user (one-time)

If a user already registered but never confirmed (e.g. "Email not confirmed" or "Waiting for verif"), you can confirm them manually.

### Option A: Supabase Dashboard

1. **Authentication** → **Users**.
2. Open the user (e.g. `dayrabdulla2019@gmail.com`).
3. Use **"Confirm email"** / **"Confirm user"** if shown.

### Option B: SQL (if the dashboard has no confirm action)

In **SQL Editor**, run (replace the email):

```sql
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email = 'dayrabdulla2019@gmail.com';
```

---

## 3. Rate limits (429 / "email rate limit exceeded")

- **Cause:** Too many signup or "resend verification" attempts; Supabase throttles auth emails on the free tier.
- **What to do:**
  - **Wait** ~1 hour before trying again, or
  - **Custom SMTP:** In **Authentication** → **Notifications** / **Email**, set up **Resend**, **SendGrid**, or another SMTP for higher limits and reliable delivery.

---

## 4. Checklist

| Step | Action |
|------|--------|
| 1 | **Authentication** → **Providers** → **Email** → keep **"Confirm email"** **ON** |
| 2 | For an existing unconfirmed user: run the `UPDATE auth.users` SQL above or confirm in the dashboard |
| 3 | (Recommended) Configure **Resend** or another SMTP under **Authentication** → **Notifications** to avoid rate limits |

Users can also use **"Resend verification email"** on the Login page when they see "Email not confirmed."

---

## 5. Google Sign-In

To enable **Sign in with Google**, see **[GOOGLE_AUTH_SETUP.md](./GOOGLE_AUTH_SETUP.md)** for step-by-step Google Cloud and Supabase setup.
