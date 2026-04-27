"""Resize, re-encode, and watermark listing photos before storage."""

from __future__ import annotations

import io
import os
from typing import Optional

from PIL import Image

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _resolve_logo_path(logo_path: Optional[str]) -> str:
    if logo_path and os.path.isfile(logo_path):
        return logo_path
    preferred = os.path.join(_APP_DIR, "assets", "logobuysell.jpg")
    if os.path.isfile(preferred):
        return preferred
    backend_dir = os.path.dirname(_APP_DIR)
    root_dir = os.path.dirname(backend_dir)
    for candidate in (
        os.path.join(root_dir, "logobuysell.jpg"),
        os.path.join(root_dir, "frontend", "public", "logobuysell.jpg"),
    ):
        if os.path.isfile(candidate):
            return candidate
    return preferred


def process_upload_image(
    image_bytes: bytes, logo_path: Optional[str] = None
) -> bytes:
    """Resize wide images, apply optional watermark, return JPEG bytes (quality 90, progressive)."""
    path = _resolve_logo_path(logo_path)
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    if img.width > 1920:
        ratio = 1920 / img.width
        img = img.resize((1920, int(img.height * ratio)), Image.LANCZOS)
    try:
        logo = Image.open(path).convert("RGBA")
        base = img.convert("RGBA")
        logo_w = int(base.width * 0.18)
        logo_h = int(logo_w * logo.height / logo.width)
        logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
        logo_alpha = logo.split()[3].point(lambda p: int(p * 0.6))
        logo.putalpha(logo_alpha)
        base.paste(logo, (base.width - logo_w - 12, base.height - logo_h - 12), logo)
        img = base.convert("RGB")
    except Exception:
        pass
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90, progressive=True, optimize=True)
    return out.getvalue()
