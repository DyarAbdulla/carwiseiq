"""
Admin API routes for dashboard and management
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging

from app.services.admin_service import (
    authenticate_admin,
    create_admin_token,
    decode_admin_token,
    get_admin_by_id,
    log_admin_action,
    check_permission,
    change_admin_password,
    ROLE_SUPER_ADMIN,
    ROLE_MODERATOR,
    ROLE_VIEWER
)
from app.services.feedback_service import get_db as get_feedback_db
from app.services.auth_service import get_db as get_user_db
from app.services.marketplace_service import get_db as get_marketplace_db
import json
import sqlite3

logger = logging.getLogger(__name__)


def get_marketplace_listings_count(status: Optional[str] = None) -> int:
    """Get count of marketplace listings"""
    try:
        conn = get_marketplace_db()
        cursor = conn.cursor()
        if status:
            cursor.execute("SELECT COUNT(*) as count FROM listings WHERE status = ?", (status,))
        else:
            cursor.execute("SELECT COUNT(*) as count FROM listings")
        result = cursor.fetchone()
        conn.close()
        return result["count"] if result else 0
    except Exception as e:
        logger.error(f"Error getting listings count: {e}")
        return 0

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Request/Response models
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    created_at: Optional[str] = None
    last_login: Optional[str] = None


class AdminAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    admin_token: Optional[str] = Cookie(None)
):
    """Get current admin from token"""
    auth_token = None
    if credentials:
        auth_token = credentials.credentials
    elif admin_token:
        auth_token = admin_token

    if not auth_token:
        return None

    payload = decode_admin_token(auth_token)
    if not payload:
        return None

    admin_id = payload.get("sub")
    if not admin_id:
        return None

    admin = get_admin_by_id(int(admin_id))
    if not admin:
        return None

    return AdminResponse(**admin)


def require_admin(admin: Optional[AdminResponse] = Depends(get_current_admin)):
    """Require admin authentication"""
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    return admin


def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(admin: AdminResponse = Depends(require_admin)):
        if not check_permission(admin.role, permission):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return admin
    return decorator


@router.post("/login", response_model=AdminAuthResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login"""
    admin = authenticate_admin(request.email, request.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_admin_token(data={"sub": str(admin["id"])})
    
    # Log login action (IP and user agent can be added later if needed)
    log_admin_action(
        admin["id"],
        "login"
    )

    return AdminAuthResponse(
        access_token=token,
        admin=AdminResponse(**admin)
    )


@router.get("/me", response_model=AdminResponse)
async def get_me(admin: AdminResponse = Depends(require_admin)):
    """Get current admin info"""
    return admin


@router.post("/logout")
async def admin_logout(admin: AdminResponse = Depends(require_admin)):
    """Admin logout"""
    log_admin_action(admin.id, "logout")
    return {"message": "Logged out successfully"}


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    admin: AdminResponse = Depends(require_admin)
):
    """Change admin password"""
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    success, error = change_admin_password(admin.id, request.old_password, request.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=error or "Failed to change password")
    
    return {"message": "Password changed successfully"}


