"""
Push notification API (Railway). Replaces Next.js /api/notifications/* for static export.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.api.routes.auth import UserResponse, get_current_user
from app.services import push_notifications as push

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _raise_if_supabase_rest_missing(operation: str) -> None:
    if push.supabase_rest_ready():
        return
    missing, flags = push.supabase_rest_missing_for_logging()
    logger.error(
        "notifications %s: Supabase REST not configured. missing_env=%s env_presence=%s",
        operation,
        missing,
        flags,
    )
    raise HTTPException(
        status_code=500,
        detail={"error": "Server misconfigured", "missing_env": missing},
    )


def _require_user(user: Optional[UserResponse] = Depends(get_current_user)) -> UserResponse:
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


def _require_supabase_uuid(user: UserResponse = Depends(_require_user)) -> str:
    uid = user.supabase_user_id
    if not uid:
        raise HTTPException(
            status_code=403,
            detail="Supabase account required for push notifications",
        )
    return uid


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscriptionIn(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class SubscribeBody(BaseModel):
    subscription: SubscriptionIn
    prefs: Optional[Dict[str, Any]] = None


class UnsubscribeBody(BaseModel):
    endpoint: str


class TriggerBody(BaseModel):
    listingId: str


def _merged_prefs(patch: Dict[str, Any], existing: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    base = push.merge_push_prefs(existing)
    merged = {**base, **push.merge_push_prefs(patch)}
    if "watchMakes" in patch and isinstance(patch["watchMakes"], list):
        merged["watchMakes"] = [x for x in patch["watchMakes"] if isinstance(x, str)]
    if "watchModels" in patch and isinstance(patch["watchModels"], list):
        merged["watchModels"] = [x for x in patch["watchModels"] if isinstance(x, str)]
    return merged


def _rest_headers() -> Dict[str, str]:
    return push.rest_headers()


@router.get("/vapid-public-key")
async def vapid_public_key():
    key = push.get_vapid_public_key()
    return {"configured": bool(key), "publicKey": key or None}


@router.post("/subscribe")
async def subscribe(body: SubscribeBody, user_uuid: str = Depends(_require_supabase_uuid)):
    _raise_if_supabase_rest_missing("subscribe")
    base, _ = push.get_supabase_rest_config()

    sub = body.subscription
    prefs = _merged_prefs(body.prefs or {})

    row = {
        "user_id": user_uuid,
        "endpoint": sub.endpoint,
        "p256dh": sub.keys.p256dh,
        "auth": sub.keys.auth,
        "prefs": prefs,
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    with httpx.Client() as client:
        r = client.post(
            f"{base}/rest/v1/push_subscriptions",
            params={"on_conflict": "endpoint"},
            headers={**_rest_headers(), "Prefer": "resolution=merge-duplicates"},
            json=[row],
            timeout=30.0,
        )
        if r.status_code >= 400:
            logger.error("push subscribe: %s %s", r.status_code, r.text)
            raise HTTPException(status_code=500, detail=r.text or "Upsert failed")

    return {"ok": True}


@router.delete("/unsubscribe")
async def unsubscribe(body: UnsubscribeBody, user_uuid: str = Depends(_require_supabase_uuid)):
    _raise_if_supabase_rest_missing("unsubscribe")
    base, _ = push.get_supabase_rest_config()
    with httpx.Client() as client:
        r = client.delete(
            f"{base}/rest/v1/push_subscriptions",
            params={"endpoint": f"eq.{body.endpoint}", "user_id": f"eq.{user_uuid}"},
            headers=_rest_headers(),
            timeout=30.0,
        )
        if r.status_code >= 400:
            logger.error("push unsubscribe: %s %s", r.status_code, r.text)
            raise HTTPException(status_code=500, detail=r.text or "Delete failed")
    return {"ok": True}


@router.get("/preferences")
async def get_preferences(user_uuid: str = Depends(_require_supabase_uuid)):
    _raise_if_supabase_rest_missing("get_preferences")
    base, _ = push.get_supabase_rest_config()
    with httpx.Client() as client:
        r = client.get(
            f"{base}/rest/v1/push_subscriptions",
            params={
                "user_id": f"eq.{user_uuid}",
                "select": "prefs",
                "limit": "1",
            },
            headers=_rest_headers(),
            timeout=30.0,
        )
        if r.status_code >= 400:
            raise HTTPException(status_code=500, detail=r.text)
        rows = r.json()
    defaults = push.merge_push_prefs(None)
    if not rows:
        return {"prefs": defaults}
    prefs = push.merge_push_prefs(rows[0].get("prefs"))
    return {"prefs": {**defaults, **prefs}}


@router.patch("/preferences")
async def patch_preferences(
    patch: Dict[str, Any],
    user_uuid: str = Depends(_require_supabase_uuid),
):
    _raise_if_supabase_rest_missing("patch_preferences")
    base, _ = push.get_supabase_rest_config()

    with httpx.Client() as client:
        r = client.get(
            f"{base}/rest/v1/push_subscriptions",
            params={"user_id": f"eq.{user_uuid}", "select": "id,prefs"},
            headers=_rest_headers(),
            timeout=30.0,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            raise HTTPException(
                status_code=404,
                detail="No push subscription; enable notifications on a device first.",
            )
        next_prefs = _merged_prefs(patch, rows[0].get("prefs"))
        r2 = client.patch(
            f"{base}/rest/v1/push_subscriptions",
            params={"user_id": f"eq.{user_uuid}"},
            headers=_rest_headers(),
            json={"prefs": next_prefs, "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")},
            timeout=30.0,
        )
        if r2.status_code >= 400:
            logger.error("push patch prefs: %s %s", r2.status_code, r2.text)
            raise HTTPException(status_code=500, detail=r2.text or "Update failed")

    return {"prefs": push.merge_push_prefs(next_prefs)}


@router.post("/trigger-new-listing")
async def trigger_new_listing(
    body: TriggerBody,
    user_uuid: str = Depends(_require_supabase_uuid),
):
    listing_id = body.listingId.strip()
    if not listing_id:
        raise HTTPException(status_code=400, detail="listingId required")

    result = push.trigger_new_listing(user_uuid, listing_id)
    status = result.pop("status", None)
    if status == 503:
        raise HTTPException(status_code=503, detail=result.get("error", "VAPID not configured"))
    if status == 500:
        raise HTTPException(
            status_code=500,
            detail={
                "error": result.get("error", "Server error"),
                "missing_env": result.get("missing_env", []),
            },
        )
    if status == 404:
        raise HTTPException(status_code=404, detail=result.get("error", "Not found"))
    if status == 403:
        raise HTTPException(status_code=403, detail=result.get("error", "Forbidden"))
    return result


@router.post("/send")
async def admin_send(
    body: Dict[str, Any],
    x_admin_secret: Optional[str] = Header(None, alias="x-admin-secret"),
):
    secret = x_admin_secret or ""
    result = push.admin_send(body, secret)
    status = result.pop("status", None)
    if status == 401:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if status == 503:
        raise HTTPException(status_code=503, detail=result.get("error"))
    if status == 500:
        raise HTTPException(
            status_code=500,
            detail={
                "error": result.get("error", "Server error"),
                "missing_env": result.get("missing_env", []),
            },
        )
    if status == 400:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result
