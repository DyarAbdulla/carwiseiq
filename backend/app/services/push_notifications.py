"""
Web Push: Supabase REST + pywebpush. Mirrors former Next.js /api/notifications/* logic.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx
from pywebpush import WebPushException, webpush

from app.config import settings

logger = logging.getLogger(__name__)

BAGHDAD = ZoneInfo("Asia/Baghdad")
MAX_PUSH_PER_DAY = 3


def _supabase_url() -> str:
    """Project URL for PostgREST (Railway: SUPABASE_URL; also accepts NEXT_PUBLIC_SUPABASE_URL)."""
    for env_name in ("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"):
        raw = os.getenv(env_name)
        if raw and str(raw).strip():
            return str(raw).strip().rstrip("/")
    cfg = settings.SUPABASE_URL
    if cfg and str(cfg).strip():
        return str(cfg).strip().rstrip("/")
    return ""


def _service_key() -> str:
    """Service role JWT for PostgREST (bypasses RLS). Railway: SUPABASE_SERVICE_ROLE_KEY."""
    for env_name in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"):
        raw = os.getenv(env_name)
        if raw and str(raw).strip():
            return str(raw).strip()
    cfg = settings.SUPABASE_SERVICE_ROLE_KEY
    if cfg and str(cfg).strip():
        return str(cfg).strip()
    return ""


def _vapid_public() -> str:
    return os.getenv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") or os.getenv("VAPID_PUBLIC_KEY") or ""


def _vapid_private() -> str:
    return os.getenv("VAPID_PRIVATE_KEY") or ""


def _vapid_subject() -> str:
    return os.getenv("VAPID_SUBJECT") or "mailto:support@carwiseiq.com"


def _app_origin() -> str:
    return (
        os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("NEXT_PUBLIC_SITE_URL")
        or "https://carwiseiq.com"
    ).rstrip("/")


def vapid_configured() -> bool:
    return bool(_vapid_public() and _vapid_private())


def _rest_headers() -> Dict[str, str]:
    key = _service_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def rest_headers() -> Dict[str, str]:
    """Service-role headers for Supabase PostgREST (used by notification routes)."""
    return _rest_headers()


def get_supabase_rest_config() -> Tuple[str, str]:
    """Returns (supabase_url, service_role_key)."""
    return _supabase_url(), _service_key()


def get_vapid_public_key() -> str:
    return _vapid_public()


def supabase_rest_ready() -> bool:
    return bool(_supabase_url() and _service_key())


def supabase_rest_missing_for_logging() -> Tuple[List[str], Dict[str, bool]]:
    """
    Human-readable missing pieces + safe booleans (which env names have non-empty values).
    Never log secret values.
    """
    missing: List[str] = []
    if not _supabase_url():
        missing.append("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL")
    if not _service_key():
        missing.append("SUPABASE_SERVICE_ROLE_KEY (alias: SUPABASE_SERVICE_KEY)")
    flags = {
        "SUPABASE_URL": bool(os.getenv("SUPABASE_URL", "").strip()),
        "NEXT_PUBLIC_SUPABASE_URL": bool(os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()),
        "settings.SUPABASE_URL": bool((settings.SUPABASE_URL or "").strip()),
        "SUPABASE_SERVICE_ROLE_KEY": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()),
        "SUPABASE_SERVICE_KEY": bool(os.getenv("SUPABASE_SERVICE_KEY", "").strip()),
        "settings.SUPABASE_SERVICE_ROLE_KEY": bool(
            (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        ),
    }
    return missing, flags


def _supabase_rest_error_response(context: str) -> Dict[str, Any]:
    missing, flags = supabase_rest_missing_for_logging()
    logger.error(
        "Push %s: Supabase REST not configured. missing_env=%s env_presence=%s",
        context,
        missing,
        flags,
    )
    return {
        "ok": False,
        "error": "Server misconfigured",
        "missing_env": missing,
        "status": 500,
    }


def _webpush_status_code(ex: WebPushException) -> Optional[int]:
    resp = getattr(ex, "response", None)
    if resp is None:
        return None
    return getattr(resp, "status_code", None)


def is_iraq_sending_window(now: Optional[datetime] = None) -> bool:
    dt = now or datetime.now(BAGHDAD)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=BAGHDAD)
    else:
        dt = dt.astimezone(BAGHDAD)
    h = dt.hour
    return 9 <= h <= 21


def baghdad_start_of_day_iso() -> str:
    dt = datetime.now(BAGHDAD)
    d = dt.date()
    return f"{d.isoformat()}T00:00:00+03:00"


def merge_push_prefs(raw: Any) -> Dict[str, Any]:
    defaults = {
        "newListing": True,
        "priceDrop": True,
        "marketTrend": True,
        "watchMakes": [],
        "watchModels": [],
        "priceMin": None,
        "priceMax": None,
        "locale": "en",
    }
    if not isinstance(raw, dict):
        return dict(defaults)
    o = raw
    out = dict(defaults)
    # camelCase (stored prefs) and snake_case (API / legacy) both apply
    if isinstance(o.get("newListing"), bool):
        out["newListing"] = o["newListing"]
    elif isinstance(o.get("new_listing"), bool):
        out["newListing"] = o["new_listing"]
    if isinstance(o.get("priceDrop"), bool):
        out["priceDrop"] = o["priceDrop"]
    elif isinstance(o.get("price_drop"), bool):
        out["priceDrop"] = o["price_drop"]
    if isinstance(o.get("marketTrend"), bool):
        out["marketTrend"] = o["marketTrend"]
    elif isinstance(o.get("market_trend"), bool):
        out["marketTrend"] = o["market_trend"]
    if isinstance(o.get("watchMakes"), list):
        out["watchMakes"] = [x for x in o["watchMakes"] if isinstance(x, str)]
    if isinstance(o.get("watchModels"), list):
        out["watchModels"] = [x for x in o["watchModels"] if isinstance(x, str)]
    if o.get("priceMin") is not None:
        try:
            out["priceMin"] = float(o["priceMin"])
        except (TypeError, ValueError):
            pass
    if o.get("priceMax") is not None:
        try:
            out["priceMax"] = float(o["priceMax"])
        except (TypeError, ValueError):
            pass
    if isinstance(o.get("locale"), str):
        out["locale"] = o["locale"]
    return out


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def subscription_matches_listing(
    seller_user_id: str,
    subscriber_user_id: str,
    prefs: Dict[str, Any],
    listing: Dict[str, Any],
) -> bool:
    if subscriber_user_id == seller_user_id:
        return False
    if prefs.get("newListing") is False:
        return False
    try:
        price = float(listing.get("price") or 0)
    except (TypeError, ValueError):
        price = 0
    pmin = prefs.get("priceMin")
    pmax = prefs.get("priceMax")
    if pmin is not None and price < float(pmin):
        return False
    if pmax is not None and price > float(pmax):
        return False
    makes = prefs.get("watchMakes") or []
    models = prefs.get("watchModels") or []
    if len(makes) == 0 and len(models) == 0:
        return True
    make_ok = len(makes) == 0 or any(_norm(m) == _norm(str(listing.get("make", ""))) for m in makes)
    model_ok = len(models) == 0 or any(_norm(m) == _norm(str(listing.get("model", ""))) for m in models)
    return make_ok and model_ok


def format_usd(n: float) -> str:
    return f"${n:,.0f}"


def new_listing_copy(prefs: Dict[str, Any], listing: Dict[str, Any]) -> Tuple[str, str]:
    loc = (prefs.get("locale") or "en").lower()
    if loc not in ("en", "ar", "ku"):
        loc = "en"
    try:
        price = float(listing.get("price") or 0)
    except (TypeError, ValueError):
        price = 0
    price_s = format_usd(price)
    city = (listing.get("location") or "").strip() or (
        "العراق" if loc == "ar" else "عێراق" if loc == "ku" else "Iraq"
    )
    make = listing.get("make", "")
    model = listing.get("model", "")
    year = listing.get("year", "")
    if loc == "ar":
        return (
            "سيارة جديدة في السوق",
            f"تم إدراج {make} {model} {year} بسعر {price_s} في {city}",
        )
    if loc == "ku":
        return (
            "ئۆتۆمبێلی نوێ لە بازاڕدا",
            f"{make} {model} {year} بە نرخی {price_s} لە {city} لیستکرا",
        )
    return (
        "New car on the market",
        f"New {make} {model} {year} listed for {price_s} in {city}",
    )


def price_drop_copy(prefs: Dict[str, Any], make: str, model: str, new_price: float) -> Tuple[str, str]:
    loc = (prefs.get("locale") or "en").lower()
    if loc not in ("en", "ar", "ku"):
        loc = "en"
    ps = format_usd(new_price)
    if loc == "ar":
        return "انخفاض السعر", f"انخفض سعر {make} {model} الذي عرضته — الآن {ps}"
    if loc == "ku":
        return "نرخ کەمبووەوە", f"نرخی {make} {model} کە بینیت کەمبووەوە — ئێستا {ps}"
    return "Price drop", f"Price dropped on {make} {model} you viewed — now {ps}"


def market_trend_copy(prefs: Dict[str, Any], make: str, count: int, region: str) -> Tuple[str, str]:
    loc = (prefs.get("locale") or "en").lower()
    if loc not in ("en", "ar", "ku"):
        loc = "en"
    if loc == "ar":
        return "ملخص السوق", f"{count} إدراجات جديدة لـ {make} هذا الأسبوع في {region}"
    if loc == "ku":
        return "پوختەی بازاڕ", f"ئەم هەفتەیە {count} لیستی نوێی {make} لە {region}"
    return "Market digest", f"{count} new {make} listings this week in {region}"


def first_image_url(images: Any) -> Optional[str]:
    if not isinstance(images, list) or len(images) == 0:
        return None
    u = images[0]
    return u if isinstance(u, str) else None


def _count_sends_today(client: httpx.Client, subscription_id: str, day_start: str) -> int:
    base = _supabase_url()
    key = _service_key()
    if not base or not key:
        return 999
    url = f"{base}/rest/v1/push_notification_log"
    params = {
        "subscription_id": f"eq.{subscription_id}",
        "sent_at": f"gte.{day_start}",
        "select": "id",
    }
    headers = {**_rest_headers(), "Prefer": "count=exact", "Range": "0-0"}
    r = client.get(url, params=params, headers=headers, timeout=30.0)
    r.raise_for_status()
    cr = r.headers.get("content-range") or ""
    if "/" in cr:
        try:
            return int(cr.split("/")[-1])
        except ValueError:
            return 0
    return 0


def _send_web_push(subscription: Dict[str, str], payload: Dict[str, Any]) -> None:
    priv = _vapid_private()
    if not priv:
        raise RuntimeError("VAPID not configured")
    webpush(
        subscription_info={
            "endpoint": subscription["endpoint"],
            "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
        },
        data=json.dumps(payload),
        vapid_private_key=priv,
        vapid_claims={"sub": _vapid_subject()},
        ttl=86400,
    )


def _delete_subscription(client: httpx.Client, sub_id: str) -> None:
    base = _supabase_url()
    url = f"{base}/rest/v1/push_subscriptions?id=eq.{sub_id}"
    r = client.delete(url, headers=_rest_headers(), timeout=30.0)
    if r.status_code >= 400:
        logger.warning("delete subscription %s: %s %s", sub_id, r.status_code, r.text)


def _insert_log(client: httpx.Client, subscription_id: str, ntype: str, meta: Optional[dict] = None) -> None:
    base = _supabase_url()
    url = f"{base}/rest/v1/push_notification_log"
    body = {"subscription_id": subscription_id, "notification_type": ntype, "meta": meta or {}}
    r = client.post(url, headers=_rest_headers(), json=body, timeout=30.0)
    if r.status_code >= 400:
        logger.warning("insert push log: %s %s", r.status_code, r.text)


def trigger_new_listing(seller_uuid: str, listing_id: str) -> Dict[str, Any]:
    if not vapid_configured():
        return {"ok": False, "error": "VAPID not configured", "status": 503}
    if not supabase_rest_ready():
        return _supabase_rest_error_response("trigger_new_listing")
    base = _supabase_url()

    if not is_iraq_sending_window():
        return {"ok": True, "skipped": "outside_sending_window", "sent": 0}

    origin = _app_origin()
    errors: List[str] = []
    sent = 0

    with httpx.Client() as client:
        r = client.get(
            f"{base}/rest/v1/car_listings",
            params={"id": f"eq.{listing_id}", "select": "id,user_id,make,model,year,price,location,images"},
            headers=_rest_headers(),
            timeout=30.0,
        )
        if r.status_code != 200:
            return {"ok": False, "error": "Listing not found", "status": 404}
        rows = r.json()
        if not rows:
            return {"ok": False, "error": "Listing not found", "status": 404}
        listing = rows[0]
        if str(listing.get("user_id")) != seller_uuid:
            return {"ok": False, "error": "Forbidden", "status": 403}

        brief = {
            "id": listing["id"],
            "make": listing.get("make", ""),
            "model": listing.get("model", ""),
            "year": listing.get("year", ""),
            "price": listing.get("price", 0),
            "location": listing.get("location", ""),
            "imageUrl": first_image_url(listing.get("images")),
        }

        r2 = client.get(
            f"{base}/rest/v1/push_subscriptions",
            params={"select": "id,user_id,endpoint,p256dh,auth,prefs"},
            headers=_rest_headers(),
            timeout=60.0,
        )
        r2.raise_for_status()
        subs = r2.json()
        if not subs:
            return {"ok": True, "sent": 0, "reason": "no_subscribers"}

        day_start = baghdad_start_of_day_iso()
        seller_id = str(listing.get("user_id"))

        for row in subs:
            prefs = merge_push_prefs(row.get("prefs"))
            if not subscription_matches_listing(seller_id, str(row.get("user_id")), prefs, brief):
                continue
            cnt = _count_sends_today(client, row["id"], day_start)
            if cnt >= MAX_PUSH_PER_DAY:
                continue
            title, body_t = new_listing_copy(prefs, brief)
            loc = (prefs.get("locale") or "en").lower()
            if loc not in ("en", "ar", "ku"):
                loc = "en"
            url = f"{origin}/{loc}/buy-sell?id={quote(str(brief['id']), safe='')}"
            payload = {
                "title": title,
                "body": body_t,
                "icon": f"{origin}/icons/icon-192x192.png",
                "badge": f"{origin}/icons/icon-192x192.png",
                "image": brief.get("imageUrl"),
                "data": {"url": url, "type": "new_listing", "tag": f"listing-{brief['id']}"},
            }
            try:
                _send_web_push(
                    {"endpoint": row["endpoint"], "p256dh": row["p256dh"], "auth": row["auth"]},
                    payload,
                )
                _insert_log(client, row["id"], "new_listing", {"listing_id": str(brief["id"])})
                sent += 1
            except WebPushException as ex:
                code = _webpush_status_code(ex)
                if code in (404, 410):
                    _delete_subscription(client, row["id"])
                else:
                    errors.append(str(ex))
            except Exception as ex:
                errors.append(str(ex))

    out: Dict[str, Any] = {"ok": True, "sent": sent}
    if errors:
        out["errors"] = errors
    return out


def _safe_int(v: Any) -> Optional[int]:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def admin_send(body: Dict[str, Any], cron_secret: str) -> Dict[str, Any]:
    expected = os.getenv("NOTIFICATIONS_CRON_SECRET") or ""
    if not expected or cron_secret != expected:
        return {"ok": False, "error": "Unauthorized", "status": 401}
    if not vapid_configured():
        return {"ok": False, "error": "VAPID not configured", "status": 503}
    if not supabase_rest_ready():
        return _supabase_rest_error_response("admin_send")
    base = _supabase_url()

    if not is_iraq_sending_window():
        logger.info(
            "admin_send: skipped (outside Iraq sending window 09:00–21:00 Asia/Baghdad)"
        )
        return {"ok": True, "skipped": "outside_sending_window", "sent": 0, "found": 0}

    ntype = body.get("type")
    if ntype not in ("price_drop", "market_trend"):
        return {"ok": False, "error": "Invalid type", "status": 400}

    # Required fields for each type (avoid silent sent:0 when body is incomplete)
    if ntype == "price_drop":
        if body.get("newPrice") is None:
            return {
                "ok": False,
                "error": "newPrice is required for price_drop",
                "status": 400,
            }
        try:
            float(body.get("newPrice"))
        except (TypeError, ValueError):
            return {"ok": False, "error": "newPrice must be a number", "status": 400}
    else:
        if body.get("make") is None or body.get("count") is None or body.get("region") is None:
            return {
                "ok": False,
                "error": "make, count, and region are required for market_trend",
                "status": 400,
            }
        if _safe_int(body.get("count")) is None:
            return {"ok": False, "error": "count must be an integer", "status": 400}

    origin = _app_origin()
    user_filter = body.get("userId")
    params: Dict[str, Any] = {"select": "id,user_id,endpoint,p256dh,auth,prefs"}
    if user_filter:
        params["user_id"] = f"eq.{user_filter}"

    sent = 0
    skipped_daily_cap = 0
    skipped_webpush = 0
    deleted_expired = 0
    day_start = baghdad_start_of_day_iso()

    with httpx.Client() as client:
        r = client.get(f"{base}/rest/v1/push_subscriptions", params=params, headers=_rest_headers(), timeout=60.0)
        r.raise_for_status()
        subs = r.json()
        found = len(subs)
        if not subs:
            logger.info("admin_send: found 0 subscriptions, sent 0")
            return {"ok": True, "sent": 0, "found": 0}

        for row in subs:
            prefs = merge_push_prefs(row.get("prefs"))
            loc = (prefs.get("locale") or "en").lower()
            if loc not in ("en", "ar", "ku"):
                loc = "en"
            icon_url = f"{origin}/icons/icon-192x192.png"
            if ntype == "price_drop":
                listing = body.get("listing") or {}
                make = listing.get("make", "")
                model = listing.get("model", "")
                new_price_f = float(body.get("newPrice"))
                t, b = price_drop_copy(prefs, make, model, new_price_f)
                lid = body.get("listingId")
                if lid:
                    url = f"{origin}/{loc}/buy-sell?id={quote(str(lid), safe='')}"
                else:
                    url = f"{origin}/{loc}/buy-sell"
                payload = {
                    "title": t,
                    "body": b,
                    "icon": icon_url,
                    "badge": icon_url,
                    "data": {
                        "url": url,
                        "type": "price_drop",
                        "tag": f"listing-{lid}" if lid else "price_drop",
                    },
                }
                if body.get("imageUrl") is not None:
                    payload["image"] = body.get("imageUrl")
            else:
                mt_make = str(body.get("make"))
                mt_count = _safe_int(body.get("count"))
                mt_region = str(body.get("region"))
                t, b = market_trend_copy(prefs, mt_make, int(mt_count), mt_region)
                payload = {
                    "title": t,
                    "body": b,
                    "icon": icon_url,
                    "badge": icon_url,
                    "data": {
                        "url": f"{origin}/{loc}/buy-sell",
                        "type": "market_trend",
                        "tag": "market-trend",
                    },
                }

            cnt = _count_sends_today(client, row["id"], day_start)
            if cnt >= MAX_PUSH_PER_DAY:
                skipped_daily_cap += 1
                logger.debug(
                    "admin_send skip subscription_id=%s: daily_cap (%s/%s per day)",
                    row["id"],
                    cnt,
                    MAX_PUSH_PER_DAY,
                )
                continue

            try:
                _send_web_push(
                    {"endpoint": row["endpoint"], "p256dh": row["p256dh"], "auth": row["auth"]},
                    payload,
                )
                _insert_log(client, row["id"], ntype, {})
                sent += 1
            except WebPushException as ex:
                skipped_webpush += 1
                code = _webpush_status_code(ex)
                logger.warning(
                    "admin_send WebPushException subscription_id=%s status=%s: %s",
                    row["id"],
                    code,
                    ex,
                )
                if code in (404, 410):
                    _delete_subscription(client, row["id"])
                    deleted_expired += 1
            except Exception as ex:
                skipped_webpush += 1
                logger.warning(
                    "admin_send failed subscription_id=%s: %s",
                    row["id"],
                    ex,
                    exc_info=True,
                )

    skipped_total = skipped_daily_cap + skipped_webpush
    logger.info(
        "admin_send type=%s: found %s subscriptions, skipped %s (daily_cap=%s webpush_error=%s expired_removed=%s), sent %s",
        ntype,
        found,
        skipped_total,
        skipped_daily_cap,
        skipped_webpush,
        deleted_expired,
        sent,
    )
    out: Dict[str, Any] = {
        "ok": True,
        "sent": sent,
        "found": found,
        "skipped": skipped_total,
        "skipped_breakdown": {
            "daily_cap": skipped_daily_cap,
            "webpush_error": skipped_webpush,
            "subscriptions_deleted_expired": deleted_expired,
        },
    }
    return out
