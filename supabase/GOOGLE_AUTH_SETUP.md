# Google Sign-In Setup (CarWiseIQ)

Follow these steps to enable **Sign in with Google** on the Login and Register pages.

---

## What’s already done in the app

- **Login** and **Register** pages have a “Sign in with Google” / “Sign up with Google” button.
- **Auth callback** route: `/{locale}/auth/callback` (e.g. `/en/auth/callback`) handles the OAuth redirect and sends users to the right page.

You only need to configure **Google Cloud** and **Supabase**.

---

## Step 1: Google Cloud Console

### 1.1 Open Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your Google account.

### 1.2 Create or select a project

1. At the top, click the project dropdown.
2. Click **New Project**, name it (e.g. `CarWiseIQ`), and create it.
   Or pick an existing project.

### 1.3 OAuth consent screen

1. In the left menu: **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (or Internal if it’s only for your org) → **Create**.
3. Fill in:
   - **App name:** e.g. `CarWiseIQ`
   - **User support email:** your email
   - **Developer contact:** your email
4. Click **Save and Continue** through Scopes and Test users (you can add your email as a test user if the app is in “Testing”).
5. Back on the OAuth consent screen, leave it as is for now.

### 1.4 OAuth client (Web)

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. **Application type:** **Web application**.
4. **Name:** e.g. `CarWiseIQ Web`.
5. **Authorized redirect URIs** – click **+ ADD URI** and add **exactly**:

   ```
https://fehkzrrahgyesxzrwlme.supabase.co/auth/v1/callback
   ```
   To avoid "Cannot contain whitespace": copy from `supabase/REDIRECT_URI.txt` (no spaces) or type the URL by hand.

   This is the Supabase auth callback. Copy it from **Supabase** → **Authentication** → **Providers** → **Google** → “Callback URL (for OAuth)". If Google shows "Cannot contain whitespace", clear the field and paste again with no spaces before, after, or inside the URL.

6. Click **Create**.
7. In the popup, copy and save:
   - **Client ID**
   - **Client secret**

---

## Step 2: Supabase – Google provider

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project **CarWiseIQ**.
2. Go to **Authentication** → **Providers** → **Google**.
3. Turn **ON** “Enable Sign in with Google”.
4. **Client IDs:** paste your **Client ID** from Google.
5. **Client Secret (for OAuth):** paste your **Client secret** from Google.
6. Leave **Skip nonce checks** and **Allow users without an email** **OFF**.
7. Click **Save**.

---

## Step 3: Supabase – Redirect URLs

Supabase must be allowed to redirect users back to your app after Google sign-in.

1. In Supabase: **Authentication** → **URL Configuration**.
2. In **Redirect URLs**, add (one per line). **Verified list** — use these exact three (en, ar, ku); do not duplicate:

   - For local development:
     ```
     http://localhost:3002/en/auth/callback
     http://localhost:3002/ar/auth/callback
     http://localhost:3002/ku/auth/callback
     ```
     (Third is **ku**, not ar. App locales: en, ar, ku.) You can copy from `supabase/REDIRECT_URLS.txt`.

   - For production (replace with your real domain):
     ```
     https://yourdomain.com/en/auth/callback
     https://yourdomain.com/ar/auth/callback
     https://yourdomain.com/ku/auth/callback
     ```

3. **Site URL** can stay as `http://localhost:3002` in development, or your production URL.
4. Save.

---

## Step 4: Apply the migration (Google `name` → `full_name`)

To store the Google display name in `public.users.full_name`:

```bash
npx supabase db push
```

If you already ran `db push` before, only the new migration `20250124000010_handle_new_user_google_name.sql` will run.
If you prefer not to run it, Google users will still sign in; `full_name` may stay empty until they update their profile.

---

## Step 5: Test

1. Restart the frontend: `cd frontend && npm run dev`.
2. Open `http://localhost:3002/en/login` (or `/en/register`).
3. Click **Sign in with Google** (or **Sign up with Google**).
4. You should be sent to Google, then back to the app and logged in.

---

## Checklist

| Step | Action |
|------|--------|
| 1 | In **Google Cloud**: create/select project, set OAuth consent screen, create **Web application** OAuth client. |
| 2 | In **Authorized redirect URIs** add: `https://fehkzrrahgyesxzrwlme.supabase.co/auth/v1/callback` |
| 3 | Copy **Client ID** and **Client secret** from Google. |
| 4 | In **Supabase** → **Authentication** → **Providers** → **Google**: Enable, paste Client ID and Client secret, **Save**. |
| 5 | In **Supabase** → **Authentication** → **URL Configuration** → **Redirect URLs**: add `http://localhost:3002/{locale}/auth/callback` (and production URLs when you deploy). |
| 6 | Run `npx supabase db push` (optional, for `full_name` from Google). |
| 7 | Test **Sign in with Google** and **Sign up with Google** on `/en/login` and `/en/register`. |

---

## Troubleshooting

- **“redirect_uri_mismatch”**
  - The redirect URI in Google must be exactly:
    `https://fehkzrrahgyesxzrwlme.supabase.co/auth/v1/callback`
  - No trailing slash, `http` vs `https`, or typos.

- **“Redirect URL is not allowed”**
  - Add your app’s callback URL (e.g. `http://localhost:3002/en/auth/callback`) to **Supabase** → **Authentication** → **URL Configuration** → **Redirect URLs**.

- **Google button does nothing or shows an error**
  - In Supabase, ensure the Google provider is **enabled** and that **Client ID** and **Client secret** are correct.

- **User is created but `full_name` is empty**
  - Run the migration from Step 4 so `handle_new_user` can use Google’s `name` when `full_name` is not provided.
