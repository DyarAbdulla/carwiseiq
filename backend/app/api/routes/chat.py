"""
Chat API: CarWiseIQ AI assistant powered by Claude.
POST /api/chat: { messages, locale } -> { response, ... }
Includes Supabase-backed rate limits, profanity handling, and IP bans.
"""

import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
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


def _last_user_text(messages: List[ChatMessage]) -> Optional[str]:
    for m in reversed(messages):
        if m.role == "user" and (m.content or "").strip():
            return m.content.strip()
    return None


def _fallback_roast(lang: str) -> str:
    if lang == "ar":
        return (
            "تم تحذيرك من قبل وعدت بذلك. أسلوبك وقح وغير مقبول — تعلم الاحترام قبل أن تعود."
        )
    if lang == "ku":
        return (
            "پێشتر ئاگادارت کردمەوە. قسەکردنت ناشایستەیە — ڕێزگرتن فێربە پێش ئەوەی دووبارە بگەڕێیتەوە."
        )
    return (
        "You were already warned. You still can't behave — learn some respect before you come back."
    )


def _claude_roast_line(api_key: str, lang: str, user_snippet: str) -> str:
    """One short insult/roast in the user's language; falls back to _fallback_roast on any error."""
    try:
        from anthropic import Anthropic

        lang_name = {"ar": "Arabic", "ku": "Kurdish Sorani", "en": "English"}.get(lang, "English")
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=120,
            system=(
                f"Reply in {lang_name} only. The user was already warned once for profanity in chat "
                "and swore again. Respond with exactly one or two short sentences: a sarcastic roast. "
                "Plain text, no markdown, no emojis."
            ),
            messages=[
                {
                    "role": "user",
                    "content": (user_snippet or "")[:500],
                }
            ],
        )
        text_content = next(
            (b for b in response.content if getattr(b, "type", None) == "text"),
            None,
        )
        text = (getattr(text_content, "text", None) or "").strip()
        if text:
            return text
    except Exception as e:
        logger.warning("claude roast fallback: %s", e)
    return _fallback_roast(lang)


async def _claude_chat(api_key: str, messages: List[ChatMessage]) -> str:
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": m.role, "content": m.content} for m in messages],
    )
    text_content = next(
        (b for b in response.content if getattr(b, "type", None) == "text"),
        None,
    )
    return (
        getattr(text_content, "text", None)
        if text_content
        else "Sorry, I could not generate a response."
    )


@router.post("/chat")
async def chat(
    request: Request,
    chat_request: ChatRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user),
) -> Dict[str, Any]:
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
                    "message": chat_ip_ban_message(ui_locale),
                },
            )

    supabase_uid = getattr(current_user, "supabase_user_id", None) if current_user else None
    legacy_id = current_user.id if current_user else None
    identity = rate_limit_identity_key(ip, supabase_uid, legacy_id)

    last_user = _last_user_text(chat_request.messages)
    if not last_user:
        raise HTTPException(status_code=400, detail="No user message provided")

    profane, lang = profanity_match_details(last_user)
    if profane and chat_security_ready():
        strikes = await get_profanity_strikes(ip)
        logger.info(
            "chat profanity ip=%s strikes=%s (ai_chat_profanity_strikes.strike_count)",
            ip[:24] + ("…" if len(ip) > 24 else ""),
            strikes,
        )
        # First profane message: strike_count 0 -> 1 (warning only). Second+: ban + 5h IP block.
        if strikes == 0:
            await set_profanity_strikes(ip, 1)
            return {"response": chat_warning_message(ui_locale), "profanity_warning": True}

        roast_text = _claude_roast_line(api_key, lang, last_user)
        ban_until = await insert_ip_ban(ip, "Repeated profanity in AI chat after warning")
        await set_profanity_strikes(ip, strikes + 1)
        return {
            "response": roast_text,
            "banned": True,
            "ban_ends_at": ban_until.isoformat().replace("+00:00", "Z"),
        }

    if chat_security_ready():
        allowed, reset_at, remaining_phrase = await try_consume_chat_quota(identity, ui_locale)
        if not allowed and reset_at and remaining_phrase:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "chat_limit",
                    "reset_at": reset_at.isoformat().replace("+00:00", "Z"),
                    "message": chat_rate_limit_message(ui_locale, remaining_phrase),
                },
            )

    try:
        import anthropic
    except ImportError:
        logger.error("anthropic package not installed")
        raise HTTPException(status_code=500, detail="Chat service not available")

    try:
        response_text = await _claude_chat(api_key, chat_request.messages)
        return {"response": response_text}
    except anthropic.APIConnectionError:
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable",
        )
    except anthropic.RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Too many requests, please wait",
        )
    except anthropic.APIStatusError as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI service error: {str(e)}",
        )
    except Exception as e:
        logger.error("Chat API error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Chat service error",
        )
