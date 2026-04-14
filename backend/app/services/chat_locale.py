"""Localized user-facing strings for AI chat security (quota, profanity, bans)."""

from __future__ import annotations

from datetime import timedelta


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
    loc = normalize_chat_locale(locale)
    if loc == "ar":
        return (
            f"لقد وصلت إلى حد الرسائل. يرجى المحاولة مرة أخرى بعد {remaining_phrase}. "
            "للمساعدة: carwise15@gmail.com أو اتصل على 07774472106"
        )
    if loc == "ku":
        return (
            f"گەیشتیتە سنووری پەیامەکان. تکایە دوای {remaining_phrase} دووبارە هەوڵ بدەوە. "
            "یارمەتی: carwise15@gmail.com یان 07774472106"
        )
    return (
        f"You've reached the message limit. Please try again in {remaining_phrase}. "
        "If you need help, contact our support at carwise15@gmail.com or call 07774472106"
    )


def chat_ip_ban_message(locale: str | None) -> str:
    loc = normalize_chat_locale(locale)
    if loc == "ar":
        return (
            "تم تقييد وصولك مؤقتًا بسبب سلوك غير لائق. "
            "تواصل مع الدعم: carwise15@gmail.com"
        )
    if loc == "ku":
        return (
            "دەستگەیشتنەکەت کاتیی سنووردارکراوە بەهۆی هەڵسوکەوتی ناشایستەوە. "
            "پەیوەندی بە پشتگیری: carwise15@gmail.com"
        )
    return (
        "Your access has been temporarily restricted due to inappropriate behavior. "
        "Contact support at carwise15@gmail.com"
    )
