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

# Rolling window from window_start: max CHAT_MAX_MESSAGES, then block until window_start + CHAT_WINDOW.
CHAT_WINDOW = timedelta(hours=5)
CHAT_MAX_MESSAGES = 10
# Profanity: third strike inserts user_bans with this duration.
PROFANITY_BAN_DURATION = timedelta(hours=2)


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


PERMANENT_BAN_END = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def _active_ban_rows_user_bans(ip: str, now: datetime) -> list[dict]:
    """Rows for this IP where ban is still active: ends_at IS NULL OR ends_at > now (two queries, no PostgREST or= quirks)."""
    base = _supabase_url()
    ip_q = quote(ip, safe="")
    headers = _headers()
    merged: list[dict] = []
    async with httpx.AsyncClient(timeout=12.0) as client:
        u_perm = f"{base}/rest/v1/user_bans?ip_address=eq.{ip_q}&ends_at=is.null&select=ends_at"
        r1 = await client.get(u_perm, headers=headers)
        if r1.status_code != 200:
            logger.warning("user_bans (permanent) select failed: %s %s", r1.status_code, r1.text[:200])
        elif isinstance(r1.json(), list):
            merged.extend(r1.json())
        u_temp = (
            f"{base}/rest/v1/user_bans?ip_address=eq.{ip_q}"
            f"&ends_at=gt.{quote(_iso(now), safe='')}&select=ends_at"
        )
        r2 = await client.get(u_temp, headers=headers)
        if r2.status_code != 200:
            logger.warning("user_bans (temporary) select failed: %s %s", r2.status_code, r2.text[:200])
        elif isinstance(r2.json(), list):
            merged.extend(r2.json())
    try:
        print(f"[BAN CHECK] ip={ip}, active_bans={len(merged)}", flush=True)
    except Exception:
        pass
    return merged


def _max_active_ban_end(rows: list[dict]) -> Optional[datetime]:
    if not rows:
        return None
    ends_list: list[datetime] = []
    for row in rows:
        raw = row.get("ends_at")
        if raw is None:
            return PERMANENT_BAN_END
        ends_list.append(datetime.fromisoformat(str(raw).replace("Z", "+00:00")))
    return max(ends_list) if ends_list else None


async def get_active_ban_ends_at(ip: str) -> Optional[datetime]:
    """Latest ban end time if IP is currently banned (public.user_bans only). NULL ends_at = permanent."""
    ip = normalize_client_ip(ip)
    if not ip or ip == "unknown" or not chat_security_ready():
        return None
    now = datetime.now(timezone.utc)
    try:
        rows = await _active_ban_rows_user_bans(ip, now)
        return _max_active_ban_end(rows)
    except Exception as e:
        logger.error("get_active_ban_ends_at error: %s", e, exc_info=True)
        return None


async def insert_ip_ban(
    ip: str,
    reason: str,
    *,
    duration: Optional[timedelta] = None,
) -> datetime:
    ip = normalize_client_ip(ip)
    delta = duration if duration is not None else PROFANITY_BAN_DURATION
    now_dt = datetime.now(timezone.utc)
    ends = now_dt + delta
    if not chat_security_ready():
        return ends
    base = _supabase_url()
    banned_at_s = _iso(now_dt)
    ends_s = _iso(ends)
    ub_body = {
        "ip_address": ip,
        "reason": reason,
        "banned_at": banned_at_s,
        "ends_at": ends_s,
    }
    try:
        print(f"[INSERTING BAN] ip={ip}, ends_at={ends_s}", flush=True)
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.post(
                f"{base}/rest/v1/user_bans",
                headers={**_headers(), "Prefer": "return=minimal"},
                json=ub_body,
            )
            if r.status_code not in (200, 201, 204):
                logger.error("insert user_bans failed: %s %s", r.status_code, r.text[:300])
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
            try:
                print(f"[WARNING COUNT] ip={ip}, count=0", flush=True)
            except Exception:
                pass
            return 0
        c = int(rows[0].get("strike_count") or 0)
        try:
            print(f"[WARNING COUNT] ip={ip}, count={c}", flush=True)
        except Exception:
            pass
        return c
    except Exception as e:
        logger.error("get_profanity_strikes error: %s", e, exc_info=True)
        return 0


async def set_profanity_strikes(ip: str, count: int) -> None:
    """Persist strike_count for this IP (warning tier). PostgREST upsert — PATCH+204 on zero rows broke first-time writes."""
    ip = normalize_client_ip(ip)
    if not ip or ip == "unknown" or not chat_security_ready():
        return
    base = _supabase_url()
    now = datetime.now(timezone.utc)
    body = {
        "ip_address": ip,
        "strike_count": max(0, int(count)),
        "updated_at": _iso(now),
    }
    url = f"{base}/rest/v1/ai_chat_profanity_strikes"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.post(
                url,
                headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": "ip_address"},
                json=body,
            )
        if r.status_code not in (200, 201, 204):
            logger.error("set_profanity_strikes upsert failed: %s %s", r.status_code, r.text[:300])
    except Exception as e:
        logger.error("set_profanity_strikes error: %s", e, exc_info=True)


async def _persist_chat_rate_limit(
    identity_key: str,
    window_start: datetime,
    message_count: int,
) -> bool:
    """Upsert ai_chat_rate_limits row. Do NOT use PATCH-then-INSERT: PostgREST returns 204 when zero rows match PATCH, which skipped INSERT."""
    base = _supabase_url()
    now = datetime.now(timezone.utc)
    body = {
        "identity_key": identity_key,
        "window_start": _iso(window_start),
        "message_count": message_count,
        "updated_at": _iso(now),
    }
    url = f"{base}/rest/v1/ai_chat_rate_limits"
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.post(
                url,
                headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": "identity_key"},
                json=body,
            )
        ok = r.status_code in (200, 201, 204)
        if ok:
            logger.info(
                "chat rate limit upsert ok identity=%s count=%s",
                identity_key[:48],
                message_count,
            )
        else:
            logger.error(
                "chat rate limit upsert failed: %s %s",
                r.status_code,
                r.text[:300],
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
            try:
                print(f"[RATE LIMIT] identity_key={identity_key}, message_count=0 (new row → 1)", flush=True)
            except Exception:
                pass
        else:
            ws_raw = row.get("window_start")
            ws = datetime.fromisoformat(str(ws_raw).replace("Z", "+00:00"))
            count = int(row.get("message_count") or 0)
            try:
                print(f"[RATE LIMIT] identity_key={identity_key}, message_count={count}", flush=True)
            except Exception:
                pass
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
