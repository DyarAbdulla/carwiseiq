"""
Security middleware: rate limiting (path-specific) and security headers.
- Auth endpoints: 5 req/min per IP
- Prediction endpoints: 30 req/min per IP
- Read endpoints: 100 req/min per IP
- HSTS, CSP, X-Content-Type-Options, X-Frame-Options, etc.
"""
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import time
from collections import defaultdict
from typing import Dict, List, Tuple
import logging
import os

logger = logging.getLogger(__name__)

# In-memory rate limit store (use Redis in production for multi-worker)
rate_limit_store: Dict[str, list] = defaultdict(list)

ENV = os.getenv("ENV", "development").lower()
DEBUG = os.getenv("DEBUG", "True").lower() == "true"


def _get_rate_limit_for_path(path: str) -> int:
    """Return requests per minute allowed for this path."""
    if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
        return 5
    if path.startswith("/api/auth/"):
        return 10
    if path.startswith("/api/predict"):
        return 30
    if path.startswith("/api/health"):
        return 1000  # Health checks lenient
    # Read-heavy and other endpoints
    return 100


class SecurityMiddleware(BaseHTTPMiddleware):
    """Add security headers and path-specific rate limiting."""

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Rate limiting (skip in dev for localhost if desired)
        is_localhost = client_ip in ("127.0.0.1", "::1", "localhost") or client_ip.startswith("127.") or client_ip.startswith("::1")
        if ENV == "production" or not is_localhost:
            threshold = _get_rate_limit_for_path(path)
            current_time = time.time()
            minute_ago = current_time - 60
            key = f"{client_ip}:{path.split('/')[2] if len(path.split('/')) > 2 else path}"
            rate_limit_store[key] = [t for t in rate_limit_store[key] if t > minute_ago]
            if len(rate_limit_store[key]) >= threshold:
                logger.warning(f"Rate limit exceeded for {client_ip} on {path} (limit={threshold}/min)")
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many requests. Please try again later."},
                )
            rate_limit_store[key].append(current_time)

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS (production only, HTTPS)
        if ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Content-Security-Policy (strict; allow your domains, Supabase, Cloudflare)
        csp_parts = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://*.supabase.co https://carwiseiq.com https://www.carwiseiq.com https://cdn.iqcars.io",
            "connect-src 'self' https://*.supabase.co https://api.carwiseiq.com https://carwiseiq.com https://www.carwiseiq.com",
            "font-src 'self' data:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_parts)

        return response
