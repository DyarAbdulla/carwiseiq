"""
Favorites and saved searches API routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from typing import Optional, Dict, List
import logging

from app.services.favorites_service import (
    toggle_favorite,
    is_favorite,
    get_favorites,
    save_search,
    get_saved_searches,
    delete_saved_search,
    update_saved_search,
    get_price_history,
    get_notification_settings,
    update_notification_settings,
    get_favorites_count_for_listing
)
from app.api.routes.auth import get_current_user, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Request/Response models
class SaveSearchRequest(BaseModel):
    name: str
    filters: Dict
    email_alerts: bool = True
    frequency: str = 'instant'  # instant, daily, weekly


class UpdateSearchRequest(BaseModel):
    name: Optional[str] = None
    email_alerts: Optional[bool] = None
    frequency: Optional[str] = None


class NotificationSettingsRequest(BaseModel):
    email_new_matches: Optional[bool] = None
    email_price_drops: Optional[bool] = None
    push_notifications: Optional[bool] = None
    frequency: Optional[str] = None


@router.post("/toggle")
async def toggle_favorite_endpoint(
    listing_id: str = Query(...),  # Accept string to support both numeric IDs and UUIDs
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Toggle favorite status for a listing
    Supports both numeric IDs (REST API) and UUID strings (Supabase)
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # For Supabase users (id=0), use supabase_user_id from UserResponse
    # For REST API users, use user_id
    user_id = current_user.id if current_user.id != 0 else None
    supabase_user_id = getattr(current_user, 'supabase_user_id', None) or (current_user.email if current_user.id == 0 else None)
    
    logger.info(f"Toggle favorite - user_id: {user_id}, supabase_user_id: {supabase_user_id}, listing_id: {listing_id}")
    
    try:
        is_fav, was_added = toggle_favorite(user_id, listing_id, supabase_user_id)
        logger.info(f"Toggle result - is_favorite: {is_fav}, was_added: {was_added}")
        return {
            "is_favorite": is_fav,
            "was_added": was_added,
            "message": "Added to favorites" if was_added else "Removed from favorites"
        }
    except Exception as e:
        logger.error(f"Error toggling favorite: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check/{listing_id}")
async def check_favorite_endpoint(
    listing_id: str,  # Accept string to support both numeric IDs and UUIDs
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Check if listing is favorited
    Supports both numeric IDs (REST API) and UUID strings (Supabase)
    """
    if not current_user:
        return {"is_favorite": False}
    
    user_id = current_user.id if current_user.id != 0 else None
    supabase_user_id = getattr(current_user, 'supabase_user_id', None) or (current_user.email if current_user.id == 0 else None)
    
    is_fav = is_favorite(user_id, listing_id, supabase_user_id)
    return {"is_favorite": is_fav}


@router.get("/list")
async def get_favorites_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=50),
    sort_by: str = Query("recently_saved", regex="^(recently_saved|price_low|price_high|newest_listings)$"),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get user's favorite listings"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        user_id = current_user.id if current_user.id != 0 else None
        supabase_user_id = getattr(current_user, 'supabase_user_id', None) or (current_user.email if current_user.id == 0 else None)
        
        logger.info(f"get_favorites_endpoint - user_id: {user_id}, supabase_user_id: {supabase_user_id}, page: {page}, sort_by: {sort_by}")
        
        listings, total = get_favorites(user_id, page, page_size, sort_by, supabase_user_id)
        
        logger.info(f"get_favorites_endpoint - returning {len(listings)} listings, total: {total}")
        
        return {
            "items": listings,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        logger.error(f"Error getting favorites: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/count/{listing_id}")
async def get_favorites_count_endpoint(listing_id: str):
    """Get number of users who favorited a listing
    Supports both numeric IDs (REST API) and UUID strings (Supabase)
    """
    try:
        count = get_favorites_count_for_listing(listing_id)
        return {"count": count}
    except Exception as e:
        logger.error(f"Error getting favorites count: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/searches")
async def save_search_endpoint(
    request: SaveSearchRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Save a search"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        search_id = save_search(
            current_user.id,
            request.name,
            request.filters,
            request.email_alerts,
            request.frequency
        )
        return {"search_id": search_id, "success": True, "message": "Search saved successfully"}
    except Exception as e:
        logger.error(f"Error saving search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/searches")
async def get_saved_searches_endpoint(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get user's saved searches"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        searches = get_saved_searches(current_user.id)
        return {"searches": searches, "total": len(searches)}
    except Exception as e:
        logger.error(f"Error getting saved searches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/searches/{search_id}")
async def update_saved_search_endpoint(
    search_id: int,
    request: UpdateSearchRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update a saved search"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        success = update_saved_search(
            current_user.id,
            search_id,
            request.name,
            request.email_alerts,
            request.frequency
        )
        if success:
            return {"success": True, "message": "Search updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="Search not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating saved search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/searches/{search_id}")
async def delete_saved_search_endpoint(
    search_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete a saved search"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        success = delete_saved_search(current_user.id, search_id)
        if success:
            return {"success": True, "message": "Search deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Search not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting saved search: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/price-history/{listing_id}")
async def get_price_history_endpoint(
    listing_id: int,
    days: int = Query(30, ge=1, le=365)
):
    """Get price history for a listing"""
    try:
        history = get_price_history(listing_id, days)
        return {"history": history}
    except Exception as e:
        logger.error(f"Error getting price history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notifications/settings")
async def get_notification_settings_endpoint(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get user's notification settings"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        settings = get_notification_settings(current_user.id)
        if settings:
            return settings
        else:
            raise HTTPException(status_code=500, detail="Failed to get notification settings")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting notification settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/notifications/settings")
async def update_notification_settings_endpoint(
    request: NotificationSettingsRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update notification settings"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        updates = {}
        if request.email_new_matches is not None:
            updates['email_new_matches'] = request.email_new_matches
        if request.email_price_drops is not None:
            updates['email_price_drops'] = request.email_price_drops
        if request.push_notifications is not None:
            updates['push_notifications'] = request.push_notifications
        if request.frequency is not None:
            updates['frequency'] = request.frequency

        success = update_notification_settings(current_user.id, **updates)
        if success:
            return {"success": True, "message": "Settings updated successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update settings")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating notification settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
