# Deployment Guide

Complete deployment instructions for the Car Price Predictor system.

## Table of Contents

1. [Quick Start with Docker](#quick-start-with-docker)
2. [Manual Deployment](#manual-deployment)
3. [Platform-Specific Deployment](#platform-specific-deployment)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- At least 2GB RAM available
- Ports 8000 (backend) and 3002 (frontend) available

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd car-price-predictor
   ```

2. **Create environment file**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Check status**
   ```bash
   docker-compose ps
   docker-compose logs backend
   ```

5. **Access the application**
   - Frontend: http://localhost:3002
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## Manual Deployment

### Backend Deployment

#### Option A: Railway

1. **Create Railway account** at https://railway.app
2. **Create new project** and connect GitHub repository
3. **Add service** → Select backend directory
4. **Set environment variables**:
   ```
   MOCK_MODE=False
   DEBUG=False
   PORT=8000
   ```
5. **Deploy** - Railway will auto-detect Python and install dependencies

#### Option B: Render

1. **Create Render account** at https://render.com
2. **New Web Service** → Connect repository
3. **Settings**:
   - Build Command: `cd backend && pip install -r requirements.txt`
   - Start Command: `cd backend && python main.py`
   - Environment: Python 3
4. **Set environment variables** (same as Railway)
5. **Deploy**

#### Option C: VPS (Ubuntu/Debian)

1. **SSH into server**
   ```bash
   ssh user@your-server-ip
   ```

2. **Install dependencies**
   ```bash
   sudo apt update
   sudo apt install python3.11 python3.11-venv nginx
   ```

3. **Clone repository**
   ```bash
   git clone <repository-url>
   cd car-price-predictor/backend
   ```

4. **Create virtual environment**
   ```bash
   python3.11 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

5. **Create systemd service**
   ```bash
   sudo nano /etc/systemd/system/car-predictor.service
   ```
   
   Add:
   ```ini
   [Unit]
   Description=Car Price Predictor Backend
   After=network.target

   [Service]
   User=your-user
   WorkingDirectory=/path/to/car-price-predictor/backend
   Environment="PATH=/path/to/car-price-predictor/backend/venv/bin"
   ExecStart=/path/to/car-price-predictor/backend/venv/bin/python main.py
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

6. **Start service**
   ```bash
   sudo systemctl enable car-predictor
   sudo systemctl start car-predictor
   sudo systemctl status car-predictor
   ```

7. **Configure Nginx** (optional, for reverse proxy)
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### Frontend Deployment

#### Option A: Vercel (Recommended)

1. **Create Vercel account** at https://vercel.com
2. **Import project** from GitHub
3. **Configure**:
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Environment Variables:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend-url.com
     ```
4. **Deploy**

#### Option B: Netlify

1. **Create Netlify account** at https://netlify.com
2. **New site from Git** → Connect repository
3. **Build settings**:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/.next`
4. **Set environment variables**
5. **Deploy**

---

## Environment Variables

### Backend (.env)

```env
# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# Mode
MOCK_MODE=False

# Optional: External APIs
EDMUNDS_API_KEY=your-edmunds-api-key-here

# Redis (optional, for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS (comma-separated)
CORS_ORIGINS=http://localhost:3002,https://yourdomain.com
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Database Setup

The SQLite database is created automatically on first run.

For production, consider migrating to PostgreSQL:

1. Install PostgreSQL
2. Create database
3. Update `database.py` to use PostgreSQL connection
4. Run migrations

---

## Custom Domain Setup

### Backend API

1. **Get domain** (e.g., api.yourdomain.com)
2. **Point DNS** to your server IP
3. **Configure SSL** with Let's Encrypt:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```
4. **Update frontend** `NEXT_PUBLIC_API_URL` to `https://api.yourdomain.com`

### Frontend

1. **Get domain** (e.g., yourdomain.com)
2. **Point DNS** to Vercel/Netlify (provided in dashboard)
3. **SSL is automatic** on Vercel/Netlify

---

## Troubleshooting

### Backend won't start

1. **Check logs**
   ```bash
   docker-compose logs backend
   # or
   journalctl -u car-predictor -f
   ```

2. **Check port availability**
   ```bash
   netstat -tulpn | grep 8000
   ```

3. **Check Python version**
   ```bash
   python --version  # Should be 3.11+
   ```

### Frontend can't connect to backend

1. **Check CORS settings** in backend
2. **Verify API URL** in frontend environment variables
3. **Check browser console** for errors
4. **Test API directly**: `curl http://localhost:8000/api/health`

### Database errors

1. **Check file permissions**
   ```bash
   ls -la backend/car_predictions.db
   chmod 664 backend/car_predictions.db
   ```

2. **Check disk space**
   ```bash
   df -h
   ```

### High memory usage

1. **Reduce cache TTL** in `cache_service.py`
2. **Limit batch size** in batch processing
3. **Use Redis** for distributed caching

---

## Performance Optimization

1. **Enable Redis caching** (recommended for production)
2. **Use CDN** for frontend static assets
3. **Enable compression** in Nginx/Reverse proxy
4. **Monitor** with tools like Prometheus + Grafana
5. **Set up logging** aggregation (e.g., Logtail, Papertrail)

---

## Security Checklist

- [ ] Change default secrets
- [ ] Enable HTTPS/SSL
- [ ] Set up rate limiting
- [ ] Configure firewall rules
- [ ] Enable CORS properly
- [ ] Regular security updates
- [ ] Backup database regularly
- [ ] Monitor error logs

---

## Support

For issues, check:
- Backend logs: `backend/logs/errors.log`
- Docker logs: `docker-compose logs`
- System logs: `journalctl -u car-predictor`

For help, open an issue on GitHub.
