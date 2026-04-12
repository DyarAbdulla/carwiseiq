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
    return (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or settings.SUPABASE_URL or "").rstrip("/")


def _service_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""


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
    if isinstance(o.get("newListing"), bool):
        out["newListing"] = o["newListing"]
    if isinstance(o.get("priceDrop"), bool):
        out["priceDrop"] = o["priceDrop"]
    if isinstance(o.get("marketTrend"), bool):
        out["marketTrend"] = o["marketTrend"]
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
    base = _supabase_url()
    key = _service_key()
    if not base or not key:
        return {"ok": False, "error": "Server misconfigured", "status": 500}

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


def admin_send(body: Dict[str, Any], cron_secret: str) -> Dict[str, Any]:
    expected = os.getenv("NOTIFICATIONS_CRON_SECRET") or ""
    if not expected or cron_secret != expected:
        return {"ok": False, "error": "Unauthorized", "status": 401}
    if not vapid_configured():
        return {"ok": False, "error": "VAPID not configured", "status": 503}
    base = _supabase_url()
    key = _service_key()
    if not base or not key:
        return {"ok": False, "error": "Server misconfigured", "status": 500}

    if not is_iraq_sending_window():
        return {"ok": True, "skipped": "outside_sending_window", "sent": 0}

    ntype = body.get("type")
    if ntype not in ("price_drop", "market_trend"):
        return {"ok": False, "error": "Invalid type", "status": 400}

    origin = _app_origin()
    user_filter = body.get("userId")
    params: Dict[str, Any] = {"select": "id,user_id,endpoint,p256dh,auth,prefs"}
    if user_filter:
        params["user_id"] = f"eq.{user_filter}"

    sent = 0
    day_start = baghdad_start_of_day_iso()

    with httpx.Client() as client:
        r = client.get(f"{base}/rest/v1/push_subscriptions", params=params, headers=_rest_headers(), timeout=60.0)
        r.raise_for_status()
        subs = r.json()
        if not subs:
            return {"ok": True, "sent": 0}

        for row in subs:
            prefs = merge_push_prefs(row.get("prefs"))
            payload: Optional[Dict[str, Any]] = None

            if ntype == "price_drop":
                if prefs.get("priceDrop") is False:
                    continue
                listing = body.get("listing") or {}
                make = listing.get("make", "")
                model = listing.get("model", "")
                new_price = body.get("newPrice")
                if new_price is None:
                    continue
                try:
                    new_price_f = float(new_price)
                except (TypeError, ValueError):
                    continue
                title, body_t = price_drop_copy(prefs, make, model, new_price_f)
                loc = (prefs.get("locale") or "en").lower()
                if loc not in ("en", "ar", "ku"):
                    loc = "en"
                lid = body.get("listingId")
                if lid:
                    url = f"{origin}/{loc}/buy-sell?id={quote(str(lid), safe='')}"
                else:
                    url = f"{origin}/{loc}/buy-sell"
                payload = {
                    "title": title,
                    "body": body_t,
                    "icon": f"{origin}/icons/icon-192x192.png",
                    "badge": f"{origin}/icons/icon-192x192.png",
                    "image": body.get("imageUrl"),
                    "data": {
                        "url": url,
                        "type": "price_drop",
                        "tag": f"listing-{lid}" if lid else "price_drop",
                    },
                }
            else:
                if prefs.get("marketTrend") is False:
                    continue
                make = body.get("make")
                count = body.get("count")
                region = body.get("region")
                if make is None or count is None or region is None:
                    continue
                title, body_t = market_trend_copy(prefs, str(make), int(count), str(region))
                loc = (prefs.get("locale") or "en").lower()
                if loc not in ("en", "ar", "ku"):
                    loc = "en"
                payload = {
                    "title": title,
                    "body": body_t,
                    "icon": f"{origin}/icons/icon-192x192.png",
                    "badge": f"{origin}/icons/icon-192x192.png",
                    "data": {
                        "url": f"{origin}/{loc}/buy-sell",
                        "type": "market_trend",
                        "tag": "market-trend",
                    },
                }

            if not payload:
                continue

            cnt = _count_sends_today(client, row["id"], day_start)
            if cnt >= MAX_PUSH_PER_DAY:
                continue

            try:
                _send_web_push(
                    {"endpoint": row["endpoint"], "p256dh": row["p256dh"], "auth": row["auth"]},
                    payload,
                )
                _insert_log(client, row["id"], ntype, {})
                sent += 1
            except WebPushException as ex:
                code = _webpush_status_code(ex)
                if code in (404, 410):
                    _delete_subscription(client, row["id"])
            except Exception:
                pass

    return {"ok": True, "sent": sent}
