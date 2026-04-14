"""
Daily limits for /api/predict (predict page) and compare-batch (Predict All).
Stored in Supabase daily_feature_usage; account perks from user_vouchers (benefits_granted).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import httpx

from app.services.chat_security_service import _headers
from app.services.push_notifications import _supabase_url, supabase_rest_ready
from app.services.usage_limits_locale import (
    localized_compare_limit_message,
    localized_predict_limit_message,
)

logger = logging.getLogger(__name__)

PREDICT_DAILY_LIMIT = 5
COMPARE_DAILY_LIMIT = 2
DISPLAY_UNLIMITED_PREDICT = 999_999


def usage_limits_ready() -> bool:
    return supabase_rest_ready()


def merge_benefits_from_rows(rows: List[Dict[str, Any]]) -> Tuple[bool, int]:
    """From user_vouchers.benefits_granted JSON objects: (unlimited_predictions, compare_daily_cap)."""
    unlimited = False
    compare_lim = COMPARE_DAILY_LIMIT
    for row in rows:
        b = row.get("benefits_granted")
        if b is None:
            continue
        if isinstance(b, str):
            import json

            try:
                b = json.loads(b)
            except Exception:
                continue
        if not isinstance(b, dict):
            continue
        if b.get("unlimited_predictions") is True:
            unlimited = True
        dc = b.get("daily_comparisons")
        if isinstance(dc, bool):
            continue
        if isinstance(dc, (int, float)):
            compare_lim = max(compare_lim, int(dc))
        elif isinstance(dc, str):
            try:
                compare_lim = max(compare_lim, int(float(dc)))
            except ValueError:
                pass
    return unlimited, compare_lim


async def _fetch_user_benefit_rows(supabase_user_id: str) -> List[Dict[str, Any]]:
    if not usage_limits_ready() or not supabase_user_id:
        return []
    base = _supabase_url()
    url = (
        f"{base}/rest/v1/user_vouchers"
        f"?user_id=eq.{quote(str(supabase_user_id).strip(), safe='')}"
        f"&select=benefits_granted"
    )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, headers=_headers())
        if r.status_code != 200:
            logger.warning("user_vouchers read failed: %s", r.status_code)
            return []
        data = r.json()
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.error("user_vouchers fetch error: %s", e, exc_info=True)
        return []


async def fetch_merged_benefits(supabase_user_id: Optional[str]) -> Tuple[bool, int]:
    if not supabase_user_id:
        return False, COMPARE_DAILY_LIMIT
    rows = await _fetch_user_benefit_rows(str(supabase_user_id))
    return merge_benefits_from_rows(rows)


async def _fetch_row(identity_key: str, usage_date: str) -> Dict[str, int]:
    if not usage_limits_ready():
        return {"predict_count": 0, "compare_count": 0}
    base = _supabase_url()
    url = (
        f"{base}/rest/v1/daily_feature_usage"
        f"?identity_key=eq.{quote(identity_key, safe='')}"
        f"&usage_date=eq.{usage_date}"
        f"&select=predict_count,compare_count"
    )
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(url, headers=_headers())
        if r.status_code != 200:
            logger.warning("daily_feature_usage read failed: %s", r.status_code)
            return {"predict_count": 0, "compare_count": 0}
        rows = r.json()
        if not rows:
            return {"predict_count": 0, "compare_count": 0}
        return {
            "predict_count": int(rows[0].get("predict_count") or 0),
            "compare_count": int(rows[0].get("compare_count") or 0),
        }
    except Exception as e:
        logger.error("usage fetch error: %s", e, exc_info=True)
        return {"predict_count": 0, "compare_count": 0}


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


async def _upsert_counts(
    identity_key: str,
    usage_date: str,
    predict_count: int,
    compare_count: int,
) -> None:
    if not usage_limits_ready():
        return
    base = _supabase_url()
    body = {
        "identity_key": identity_key,
        "usage_date": usage_date,
        "predict_count": predict_count,
        "compare_count": compare_count,
        "updated_at": _iso_now(),
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.post(
                f"{base}/rest/v1/daily_feature_usage",
                headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
                params={"on_conflict": "identity_key,usage_date"},
                json=body,
            )
        if r.status_code not in (200, 201, 204):
            logger.error("daily_feature_usage upsert failed: %s %s", r.status_code, r.text[:300])
    except Exception as e:
        logger.error("usage upsert error: %s", e, exc_info=True)


async def get_daily_status(
    identity_key: str,
    usage_date: str,
    supabase_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    unlimited_predictions, compare_cap = await fetch_merged_benefits(supabase_user_id)
    if not usage_limits_ready():
        return {
            "unlimited_predictions": unlimited_predictions,
            "unlimited": unlimited_predictions,
            "usage_date": usage_date,
            "predict_used": 0,
            "predict_limit": DISPLAY_UNLIMITED_PREDICT if unlimited_predictions else PREDICT_DAILY_LIMIT,
            "predict_remaining": DISPLAY_UNLIMITED_PREDICT if unlimited_predictions else PREDICT_DAILY_LIMIT,
            "compare_used": 0,
            "compare_limit": compare_cap,
            "compare_remaining": compare_cap,
        }

    row = await _fetch_row(identity_key, usage_date)
    pu, cu = row["predict_count"], row["compare_count"]

    if unlimited_predictions:
        pred_limit = DISPLAY_UNLIMITED_PREDICT
        pred_rem = DISPLAY_UNLIMITED_PREDICT
    else:
        pred_limit = PREDICT_DAILY_LIMIT
        pred_rem = max(0, PREDICT_DAILY_LIMIT - pu)

    cmp_rem = max(0, compare_cap - cu)

    return {
        "unlimited_predictions": unlimited_predictions,
        "unlimited": unlimited_predictions,
        "usage_date": usage_date,
        "predict_used": pu,
        "predict_limit": pred_limit,
        "predict_remaining": pred_rem,
        "compare_used": cu,
        "compare_limit": compare_cap,
        "compare_remaining": cmp_rem,
    }


async def ensure_predict_room(
    identity_key: str,
    usage_date: str,
    need: int = 1,
    supabase_user_id: Optional[str] = None,
    ui_locale: str = "en",
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Returns (ok, error_detail) if not enough predict slots."""
    unlimited_predictions, _ = await fetch_merged_benefits(supabase_user_id)
    if unlimited_predictions:
        return True, None
    if not usage_limits_ready():
        return True, None
    row = await _fetch_row(identity_key, usage_date)
    if row["predict_count"] + need > PREDICT_DAILY_LIMIT:
        st = await get_daily_status(identity_key, usage_date, supabase_user_id)
        return False, {
            "code": "predict_limit",
            "message": localized_predict_limit_message(ui_locale, PREDICT_DAILY_LIMIT),
            **{k: st[k] for k in st if k not in ("unlimited",)},
        }
    return True, None


