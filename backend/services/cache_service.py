"""
Cache service for storing scraped data
Uses in-memory dictionary (can be replaced with Redis)
Cache TTL: 24 hours
"""

import logging
import time
import hashlib
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class CacheService:
    """In-memory cache service with TTL"""
    
    def __init__(self, ttl_seconds: int = 24 * 60 * 60):
        """
        Initialize cache service
        
        Args:
            ttl_seconds: Time to live in seconds (default: 24 hours)
        """
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl_seconds
    
    def _hash_key(self, url: str) -> str:
        """Generate hash key for URL"""
        return hashlib.md5(url.encode()).hexdigest()
    
    def get(self, url: str) -> Optional[Dict[str, Any]]:
        """
        Get cached data for URL
        
        Args:
            url: URL to lookup
            
        Returns:
            Cached data or None if not found/expired
        """
        key = self._hash_key(url)
        
        if key not in self.cache:
            return None
        
        cached_item = self.cache[key]
        cached_time = cached_item.get('timestamp', 0)
        
        # Check if expired
        if time.time() - cached_time > self.ttl:
            # Remove expired item
            del self.cache[key]
            logger.debug(f"Cache expired for URL: {url}")
            return None
        
        logger.debug(f"Cache hit for URL: {url}")
        return cached_item.get('data')
    
    def set(self, url: str, data: Dict[str, Any]):
        """
        Cache data for URL
        
        Args:
            url: URL to cache
            data: Data to cache
        """
        key = self._hash_key(url)
        self.cache[key] = {
            'data': data,
            'timestamp': time.time(),
        }
        logger.debug(f"Cached data for URL: {url}")
    
    def clear(self):
        """Clear all cached data"""
        self.cache.clear()
        logger.info("Cache cleared")
    
    def size(self) -> int:
        """Get number of cached items"""
        return len(self.cache)