# Dashboard Statistics
@router.get("/dashboard/stats")
async def get_dashboard_stats(admin: AdminResponse = Depends(require_admin)):
    """Get dashboard statistics"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()

        # Total predictions (today, this week, this month, all-time)
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN DATE(timestamp) = DATE('now') THEN 1 ELSE 0 END) as today,
                SUM(CASE WHEN timestamp >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as this_week,
                SUM(CASE WHEN timestamp >= datetime('now', '-30 days') THEN 1 ELSE 0 END) as this_month,
                COUNT(*) as all_time
            FROM predictions
        """)
        pred_stats = cursor.fetchone()

        # Total users
        user_conn = get_user_db()
        user_cursor = user_conn.cursor()
        user_cursor.execute("SELECT COUNT(*) as total FROM users")
        total_users = user_cursor.fetchone()["total"]
        user_conn.close()

        # Model accuracy from feedback
        cursor.execute("""
            SELECT 
                COUNT(*) as total_feedback,
                CASE 
                    WHEN COUNT(*) > 0 THEN SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
                    ELSE 0
                END as accuracy_percent
            FROM feedback
            WHERE is_accurate IS NOT NULL
        """)
        accuracy = cursor.fetchone()

        # Recent feedback (last 10)
        cursor.execute("""
            SELECT 
                f.id, f.rating, f.is_accurate, f.timestamp,
                p.car_features, p.predicted_price
            FROM feedback f
            JOIN predictions p ON f.prediction_id = p.id
            ORDER BY f.timestamp DESC
            LIMIT 10
        """)
        recent_feedback = cursor.fetchall()

        # System health
        health_status = {
            "api": "healthy",
            "database": "healthy",
            "model": "healthy"
        }

        conn.close()

        return {
            "predictions": {
                "today": int(pred_stats["today"] or 0),
                "this_week": int(pred_stats["this_week"] or 0),
                "this_month": int(pred_stats["this_month"] or 0),
                "all_time": int(pred_stats["all_time"] or 0)
            },
            "users": {
                "total": int(total_users or 0)
            },
            "accuracy": {
                "percent": round(float(accuracy["accuracy_percent"] or 0), 2) if accuracy and accuracy["total_feedback"] else 0.0,
                "total_feedback": int(accuracy["total_feedback"] or 0) if accuracy else 0
            },
            "listings": {
                "active": get_marketplace_listings_count("active"),
                "total": get_marketplace_listings_count(),
                "sold": get_marketplace_listings_count("sold"),
                "draft": get_marketplace_listings_count("draft"),
            },
            "recent_feedback": [
                {
                    "id": row["id"],
                    "rating": row["rating"],
                    "is_accurate": bool(row["is_accurate"]) if row["is_accurate"] is not None else None,
                    "timestamp": row["timestamp"],
                    "car": json.loads(row["car_features"]) if row["car_features"] else {},
                    "predicted_price": float(row["predicted_price"]) if row["predicted_price"] else 0.0
                }
                for row in recent_feedback
            ],
            "system_health": health_status
        }
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/charts/predictions-over-time")
async def get_predictions_over_time(
    days: int = Query(30, ge=1, le=365),
    admin: AdminResponse = Depends(require_admin)
):
    """Get predictions over time for chart"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as count
            FROM predictions
            WHERE timestamp >= datetime('now', '-{days} days')
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        """)
        rows = cursor.fetchall()
        conn.close()

        return [
            {"date": row["date"], "count": row["count"]}
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error getting predictions chart: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/charts/feedback-ratings")
async def get_feedback_ratings_distribution(admin: AdminResponse = Depends(require_admin)):
    """Get feedback ratings distribution"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                rating,
                COUNT(*) as count
            FROM feedback
            WHERE rating IS NOT NULL
            GROUP BY rating
            ORDER BY rating ASC
        """)
        rows = cursor.fetchall()
        conn.close()

        return [
            {"rating": row["rating"], "count": row["count"]}
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error getting feedback ratings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/charts/accuracy-trend")
async def get_accuracy_trend(
    days: int = Query(30, ge=1, le=365),
    admin: AdminResponse = Depends(require_admin)
):
    """Get accuracy trend over time"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()
        cursor.execute(f"""
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as total,
                CASE 
                    WHEN COUNT(*) > 0 THEN SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
                    ELSE 0
                END as accuracy_percent
            FROM feedback
            WHERE timestamp >= datetime('now', '-{days} days')
                AND is_accurate IS NOT NULL
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        """)
        rows = cursor.fetchall()
        conn.close()

        return [
            {
                "date": row["date"],
                "accuracy_percent": round(row["accuracy_percent"] or 0, 2)
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error getting accuracy trend: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/marketplace-analytics")
async def get_marketplace_analytics(admin: AdminResponse = Depends(require_admin)):
    """Get marketplace analytics for admin dashboard"""
    try:
        conn = get_marketplace_db()
        cursor = conn.cursor()
        
        # Total listings by status
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM listings
            GROUP BY status
        """)
        status_counts = {row["status"]: row["count"] for row in cursor.fetchall()}
        
        # Most viewed makes/models
        cursor.execute("""
            SELECT make, model, SUM(views_count) as total_views
            FROM listings
            GROUP BY make, model
            ORDER BY total_views DESC
            LIMIT 10
        """)
        top_makes_models = [
            {"make": row["make"], "model": row["model"], "views": row["total_views"]}
            for row in cursor.fetchall()
        ]
        
        # Average time to sell (sold listings)
        cursor.execute("""
            SELECT 
                AVG(julianday(updated_at) - julianday(created_at)) as avg_days
            FROM listings
            WHERE status = 'sold'
        """)
        avg_days_result = cursor.fetchone()
        avg_days_to_sell = round(avg_days_result["avg_days"] or 0, 1) if avg_days_result else 0
        
        # Conversion rate (views to messages)
        cursor.execute("""
            SELECT 
                SUM(views_count) as total_views,
                SUM(contacts_count) as total_contacts
            FROM listings
            WHERE views_count > 0
        """)
        conversion_result = cursor.fetchone()
        conversion_rate = 0
        if conversion_result and conversion_result["total_views"]:
            conversion_rate = round(
                (conversion_result["total_contacts"] / conversion_result["total_views"]) * 100, 
                2
            )
        
        # Geographic distribution
        cursor.execute("""
            SELECT location_city, COUNT(*) as count
            FROM listings
            WHERE location_city IS NOT NULL
            GROUP BY location_city
            ORDER BY count DESC
            LIMIT 10
        """)
        geographic_dist = [
            {"city": row["location_city"], "count": row["count"]}
            for row in cursor.fetchall()
        ]
        
        # Listings over time
        cursor.execute("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM listings
            WHERE created_at >= datetime('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """)
        listings_over_time = [
            {"date": row["date"], "count": row["count"]}
            for row in cursor.fetchall()
        ]
        
        conn.close()
        
        return {
            "listings_by_status": status_counts,
            "top_makes_models": top_makes_models,
            "average_days_to_sell": avg_days_to_sell,
            "conversion_rate": conversion_rate,
            "geographic_distribution": geographic_dist,
            "listings_over_time": listings_over_time,
        }
    except Exception as e:
        logger.error(f"Error getting marketplace analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Feedback Management
@router.get("/feedback")
async def get_feedback_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    rating: Optional[int] = Query(None, ge=1, le=5),
    accuracy: Optional[str] = Query(None),  # "accurate", "inaccurate", "no_feedback"
    make: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    admin: AdminResponse = Depends(require_admin)
):
    """Get feedback list with filters"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()

        # Build query
        where_clauses = []
        params = []

        if rating:
            where_clauses.append("f.rating = ?")
            params.append(rating)

        if accuracy == "accurate":
            where_clauses.append("f.is_accurate = 1")
        elif accuracy == "inaccurate":
            where_clauses.append("f.is_accurate = 0")
        elif accuracy == "no_feedback":
            where_clauses.append("f.is_accurate IS NULL")

        if make:
            where_clauses.append("json_extract(p.car_features, '$.make') = ?")
            params.append(make)

        if search:
            where_clauses.append("""
                (json_extract(p.car_features, '$.make') LIKE ? OR
                 json_extract(p.car_features, '$.model') LIKE ? OR
                 u.email LIKE ?)
            """)
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])

        if date_from:
            where_clauses.append("DATE(f.timestamp) >= ?")
            params.append(date_from)

        if date_to:
            where_clauses.append("DATE(f.timestamp) <= ?")
            params.append(date_to)

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Get total count
        cursor.execute(f"""
            SELECT COUNT(*) as total
            FROM feedback f
            JOIN predictions p ON f.prediction_id = p.id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE {where_sql}
        """, params)
        total = cursor.fetchone()["total"]

        # Get paginated results
        offset = (page - 1) * page_size
        cursor.execute(f"""
            SELECT 
                f.id, f.rating, f.is_accurate, f.feedback_type, f.timestamp,
                p.id as prediction_id, p.car_features, p.predicted_price,
                p.confidence_level,
                u.email as user_email,
                f.feedback_reasons, f.correct_price, f.other_details
            FROM feedback f
            JOIN predictions p ON f.prediction_id = p.id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE {where_sql}
            ORDER BY f.timestamp DESC
            LIMIT ? OFFSET ?
        """, params + [page_size, offset])
        rows = cursor.fetchall()
        conn.close()

        return {
            "items": [
                {
                    "id": row["id"],
                    "prediction_id": row["prediction_id"],
                    "date": row["timestamp"],
                    "user": row["user_email"] or "Anonymous",
                    "car": json.loads(row["car_features"]) if row["car_features"] else {},
                    "rating": row["rating"],
                    "is_accurate": bool(row["is_accurate"]) if row["is_accurate"] is not None else None,
                    "feedback_type": row["feedback_type"],
                    "predicted_price": row["predicted_price"],
                    "confidence_level": row["confidence_level"],
                    "feedback_reasons": json.loads(row["feedback_reasons"]) if row["feedback_reasons"] else [],
                    "correct_price": row["correct_price"],
                    "other_details": row["other_details"]
                }
                for row in rows
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        logger.error(f"Error getting feedback list: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feedback/{feedback_id}")
async def get_feedback_detail(
    feedback_id: int,
    admin: AdminResponse = Depends(require_admin)
):
    """Get feedback detail"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                f.*, p.*, u.email as user_email
            FROM feedback f
            JOIN predictions p ON f.prediction_id = p.id
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.id = ?
        """, (feedback_id,))
        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=404, detail="Feedback not found")

        return {
            "id": row["id"],
            "prediction_id": row["prediction_id"],
            "user_email": row["user_email"],
            "rating": row["rating"],
            "is_accurate": bool(row["is_accurate"]) if row["is_accurate"] is not None else None,
            "feedback_type": row["feedback_type"],
            "feedback_reasons": json.loads(row["feedback_reasons"]) if row["feedback_reasons"] else [],
            "correct_make": row["correct_make"],
            "correct_model": row["correct_model"],
            "correct_year": row["correct_year"],
            "correct_price": row["correct_price"],
            "other_details": row["other_details"],
            "timestamp": row["timestamp"],
            "prediction": {
                "id": row["prediction_id"],
                "car_features": json.loads(row["car_features"]) if row["car_features"] else {},
                "predicted_price": row["predicted_price"],
                "confidence_level": row["confidence_level"],
                "timestamp": row["timestamp"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting feedback detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# User Management
@router.get("/users")
async def get_users_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    admin: AdminResponse = Depends(require_permission("view"))
):
    """Get users list"""
    try:
        conn = get_user_db()
        cursor = conn.cursor()

        where_clause = ""
        params = []
        if search:
            where_clause = "WHERE email LIKE ?"
            params.append(f"%{search}%")

        # Get total count
        cursor.execute(f"SELECT COUNT(*) as total FROM users {where_clause}", params)
        total = cursor.fetchone()["total"]

        # Get user stats (predictions count, feedback count)
        offset = (page - 1) * page_size
        cursor.execute(f"""
            SELECT 
                u.id, u.email, u.created_at,
                COUNT(DISTINCT p.id) as predictions_count,
                COUNT(DISTINCT f.id) as feedback_count
            FROM users u
            LEFT JOIN predictions p ON u.id = p.user_id
            LEFT JOIN feedback f ON u.id = f.user_id
            {where_clause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        """, params + [page_size, offset])
        rows = cursor.fetchall()
        conn.close()

        return {
            "items": [
                {
                    "id": row["id"],
                    "email": row["email"],
                    "join_date": row["created_at"],
                    "predictions_count": row["predictions_count"] or 0,
                    "feedback_count": row["feedback_count"] or 0,
                    "status": "active"  # Placeholder
                }
                for row in rows
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }
    except Exception as e:
        logger.error(f"Error getting users list: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    admin: AdminResponse = Depends(require_permission("view"))
):
    """Get user detail"""
    try:
        conn = get_user_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user predictions count
        feedback_conn = get_feedback_db()
        feedback_cursor = feedback_conn.cursor()
        feedback_cursor.execute("SELECT COUNT(*) as count FROM predictions WHERE user_id = ?", (user_id,))
        predictions_count = feedback_cursor.fetchone()["count"]
        feedback_cursor.execute("SELECT COUNT(*) as count FROM feedback WHERE user_id = ?", (user_id,))
        feedback_count = feedback_cursor.fetchone()["count"]
        feedback_conn.close()

        return {
            "id": user["id"],
            "email": user["email"],
            "created_at": user["created_at"],
            "predictions_count": predictions_count,
            "feedback_count": feedback_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: AdminResponse = Depends(require_permission("edit"))
):
    """Delete a user"""
    try:
        conn = get_user_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()

        log_admin_action(admin.id, "delete_user", "user", user_id)
        return {"message": "User deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Admin listings (marketplace management)
@router.get("/listings")
async def get_admin_listings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, regex="^(active|sold|draft|deleted)$"),
    search: Optional[str] = Query(None),
    admin: AdminResponse = Depends(require_permission("view")),
):
    """List marketplace listings for admin."""
    try:
        conn = get_marketplace_db()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        where_parts = ["1=1"]
        params: List[Any] = []
        if status:
            where_parts.append("l.status = ?")
            params.append(status)
        if search:
            where_parts.append("(l.make LIKE ? OR l.model LIKE ? OR l.description LIKE ?)")
            q = f"%{search}%"
            params.extend([q, q, q])
        where_sql = " AND ".join(where_parts)
        cursor.execute(f"SELECT COUNT(*) as total FROM listings l WHERE {where_sql}", params)
        total = cursor.fetchone()[0]
        offset = (page - 1) * page_size
        cursor.execute(f"""
            SELECT l.id, l.make, l.model, l.year, l.price, l.mileage, l.mileage_unit,
                   l.condition, l.status, l.location_city, l.location_state, l.cover_image_id,
                   l.created_at
            FROM listings l
            WHERE {where_sql}
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        """, params + [page_size, offset])
        rows = cursor.fetchall()
        items = []
        for row in rows:
            r = {k: row[k] for k in row.keys()}
            cursor.execute(
                "SELECT id, url, file_path FROM listing_images WHERE listing_id = ? ORDER BY display_order, id LIMIT 1",
                (r["id"],),
            )
            img = cursor.fetchone()
            if img:
                r["cover_image"] = img["url"] if img["url"] else (f"/uploads/listings/{r['id']}/{img['file_path']}" if img["file_path"] else None)
            else:
                r["cover_image"] = None
            items.append(r)
        conn.close()
        return {"items": items, "total": total, "page": page, "page_size": page_size}
    except Exception as e:
        logger.error(f"Error listing admin listings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class AdminListingPatch(BaseModel):
    status: Optional[str] = None


@router.patch("/listings/{listing_id}")
async def admin_patch_listing(
    listing_id: int,
    body: AdminListingPatch,
    admin: AdminResponse = Depends(require_permission("edit")),
):
    """Update listing status (e.g. mark sold/active)."""
    if not body.status or body.status not in ("active", "sold", "draft", "deleted"):
        raise HTTPException(status_code=400, detail="status must be one of: active, sold, draft, deleted")
    try:
        conn = get_marketplace_db()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE listings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (body.status, listing_id),
        )
        n = cursor.rowcount
        conn.commit()
        conn.close()
        if n == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        return {"message": "Updated", "id": listing_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error patching listing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/listings/{listing_id}")
async def admin_delete_listing(
    listing_id: int,
    admin: AdminResponse = Depends(require_permission("edit")),
):
    """Soft-delete a listing (status = deleted)."""
    try:
        conn = get_marketplace_db()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE listings SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (listing_id,),
        )
        n = cursor.rowcount
        conn.commit()
        conn.close()
        if n == 0:
            raise HTTPException(status_code=404, detail="Listing not found")
        return {"message": "Deleted", "id": listing_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting listing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# System Settings (placeholder endpoints)
@router.get("/settings")
async def get_settings(admin: AdminResponse = Depends(require_permission("view"))):
    """Get system settings"""
    return {
        "model": {
            "version": "v2",
            "accuracy_threshold": 85.0,
            "retraining_schedule": "weekly"
        },
        "feedback": {
            "collection_enabled": True,
            "min_feedback_for_retraining": 100
        }
    }


@router.post("/settings/model/retrain")
async def trigger_model_retrain(admin: AdminResponse = Depends(require_permission("edit"))):
    """Trigger model retraining"""
    log_admin_action(admin.id, "trigger_retrain", "model")
    # TODO: Implement actual retraining trigger
    return {"message": "Model retraining triggered", "status": "queued"}


# Reports
@router.get("/reports/daily-feedback")
async def get_daily_feedback_report(
    date: Optional[str] = Query(None),
    admin: AdminResponse = Depends(require_admin)
):
    """Get daily feedback summary report"""
    try:
        conn = get_feedback_db()
        cursor = conn.cursor()
        target_date = date or datetime.now().strftime("%Y-%m-%d")
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent
            FROM feedback
            WHERE DATE(timestamp) = ?
        """, (target_date,))
        result = cursor.fetchone()
        conn.close()

        return {
            "date": target_date,
            "total_feedback": result["total"] or 0,
            "avg_rating": round(result["avg_rating"] or 0, 2),
            "accuracy_percent": round(result["accuracy_percent"] or 0, 2)
        }
    except Exception as e:
        logger.error(f"Error getting daily report: {e}")
        raise HTTPException(status_code=500, detail=str(e))
