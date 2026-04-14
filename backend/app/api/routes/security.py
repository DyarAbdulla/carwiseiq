"""
Public security endpoints (IP ban status for static frontend gate).
"""

from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request

from app.services.chat_security_service import (
    chat_security_ready,
    client_ip_from_request,
    get_active_ban_ends_at,
)

router = APIRouter()


@router.get("/security/ip-ban-status")
async def ip_ban_status(request: Request) -> Dict[str, Any]:
    """Returns whether the caller IP is currently banned (used by SPA gate)."""
    if not chat_security_ready():
        return {"banned": False, "ends_at": None}

    fwd = request.headers.get("x-forwarded-for")
    ip = client_ip_from_request(
        request.client.host if request.client else None,
        fwd,
    )
    ends: Optional[datetime] = await get_active_ban_ends_at(ip)
    if not ends:
        return {"banned": False, "ends_at": None}
    return {
        "banned": True,
        "ends_at": ends.isoformat().replace("+00:00", "Z"),
    }
