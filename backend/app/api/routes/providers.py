"""
Provider API routes
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
from pydantic import BaseModel
import logging

from app.services.provider_service import (
    get_providers_by_service,
    get_provider_by_id,
    create_provider,
    update_provider,
    delete_provider,
    get_all_providers
)
from app.services.admin_service import (
    authenticate_admin,
    decode_admin_token,
    check_permission,
    ROLE_SUPER_ADMIN,
    ROLE_MODERATOR
)

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Pydantic models
class ProviderCreate(BaseModel):
    service_id: str
    provider_name: str
    provider_logo: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_email: Optional[str] = None
    provider_whatsapp: Optional[str] = None
    provider_website: Optional[str] = None
    provider_address: Optional[str] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None
    working_hours: Optional[str] = None
    price_range: Optional[str] = None
    rating: Optional[float] = 0
    review_count: Optional[int] = 0
    gallery_images: Optional[List[str]] = []
    locations: Optional[List[str]] = []
    is_all_iraq: Optional[bool] = False
    status: Optional[str] = 'active'
    display_order: Optional[int] = 0


class ProviderUpdate(BaseModel):
    provider_name: Optional[str] = None
    provider_logo: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_email: Optional[str] = None
    provider_whatsapp: Optional[str] = None
    provider_website: Optional[str] = None
    provider_address: Optional[str] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None
    working_hours: Optional[str] = None
    price_range: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    gallery_images: Optional[List[str]] = None
    locations: Optional[List[str]] = None
    is_all_iraq: Optional[bool] = None
    status: Optional[str] = None
    display_order: Optional[int] = None


# Admin authentication dependency
async def get_admin_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(None)
):
    """Get authenticated admin user"""
    token = None
    if credentials:
        token = credentials.credentials
    elif admin_token:
        token = admin_token

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        admin_id = decode_admin_token(token)
        return admin_id
    except Exception as e:
        logger.error(f"Admin authentication error: {e}")
        raise HTTPException(
            status_code=401, detail="Invalid authentication token")


# Frontend endpoints (public)
@router.get("/services/{service_id}/providers")
async def get_service_providers(
    service_id: str,
    location_id: Optional[str] = Query(
        None, description="Filter by location ID"),
    status: Optional[str] = Query('active', description="Filter by status")
):
    """Get all providers for a specific service"""
    try:
        providers = get_providers_by_service(
            service_id=service_id,
            status=status,
            location_id=location_id,
            active_only=True
        )
        return {"providers": providers, "count": len(providers)}
    except Exception as e:
        logger.error(f"Error getting providers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider_id}")
async def get_provider(provider_id: str):
    """Get a single provider by ID"""
    try:
        provider = get_provider_by_id(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        return provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints
@router.get("/admin/providers")
async def admin_get_providers(
    service_id: Optional[str] = Query(
        None, description="Filter by service ID"),
    location_id: Optional[str] = Query(
        None, description="Filter by location ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    admin_id: str = Depends(get_admin_user)
):
    """Get all providers (admin)"""
    try:
        providers = get_all_providers(
            service_id=service_id,
            location_id=location_id,
            status=status,
            active_only=False
        )
        return {"providers": providers, "count": len(providers)}
    except Exception as e:
        logger.error(f"Error getting providers: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/providers")
async def admin_create_provider(
    provider_data: ProviderCreate,
    admin_id: str = Depends(get_admin_user)
):
    """Create a new provider"""
    try:
        check_permission(admin_id, ROLE_MODERATOR)
        provider = create_provider(provider_data.dict())
        return provider
    except Exception as e:
        logger.error(f"Error creating provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/providers/{provider_id}")
async def admin_get_provider(
    provider_id: str,
    admin_id: str = Depends(get_admin_user)
):
    """Get a single provider (admin)"""
    try:
        provider = get_provider_by_id(provider_id)
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        return provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/providers/{provider_id}")
async def admin_update_provider(
    provider_id: str,
    provider_data: ProviderUpdate,
    admin_id: str = Depends(get_admin_user)
):
    """Update a provider"""
    try:
        check_permission(admin_id, ROLE_MODERATOR)
        provider = update_provider(
            provider_id, provider_data.dict(exclude_unset=True))
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        return provider
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/providers/{provider_id}")
async def admin_delete_provider(
    provider_id: str,
    admin_id: str = Depends(get_admin_user)
):
    """Delete a provider"""
    try:
        check_permission(admin_id, ROLE_SUPER_ADMIN)
        deleted = delete_provider(provider_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Provider not found")
        return {"message": "Provider deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting provider: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
