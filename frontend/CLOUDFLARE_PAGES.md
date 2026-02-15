# Cloudflare Pages build configuration (static export)

The frontend uses **Next.js static export** (`output: 'export'`) so Cloudflare Pages serves plain HTML/JS/CSS with no SSR and no memory-heavy build.

## Redeploy (GitHub Actions)

A workflow can trigger a **redeploy** without pushing a new commit (retries the latest deployment):

1. **Repo → Actions → "Cloudflare Pages Redeploy" → Run workflow.**

2. **Required secrets** (Settings → Secrets and variables → Actions):
   - `CLOUDFLARE_ACCOUNT_ID` – Cloudflare Dashboard → any product → right sidebar "Account ID".
   - `CLOUDFLARE_API_TOKEN` – [Create API token](https://dash.cloudflare.com/profile/api-tokens) with **Pages: Edit**.
   - `CLOUDFLARE_PAGES_PROJECT_NAME` – Your Pages project name (e.g. `carwiseiq`).

3. After the workflow runs, check the [Cloudflare Pages dashboard](https://dash.cloudflare.com/) for the new deployment.

Pushing to the connected branch (e.g. `main`) still triggers an automatic deployment via Cloudflare’s Git integration.

## Build configuration

| Setting | Value |
|--------|--------|
| **Framework preset** | None |
| **Build command** | `npm run build` or `next build` |
| **Build output directory** | `out` (relative to Root; if Root is `frontend`, path is `frontend/out`) |
| **Root directory** | `frontend` |

## Environment variables

In **Settings → Environment variables** (Production and Preview):

| Variable | Value |
|----------|--------|
| **NODE_VERSION** | `20` (recommended) |
| **NEXT_PUBLIC_SUPABASE_URL** | your Supabase project URL |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | your Supabase anon key (if used) |
| **NEXT_PUBLIC_API_BASE_URL** | your API URL (e.g. `https://api.carwiseiq.com` for production) |

No `NODE_OPTIONS` or `@cloudflare/next-on-pages` is needed for static export.
