"""Localized user-facing strings for AI chat security (quota, profanity, bans)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def normalize_chat_locale(locale: str | None) -> str:
    if not locale:
        return "en"
    loc = str(locale).lower().strip().split("-")[0]
    if loc in ("ar", "ku", "ckb"):
        return "ar" if loc == "ar" else "ku"
    return "en"


def format_remaining_phrase(delta: timedelta, locale: str | None) -> str:
    """Human-readable countdown until quota reset."""
    loc = normalize_chat_locale(locale)
    total = int(max(0, delta.total_seconds()))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    if loc == "ar":
        parts: list[str] = []
        if h:
            parts.append(f"{h} ساعة")
        if m:
            parts.append(f"{m} دقيقة")
        if not parts:
            parts.append(f"{s} ثانية")
        return " و ".join(parts[:2])
    if loc == "ku":
        parts = []
        if h:
            parts.append(f"{h} کاتژمێر")
        if m:
            parts.append(f"{m} خولەک")
        if not parts:
            parts.append(f"{s} چرکە")
        return " و ".join(parts[:2])
    parts = []
    if h:
        parts.append(f"{h} hour{'s' if h != 1 else ''}")
    if m:
        parts.append(f"{m} minute{'s' if m != 1 else ''}")
    if not parts or (h == 0 and m == 0):
        parts.append(f"{s} second{'s' if s != 1 else ''}")
    return " and ".join(parts[:2]) if len(parts) > 2 else " and ".join(parts)


def chat_warning_message(locale: str | None) -> str:
    loc = normalize_chat_locale(locale)
    if loc == "ar":
        return (
            "\u26a0\ufe0f تحذير: يرجى الحفاظ على احترام المحادثة. اللغة غير اللائقة غير مسموحة. "
            "إذا استمررت، سيتم تقييد وصولك."
        )
    if loc == "ku":
        return (
            "\u26a0\ufe0f ئاگاداری: تکایە گفتوگۆکە ڕێزدار بکە. زمانێکی ناشایستە ڕێگەپێدراو نییە. "
            "ئەگەر بەردەوام بیت، دەستگەیشتنەکەت سنووردار دەکرێت."
        )
    return (
        "\u26a0\ufe0f Warning: Please keep the conversation respectful. Inappropriate language is not allowed. "
        "If you continue, your access will be restricted."
    )


def chat_rate_limit_message(locale: str | None, remaining_phrase: str) -> str:
    """10 messages per 5h window exhausted; includes support contacts."""
    loc = normalize_chat_locale(locale)
    if loc == "ar":
        return (
            f"⏱️ لقد وصلتَ إلى حد 10 رسائل. للمزيد من المساعدة، تواصل مع فريق الدعم. "
            f"ستكون المحادثة متاحة مجددًا بعد {remaining_phrase}. "
            "البريد: carwise15@gmail.com — الهاتف: 0777 447 2106"
        )
    if loc == "ku":
        return (
            f"⏱️ گەیشتیتە سنووری 10 پەیام. بۆ یارمەتی زیاتر پەیوەندی بە پشتگیری بکە. "
            f"چات دوای {remaining_phrase} دووبارە بەردەست دەبێت. "
            "ئیمەیڵ: carwise15@gmail.com — مۆبایل: 0777 447 2106"
        )
    return (
        f"⏱️ You've reached the limit of 10 messages. "
        f"For more help, contact our support. Chat will be available again in {remaining_phrase}. "
        "Email: carwise15@gmail.com — Phone: 0777 447 2106"
    )


def chat_ip_ban_message(locale: str | None, ends_at: datetime | None = None) -> str:
    """Inappropriate-language ban (e.g. 2h); ends_at in UTC for display."""
    loc = normalize_chat_locale(locale)
    permanent = ends_at is None or ends_at.year >= 9999
    if permanent:
        if loc == "ar":
            return (
                "تم حظرك بسبب لغة غير لائقة. للمساعدة: carwise15@gmail.com أو 0777 447 2106"
            )
        if loc == "ku":
            return (
                "قەدەغەکراویت بەهۆی زمانێکی ناشایستەوە. یارمەتی: carwise15@gmail.com یان 0777 447 2106"
            )
        return (
            "You are banned due to inappropriate language. "
            "Contact support at carwise15@gmail.com or 0777 447 2106."
        )
    utc_str = ends_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if loc == "ar":
        return (
            "تم حظرك لمدة ساعتين بسبب لغة غير لائقة. "
            f"حاول مرة أخرى بعد {utc_str}. "
            "للمساعدة: carwise15@gmail.com"
        )
    if loc == "ku":
        return (
            "بۆ ماوەی 2 کاتژمێر قەدەغەکراویت بەهۆی زمانێکی ناشایستەوە. "
            f"دوای {utc_str} دووبارە هەوڵ بدەوە. "
            "یارمەتی: carwise15@gmail.com"
        )
    return (
        "You are banned for 2 hours due to inappropriate language. "
        f"Try again after {utc_str}. "
        "For help, contact carwise15@gmail.com or 0777 447 2106."
    )
