"""
Chat API: CarWiseIQ AI assistant powered by Claude.
POST /api/chat: { messages, locale } -> { response, ... }
Includes Supabase-backed rate limits, profanity handling, and IP bans.
"""

import json
import logging
import os
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.routes.auth import UserResponse, get_current_user
from app.services.chat_profanity import profanity_match_details
from app.services.chat_locale import (
    chat_ip_ban_message,
    chat_rate_limit_message,
    chat_warning_message,
)
from app.services.chat_security_service import (
    chat_security_ready,
    client_ip_from_request,
    get_active_ban_ends_at,
    get_profanity_strikes,
    insert_ip_ban,
    rate_limit_identity_key,
    set_profanity_strikes,
    try_consume_chat_quota,
)

logger = logging.getLogger(__name__)

router = APIRouter()

SYSTEM_PROMPT = """You are the official AI assistant for CarWiseIQ. You help users with car valuations, marketplace questions, and general car buying/selling advice for Iraq and Kurdistan.

## ABOUT CARWISEIQ
- AI-powered car valuation and marketplace platform for Iraq & Kurdistan
- Founded by Dyar Abdulla, AI & Data Science student from Sulaymaniyah, Kurdistan
- Tagline: "The Smartest Way to Value Cars in Iraq & Kurdistan"
- Website: carwiseiq.com
- 100% FREE platform - no fees, no commissions

## FEATURES

### 1. PRICE PREDICTION (FREE, no login)
- AI estimates car value using Machine Learning (Random Forest, XGBoost, LightGBM)
- Enter: make, model, year, mileage, engine size, condition, fuel type, location
- Get: predicted price (USD), confidence interval, deal rating, market comparison
- Can export/share results

### 2. BUY & SELL MARKETPLACE
- Browse FREE (no login), Sell requires login
- Search by make, model; filter by price, year, mileage, location
- Contact sellers via phone, WhatsApp, or messaging
- To sell: Login → Upload 4-10 photos → Enter details → Publish (FREE, unlimited listings)

### 3. COMPARE CARS (FREE, no login)
- Compare up to 4 cars side-by-side
- See predicted prices, specs, value analysis
- Export comparison as PDF

### 4. BATCH PREDICTION (FREE, no login)
- Upload CSV or paste URLs to predict many cars at once
- Export results as CSV

### 5. FAVORITES & HISTORY (requires login)
- Save favorite listings
- Track prediction history and activity

### 6. SERVICES DIRECTORY (FREE)
- Find automotive services: oil change, towing, tires, batteries
- Filter by category and city

## WHAT REQUIRES LOGIN
- Selling a car (creating listings)
- Favorites (saving listings)
- History (viewing past activity)
- Messaging sellers/buyers
- Profile settings

## WHAT'S FREE WITHOUT LOGIN
- All predictions (single and batch)
- Browsing marketplace
- Comparing cars (up to 4)
- Services directory
- No fees or commissions ever

## SUPPORTED LOCATIONS
Iraq & Kurdistan cities: Erbil, Baghdad, Sulaymaniyah, Basra, Mosul, Kirkuk, Duhok, Najaf, Karbala, Nasiriyah, Ramadi, Fallujah, Amarah, and more.

## LIMITS
- Compare: Max 4 cars
- Listings: 4-10 photos (max 5MB), videos (max 50MB)
- Accounts: Max 3 per IP

## WHAT CARWISEIQ DOES NOT DO
- Process payments or handle money
- Take possession of vehicles or arrange delivery
- Mediate disputes (users resolve directly or legally)
- Guarantee AI prices (estimates only)
- Inspect vehicles or provide warranties

## CONTACT
- Phone: 0777 447 2106
- Email: carwise15@gmail.com

## YOUR BEHAVIOR RULES
1. **Language**: Respond in the same language as the user (Kurdish Sorani, Arabic, or English).
2. **Tone**: Be natural, friendly, and conversational - like talking to a friend. NOT formal or robotic.
3. **Length**: Keep responses SHORT - 1-3 sentences. Do NOT list everything at once. Ask what they need first.
4. **Kurdish**: Use natural Kurdish Sorani, friendly tone. Example: "سلاو! چۆن دەتوانم یارمەتیت بدەم؟" - NOT Google Translate style.
5. **NO MARKDOWN**: Never use ** or * or __ in your responses. Write plain text only.
6. For CarWiseIQ questions, use ONLY the information above. Never invent features.
7. If user asks something vague, ask a follow-up: "What would you like to know? Car value, selling, or buying?"
8. Recommend features briefly: value → Predict page, sell → Sell button, buy → marketplace, compare → Compare.
9. If unsure: suggest support (0777 447 2106 or carwise15@gmail.com).
"""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    locale: str = "en"
    stream: bool = True


