"""
AI detection API: car make/model/color from images.
POST /api/ai/detect-car: multipart listing_id + optional images (2-6). (Legacy CLIP-based)
POST /api/ai/detect-car-vision: JSON { images: [{ data, media_type }] } (local CNN, 4-10 images).
"""

import base64
import logging
import os
import uuid
import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Depends
from pydantic import BaseModel

from app.api.routes.auth import get_current_user, UserResponse
from app.services.car_model_service import detect_car_from_images as detect_car_from_images_local
from app.services.marketplace_service import (
    get_listing,
    add_listing_images,
    delete_listing_images,
    get_db,
)
from app.services.car_detection_service import (
    detect_car_from_images,
    get_image_hash,
    get_labels_version,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Match marketplace: from app/api/routes -> app
_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(_BASE, "uploads", "listings")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _resolve_listing_image_paths(listing_id: int) -> List[str]:
    """Get resolved file paths for listing images. Same logic as marketplace auto_detect."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT file_path FROM listing_images
        WHERE listing_id = ? AND file_path IS NOT NULL
        ORDER BY display_order
    """, (listing_id,))
    rows = cursor.fetchall()
    conn.close()

    upload_dir = Path(UPLOAD_DIR)
    base = Path(_BASE)
    paths = []
    for row in rows:
        raw = row["file_path"]
        if not raw:
            continue
        p = Path(raw)
        if not p.is_absolute():
            resolved = upload_dir / (p.name if p.name else p)
            if not resolved.exists():
                resolved = base / raw
            p = resolved
        if p.exists():
            paths.append(str(p))
        else:
            logger.warning("Image file not found: %s", p)
    return paths


def _run_detection_and_update(
    listing_id: int,
    image_paths: List[str],
) -> dict:
    """Load valid makes/models, run detect_car_from_images, update listing. Returns detection dict."""
    valid_makes = None
    valid_models_by_make = None
    try:
        from app.services.dataset_loader import DatasetLoader
        loader = DatasetLoader.get_instance()
        df = loader.dataset
        if df is not None and len(df) > 0:
            makes = df["make"].dropna().unique().tolist()
            valid_makes = sorted(list({str(m).strip() for m in makes if str(m).strip()}))
            valid_models_by_make = {}
            for make in valid_makes:
                sub = df[df["make"].str.lower().eq(str(make).lower())]
                models = sub["model"].dropna().unique().tolist()
                valid_models_by_make[make] = sorted(list({str(m).strip() for m in models if str(m).strip()}))
    except Exception as e:
        logger.warning("Could not load valid makes/models: %s", e)

    detection = detect_car_from_images(
        image_paths,
        valid_makes=valid_makes,
        valid_models_by_make=valid_models_by_make,
    )

    best = detection.get("best") or {}
    meta = detection.get("meta") or {}
    prefill = {
        "make": best.get("make", {}).get("value") if best.get("make") else None,
        "model": best.get("model", {}).get("value") if best.get("model") else None,
        "color": best.get("color", {}).get("value") if best.get("color") else None,
        "year": best.get("year", {}).get("value") if best.get("year") else None,
    }

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE listings SET auto_detect = ?, prefill = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (json.dumps(detection), json.dumps(prefill), listing_id))
    conn.commit()
    conn.close()

    return detection


class ImageInput(BaseModel):
    data: str  # base64
    media_type: str = "image/jpeg"


class DetectCarVisionRequest(BaseModel):
    images: List[ImageInput]


def _decode_base64_to_bytes(b64: str) -> bytes:
    """Decode base64 string, optionally stripping data URL prefix."""
    s = (b64 or "").strip()
    if "," in s:
        s = s.split(",", 1)[-1]
    return base64.b64decode(s)


