"""
Rate limiting middleware
Limits requests per IP address
"""

import time
from typing import Dict, Tuple
from collections import defaultdict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

# Rate limit storage: IP -> (request_count, reset_time)
rate_limit_store: Dict[str, Tuple[int, float]] = defaultdict(lambda: (0, 0))

# Rate limit settings
RATE_LIMIT_REQUESTS = 100  # Max requests per hour
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to limit requests per IP address"""
    
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Skip rate limiting for health check
        if request.url.path == "/api/health":
            return await call_next(request)
        
        # Bypass rate limiting for localhost/127.0.0.1 in development
        import os
        is_development = os.getenv("ENV", "development").lower() == "development"
        is_localhost = client_ip in ["127.0.0.1", "localhost", "::1"] or client_ip.startswith("127.")
        
        if is_development and is_localhost:
            # No rate limiting for localhost in dev mode
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = "unlimited"
            response.headers["X-RateLimit-Remaining"] = "unlimited"
            return response
        
        current_time = time.time()
        count, reset_time = rate_limit_store[client_ip]
        
        # Reset counter if window expired
        if current_time > reset_time:
            count = 0
            reset_time = current_time + RATE_LIMIT_WINDOW
        
        # Check rate limit
        if count >= RATE_LIMIT_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {RATE_LIMIT_REQUESTS} requests per hour. Try again later."
            )
        
        # Increment counter
        count += 1
        rate_limit_store[client_ip] = (count, reset_time)
        
        # Add rate limit headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_REQUESTS)
        response.headers["X-RateLimit-Remaining"] = str(RATE_LIMIT_REQUESTS - count)
        response.headers["X-RateLimit-Reset"] = str(int(reset_time))
        
        return response
