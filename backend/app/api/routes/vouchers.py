"""Apply and inspect voucher codes (Supabase user_vouchers + redeem_voucher_code RPC)."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.routes.auth import UserResponse, get_current_user
from app.services.chat_security_service import _headers
from app.services.push_notifications import _supabase_url, supabase_rest_ready
from app.services.usage_limits_service import merge_benefits_from_rows

logger = logging.getLogger(__name__)

router = APIRouter()


class VoucherApplyBody(BaseModel):
    code: str = Field(..., min_length=1, max_length=80)


def _parse_rpc_result(data: Any) -> Dict[str, Any]:
    """PostgREST rpc may return [{ "redeem_voucher_code": <object or string> }]."""
    raw: Any = None
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            raw = first.get("redeem_voucher_code", first)
    elif isinstance(data, dict):
        raw = data.get("redeem_voucher_code", data)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return raw if isinstance(raw, dict) else {}


@router.post("/vouchers/apply")
async def apply_voucher(
    body: VoucherApplyBody,
    current_user: Optional[UserResponse] = Depends(get_current_user),
):
    if not current_user or not current_user.supabase_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not supabase_rest_ready():
        raise HTTPException(status_code=503, detail="Voucher service unavailable")

    uid = str(current_user.supabase_user_id).strip()
    base = _supabase_url()
    url = f"{base}/rest/v1/rpc/redeem_voucher_code"
    payload = {"p_user_id": uid, "p_code": body.code.strip()}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, headers=_headers(), json=payload)
    except Exception as e:
        logger.error("redeem_voucher_code request failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not reach database") from e

    if r.status_code != 200:
        logger.warning("redeem_voucher_code HTTP %s: %s", r.status_code, r.text[:400])
        raise HTTPException(status_code=502, detail="Voucher service error")

    try:
        data = r.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Invalid voucher response")

    raw = _parse_rpc_result(data)
    if not raw.get("ok"):
        err = str(raw.get("error") or "invalid")
        if err == "invalid":
            raise HTTPException(
                status_code=400,
                detail="Invalid voucher code. Please check and try again.",
            )
        if err == "already_redeemed":
            raise HTTPException(
                status_code=400,
                detail="You have already redeemed this voucher.",
            )
        if err == "exhausted":
            raise HTTPException(
                status_code=400,
                detail="This voucher has reached its redemption limit.",
            )
        if err == "expired":
            raise HTTPException(status_code=400, detail="This voucher has expired.")
        if err == "inactive":
            raise HTTPException(
                status_code=400,
                detail="This voucher is no longer active.",
            )
        raise HTTPException(status_code=400, detail="Could not apply voucher.")

    return {"ok": True, "benefits": raw.get("benefits")}


@router.get("/vouchers/me")
async def vouchers_me(current_user: Optional[UserResponse] = Depends(get_current_user)):
    if not current_user or not current_user.supabase_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not supabase_rest_ready():
        return {
            "redemptions": [],
            "merged_benefits": {
                "unlimited_predictions": False,
                "daily_comparisons": 2,
            },
        }

    uid = quote(str(current_user.supabase_user_id).strip(), safe="")
    base = _supabase_url()
    url = (
        f"{base}/rest/v1/user_vouchers"
        f"?user_id=eq.{uid}"
        f"&select=redeemed_at,benefits_granted,voucher_codes(code)"
        f"&order=redeemed_at.desc"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=_headers())
    except Exception as e:
        logger.error("user_vouchers list failed: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="Could not load vouchers") from e

    if r.status_code != 200:
        logger.warning("user_vouchers HTTP %s: %s", r.status_code, r.text[:300])
        raise HTTPException(status_code=502, detail="Could not load vouchers")

    rows: List[Dict[str, Any]] = r.json() if isinstance(r.json(), list) else []
    unlimited, daily_cmp = merge_benefits_from_rows(rows)

    redemptions: List[Dict[str, Any]] = []
    for row in rows:
        vc = row.get("voucher_codes")
        code_val: Optional[str] = None
        if isinstance(vc, dict):
            code_val = vc.get("code")
        redemptions.append(
            {
                "code": code_val,
                "redeemed_at": row.get("redeemed_at"),
                "benefits": row.get("benefits_granted"),
            }
        )

    return {
        "redemptions": redemptions,
        "merged_benefits": {
            "unlimited_predictions": unlimited,
            "daily_comparisons": daily_cmp,
        },
    }