@router.post("/detect-car-vision")
async def detect_car_vision(
    body: DetectCarVisionRequest,
):
    """
    Local CNN: detect car make and model from 4-10 images (base64).
    Uses trained EfficientNetB4 (models/car_classifier.keras). Returns { make?, model?, confidence, error? }.
    No auth required so sell flow can run before login; rate-limit at gateway if needed.
    """
    if len(body.images) < 4:
        raise HTTPException(status_code=400, detail="Please upload at least 4 images for AI detection")
    if len(body.images) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed")

    try:
        raw_list = [_decode_base64_to_bytes(i.data) for i in body.images]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {e}")

    out = detect_car_from_images_local(raw_list)
    if out.get("error") and not out.get("make") and not out.get("model"):
        return {
            "make": None,
            "model": None,
            "confidence": 0.0,
            "error": out["error"],
        }
    return {
        "make": out.get("make"),
        "model": out.get("model"),
        "confidence": out.get("confidence", 0.0),
        "error": out.get("error"),
    }


@router.post("/detect-car")
async def detect_car(
    listing_id: int = Form(...),
    images: Optional[List[UploadFile]] = File(default=None),
    current_user: Optional[UserResponse] = Depends(get_current_user),
):
    """
    Run car detection on 2-6 images. Accepts multipart: listing_id (required), images (optional).
    - If images provided: replace listing images, save, run detection. Returns image_urls.
    - If no images: run detection on existing listing images (re-run). Requires at least 2.
    """
    files = images or []
    logger.info("detect-car: listing_id=%s, num_images=%s", listing_id, len(files))

    listing = get_listing(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if current_user and listing.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    image_urls: List[str] = []
    image_ids: List[int] = []

    if len(files) > 0:
        if len(files) < 2 or len(files) > 6:
            raise HTTPException(status_code=400, detail="Provide 2–6 images")
        # Replace existing images: delete then add
        delete_listing_images(listing_id)
        uploaded = []
        for idx, im in enumerate(files):
            ext = os.path.splitext(im.filename or "")[1] or ".jpg"
            fname = f"{listing_id}_{uuid.uuid4()}{ext}"
            fpath = os.path.join(UPLOAD_DIR, fname)
            content = await im.read()
            with open(fpath, "wb") as f:
                f.write(content)
            url = f"/uploads/listings/{fname}"
            uploaded.append({
                "url": url,
                "file_path": fpath,
                "is_primary": idx == 0,
                "display_order": idx,
            })
        image_ids = add_listing_images(listing_id, uploaded)
        image_urls = [u["url"] for u in uploaded]
        logger.info("Saved %s images for listing %s, paths count=%s", len(uploaded), listing_id, len(uploaded))

    image_paths = _resolve_listing_image_paths(listing_id)
    logger.info("Resolved %s image paths for listing %s", len(image_paths), listing_id)

    if len(image_paths) < 2:
        return {
            "status": "error",
            "make": None,
            "model": None,
            "color": None,
            "confidence": 0.0,
            "confidence_label": "LOW",
            "per_image": [],
            "debug": {"error": "At least 2 images required"},
            **({"image_urls": image_urls} if image_urls else {}),
        }

    try:
        detection = _run_detection_and_update(listing_id, image_paths)
    except Exception as e:
        logger.error("Detection failed: %s", e, exc_info=True)
        return {
            "status": "error",
            "make": None,
            "model": None,
            "color": None,
            "confidence": 0.0,
            "confidence_label": "LOW",
            "per_image": [],
            "debug": {"error": str(e)},
            **({"image_urls": image_urls} if image_urls else {}),
        }

    best = detection.get("best") or {}
    meta = detection.get("meta") or {}
    status = meta.get("status", "ok")
    cl = (meta.get("confidence_level") or "low").upper()
    if cl not in ("LOW", "MEDIUM", "HIGH"):
        cl = "LOW"

    def _v(k: str):
        b = best.get(k)
        return (b or {}).get("value") if b else None

    def _c(k: str):
        b = best.get(k)
        return float((b or {}).get("confidence", 0) or 0)

    make, model, color = _v("make"), _v("model"), _v("color")
    conf = 0.0
    if make or model or color:
        vals = [_c("make"), _c("model"), _c("color")]
        conf = sum(vals) / len([v for v in vals if v > 0]) if any(v > 0 for v in vals) else 0.0

    out = {
        "status": status,
        "make": make,
        "model": model,
        "color": color,
        "confidence": round(conf, 2),
        "confidence_label": cl,
        "per_image": [],
        "debug": meta.get("debug"),
    }
    if image_urls:
        out["image_urls"] = image_urls
    if image_ids:
        out["image_ids"] = image_ids
    return out
