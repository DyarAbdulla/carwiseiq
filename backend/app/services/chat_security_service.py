"""
Supabase-backed AI chat quotas, profanity strikes, and IP bans (PostgREST + service role).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

import httpx

from app.services.chat_locale import format_remaining_phrase
from app.services.push_notifications import _service_key, _supabase_url, supabase_rest_ready

logger = logging.getLogger(__name__)

CHAT_WINDOW = timedelta(minutes=120)
CHAT_MAX_MESSAGES = 10
BAN_DURATION = timedelta(hours=5)


def chat_security_ready() -> bool:
    return supabase_rest_ready()


def _headers() -> Dict[str, str]:
    key = _service_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


async def get_active_ban_ends_at(ip: str) -> Optional[datetime]:
    """Returns ban end time if IP is currently banned."""
    if not ip or not chat_security_ready():
        return None
    base = _supabase_url()
    now = datetime.now(timezone.utc)
    url = (
        f"{base}/rest/v1/ip_bans"
        f"?ip_address=eq.{quote(ip, safe='')}"
        f"&ends_at=gt.{quote(_iso(now), safe='')}"
        f"&select=ends_at"
        f"&order=ends_at.desc"
        f"&limit=1"
    )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, headers=_headers())
        if r.status_code != 200:
            logger.warning("ip_bans select failed: %s %s", r.status_code, r.text[:200])
            return None
        rows = r.json()
        if not rows:
            return None
        raw = rows[0].get("ends_at")
        if not raw:
            return None
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except Exception as e:
        logger.error("get_active_ban_ends_at error: %s", e, exc_info=True)
        return None


async def insert_ip_ban(ip: str, reason: str) -> datetime:
    ends = datetime.now(timezone.utc) + BAN_DURATION
    if not chat_security_ready():
        return ends
    base = _supabase_url()
    url = f"{base}/rest/v1/ip_bans"
    body = {
        "ip_address": ip,
        "reason": reason,
        "starts_at": _iso(datetime.now(timezone.utc)),
        "ends_at": _iso(ends),
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.post(
                url,
                headers={**_headers(), "Prefer": "return=minimal"},
                json=body,
            )
        if r.status_code not in (200, 201, 204):
            logger.error("insert_ip_ban failed: %s %s", r.status_code, r.text[:300])
    except Exception as e:
        logger.error("insert_ip_ban error: %s", e, exc_info=True)
    return ends


async def get_profanity_strikes(ip: str) -> int:
    if not ip or not chat_security_ready():
        return 0
    base = _supabase_url()
    url = f"{base}/rest/v1/ai_chat_profanity_strikes?ip_address=eq.{quote(ip, safe='')}&select=strike_count"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, headers=_headers())
        if r.status_code != 200:
            return 0
        rows = r.json()
        if not rows:
            return 0
        return int(rows[0].get("strike_count") or 0)
    except Exception as e:
        logger.error("get_profanity_strikes error: %s", e, exc_info=True)
        return 0


async def set_profanity_strikes(ip: str, count: int) -> None:
    """Persist strike_count for this IP. Uses PATCH-then-INSERT so we do not rely on PostgREST upsert quirks."""
    if not ip or ip == "unknown" or not chat_security_ready():
        return
    base = _supabase_url()
    now = datetime.now(timezone.utc)
    body = {"strike_count": max(0, int(count)), "updated_at": _iso(now)}
    patch_url = f"{base}/rest/v1/ai_chat_profanity_strikes?ip_address=eq.{quote(ip, safe='')}"
    insert_url = f"{base}/rest/v1/ai_chat_profanity_strikes"
    insert_body = {"ip_address": ip, **body}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            pr = await client.patch(
                patch_url,
                headers={**_headers(), "Prefer": "return=representation"},
                json=body,
            )
        if pr.status_code == 204:
            return
        if pr.status_code == 200:
            rows = pr.json()
            if isinstance(rows, list) and len(rows) > 0:
                return
        else:
            logger.warning("set_profanity_strikes patch: %s %s", pr.status_code, pr.text[:300])

        async with httpx.AsyncClient(timeout=12.0) as client:
            ins = await client.post(
                insert_url,
                headers={**_headers(), "Prefer": "return=minimal"},
                json=insert_body,
            )
        if ins.status_code not in (200, 201, 204):
            logger.error("set_profanity_strikes insert failed: %s %s", ins.status_code, ins.text[:300])
    except Exception as e:
        logger.error("set_profanity_strikes error: %s", e, exc_info=True)


async def try_consume_chat_quota(
    identity_key: str,
    locale: str = "en",
) -> Tuple[bool, Optional[datetime], Optional[str]]:
    """
    Enforces rolling window from first message in window.
    Returns (allowed, reset_at_if_blocked, user_facing_remaining_phrase).
    On allowed, increments count and may start a new window.
    """
    if not chat_security_ready():
        return True, None, None

    base = _supabase_url()
    read_url = f"{base}/rest/v1/ai_chat_rate_limits?identity_key=eq.{quote(identity_key, safe='')}&select=window_start,message_count"

    now = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(read_url, headers=_headers())
        if r.status_code != 200:
            logger.warning("rate limit read failed: %s", r.status_code)
            return True, None, None

        rows = r.json()
        row = rows[0] if rows else None

        if not row:
            new_start = now
            new_count = 1
        else:
            ws_raw = row.get("window_start")
            ws = datetime.fromisoformat(str(ws_raw).replace("Z", "+00:00"))
            count = int(row.get("message_count") or 0)
            if now >= ws + CHAT_WINDOW:
                new_start = now
                new_count = 1
            elif count >= CHAT_MAX_MESSAGES:
                reset_at = ws + CHAT_WINDOW
                rem = reset_at - now
                phrase = format_remaining_phrase(rem, locale)
                return False, reset_at, phrase
            else:
                new_start = ws
                new_count = count + 1

        write_url = f"{base}/rest/v1/ai_chat_rate_limits"
        upsert_body = {
            "identity_key": identity_key,
            "window_start": _iso(new_start),
            "message_count": new_count,
            "updated_at": _iso(now),
        }
        async with httpx.AsyncClient(timeout=12.0) as client:
            wr = await client.post(
                write_url,
                headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": "identity_key"},
                json=upsert_body,
            )
        if wr.status_code not in (200, 201, 204):
            logger.error("rate limit upsert failed: %s %s", wr.status_code, wr.text[:300])
        return True, None, None
    except Exception as e:
        logger.error("try_consume_chat_quota error: %s", e, exc_info=True)
        return True, None, None


def rate_limit_identity_key(ip: str, supabase_user_id: Optional[str], legacy_user_id: Optional[int]) -> str:
    if supabase_user_id:
        return f"su:{supabase_user_id}"
    if legacy_user_id is not None and legacy_user_id > 0:
        return f"rest:{legacy_user_id}"
    return f"ip:{ip or 'unknown'}"


def client_ip_from_request(client_host: Optional[str], x_forwarded_for: Optional[str]) -> str:
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return (client_host or "").strip() or "unknown"
