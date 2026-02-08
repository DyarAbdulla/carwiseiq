"""
Image analysis endpoint - analyzes car images using AI
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import List, Optional
import logging
import os
import uuid
from pathlib import Path
import shutil

from app.services.image_analyzer import ImageAnalyzer
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Limits
MAX_IMAGES = 10
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}

# Magic bytes for image validation (check content, not just extension)
IMAGE_MAGIC_BYTES = {
    b'\xff\xd8\xff': ('.jpg', '.jpeg'),
    b'\x89PNG\r\n\x1a\n': ('.png',),
    b'RIFF': ('.webp',),  # WebP: RIFF....WEBP at offset 8
}


def _validate_image_magic_bytes(contents: bytes, filename: str) -> bool:
    """Validate file content matches image magic bytes. Prevents disguised executables."""
    if len(contents) < 12:
        return False
    if contents[:3] == b'\xff\xd8\xff':
        return True
    if contents[:8] == b'\x89PNG\r\n\x1a\n':
        return True
    if contents[:4] == b'RIFF' and contents[8:12] == b'WEBP':
        return True
    return False


@router.post("/analyze-images")
async def analyze_images(
    images: List[UploadFile] = File(...)
):
    """
    Analyze car images and return AI description + guesses

    Accepts multiple images (multipart/form-data)
    Returns:
    {
        "summary": "...",
        "bullets": ["...","..."],
        "guessed_make": "...|null",
        "guessed_model": "...|null",
        "guessed_color": "...|null",
        "condition": "excellent|good|fair|poor|unknown",
        "confidence": 0-1
    }
    """
    try:
        # Validate number of images
        if len(images) > MAX_IMAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum {MAX_IMAGES} images allowed"
            )

        if len(images) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one image is required"
            )

        # Save uploaded images temporarily
        saved_paths = []
        try:
            for img_file in images:
                # Validate file extension
                file_ext = Path(img_file.filename).suffix.lower()
                if file_ext not in ALLOWED_EXTENSIONS:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid file type: {file_ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
                    )

                # Validate file size
                contents = await img_file.read()
                if len(contents) > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail=f"File {img_file.filename} exceeds maximum size of {MAX_FILE_SIZE / 1024 / 1024}MB"
                    )

                # Validate magic bytes (prevent disguised non-image files)
                if not _validate_image_magic_bytes(contents, img_file.filename or ""):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid image content: file does not appear to be a valid JPEG, PNG, or WebP image"
                    )

                # Save file
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                file_path = UPLOAD_DIR / unique_filename

                with open(file_path, 'wb') as f:
                    f.write(contents)

                saved_paths.append(str(file_path))

            # Analyze images
            analyzer = ImageAnalyzer()
            result = analyzer.analyze_images(saved_paths)

            # Validate image_features if present
            image_features = result.get("image_features")
            if image_features is not None:
                if len(image_features) != 2048:
                    logger.error(f"Invalid image_features length: {len(image_features)}, expected 2048")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Image feature extraction failed: expected 2048 features, got {len(image_features)}"
                    )
                logger.info(f"Successfully extracted {len(image_features)} image features")

            return {
                "success": True,
                "data": result
            }

        finally:
            # Clean up uploaded files
            for path in saved_paths:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except Exception as e:
                    logger.warning(f"Failed to delete {path}: {e}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing images: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing images: {str(e)}"
        )


@router.get("/car-images/{image_filename}")
async def get_car_image(image_filename: str):
    """
    Serve car images from car_images folder

    Image filename should be like 'car_000000.jpg'
    Maps dataset row index to car_images folder
    """
    try:
        # Validate filename format (security check)
        if not image_filename.startswith('car_') or not image_filename.endswith('.jpg'):
            raise HTTPException(
                status_code=400,
                detail="Invalid image filename format. Expected: car_XXXXXX.jpg"
            )

        # Get car_images folder path (relative to project root)
        car_images_dir = settings.ROOT_DIR / "car_images"

        # If car_images doesn't exist in root, try backend directory
        if not car_images_dir.exists():
            car_images_dir = settings.BASE_DIR.parent / "car_images"

        # Construct full file path
        image_path = car_images_dir / image_filename

        # Security check: ensure file is within car_images directory
        try:
            image_path.resolve().relative_to(car_images_dir.resolve())
        except ValueError:
            raise HTTPException(
                status_code=403,
                detail="Access denied: invalid file path"
            )

        # Check if file exists
        if not image_path.exists():
            logger.warning(f"Car image not found: {image_path}")
            raise HTTPException(
                status_code=404,
                detail=f"Car image not found: {image_filename}"
            )

        # Return file with proper content type and headers for high quality
        response = FileResponse(
            path=str(image_path),
            media_type="image/jpeg",
            filename=image_filename,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "Content-Disposition": f'inline; filename="{image_filename}"'
            }
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving car image: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error serving car image: {str(e)}"
        )
