# Cloudflare Pages build configuration

Use these settings in **Cloudflare Dashboard → your project → Settings → Build & deployments → Build configuration** and **Environment variables**.

## Required: Node 20

Build fails on Node 18 (heap OOM and EBADENGINE from Supabase/Vercel tooling). **You must set Node 20.**

In **Settings → Environment variables** add (Production and Preview):

| Variable | Value |
|----------|--------|
| **NODE_VERSION** | `20` |
| **NODE_OPTIONS** | `--max-old-space-size=8192` |

`NODE_OPTIONS=--max-old-space-size=8192` gives the Next.js build 8GB heap to avoid "JavaScript heap out of memory".

## Build configuration

| Setting | Value |
|--------|--------|
| **Framework preset** | None |
| **Build command** | `NODE_OPTIONS=--max-old-space-size=8192 npx @cloudflare/next-on-pages@1` |
| **Build output directory** | `.vercel/output/static` (relative to Root; if Root is `frontend`, path is under `frontend/`) |
| **Root directory** | `frontend` |

## Other environment variables

Add as needed for your app:

- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key (if used)
- `NEXT_PUBLIC_API_BASE_URL` = your API URL (e.g. `https://api.carwiseiq.com` for production)

## If build still runs out of memory

1. Confirm **NODE_VERSION=20** and **NODE_OPTIONS=--max-old-space-size=8192** are set in Cloudflare (not only in build command; the env vars ensure the whole process uses them).
2. Cloudflare Pages may have a hard memory cap; if 8GB still fails, consider building locally or in CI and deploying the `.vercel/output/static` artifact, or migrating to the OpenNext Cloudflare adapter (see [OpenNext Cloudflare](https://opennext.js.org/cloudflare)).
