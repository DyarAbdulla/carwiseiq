# CarWiseIQ – Deployment Guide (Cloudflare + VPS)

This guide covers deploying CarWiseIQ to production: frontend on **Cloudflare Pages**, backend on a **VPS with Docker**, and **Cloudflare DNS/SSL/Security**.

---

## 1. Prerequisites

- Domain: `carwiseiq.com` (and `www.carwiseiq.com`) on Cloudflare
- Cloudflare account (Free plan is fine)
- VPS (e.g. DigitalOcean, Linode, Vultr) with Docker installed
- Supabase project with RLS enabled
- Node.js 18+ and npm for local builds

---

## 2. Frontend → Cloudflare Pages

### Option A: Next.js with @cloudflare/next-on-pages (recommended for SSR)

1. **Install adapter**
   ```bash
   cd frontend
   npm install @cloudflare/next-on-pages
   ```

2. **Build**
   ```bash
   npx @cloudflare/next-on-pages
   ```

3. **In Cloudflare Dashboard**
   - Pages → Create project → Connect to Git (or Direct Upload)
   - Build command: `cd frontend && npm run build` (or `npx @cloudflare/next-on-pages` if using adapter)
   - Build output: `frontend/.vercel/output/static` (or per adapter docs)
   - Root: `frontend` if repo root is project root

4. **Environment variables** (Pages → Settings → Environment variables)
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
   - `NEXT_PUBLIC_API_BASE_URL` = `https://api.carwiseiq.com`

### Option B: Static export (no SSR)

1. In `frontend/next.config.js` add:
   ```js
   output: 'export',
   ```
2. Build: `cd frontend && npm run build` → output in `frontend/out`
3. In Cloudflare Pages: Build output directory = `frontend/out`

### Custom domain

- Pages → Custom domains → Add `carwiseiq.com` and `www.carwiseiq.com`
- Redirects: use `frontend/public/_redirects` (www → non-www) or configure in Pages

### Headers

- Use `frontend/public/_headers` for security headers and cache for `/_next/static/*`

---

## 3. Backend → VPS with Docker

### On the VPS

1. **Install Docker and Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Clone repo and set env**
   ```bash
   git clone <your-repo> carwiseiq
   cd carwiseiq/backend
   cp .env.example .env
   # Edit .env: ENV=production, SECRET_KEY=(from python scripts/generate_secret.py), CORS_ORIGINS=https://carwiseiq.com,https://www.carwiseiq.com
   ```

3. **Generate SECRET_KEY**
   ```bash
   python scripts/generate_secret.py
   # Put output in .env as SECRET_KEY=...
   ```

4. **Build and run**
   ```bash
   docker-compose up -d
   ```

5. **Volumes**
   - `users.db` and `uploads/` are mounted from host; ensure paths exist and are writable.
   - Optionally mount `models/` and `data/` if not baked into image.

### Production .env (backend)

- `ENV=production`
- `DEBUG=false`
- `SECRET_KEY` = 32+ char secret from `scripts/generate_secret.py`
- `CORS_ORIGINS=https://carwiseiq.com,https://www.carwiseiq.com`
- `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY` as needed
- `JWT_ACCESS_EXPIRE_MINUTES=15`, `JWT_REFRESH_EXPIRE_DAYS=7`

### SSL on VPS (for Cloudflare Full Strict)

- **Option 1 – Cloudflare Origin Certificate**  
  Cloudflare Dashboard → SSL/TLS → Origin Server → Create Certificate → Install on server (e.g. nginx or Caddy in front of Docker).

- **Option 2 – Let’s Encrypt**
  ```bash
  sudo apt install certbot
  sudo certbot certonly --standalone -d api.carwiseiq.com
  ```
  Then point your reverse proxy (nginx/Caddy) to the certs and to `localhost:8000` (Docker).

---

## 4. Cloudflare DNS

- **A or CNAME for API**
  - Name: `api` (or `api.carwiseiq.com` if FQDN)
  - Target: your VPS IP (A) or hostname (CNAME)
  - Proxy status: **Proxied** (orange cloud) for DDoS and WAF

- **Pages**
  - `carwiseiq.com` and `www.carwiseiq.com` point to the Pages project (via Cloudflare’s automatic CNAME or your config).

---

## 5. Cloudflare SSL/TLS

- SSL/TLS mode: **Full (Strict)**
- Edge Certificates: **Always Use HTTPS** = On
- Minimum TLS Version: 1.2
- (Optional) HSTS: Enable and preload

---

## 6. Cloudflare Security (WAF, Bot, Rate Limit)

- **WAF**
  - Managed Ruleset: ON  
  - OWASP Core Ruleset: ON  
  - Custom rule (optional): block or challenge `/api/admin/*` from non-whitelisted IPs.

- **Bot Fight Mode**
  - Enable (free tier).

- **Rate limiting (optional)**
  - Rule for `/api/auth/*`: 10 req/min per IP.
  - Rule for `/api/predict`: 30 req/min per IP.

- **Firewall**
  - Block known bad user agents; optionally challenge requests with no user agent.

---

## 7. Verification

1. **Frontend**: `https://carwiseiq.com` loads; locale routes (e.g. `/en`, `/ar`, `/ku`) work; PWA and i18n intact.
2. **API**: `https://api.carwiseiq.com/api/health` returns 200.
3. **Auth**: Login/register and token refresh work; cookies are `Secure` in production.
4. **CORS**: Requests from `https://carwiseiq.com` to `https://api.carwiseiq.com` succeed; no CORS errors.

---

## 8. SQLite backup (backend)

Run periodically (cron):

```bash
cd backend
./scripts/backup_db.sh
# Backups go to backend/backups/ by default
```

---

## 9. Security audit (backend)

```bash
cd backend
pip install pip-audit
./scripts/security_audit.sh
```

Fix any reported vulnerabilities and pin dependency versions in `requirements.txt`.
