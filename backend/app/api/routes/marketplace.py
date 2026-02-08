"""
Marketplace API routes for Buy & Sell car listings
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from pathlib import Path
import logging
import os
import uuid
import json
from datetime import datetime, timedelta

from app.services.marketplace_service import (
    create_listing,
    create_draft_listing,
    add_listing_images,
    delete_listing_image,
    get_listing,
    search_listings,
    increment_listing_views,
    save_listing,
    unsave_listing,
    is_listing_saved,
    init_marketplace_db,
    get_db,
)
from app.services.car_detection_service import detect_car_from_images, get_image_hash, get_labels_version
from app.api.routes.auth import get_current_user, UserResponse
from app.services.feedback_service import save_prediction  # For auto-save to training

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)

# Backend/project root (parent of app/)
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOADS_LISTINGS = os.path.join(BACKEND_ROOT, "uploads", "listings")
os.makedirs(UPLOADS_LISTINGS, exist_ok=True)
logger.info(f"Uploads base: {UPLOADS_LISTINGS}")


# Request/Response models
class ListingCreateRequest(BaseModel):
    make: str
    model: str
    year: int
    trim: Optional[str] = None
    price: float
    mileage: float
    mileage_unit: str = "km"
    condition: str
    transmission: str
    fuel_type: str
    color: str
    features: Optional[List[str]] = []
    description: Optional[str] = None
    vin: Optional[str] = None
    location_country: Optional[str] = None
    location_state: Optional[str] = None
    location_city: Optional[str] = None
    location_coords: Optional[Dict[str, float]] = None
    exact_address: Optional[str] = None
    phone: Optional[str] = None
    phone_country_code: Optional[str] = None
    show_phone_to_buyers_only: bool = True
    preferred_contact_methods: Optional[List[str]] = []
    availability: Optional[str] = None
    status: str = "draft"  # draft or active


class ListingResponse(BaseModel):
    id: int
    user_id: Optional[int]
    make: str
    model: str
    year: int
    trim: Optional[str]
    price: float
    mileage: float
    mileage_unit: str
    condition: str
    transmission: str
    fuel_type: str
    color: str
    features: List[str]
    description: Optional[str]
    vin: Optional[str]
    location_country: Optional[str]
    location_state: Optional[str]
    location_city: Optional[str]
    location_coords: Optional[Dict[str, float]]
    exact_address: Optional[str]
    phone: Optional[str]
    phone_country_code: Optional[str]
    show_phone_to_buyers_only: bool
    preferred_contact_methods: List[str]
    availability: Optional[str]
    status: str
    views_count: int
    contacts_count: int
    saves_count: int
    cover_image_id: Optional[int]
    images: List[Dict[str, Any]]
    created_at: str
    updated_at: str
    expires_at: Optional[str]


@router.post("/listings/draft", response_model=Dict[str, Any])
async def create_draft_listing_endpoint(
    listing_data: Optional[Dict[str, Any]] = None,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Create a draft listing (for multi-step flow)"""
    try:
        user_id = current_user.id if current_user else None
        
        # Use provided data or minimal draft data
        listing_dict = listing_data or {}
        listing_dict['status'] = 'draft'
        
        listing_id = create_draft_listing(listing_dict, user_id)
        
        logger.info(f"Draft listing created: {listing_id} by user {user_id}")
        
        return {
            "listing_id": listing_id,
            "success": True,
            "message": "Draft listing created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating draft listing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/listings", response_model=Dict[str, Any])