async def increment_predict(
    identity_key: str,
    usage_date: str,
    delta: int = 1,
    supabase_user_id: Optional[str] = None,
) -> None:
    unlimited_predictions, _ = await fetch_merged_benefits(supabase_user_id)
    if unlimited_predictions:
        return
    if not usage_limits_ready() or delta <= 0:
        return
    row = await _fetch_row(identity_key, usage_date)
    await _upsert_counts(
        identity_key,
        usage_date,
        row["predict_count"] + delta,
        row["compare_count"],
    )


async def ensure_compare_room(
    identity_key: str,
    usage_date: str,
    supabase_user_id: Optional[str] = None,
    ui_locale: str = "en",
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    _, compare_cap = await fetch_merged_benefits(supabase_user_id)
    if not usage_limits_ready():
        return True, None
    row = await _fetch_row(identity_key, usage_date)
    if row["compare_count"] >= compare_cap:
        st = await get_daily_status(identity_key, usage_date, supabase_user_id)
        return False, {
            "code": "compare_limit",
            "message": localized_compare_limit_message(ui_locale, compare_cap),
            **{k: st[k] for k in st if k not in ("unlimited",)},
        }
    return True, None


async def increment_compare(
    identity_key: str,
    usage_date: str,
    delta: int = 1,
) -> None:
    if not usage_limits_ready() or delta <= 0:
        return
    row = await _fetch_row(identity_key, usage_date)
    await _upsert_counts(
        identity_key,
        usage_date,
        row["predict_count"],
        row["compare_count"] + delta,
    )
