"""
Services API routes for frontend and admin
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import logging

from app.services.services_service import (
    get_all_services,
    get_service_by_id,
    create_service,
    update_service,
    delete_service,
    get_all_locations,
    get_location_by_id,
    create_location,
    update_location,
    delete_location,
    increment_service_view,
    increment_service_click
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
class ServiceCreate(BaseModel):
    name_en: str
    name_ar: Optional[str] = None
    name_ku: Optional[str] = None
    description_en: str
    description_ar: Optional[str] = None
    description_ku: Optional[str] = None
    icon: Optional[str] = None
    icon_type: Optional[str] = 'library'
    locations: Optional[List[str]] = []
    is_all_iraq: bool = False
    status: Optional[str] = 'active'
    display_order: Optional[int] = 50
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    service_url: Optional[str] = None
    is_featured: Optional[bool] = False
    provider_name: Optional[str] = None
    provider_logo: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_email: Optional[str] = None
    provider_website: Optional[str] = None
    provider_address: Optional[str] = None
    provider_whatsapp: Optional[str] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None
    gallery_images: Optional[List[str]] = []
    working_hours: Optional[str] = None
    rating: Optional[float] = 0
    review_count: Optional[int] = 0
    price_range: Optional[str] = None


class ServiceUpdate(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    name_ku: Optional[str] = None
    description_en: Optional[str] = None
    description_ar: Optional[str] = None
    description_ku: Optional[str] = None
    icon: Optional[str] = None
    icon_type: Optional[str] = None
    locations: Optional[List[str]] = None
    is_all_iraq: Optional[bool] = None
    status: Optional[str] = None
    display_order: Optional[int] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    service_url: Optional[str] = None
    is_featured: Optional[bool] = None
    provider_name: Optional[str] = None
    provider_logo: Optional[str] = None
    provider_phone: Optional[str] = None
    provider_email: Optional[str] = None
    provider_website: Optional[str] = None
    provider_address: Optional[str] = None
    provider_whatsapp: Optional[str] = None
    map_latitude: Optional[float] = None
    map_longitude: Optional[float] = None
    gallery_images: Optional[List[str]] = None
    working_hours: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    price_range: Optional[str] = None


class LocationCreate(BaseModel):
    id: Optional[str] = None
    name_en: str
    name_ar: Optional[str] = None
    name_ku: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = True
    coordinates: Optional[Dict[str, float]] = None


class LocationUpdate(BaseModel):
    name_en: Optional[str] = None
    name_ar: Optional[str] = None
    name_ku: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None
    coordinates: Optional[Dict[str, float]] = None


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
@router.get("/services")
async def get_services(
    location_id: Optional[str] = Query(
        None, description="Filter by location ID"),
    featured_only: bool = Query(
        False, description="Get only featured services"),
    status: Optional[str] = Query('active', description="Filter by status")
):
    """Get all active services (public endpoint)"""
    try:
        logger.info(
            f"Getting services with params: location_id={location_id}, featured_only={featured_only}, status={status}")
        services = get_all_services(
            status=status,
            location_id=location_id,
            featured_only=featured_only,
            active_only=True
        )
        logger.info(f"Found {len(services)} services")
        return {"services": services, "count": len(services)}
    except Exception as e:
        logger.error(f"Error getting services: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services/{service_id}")
async def get_service(service_id: str):
    """Get a single service by ID (public endpoint)"""
    try:
        service = get_service_by_id(service_id)
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        return service
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services/location/{location_id}")
async def get_services_by_location(location_id: str):
    """Get services available in a specific location"""
    try:
        services = get_all_services(location_id=location_id, active_only=True)
        return {"services": services, "count": len(services), "location_id": location_id}
    except Exception as e:
        logger.error(f"Error getting services by location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services/featured")
async def get_featured_services():
    """Get featured services"""
    try:
        services = get_all_services(featured_only=True, active_only=True)
        return {"services": services, "count": len(services)}
    except Exception as e:
        logger.error(f"Error getting featured services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/services/{service_id}/view")
async def track_service_view(service_id: str):
    """Track service view (public endpoint)"""
    try:
        increment_service_view(service_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error tracking service view: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/services/{service_id}/click")
async def track_service_click(service_id: str):
    """Track service click (public endpoint)"""
    try:
        increment_service_click(service_id)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error tracking service click: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/locations")
async def get_locations(active_only: bool = Query(True, description="Get only active locations")):
    """Get all locations (public endpoint)"""
    try:
        locations = get_all_locations(active_only=active_only)
        return {"locations": locations, "count": len(locations)}
    except Exception as e:
        logger.error(f"Error getting locations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin endpoints
@router.get("/admin/services")
async def admin_get_services(
    status: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    admin_id: str = Depends(get_admin_user)
):
    """Get all services for admin (with pagination)"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        services = get_all_services(
            status=status,
            location_id=location_id,
            active_only=False
        )

        # Pagination
        total = len(services)
        start = (page - 1) * page_size
        end = start + page_size
        paginated_services = services[start:end]

        return {
            "services": paginated_services,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "pages": (total + page_size - 1) // page_size
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting services for admin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/services/{service_id}")
async def admin_get_service(service_id: str, admin_id: str = Depends(get_admin_user)):
    """Get a single service for admin"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        service = get_service_by_id(service_id)
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        return service
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service for admin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/services")
async def admin_create_service(
    service: ServiceCreate,
    admin_id: str = Depends(get_admin_user)
):
    """Create a new service"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        service_data = service.dict()
        service_data['created_by'] = admin_id
        service_data['updated_by'] = admin_id

        new_service = create_service(service_data)
        return new_service
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/services/{service_id}")
async def admin_update_service(
    service_id: str,
    service: ServiceUpdate,
    admin_id: str = Depends(get_admin_user)
):
    """Update a service"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        existing_service = get_service_by_id(service_id)
        if not existing_service:
            raise HTTPException(status_code=404, detail="Service not found")

        service_data = {k: v for k, v in service.dict().items()
                        if v is not None}
        service_data['updated_by'] = admin_id

        updated_service = update_service(service_id, service_data)
        return updated_service
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/services/{service_id}")
async def admin_delete_service(service_id: str, admin_id: str = Depends(get_admin_user)):
    """Delete a service"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN])

        existing_service = get_service_by_id(service_id)
        if not existing_service:
            raise HTTPException(status_code=404, detail="Service not found")

        delete_service(service_id)
        return {"success": True, "message": "Service deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/admin/services/{service_id}/status")
async def admin_toggle_service_status(
    service_id: str,
    status: str = Query(..., description="Status: 'active' or 'inactive'"),
    admin_id: str = Depends(get_admin_user)
):
    """Toggle service status"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        if status not in ['active', 'inactive']:
            raise HTTPException(
                status_code=400, detail="Status must be 'active' or 'inactive'")

        existing_service = get_service_by_id(service_id)
        if not existing_service:
            raise HTTPException(status_code=404, detail="Service not found")

        update_service(service_id, {'status': status, 'updated_by': admin_id})
        return {"success": True, "status": status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling service status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/services/bulk-delete")
async def admin_bulk_delete_services(
    service_ids: List[str],
    admin_id: str = Depends(get_admin_user)
):
    """Delete multiple services"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN])

        deleted_count = 0
        for service_id in service_ids:
            if get_service_by_id(service_id):
                delete_service(service_id)
                deleted_count += 1

        return {"success": True, "deleted_count": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/services/reorder")
async def admin_reorder_services(
    reorder_data: Dict[str, int],  # {service_id: display_order}
    admin_id: str = Depends(get_admin_user)
):
    """Update display order of services"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        for service_id, display_order in reorder_data.items():
            update_service(
                service_id, {'display_order': display_order, 'updated_by': admin_id})

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering services: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Location management endpoints
@router.get("/admin/locations")
async def admin_get_locations(admin_id: str = Depends(get_admin_user)):
    """Get all locations for admin"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        locations = get_all_locations(active_only=False)
        return {"locations": locations, "count": len(locations)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting locations for admin: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/locations")
async def admin_create_location(
    location: LocationCreate,
    admin_id: str = Depends(get_admin_user)
):
    """Create a new location"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        location_data = location.dict()
        new_location = create_location(location_data)
        return new_location
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/locations/{location_id}")
async def admin_update_location(
    location_id: str,
    location: LocationUpdate,
    admin_id: str = Depends(get_admin_user)
):
    """Update a location"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN, ROLE_MODERATOR])

        existing_location = get_location_by_id(location_id)
        if not existing_location:
            raise HTTPException(status_code=404, detail="Location not found")

        location_data = {k: v for k, v in location.dict().items()
                         if v is not None}
        updated_location = update_location(location_id, location_data)
        return updated_location
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating location: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/locations/{location_id}")
async def admin_delete_location(location_id: str, admin_id: str = Depends(get_admin_user)):
    """Delete a location"""
    try:
        check_permission(admin_id, [ROLE_SUPER_ADMIN])

        if not delete_location(location_id):
            raise HTTPException(
                status_code=400, detail="Cannot delete location that is in use by services")

        return {"success": True, "message": "Location deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting location: {e}")
        raise HTTPException(status_code=500, detail=str(e))