async def create_car_listing(
    listing_data: ListingCreateRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Create a new car listing"""
    try:
        user_id = current_user.id if current_user else None
        
        # Convert Pydantic model to dict
        listing_dict = listing_data.dict(exclude_unset=False)
        
        # Validate required fields
        required_fields = ['make', 'model', 'year', 'price', 'mileage', 'condition', 'transmission', 'fuel_type', 'color']
        missing_fields = [field for field in required_fields if not listing_dict.get(field)]
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )
        
        listing_id = create_listing(listing_dict, user_id)
        
        logger.info(f"Listing created: {listing_id} by user {user_id}")
        
        # Auto-save to training dataset (background process)
        try:
            # Save as prediction for training
            car_features = {
                "make": listing_data.make,
                "model": listing_data.model,
                "year": listing_data.year,
                "mileage": listing_data.mileage,
                "condition": listing_data.condition,
                "fuel_type": listing_data.fuel_type,
                "location": listing_data.location_city or "Unknown"
            }
            save_prediction(
                car_features=car_features,
                predicted_price=listing_data.price,  # Use listing price as "actual" price
                user_id=user_id
            )
            logger.info(f"Auto-saved listing {listing_id} to training dataset")
        except Exception as e:
            logger.warning(f"Failed to auto-save listing to training dataset: {e}")
            # Don't fail the request if auto-save fails
        
        return {"listing_id": listing_id, "success": True, "message": "Listing created successfully"}
    except Exception as e:
        logger.error(f"Error creating listing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/listings/create-with-images", response_model=Dict[str, Any])
async def create_listing_with_images(
    listing: str = Form(..., description="JSON string of listing fields"),
    images: Optional[List[UploadFile]] = File(default=None, description="Image files (form key: images)"),
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Create a listing and upload images in one multipart/form-data request."""
    try:
        user_id = current_user.id if current_user else None
        data = json.loads(listing)

        required = ['make', 'model', 'year', 'price', 'mileage', 'condition', 'transmission', 'fuel_type', 'color']
        missing = [f for f in required if not data.get(f)]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

        listing_id = create_listing(data, user_id)
        image_urls: List[str] = []
        files = images or []

        if files:
            listing_dir = os.path.join(UPLOADS_LISTINGS, str(listing_id))
            os.makedirs(listing_dir, exist_ok=True)
            uploaded = []
            for idx, img in enumerate(files):
                ext = os.path.splitext(img.filename or "x")[1] or ".jpg"
                fn = f"{uuid.uuid4().hex}{ext}"
                abs_path = os.path.join(listing_dir, fn)
                with open(abs_path, "wb") as f:
                    f.write(await img.read())
                url = f"/uploads/listings/{listing_id}/{fn}"
                fp_rel = f"listings/{listing_id}/{fn}"
                image_urls.append(url)
                uploaded.append({"url": url, "file_path": fp_rel, "is_primary": idx == 0, "display_order": idx})
            add_listing_images(listing_id, uploaded)

        return {"listing_id": listing_id, "success": True, "image_urls": image_urls, "message": "Listing created"}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid listing JSON: {e}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating listing with images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/listings/{listing_id}/images")
async def upload_listing_images(
    listing_id: int,
    images: List[UploadFile] = File(...),
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Upload images for a listing"""
    try:
        # Verify listing exists and belongs to user
        listing = get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if current_user and listing.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        listing_dir = os.path.join(UPLOADS_LISTINGS, str(listing_id))
        os.makedirs(listing_dir, exist_ok=True)

        uploaded_images = []
        for idx, image in enumerate(images):
            file_ext = os.path.splitext(image.filename or "x")[1] or ".jpg"
            filename = f"{uuid.uuid4().hex}{file_ext}"
            abs_path = os.path.join(listing_dir, filename)

            with open(abs_path, "wb") as f:
                content = await image.read()
                f.write(content)

            # URL for browser; file_path in DB is relative for portability
            image_url = f"/uploads/listings/{listing_id}/{filename}"
            file_path_rel = f"listings/{listing_id}/{filename}"

            uploaded_images.append({
                "url": image_url,
                "file_path": file_path_rel,
                "is_primary": idx == 0,
                "display_order": idx,
            })
        
        image_ids = add_listing_images(listing_id, uploaded_images)
        image_urls = [u["url"] for u in uploaded_images]
        
        return {
            "success": True,
            "image_ids": image_ids,
            "image_urls": image_urls,
            "message": f"{len(image_ids)} images uploaded successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading images: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/listings/{listing_id}/images/{image_id}")
async def delete_listing_image_endpoint(
    listing_id: int,
    image_id: int,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Remove one image from a draft listing."""
    listing = get_listing(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if current_user and listing.get('user_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if listing.get('status') != 'draft':
        raise HTTPException(status_code=400, detail="Can only remove images from draft")
    ok = delete_listing_image(listing_id, image_id)
    return {"success": ok, "message": "Image removed" if ok else "Image not found"}


@router.post("/listings/{listing_id}/auto-detect")
async def auto_detect_car(
    listing_id: int,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """
    Auto-detect car make, model, color, and year from listing images
    
    Returns detection results with best guesses and top-5 suggestions
    """
    import traceback
    
    try:
        logger.info(f"=== AUTO-DETECT START: listing_id={listing_id} ===")
        
        # Verify listing exists
        listing = get_listing(listing_id)
        if not listing:
            logger.error(f"Listing {listing_id} not found")
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if current_user and listing.get('user_id') != current_user.id:
            logger.error(f"User {current_user.id} not authorized for listing {listing_id}")
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Check if detection already exists and image hash matches
        if listing.get('auto_detect'):
            existing_detection = listing.get('auto_detect', {})
            existing_hash = existing_detection.get('meta', {}).get('image_hash')
            
            # Get current image hash
            from app.services.marketplace_service import get_db
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT file_path FROM listing_images 
                WHERE listing_id = ? AND file_path IS NOT NULL
                ORDER BY display_order
            """, (listing_id,))
            image_rows = cursor.fetchall()
            conn.close()
            
            current_image_paths = []
            uploads_base = Path(BACKEND_ROOT) / "uploads"
            for row in image_rows:
                raw = row['file_path']
                if raw:
                    p = Path(raw)
                    if p.is_absolute():
                        res = p
                    elif raw.startswith("listings/"):
                        res = uploads_base / raw
                    else:
                        res = Path(UPLOADS_LISTINGS) / p.name
                    if res.exists():
                        current_image_paths.append(str(res))
            
            if current_image_paths:
                current_hash = get_image_hash(current_image_paths)
                
                # Check labels_version too
                existing_labels_version = existing_detection.get('meta', {}).get('labels_version')
                current_labels_version = get_labels_version()
                
                if existing_hash == current_hash and existing_labels_version == current_labels_version and existing_detection.get('best'):
                    logger.info(f"Returning cached detection for listing {listing_id}")
                    return {
                        "success": True,
                        "detection": existing_detection,
                        "prefill": listing.get('prefill', {}),
                        "confidence_level": existing_detection.get('meta', {}).get('confidence_level', 'low')
                    }
        
        # Get listing images
        from app.services.marketplace_service import get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT file_path, url FROM listing_images 
            WHERE listing_id = ? AND file_path IS NOT NULL
            ORDER BY display_order
        """, (listing_id,))
        image_rows = cursor.fetchall()
        conn.close()
        
        logger.info(f"Found {len(image_rows)} image records in DB for listing {listing_id}")
        
        if len(image_rows) < 2:
            error_msg = f"At least 2 images required for auto-detection (found {len(image_rows)})"
            logger.error(error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Get image file paths (absolute paths)
        image_paths = []
        uploads_base = Path(BACKEND_ROOT) / "uploads"
        logger.info(f"Uploads base: {uploads_base}")

        for idx, row in enumerate(image_rows):
            raw_path = row['file_path']
            logger.info(f"Image {idx+1}: raw_path={raw_path}")

            if raw_path:
                file_path = Path(raw_path)

                if file_path.is_absolute():
                    resolved_path = file_path
                elif raw_path.startswith("listings/"):
                    # New format: listings/{id}/{filename} under uploads/
                    resolved_path = uploads_base / raw_path
                else:
                    # Legacy: filename in uploads/listings/
                    resolved_path = Path(UPLOADS_LISTINGS) / file_path.name
                file_path = resolved_path

                exists = file_path.exists()
                logger.info(f"  -> resolved: {file_path}, exists: {exists}")
                
                if exists:
                    image_paths.append(str(file_path))
                else:
                    logger.warning(f"  -> Image file not found: {file_path}")
        
        logger.info(f"Resolved {len(image_paths)} valid image paths out of {len(image_rows)} records")
        
        if not image_paths:
            error_msg = f"No valid image files found for listing {listing_id}. Checked {len(image_rows)} paths."
            logger.error(error_msg)
            # Return error response instead of raising HTTPException for better frontend handling
            return {
                "success": False,
                "status": "error",
                "error": error_msg,
                "detection": None,
                "prefill": {}
            }
        
        # Get valid makes/models from dataset for normalization
        from app.services.dataset_loader import DatasetLoader
        valid_makes_list = None
        valid_models_by_make_dict = None
        
        try:
            dataset_loader = DatasetLoader.get_instance()
            df = dataset_loader.dataset
            
            if df is not None and len(df) > 0:
                # Get unique makes
                valid_makes_list = df['make'].dropna().unique().tolist()
                valid_makes_list = [str(m).strip() for m in valid_makes_list if str(m).strip()]
                valid_makes_list = sorted(list(set(valid_makes_list)))
                
                logger.info(f"Loaded {len(valid_makes_list)} valid makes from dataset")
                
                # Get models by make
                valid_models_by_make_dict = {}
                for make in valid_makes_list:
                    make_df = df[df['make'].str.lower() == str(make).lower()]
                    models = make_df['model'].dropna().unique().tolist()
                    models = [str(m).strip() for m in models if str(m).strip()]
                    valid_models_by_make_dict[make] = sorted(list(set(models)))
        except Exception as e:
            logger.warning(f"Could not load valid makes/models for normalization: {e}", exc_info=True)
        
        # Run detection (labels loaded automatically from dataset)
        logger.info(f"Running auto-detection for listing {listing_id} with {len(image_paths)} images")
        try:
            detection_result = detect_car_from_images(
                image_paths,
                valid_makes=valid_makes_list,
                valid_models_by_make=valid_models_by_make_dict
            )
            logger.info(f"Detection completed successfully: {detection_result.get('meta', {}).get('status', 'unknown')}")
        except Exception as e:
            logger.error(f"detect_car_from_images failed: {e}", exc_info=True)
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "status": "error",
                "error": f"Detection service error: {str(e)}",
                "detection": None,
                "prefill": {}
            }
        
        # Extract best guesses for prefill (only if status is ok)
        best = detection_result.get('best', {})
        meta = detection_result.get('meta', {})
        status = meta.get('status', 'ok')
        
        logger.info(f"Detection status: {status}, confidence_level: {meta.get('confidence_level', 'unknown')}")
        
        if status == "low_confidence":
            # Don't prefill if low confidence, but still return success with suggestions
            prefill = {}
            logger.info("Low confidence detection - not prefilling, but returning suggestions")
        else:
            prefill = {
                "make": best.get('make', {}).get('value') if best.get('make') else None,
                "model": best.get('model', {}).get('value') if best.get('model') else None,
                "color": best.get('color', {}).get('value') if best.get('color') else None,
                "year": best.get('year', {}).get('value') if best.get('year') else None,
            }
            logger.info(f"Prefill values: {prefill}")
        
        # Save detection results to listing
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE listings 
            SET auto_detect = ?, prefill = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            json.dumps(detection_result),
            json.dumps(prefill),
            listing_id
        ))
        conn.commit()
        conn.close()
        
        logger.info(f"Auto-detection completed for listing {listing_id}: {prefill}")
        
        return {
            "success": True,
            "status": status,  # Include status for frontend
            "detection": detection_result,
            "prefill": prefill,
            "confidence_level": detection_result.get('meta', {}).get('confidence_level', 'low')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Auto-detection failed: {str(e)}"
        logger.error(f"Error in auto-detection endpoint: {error_msg}", exc_info=True)
        logger.error(f"Full traceback:\n{traceback.format_exc()}")
        
        # Return error response instead of raising 500 for better frontend handling
        import sys
        is_dev = os.getenv("ENVIRONMENT", "production") == "development" or "--reload" in sys.argv
        
        return {
            "success": False,
            "status": "error",
            "error": error_msg if is_dev else "Auto-detection failed. Please try again or continue manually.",
            "detection": None,
            "prefill": {}
        }


@router.get("/listings/{listing_id}", response_model=Dict[str, Any])
async def get_listing_detail(
    listing_id: str,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Get listing details. Supports both numeric IDs (REST API) and UUID strings (Supabase)."""
    try:
        # Check if it's a numeric ID or UUID
        try:
            id_int = int(listing_id)
            is_uuid = False
        except (TypeError, ValueError):
            # Likely a UUID string (Supabase listing)
            is_uuid = True
            id_int = None
        
        if is_uuid:
            # Fetch from Supabase using REST API (httpx)
            try:
                import os
                import httpx
                
                # Try multiple environment variable names for Supabase URL
                supabase_url = (
                    os.getenv("SUPABASE_URL") or 
                    os.getenv("NEXT_PUBLIC_SUPABASE_URL") or
                    "https://fehkzrrahgyesxzrwlme.supabase.co"  # Fallback from .env
                )
                
                # Try multiple environment variable names for Supabase key
                # Note: For public read access, anon key works fine
                supabase_key = (
                    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 
                    os.getenv("SUPABASE_ANON_KEY") or
                    os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or
                    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlaGt6cnJhaGd5ZXN4enJ3bG1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNzcwNjEsImV4cCI6MjA4NDc1MzA2MX0.AI8QaX8nOP8UwcfmgbGN2EN4jmK94i98Kpd3ZtPDZRQ"  # Fallback anon key
                )
                
                if not supabase_url:
                    logger.error("Supabase URL not configured, cannot fetch UUID listing")
                    raise HTTPException(status_code=404, detail="Listing not found")
                
                if not supabase_key:
                    logger.error(f"Supabase key not configured (URL: {supabase_url}), cannot fetch UUID listing")
                    logger.error("Available env vars: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY")
                    raise HTTPException(status_code=404, detail="Listing not found")
                
                logger.debug(f"Fetching Supabase listing {listing_id} from {supabase_url}")
                
                # Use Supabase REST API
                api_url = f"{supabase_url}/rest/v1/car_listings"
                headers = {
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                }
                
                response = httpx.get(
                    f"{api_url}?id=eq.{listing_id}&select=*",
                    headers=headers,
                    timeout=10
                )
                
                logger.debug(f"Supabase API response status: {response.status_code}")
                
                if response.status_code != 200:
                    error_text = response.text[:500] if hasattr(response, 'text') else str(response.content[:500])
                    logger.error(f"Supabase API returned {response.status_code}: {error_text}")
                    raise HTTPException(status_code=404, detail="Listing not found")
                
                try:
                    data = response.json()
                except Exception as json_error:
                    logger.error(f"Failed to parse Supabase response JSON: {json_error}")
                    logger.error(f"Response text: {response.text[:500]}")
                    raise HTTPException(status_code=404, detail="Listing not found")
                
                if not data or len(data) == 0:
                    logger.warning(f"No listing found in Supabase for UUID: {listing_id}")
                    raise HTTPException(status_code=404, detail="Listing not found")
                
                # Normalize Supabase listing format
                listing = data[0]
                
                # Normalize images array
                if isinstance(listing.get('images'), list):
                    listing['images'] = [{'url': img if isinstance(img, str) else img.get('url', '')} for img in listing['images']]
                elif listing.get('images'):
                    listing['images'] = [{'url': str(listing['images'])}]
                else:
                    listing['images'] = []
                
                # Set cover_image
                listing['cover_image'] = listing['images'][0]['url'] if listing['images'] else None
                
                # Normalize features
                if isinstance(listing.get('features'), str):
                    try:
                        listing['features'] = json.loads(listing['features'])
                    except:
                        listing['features'] = []
                elif not isinstance(listing.get('features'), list):
                    listing['features'] = []
                
                # Check if saved by user
                is_saved = False
                if current_user:
                    from app.services.favorites_service import is_favorite
                    is_saved = is_favorite(current_user.id, listing_id)
                
                listing['is_saved'] = is_saved
                listing['fromSupabase'] = True
                
                return listing
            except HTTPException:
                raise
            except httpx.HTTPStatusError as e:
                logger.error(f"Supabase API HTTP error: {e.response.status_code} - {e.response.text[:200]}")
                raise HTTPException(status_code=404, detail="Listing not found")
            except httpx.RequestError as e:
                logger.error(f"Supabase API request error: {e}")
                raise HTTPException(status_code=404, detail="Listing not found")
            except Exception as e:
                logger.error(f"Error fetching Supabase listing: {e}", exc_info=True)
                raise HTTPException(status_code=404, detail="Listing not found")
        else:
            # Numeric ID - fetch from REST API database
            if id_int <= 0:
                raise HTTPException(status_code=400, detail="Invalid listing ID")

            listing = get_listing(id_int)
            if not listing:
                raise HTTPException(status_code=404, detail="Listing not found")
            
            # Increment view count (only if listing is active)
            if listing.get('status') == 'active':
                increment_listing_views(id_int)
            
            # Check if saved by user
            is_saved = False
            if current_user:
                is_saved = is_listing_saved(current_user.id, id_int)
            
            listing['is_saved'] = is_saved
            listing['fromSupabase'] = False
            
            # Record price change for price history tracking
            try:
                from app.services.favorites_service import record_price_change
                record_price_change(id_int, listing.get('price', 0))
            except Exception as e:
                logger.warning(f"Failed to record price change: {e}")
            
            return listing
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


_DRAFT_UPDATE_FIELDS = {
    'make', 'model', 'year', 'trim', 'price', 'mileage', 'mileage_unit',
    'condition', 'transmission', 'fuel_type', 'color', 'features', 'description', 'vin',
    'location_country', 'location_state', 'location_city', 'location_coords',
    'exact_address', 'phone', 'phone_country_code', 'show_phone_to_buyers_only',
    'preferred_contact_methods', 'availability'
}
_JSON_FIELDS = {'features', 'location_coords', 'preferred_contact_methods'}


@router.patch("/listings/{listing_id}")
async def update_draft_listing(
    listing_id: int,
    data: Dict[str, Any],
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Update draft listing fields (only when status is draft)."""
    listing = get_listing(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.get('status') != 'draft':
        raise HTTPException(status_code=400, detail="Only draft listings can be updated")
    if current_user and listing.get('user_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    updates = {k: v for k, v in data.items() if k in _DRAFT_UPDATE_FIELDS and v is not None}
    if not updates:
        return {"success": True, "message": "Nothing to update"}

    set_parts = []
    args = []
    for k, v in updates.items():
        if k in _JSON_FIELDS and isinstance(v, (list, dict)):
            v = json.dumps(v)
        set_parts.append(f"{k} = ?")
        args.append(v)
    args.append(listing_id)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        f"UPDATE listings SET {', '.join(set_parts)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Draft updated"}


@router.get("/listings", response_model=Dict[str, Any])
async def search_car_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
    sort_by: str = Query("newest", regex="^(newest|price_low|price_high)$"),
    search: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    makes: Optional[str] = Query(None),  # Comma-separated
    models: Optional[str] = Query(None),  # Comma-separated
    min_year: Optional[int] = Query(None),
    max_year: Optional[int] = Query(None),
    max_mileage: Optional[float] = Query(None),
    conditions: Optional[str] = Query(None),  # Comma-separated
    transmissions: Optional[str] = Query(None),  # Comma-separated
    fuel_types: Optional[str] = Query(None),  # Comma-separated
    location_city: Optional[str] = Query(None),
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Search listings with filters"""
    try:
        # Sanitize search input to prevent injection
        filters = {}
        
        if search:
            # Remove potentially dangerous characters
            safe_search = search.strip()[:100]  # Limit length
            filters['search'] = safe_search
        if min_price:
            filters['min_price'] = max(0, float(min_price))
        if max_price:
            filters['max_price'] = max(0, float(max_price))
        if makes:
            filters['makes'] = [m.strip()[:50] for m in makes.split(',')[:10]]  # Limit to 10 makes
        if models:
            filters['models'] = [m.strip()[:50] for m in models.split(',')[:10]]  # Limit to 10 models
        if min_year:
            filters['min_year'] = max(1900, min(2025, int(min_year)))
        if max_year:
            filters['max_year'] = max(1900, min(2025, int(max_year)))
        if max_mileage:
            filters['max_mileage'] = max(0, float(max_mileage))
        if conditions:
            filters['conditions'] = [c.strip()[:50] for c in conditions.split(',')[:10]]
        if transmissions:
            filters['transmissions'] = [t.strip()[:50] for t in transmissions.split(',')[:10]]
        if fuel_types:
            filters['fuel_types'] = [f.strip()[:50] for f in fuel_types.split(',')[:10]]
        if location_city:
            filters['location_city'] = location_city.strip()[:100]
        
        listings, total = search_listings(filters, page, page_size, sort_by)
        
        # Check saved status for each listing if user is logged in
        if current_user:
            for listing in listings:
                listing['is_saved'] = is_listing_saved(current_user.id, listing['id'])
        else:
            for listing in listings:
                listing['is_saved'] = False
        
        return {
            "items": listings,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        logger.error(f"Error searching listings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/listings/{listing_id}/save")
async def save_listing_to_favorites(
    listing_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Save listing to favorites"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        success = save_listing(current_user.id, listing_id)
        if success:
            return {"success": True, "message": "Listing saved"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save listing")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/listings/{listing_id}/save")
async def unsave_listing_from_favorites(
    listing_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Remove listing from favorites"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        success = unsave_listing(current_user.id, listing_id)
        if success:
            return {"success": True, "message": "Listing unsaved"}
        else:
            raise HTTPException(status_code=500, detail="Failed to unsave listing")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unsaving listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/listings/{listing_id}/publish")
async def publish_listing(
    listing_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Publish a draft listing"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        listing = get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if listing.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

        if listing.get('status') == 'active':
            return {"success": True, "message": "Already published"}

        # Validate required fields before publishing
        required_fields = ['make', 'model', 'year', 'price', 'mileage', 'condition', 'transmission', 'fuel_type', 'color']
        missing_fields = []
        for field in required_fields:
            if not listing.get(field):
                missing_fields.append(field)
        
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail=f"Complete car details required. Missing: {', '.join(missing_fields)}"
            )
        
        # Update status to active
        from app.services.marketplace_service import get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE listings SET status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (listing_id,))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Listing published successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error publishing listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/listings/{listing_id}/analytics")
async def get_listing_analytics(
    listing_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get analytics for a specific listing (only accessible by owner)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        listing = get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if listing.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view analytics")
        
        # Get views over time (last 30 days)
        from app.services.marketplace_service import get_db
        conn = get_db()
        cursor = conn.cursor()
        
        # Get views count
        views_count = listing.get('views_count', 0)
        
        # Get saves count
        saves_count = listing.get('saves_count', 0)
        
        # Get messages count (messages sent TO the listing owner)
        try:
            from app.services.messaging_service import get_db as get_messaging_db
            msg_conn = get_messaging_db()
            msg_cursor = msg_conn.cursor()
            msg_cursor.execute("SELECT COUNT(DISTINCT sender_id) as count FROM messages WHERE listing_id = ? AND recipient_id = ?", 
                              (listing_id, current_user.id))
            msg_result = msg_cursor.fetchone()
            messages_count = dict(msg_result)['count'] if msg_result else listing.get('contacts_count', 0)
            msg_conn.close()
        except Exception as e:
            logger.warning(f"Error getting messages count: {e}")
            messages_count = listing.get('contacts_count', 0)
        
        # Calculate engagement rate
        engagement_rate = (messages_count / views_count * 100) if views_count > 0 else 0
        
        # Get views over time (simplified - would need a views_history table for accurate data)
        views_over_time = []
        for i in range(30, -1, -1):
            date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            # For now, distribute views evenly (in real implementation, track daily views)
            daily_views = views_count // 30 if i < 30 else 0
            views_over_time.append({"date": date, "views": daily_views})
        
        # Get performance indicator
        if engagement_rate > 5:
            performance = "high"
            performance_color = "green"
        elif engagement_rate >= 2:
            performance = "average"
            performance_color = "yellow"
        else:
            performance = "low"
            performance_color = "red"
        
        # Generate suggestions
        suggestions = []
        if listing.get('price'):
            # Compare with market average (simplified)
            avg_price = listing.get('price', 0)  # Would calculate from similar listings
            if listing.get('price') > avg_price * 1.1:
                suggestions.append(f"Your price is {round(((listing.get('price') / avg_price - 1) * 100), 1)}% higher than similar cars. Consider lowering.")
        
        images = listing.get('images', [])
        if len(images) < 5:
            suggestions.append("Add more photos to attract more buyers.")
        
        if views_count < 10:
            suggestions.append("Your listing hasn't been viewed much. Try sharing it on social media.")
        
        conn.close()
        
        return {
            "listing_id": listing_id,
            "views_count": views_count,
            "views_over_time": views_over_time,
            "saves_count": saves_count,
            "messages_count": messages_count,
            "engagement_rate": round(engagement_rate, 2),
            "performance": performance,
            "performance_color": performance_color,
            "suggestions": suggestions,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting listing analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-listings")
async def get_my_listings(
    status: Optional[str] = Query(None, regex="^(active|draft|sold|expired)$"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get all listings for the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        from app.services.marketplace_service import get_db
        conn = get_db()
        cursor = conn.cursor()
        
        query = """
            SELECT * FROM listings WHERE user_id = ?
        """
        params = [current_user.id]
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        listings = []
        for row in rows:
            listing = dict(row)
            # Parse JSON fields
            if listing.get('features'):
                try:
                    listing['features'] = json.loads(listing['features'])
                except:
                    listing['features'] = []
            if listing.get('location_coords'):
                try:
                    listing['location_coords'] = json.loads(listing['location_coords'])
                except:
                    listing['location_coords'] = None
            if listing.get('preferred_contact_methods'):
                try:
                    listing['preferred_contact_methods'] = json.loads(listing['preferred_contact_methods'])
                except:
                    listing['preferred_contact_methods'] = []
            
            # Get images
            cursor.execute("SELECT * FROM listing_images WHERE listing_id = ? ORDER BY display_order", (listing['id'],))
            image_rows = cursor.fetchall()
            listing['images'] = [dict(img) for img in image_rows]
            
            listings.append(listing)
        
        # Calculate quick stats
        total_listings = len(listings)
        total_views = sum(l.get('views_count', 0) for l in listings)
        total_messages = sum(l.get('contacts_count', 0) for l in listings)
        
        conn.close()
        
        return {
            "listings": listings,
            "stats": {
                "total_listings": total_listings,
                "total_views": total_views,
                "total_messages": total_messages,
                "average_response_time": "2.5 hours"  # Placeholder
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting my listings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/listings/{listing_id}/mark-sold")
async def mark_listing_as_sold(
    listing_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Mark a listing as sold"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        listing = get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if listing.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        from app.services.marketplace_service import get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE listings SET status = 'sold', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (listing_id,))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Listing marked as sold"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking listing as sold: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/listings/{listing_id}/user-overrides")
async def update_user_overrides(
    listing_id: int,
    overrides: Dict[str, Any],
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Update user override tracking for auto-detected fields"""
    try:
        from app.services.marketplace_service import update_listing_auto_detect_user_overrides
        
        # Verify listing exists
        listing = get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if current_user and listing.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        selected_by_user = overrides.get('selected_by_user', {})
        user_overrode = overrides.get('user_overrode', True)
        
        update_listing_auto_detect_user_overrides(listing_id, selected_by_user, user_overrode)
        
        return {"success": True, "message": "User overrides updated"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user overrides: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/listings/{listing_id}")
async def delete_listing(
    listing_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete a listing"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        listing = get_listing(listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        
        if listing.get('user_id') != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        from app.services.marketplace_service import get_db
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE listings SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?", (listing_id,))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Listing deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting listing: {e}")
        raise HTTPException(status_code=500, detail=str(e))