def _last_user_text(messages: List[ChatMessage]) -> Optional[str]:
    for m in reversed(messages):
        if m.role == "user" and (m.content or "").strip():
            return m.content.strip()
    return None


def _sse_event(obj: dict) -> bytes:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")


async def _stream_claude(
    api_key: str, messages: List[ChatMessage]
) -> AsyncIterator[bytes]:
    """SSE stream: data: {\"type\":\"text\",\"value\":...}\\n\\n, then data: {\"type\":\"done\"}\\n\\n."""
    from anthropic import AsyncAnthropic

    import anthropic as anthropic_lib

    client = AsyncAnthropic(api_key=api_key)
    try:
        async with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            system=SYSTEM_PROMPT,
            messages=[{"role": m.role, "content": m.content} for m in messages],
        ) as stream:
            async for text in stream.text_stream:
                if text:
                    yield _sse_event({"type": "text", "value": text})
        yield _sse_event({"type": "done"})
    except anthropic_lib.APIConnectionError:
        yield _sse_event({"type": "error", "message": "AI service temporarily unavailable"})
    except anthropic_lib.RateLimitError:
        yield _sse_event({"type": "error", "message": "Too many requests, please wait"})
    except anthropic_lib.APIStatusError as e:
        yield _sse_event({"type": "error", "message": f"AI service error: {str(e)}"})
    except Exception as e:
        logger.error("Chat stream error: %s", e, exc_info=True)
        yield _sse_event({"type": "error", "message": "Chat service error"})


@router.get("/chat/ban-status")
async def chat_ban_status(request: Request) -> Dict[str, Any]:
    """IP ban check for static frontends (Cloudflare Pages). Same logic as GET /api/security/ip-ban-status."""
    from app.api.routes.security import ip_ban_status

    return await ip_ban_status(request)


@router.post("/chat")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user),
) -> Any:
    """Handle chat messages via Anthropic Claude API with moderation and quotas."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not set")
        raise HTTPException(status_code=500, detail="Chat service not configured")

    fwd = request.headers.get("x-forwarded-for")
    ip = client_ip_from_request(
        request.client.host if request.client else None,
        fwd,
    )

    ui_locale = chat_request.locale or "en"

    if chat_security_ready():
        ban_end = await get_active_ban_ends_at(ip)
        if ban_end:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "ip_banned",
                    "ends_at": ban_end.isoformat().replace("+00:00", "Z"),
                    "message": chat_ip_ban_message(ui_locale, ban_end),
                },
            )

    supabase_uid = getattr(current_user, "supabase_user_id", None) if current_user else None
    legacy_id = current_user.id if current_user else None
    identity = rate_limit_identity_key(ip, supabase_uid, legacy_id)

    last_user = _last_user_text(chat_request.messages)
    if not last_user:
        raise HTTPException(status_code=400, detail="No user message provided")

    # Rate limit (10 msg / 5h) before profanity handling so quota matches "messages sent".
    if chat_security_ready():
        allowed, reset_at, remaining_phrase = await try_consume_chat_quota(identity, ui_locale)
        if not allowed and reset_at is not None:
            phrase = remaining_phrase or ""
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "chat_limit",
                    "reset_at": reset_at.isoformat().replace("+00:00", "Z"),
                    "message": chat_rate_limit_message(ui_locale, phrase),
                },
            )

    profane, _lang = profanity_match_details(last_user)
    if profane and chat_security_ready():
        strikes = await get_profanity_strikes(ip)
        logger.info(
            "chat profanity ip=%s strikes=%s (ai_chat_profanity_strikes.strike_count)",
            ip[:24] + ("…" if len(ip) > 24 else ""),
            strikes,
        )
        # 1st → warning, 2nd → warning, 3rd+ → 2h ban in user_bans.
        if strikes == 0:
            await set_profanity_strikes(ip, 1)
            return {"response": chat_warning_message(ui_locale), "profanity_warning": True}
        if strikes == 1:
            await set_profanity_strikes(ip, 2)
            return {"response": chat_warning_message(ui_locale), "profanity_warning": True}

        ban_until = await insert_ip_ban(ip, "inappropriate language")
        await set_profanity_strikes(ip, strikes + 1)
        ban_msg = chat_ip_ban_message(ui_locale, ban_until)
        return {
            "response": ban_msg,
            "banned": True,
            "ban_ends_at": ban_until.isoformat().replace("+00:00", "Z"),
        }

    try:
        import anthropic
    except ImportError:
        logger.error("anthropic package not installed")
        raise HTTPException(status_code=500, detail="Chat service not available")

    stream_headers = {
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
        "Content-Type": "text/event-stream",
    }
    return StreamingResponse(
        _stream_claude(api_key, chat_request.messages),
        headers=stream_headers,
    )
