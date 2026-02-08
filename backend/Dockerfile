# CarWiseIQ Backend - Production Dockerfile
# Python 3.11 slim; runs FastAPI app (app.main:app) with gunicorn + uvicorn workers

FROM python:3.11-slim

WORKDIR /app

# System deps for building some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies (pin versions in requirements.txt)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code (app/, models/, data/, etc.)
COPY . .

# Create dirs for runtime
RUN mkdir -p logs uploads

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run with gunicorn + uvicorn workers (4 workers; adjust per CPU)
# Use app.main:app when app is the package under backend/
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
