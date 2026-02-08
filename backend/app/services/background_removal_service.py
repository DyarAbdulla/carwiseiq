"""
Background removal service using rembg library
Removes background from car images and returns transparent PNG
"""

import logging
import hashlib
import os
from pathlib import Path
from typing import Optional, Tuple
from io import BytesIO
import requests
from PIL import Image

logger = logging.getLogger(__name__)

# Try to import rembg, fallback to None if not installed
try:
    from rembg import remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    logger.warning(
        "rembg library not installed. Background removal will be disabled. Install with: pip install rembg")

# Cache directory for processed images
CACHE_DIR = Path("cache/background_removed")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def get_image_hash(image_url: str) -> str:
    """Generate a hash for the image URL to use as cache key"""
    return hashlib.md5(image_url.encode()).hexdigest()


def download_image(image_url: str) -> Optional[bytes]:
    """Download image from URL"""
    try:
        # Handle local file paths
        if image_url.startswith('/') or image_url.startswith('./'):
            if os.path.exists(image_url):
                with open(image_url, 'rb') as f:
                    return f.read()
            return None

        # Handle HTTP/HTTPS URLs
        if image_url.startswith('http://') or image_url.startswith('https://'):
            response = requests.get(image_url, timeout=10, stream=True)
            response.raise_for_status()
            return response.content

        return None
    except Exception as e:
        logger.error(f"Error downloading image from {image_url}: {e}")
        return None


def remove_background(image_data: bytes) -> Optional[bytes]:
    """
    Remove background from image using rembg
    Returns transparent PNG as bytes
    """
    if not REMBG_AVAILABLE:
        logger.warning("rembg not available, cannot remove background")
        return None

    try:
        # Use rembg to remove background
        # Output is PNG with alpha channel
        output = remove(image_data)
        return output
    except Exception as e:
        logger.error(f"Error removing background: {e}")
        return None


def process_image(image_url: str, force_refresh: bool = False) -> Optional[str]:
    """
    Process image to remove background and return cached file path

    Args:
        image_url: URL or path to the image
        force_refresh: If True, reprocess even if cached

    Returns:
        Path to cached transparent PNG, or None if processing failed
    """
    if not REMBG_AVAILABLE:
        logger.warning(
            "Background removal not available (rembg not installed)")
        return None

    # Generate cache key
    cache_key = get_image_hash(image_url)
    cached_path = CACHE_DIR / f"{cache_key}.png"

    # Return cached version if exists and not forcing refresh
    if cached_path.exists() and not force_refresh:
        logger.info(f"Using cached background-removed image: {cached_path}")
        return str(cached_path)

    # Download image
    image_data = download_image(image_url)
    if not image_data:
        logger.error(f"Failed to download image: {image_url}")
        return None

    # Remove background
    processed_data = remove_background(image_data)
    if not processed_data:
        logger.error(f"Failed to remove background from: {image_url}")
        return None

    # Save to cache
    try:
        with open(cached_path, 'wb') as f:
            f.write(processed_data)
        logger.info(f"Cached background-removed image: {cached_path}")
        return str(cached_path)
    except Exception as e:
        logger.error(f"Error saving cached image: {e}")
        return None


def get_background_removed_image_url(image_url: str, base_url: str = "http://localhost:8000") -> Optional[str]:
    """
    Get URL for background-removed image (served via API)

    Args:
        image_url: Original image URL
        base_url: Base URL for API

    Returns:
        URL to background-removed image, or None if processing failed
    """
    cache_key = get_image_hash(image_url)
    cached_path = CACHE_DIR / f"{cache_key}.png"

    # Check if cached file exists
    if cached_path.exists():
        # Return API URL to serve the cached file
        return f"{base_url}/api/background-removed/{cache_key}.png"

    # Return None to trigger processing
    return None
