"""Resize, re-encode, and watermark listing photos before storage."""

from __future__ import annotations

import io
import logging
import os

from PIL import Image

logger = logging.getLogger(__name__)


def find_logo() -> str | None:
    candidates = [
        os.path.join(os.path.dirname(__file__), "../../assets/logobuysell.jpg"),
        os.path.join(os.path.dirname(__file__), "../assets/logobuysell.jpg"),
        "app/assets/logobuysell.jpg",
        "logobuysell.jpg",
        "frontend/public/logobuysell.jpg",
    ]
    for p in candidates:
        if os.path.exists(p):
            return os.path.abspath(p)
    return None


def process_upload_image(image_bytes: bytes) -> bytes:
    """Resize wide images, apply optional watermark, return JPEG bytes (quality 90, progressive)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if img.width > 1920:
        ratio = 1920 / img.width
        img = img.resize((1920, int(img.height * ratio)), Image.LANCZOS)

    logo_path = find_logo()
    if not logo_path:
        logger.warning("WATERMARK: logobuysell.jpg not found — watermark skipped")
    else:
        try:
            logo = Image.open(logo_path).convert("RGBA")
            base = img.convert("RGBA")
            logo_w = int(base.width * 0.18)
            logo_h = int(logo_w * logo.height / logo.width)
            logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
            logo_alpha = logo.split()[3].point(lambda p: int(p * 0.6))
            logo.putalpha(logo_alpha)
            base.paste(logo, (base.width - logo_w - 12, base.height - logo_h - 12), logo)
            img = base.convert("RGB")
        except Exception:
            logger.warning("WATERMARK: failed to apply logo from %s", logo_path, exc_info=True)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90, progressive=True, optimize=True)
    return out.getvalue()
