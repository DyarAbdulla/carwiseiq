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


def normalize_client_ip(ip: str) -> str:
    """Collapse IPv4-mapped IPv6 so strikes/bans/rate limits match one key per client."""
    ip = (ip or "").strip()
    if len(ip) > 7 and ip.lower().startswith("::ffff:"):
        return ip[7:]
    return ip or "unknown"


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


async def _latest_active_ban_end(table: str, ip: str, now: datetime) -> Optional[datetime]:
    base = _supabase_url()
    url = (
        f"{base}/rest/v1/{table}"
        f"?ip_address=eq.{quote(ip, safe='')}"
        f"&ends_at=gt.{quote(_iso(now), safe='')}"
        f"&select=ends_at"
        f"&order=ends_at.desc"
        f"&limit=1"
    )
    async with httpx.AsyncClient(timeout=12.0) as client:
        r = await client.get(url, headers=_headers())
    if r.status_code != 200:
        logger.warning("%s select failed: %s %s", table, r.status_code, r.text[:200])
        return None
    rows = r.json()
    if not rows:
        return None
    raw = rows[0].get("ends_at")
    if not raw:
        return None
    return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))


async def get_active_ban_ends_at(ip: str) -> Optional[datetime]:
    """Returns latest ban end time if IP is currently banned (ip_bans + user_bans)."""
    ip = normalize_client_ip(ip)
    if not ip or ip == "unknown" or not chat_security_ready():
        return None
    now = datetime.now(timezone.utc)
    try:
        ends: list[datetime] = []
        for table in ("ip_bans", "user_bans"):
            e = await _latest_active_ban_end(table, ip, now)
            if e is not None:
                ends.append(e)
        return max(ends) if ends else None
    except Exception as e:
        logger.error("get_active_ban_ends_at error: %s", e, exc_info=True)
        return None


async def insert_ip_ban(ip: str, reason: str) -> datetime:
    ip = normalize_client_ip(ip)
    ends = datetime.now(timezone.utc) + BAN_DURATION
    if not chat_security_ready():
        return ends
    base = _supabase_url()
    started = _iso(datetime.now(timezone.utc))
    ends_s = _iso(ends)
    ip_body = {
        "ip_address": ip,
        "reason": reason,
        "starts_at": started,
        "ends_at": ends_s,
    }
    ub_body = {
        "ip_address": ip,
        "reason": reason,
        "started_at": started,
        "ends_at": ends_s,
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            for path, body in (
                ("ip_bans", ip_body),
                ("user_bans", ub_body),
            ):
                r = await client.post(
                    f"{base}/rest/v1/{path}",
                    headers={**_headers(), "Prefer": "return=minimal"},
                    json=body,
                )
                if r.status_code not in (200, 201, 204):
                    logger.error("insert %s failed: %s %s", path, r.status_code, r.text[:300])
    except Exception as e:
        logger.error("insert_ip_ban error: %s", e, exc_info=True)
    return ends


async def get_profanity_strikes(ip: str) -> int:
    ip = normalize_client_ip(ip)
    if not ip or ip == "unknown" or not chat_security_ready():
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
    ip = normalize_client_ip(ip)
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


async def _persist_chat_rate_limit(
    identity_key: str,
    window_start: datetime,
    message_count: int,
) -> bool:
    """PATCH row if it exists, else INSERT. PostgREST merge-duplicates is unreliable in some deployments."""
    base = _supabase_url()
    now = datetime.now(timezone.utc)
    body = {
        "window_start": _iso(window_start),
        "message_count": message_count,
        "updated_at": _iso(now),
    }
    patch_url = f"{base}/rest/v1/ai_chat_rate_limits?identity_key=eq.{quote(identity_key, safe='')}"
    insert_url = f"{base}/rest/v1/ai_chat_rate_limits"
    insert_body = {"identity_key": identity_key, **body}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            pr = await client.patch(
                patch_url,
                headers={**_headers(), "Prefer": "return=representation"},
                json=body,
            )
        if pr.status_code == 204:
            logger.info(
                "chat rate limit PATCH ok (204) identity=%s count=%s",
                identity_key[:48],
                message_count,
            )
            return True
        if pr.status_code == 200:
            rows = pr.json()
            if isinstance(rows, list) and len(rows) > 0:
                logger.info(
                    "chat rate limit PATCH ok identity=%s count=%s",
                    identity_key[:48],
                    message_count,
                )
                return True
        logger.warning(
            "chat rate limit PATCH miss status=%s identity=%s body=%s",
            pr.status_code,
            identity_key[:48],
            pr.text[:200],
        )

        async with httpx.AsyncClient(timeout=12.0) as client:
            ins = await client.post(
                insert_url,
                headers={**_headers(), "Prefer": "return=minimal"},
                json=insert_body,
            )
        ok = ins.status_code in (200, 201, 204)
        if ok:
            logger.info(
                "chat rate limit INSERT ok identity=%s count=%s",
                identity_key[:48],
                message_count,
            )
        else:
            logger.error(
                "chat rate limit INSERT failed: %s %s",
                ins.status_code,
                ins.text[:300],
            )
        return ok
    except Exception as e:
        logger.error("_persist_chat_rate_limit error: %s", e, exc_info=True)
        return False


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
    read_url = (
        f"{base}/rest/v1/ai_chat_rate_limits"
        f"?identity_key=eq.{quote(identity_key, safe='')}"
        f"&select=window_start,message_count"
    )

    now = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(read_url, headers=_headers())
        logger.info(
            "chat quota GET ai_chat_rate_limits status=%s identity_key_prefix=%s",
            r.status_code,
            identity_key[:40],
        )
        if r.status_code != 200:
            logger.error("rate limit read failed: %s %s", r.status_code, r.text[:300])
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
                logger.info(
                    "chat quota BLOCKED identity=%s count=%s window=%s",
                    identity_key[:40],
                    count,
                    ws_raw,
                )
                return False, reset_at, phrase
            else:
                new_start = ws
                new_count = count + 1

        ok = await _persist_chat_rate_limit(identity_key, new_start, new_count)
        if not ok:
            reset_at = new_start + CHAT_WINDOW
            phrase = format_remaining_phrase(reset_at - now, locale)
            logger.error("chat quota persist failed — blocking identity=%s", identity_key[:40])
            return False, reset_at, phrase
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
        return normalize_client_ip(x_forwarded_for.split(",")[0].strip())
    return normalize_client_ip((client_host or "").strip() or "unknown")
