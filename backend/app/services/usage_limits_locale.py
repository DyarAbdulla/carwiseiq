"""Localized messages for daily predict/compare usage limits."""

from __future__ import annotations

from app.services.chat_locale import normalize_chat_locale


def localized_predict_limit_message(locale: str | None, limit: int) -> str:
    loc = normalize_chat_locale(locale)
    if loc == "ar":
        return (
            f"لقد استخدمت جميع التنبؤات المجانية ({limit}) لهذا اليوم. حاول غداً أو استخدم رمز قسيمة "
            "للوصول غير المحدود."
        )
    if loc == "ku":
        # Sorani: includes "voucher code" (\u06a4\u0627\u0648\u0686\u0647\u0631)
        return (
            f"\u0647\u06d5\u0645\u0648\u0648 \u0646\u0631\u062e\u0627\u0646\u062f\u0646\u06d5 "
            f"\u0628\u06d5\u0633\u0628\u06d5\u0631\u0627\u0645\u0628\u06d5\u0631\u06a9\u0627\u0646\u06cc "
            f"\u0626\u06d5\u0645\u0695\u06c6 ({limit})\u062a \u0628\u06d5\u06a9\u0627\u0631\u0647\u06d5\u06cc\u0646\u0627. "
            f"\u0633\u0628\u06d5\u06cc\u0646\u06ce \u062f\u0648\u0648\u0628\u0627\u0631\u06d5 \u0647\u06d5\u0648\u06da "
            f"\u0628\u062f\u06d5\u0631\u06d5\u0648\u06d5 \u06cc\u0627\u0646 \u06a9\u06c6\u062f\u06cc "
            f"\u06a4\u0627\u0648\u0686\u0647\u0631 \u0628\u06d5\u06a9\u0627\u0631\u0647\u06d5\u06cc\u0646\u06d5 "
            f"\u0628\u06c6 \u0633\u0646\u0648\u0648\u0631\u06ce\u06a9\u06cc \u0628\u06d5\u0633\u0646\u0648\u0648\u0631."
        )
    return (
        f"You've used all {limit} free predictions today. Try again tomorrow or use a voucher code "
        "for unlimited access."
    )


def localized_compare_limit_message(locale: str | None, limit: int) -> str:
    loc = normalize_chat_locale(locale)
    if loc == "ar":
        return (
            f"لقد استخدمت مقارناتك المجانية ({limit}) لهذا اليوم. حاول غداً أو استخدم رمز قسيمة للمزيد."
        )
    if loc == "ku":
        return (
            f"\u0628\u06d5\u0631\u0627\u0648\u0631\u062f\u06a9\u0631\u062f\u0646\u06d5 "
            f"\u0628\u06d5\u0633\u0628\u06d5\u0631\u0627\u0645\u0628\u06d5\u0631\u06a9\u0627\u0646\u06cc "
            f"\u0626\u06d5\u0645\u0695\u06c6 ({limit})\u062a \u062a\u06d5\u0648\u0627\u0648 \u06a9\u0631\u062f. "
            f"\u0633\u0628\u06d5\u06cc\u0646\u06ce \u062f\u0648\u0648\u0628\u0627\u0631\u06d5 \u0647\u06d5\u0648\u06da "
            f"\u0628\u062f\u06d5\u0631\u06d5\u0648\u06d5 \u06cc\u0627\u0646 \u06a9\u06c6\u062f\u06cc "
            f"\u06a4\u0627\u0648\u0686\u0647\u0631 \u0628\u06d5\u06a9\u0627\u0631\u0647\u06d5\u06cc\u0646\u06d5."
        )
    return (
        f"You've used your {limit} free comparisons today. Try again tomorrow or use a voucher code for more."
    )
