"""Daily predict/compare usage status for the frontend."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.api.routes.auth import UserResponse, get_current_user
from app.services.chat_security_service import client_ip_from_request, rate_limit_identity_key
from app.services.usage_limits_service import get_daily_status, usage_local_date

router = APIRouter()


@router.get("/usage/daily-status")
async def daily_usage_status(
    request: Request,
    current_user: Optional[UserResponse] = Depends(get_current_user),
    tz: str = Query(default="Asia/Baghdad", description="IANA timezone for calendar day"),
):
    """Returns remaining predict/compare uses for the user's local day."""
    ip = client_ip_from_request(
        request.client.host if request.client else None,
        request.headers.get("x-forwarded-for"),
    )
    supabase_uid = getattr(current_user, "supabase_user_id", None) if current_user else None
    legacy_id = current_user.id if current_user else None
    ident = rate_limit_identity_key(ip, supabase_uid, legacy_id)
    usage_date = usage_local_date(tz)
    return await get_daily_status(ident, usage_date, supabase_uid)
