"""
Claude Vision service: detect car make and model from images via Anthropic API.
Used by the sell flow when user uploads 4-10 images and clicks Next.
"""

import json
import logging
import re
from typing import List, Optional, Tuple

from app.config import settings

logger = logging.getLogger(__name__)

# Model with vision support; override via ANTHROPIC_MODEL env
DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

PROMPT = """Analyze these car images and identify the make and model of the vehicle.
Use all images to improve accuracy. Images may show different angles of the same car.
Return ONLY valid JSON in this exact format, no other text:
{"make": "string or null", "model": "string or null", "confidence": number between 0 and 1}
Examples: {"make": "BMW", "model": "X5", "confidence": 0.85}
{"make": "Toyota", "model": "Camry", "confidence": 0.92}
If you cannot identify make or model, use null and set confidence to 0."""


def _parse_response(text: str) -> Tuple[Optional[str], Optional[str], float]:
    """Extract make, model, confidence from Claude's text. Handles markdown code blocks."""
    text = (text or "").strip()
    # Strip markdown code block if present
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        text = m.group(1).strip()
    # Also try to find {...}
    m = re.search(r"\{[^{}]*\}", text)
    if m:
        text = m.group(0)
    try:
        data = json.loads(text)
        make = data.get("make")
        model = data.get("model")
        conf = float(data.get("confidence", 0) or 0)
        conf = max(0.0, min(1.0, conf))
        return (
            str(make).strip() if make and str(make).strip() else None,
            str(model).strip() if model and str(model).strip() else None,
            conf,
        )
    except Exception as e:
        logger.warning("Failed to parse Claude JSON: %s", e)
        return None, None, 0.0


def detect_car_make_model(images: List[dict]) -> dict:
    """
    images: list of {"data": base64_string, "media_type": "image/jpeg"|"image/png"|"image/webp"}
    Returns: {"make": str|None, "model": str|None, "confidence": float, "error": str|None}
    """
    api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
    if not api_key or not str(api_key).strip():
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": "ANTHROPIC_API_KEY is not configured",
        }

    if not images or len(images) < 4 or len(images) > 10:
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": "Between 4 and 10 images are required",
        }

    model_id = getattr(settings, "ANTHROPIC_MODEL", None) or DEFAULT_MODEL

    # Build content: text + image blocks
    content: List[dict] = [{"type": "text", "text": PROMPT}]
    for img in images[:10]:  # cap at 10
        data = img.get("data") or img.get("base64")
        mt = (img.get("media_type") or "image/jpeg").strip().lower()
        if not data:
            continue
        # Remove data URL prefix if present
        if "," in str(data):
            data = str(data).split(",", 1)[-1]
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": mt, "data": data},
        })

    if len(content) <= 1:
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": "No valid image data",
        }

    max_retries = 2
    last_error: Optional[str] = None

    for attempt in range(max_retries):
        try:
            import anthropic

            client = anthropic.Anthropic(api_key=api_key)
            msg = client.messages.create(
                model=model_id,
                max_tokens=512,
                messages=[{"role": "user", "content": content}],
            )
            text = ""
            for b in (msg.content or []):
                if getattr(b, "text", None):
                    text += b.text
            make, model, conf = _parse_response(text)
            return {
                "make": make,
                "model": model,
                "confidence": conf,
                "error": None,
            }
        except ImportError:
            return {
                "make": None,
                "model": None,
                "confidence": 0.0,
                "error": "anthropic package not installed",
            }
        except Exception as e:
            last_error = str(e)
            logger.warning("Claude vision attempt %s failed: %s", attempt + 1, e)
            if attempt + 1 >= max_retries:
                break

    return {
        "make": None,
        "model": None,
        "confidence": 0.0,
        "error": last_error or "AI detection failed",
    }
