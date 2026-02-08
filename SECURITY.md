# CarWiseIQ – Security Documentation

This document describes the security hardening applied to CarWiseIQ (backend, frontend, and database).

---

## 1. Backend Security

### 1.1 Environment and secrets

- All secrets are loaded from `.env` (never hardcoded): `SECRET_KEY`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY`, database paths, etc.
- Production startup fails if critical env vars are missing (e.g. `SECRET_KEY` with at least 32 characters). See `app/config.py` → `check_required_env_production()`.
- `.env.example` documents required variables; real values are only in `.env` (gitignored).

### 1.2 JWT hardening

- **SECRET_KEY**: Minimum 256-bit (32 chars) in production; generated via `backend/scripts/generate_secret.py`.
- **Access token**: Short expiry (default 15 min), configurable via `JWT_ACCESS_EXPIRE_MINUTES`.
- **Refresh token**: 7-day expiry; **rotation** – each use invalidates the old refresh token and issues a new one.
- **Claims**: Access tokens include `iss` and `aud`; REST API validation checks `exp`, and `iss`/`aud` when present (backward compatible for older tokens).
- **Cookies**: In production, auth cookies use `Secure` and `HttpOnly`; `SameSite=Lax`.

### 1.3 Rate limiting

- Path-specific limits (in-memory; use Redis for multi-worker):
  - `/api/auth/login`, `/api/auth/register`: 5 req/min per IP.
  - Other auth: 10 req/min.
  - `/api/predict`: 30 req/min.
  - Read/health: 100 req/min (health 1000).
- Implemented in `app/middleware/security.py` (`SecurityMiddleware`).

### 1.4 Input validation

- All API inputs use Pydantic models with strict validation (e.g. prediction: year, mileage, price ranges, make/model in schemas).
- File uploads (images): extension allowlist, 5MB max, **magic-byte** validation (JPEG/PNG/WebP) to prevent disguised executables. See `app/api/routes/images.py`.
- Path traversal: file-serving endpoints (e.g. `/api/car-images/{filename}`) validate filename format and resolve path inside allowed directory only.

### 1.5 Security headers

- Set in `SecurityMiddleware`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy`, `Permissions-Policy`.
- Production only: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- **Content-Security-Policy**: Restrictive directives (e.g. `default-src 'self'`, script/style/img/connect/font/frame-ancestors/base-uri/form-action) allowing your domains, Supabase, and API.

### 1.6 CORS

- Production: allowed origins from `CORS_ORIGINS` (e.g. `https://carwiseiq.com`, `https://www.carwiseiq.com` only). No localhost in production.
- Development: localhost origins allowed via config.

### 1.7 Error handling

- Global exception handler in `app/main.py`: returns generic message (`"An error occurred. Please try again later."`) with 500; detailed errors and stack traces are logged server-side only.
- API responses do not expose internal paths, stack traces, or raw database errors.

### 1.8 Docs in production

- When `ENV=production`, `/docs` and `/redoc` are disabled (`docs_url=None`, `redoc_url=None`).

### 1.9 SQL injection prevention

- All SQLite access uses parameterized queries (e.g. `cursor.execute("... WHERE id = ?", (id,))`). No string concatenation for user input in queries.
- SQLite: `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON`; optional `PRAGMA secure_delete=ON` in `auth_service.get_db()`.

### 1.10 Admin endpoints

- All `/api/admin/*` routes require admin authentication and role verification (`require_admin`, `require_permission`).
- Admin actions (login, logout, delete user, trigger retrain) are logged via `log_admin_action` in admin service.

### 1.11 Dependency security

- `backend/scripts/security_audit.sh` runs `pip-audit` (or `safety`) to check for known vulnerabilities.
- Dependencies are pinned in `requirements.txt`; run the audit script in CI and after dependency updates.

---

## 2. Frontend Security

### 2.1 Environment variables

- Only `NEXT_PUBLIC_*` are exposed to the browser. `SUPABASE_SERVICE_ROLE_KEY` and backend secrets must never be used in frontend code.
- `.env.example` documents public vars and warns against exposing service role key.

### 2.2 Auth (Supabase)

- Supabase Auth with PKCE for OAuth where applicable.
- Tokens in HTTP-only cookies for backend auth; Supabase session handled by client with automatic refresh (see `lib/api.ts` / `lib/supabase`).
- Production cookies: `Secure` set by backend for auth cookies.

### 2.3 Content Security Policy

- CSP headers set in `next.config.js` (production) and in `frontend/public/_headers` for Cloudflare Pages: strict `default-src 'self'`, script/style/img/connect/font/frame-ancestors/base-uri/form-action as needed for Next.js and Supabase.

### 2.4 XSS prevention

- User-generated content (listings, messages, feedback) should be rendered as text or sanitized; avoid `dangerouslySetInnerHTML` or use a sanitizer (e.g. DOMPurify) if HTML is required.
- CSP restricts script sources to reduce XSS impact.

### 2.5 API client (`lib/api.ts`)

- Request timeout: 30 seconds.
- Retry with exponential backoff for 5xx responses (max 2 retries).
- With credentials for cookies; error handling via interceptors.

### 2.6 Images

- External images via `next/image` with `remotePatterns` in `next.config.js` (Supabase, CDN, carwiseiq.com). Validate image URLs before rendering where applicable.

### 2.7 Dependency audit

- Run `npm audit` and fix critical/high issues; add `npm audit` to CI.

---

## 3. Database Security

### 3.1 Supabase (PostgreSQL)

- **RLS**: Row Level Security enabled on all public tables. Policies:
  - **car_listings**: Users can INSERT/UPDATE/DELETE only their own (`auth.uid() = user_id`); anyone can SELECT active listings.
  - **favorites**: Users manage only their own favorites.
  - **user_activity**: Users read only their own activity.
  - **users (profiles)**: Users update only their own profile; SELECT limited to public profile fields.
- **Storage**: RLS on `car_images` bucket: authenticated upload; public read. Enforce file size and MIME type in storage policies.
- **Service role**: The Supabase `service_role` key is never used in frontend; only the `anon` key is used in the browser.

### 3.2 SQLite (backend)

- WAL mode and foreign keys enabled on connection; optional secure_delete.
- All queries parameterized; no user input in raw SQL.
- Backup: `backend/scripts/backup_db.sh` for periodic `users.db` (and other `.db`) backups.

---

## 4. File Upload Security

- Allowed types: JPEG, PNG, WebP (extension and **magic-byte** check).
- Max size: 5MB per file.
- Uploaded files stored outside web root where possible; serving uses safe path resolution and `Content-Disposition` where appropriate.
- EXIF stripping can be added in a future pass if required for privacy.

---

## 5. Deployment Security (Cloudflare)

- SSL/TLS: Full (Strict); minimum TLS 1.2; HSTS enabled.
- WAF: Managed ruleset and OWASP Core Ruleset; optional custom rule for `/api/admin/*`.
- Bot Fight Mode enabled; rate limiting at edge for auth and predict endpoints as documented in `DEPLOYMENT.md`.
- DNSSEC, SPF/DKIM/DMARC for email domain as recommended in the prompt.

---

## 6. Scripts and Automation

- **Generate secret**: `backend/scripts/generate_secret.py` – use for `SECRET_KEY`.
- **Backup DB**: `backend/scripts/backup_db.sh` – run via cron.
- **Security audit**: `backend/scripts/security_audit.sh` – run `pip-audit` (or safety) in CI and after dependency changes.

For step-by-step deployment (Cloudflare Pages, VPS Docker, DNS, SSL, WAF), see **DEPLOYMENT.md**.
