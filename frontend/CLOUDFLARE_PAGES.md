# Cloudflare Pages build configuration

Use these settings in **Cloudflare Dashboard → your project → Settings → Build & deployments → Build configuration**:

## Build configuration

| Setting | Value |
|--------|--------|
| **Framework preset** | None |
| **Build command** | `NODE_OPTIONS=--max-old-space-size=4096 npx @cloudflare/next-on-pages@1` |
| **Build output directory** | `.vercel/output/static` (relative to Root; if Root is `frontend`, this is under `frontend/`) |
| **Root directory** | `frontend` (so build runs from the frontend folder) |

The `NODE_OPTIONS=--max-old-space-size=4096` increases Node’s memory limit to 4GB so the Next.js build can complete on Cloudflare’s build environment.

## Environment variables

Add in **Settings → Environment variables** (for Production and Preview as needed):

- `NODE_VERSION` = `18`
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key (if used)
- `NEXT_PUBLIC_API_BASE_URL` = your API URL (e.g. `https://api.carwiseiq.com` for production)
