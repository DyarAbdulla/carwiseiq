"""
Profanity / insult detection for Kurdish (Sorani script), Arabic, and English.
Uses normalization (spacing tricks, repeated letters) plus substring checks where safe.
"""

from __future__ import annotations

import re
import unicodedata
from typing import List, Set, Tuple

# --- English: token exact match + compact substring (min length avoids common false positives) ---
_EN_EXACT: Set[str] = {
    "fuck", "fucker", "fucking", "fucked", "fucks", "motherfucker", "mofo", "mf",
    "shit", "shitty", "bullshit", "dipshit", "horseshit",
    "bitch", "bitches", "biatch", "b1tch",
    "bastard", "asshole", "arsehole", "dickhead", "dick", "dicks", "cock", "cocksucker",
    "pussy", "piss", "pissed", "crap", "damn", "goddamn", "slut", "whore", "hoe",
    "retard", "retarded", "moron", "dumbass",
    "stfu", "gtfo",
    "wanker", "twat", "prick", "douche", "douchebag", "jackass", "numbnuts",
    "skank", "thot",
}

_EN_SUBSTRING_MIN_LEN = 5
_EN_SUBSTRINGS: List[str] = sorted(
    {
        w for w in {
            "fucker",
            "fucking",
            "motherfucker",
            "bullshit",
            "shithead",
            "asshole",
            "dickhead",
            "cocksucker",
            "douchebag",
            "dumbass",
            "jackass",
            "pieceofshit",
        }
        if len(w) >= _EN_SUBSTRING_MIN_LEN
    },
    key=len,
    reverse=True,
)

# --- Arabic common insults / vulgar terms (compact matching) ---
_AR_TOKENS: Set[str] = {
    "كس", "كسم", "كسك", "كسها", "طيز", "طيزك", "زب", "عرص", "شرموطة", "شراميط",
    "قحبة", "قحاب", "خول", "خولات", "منيوك", "لعين", "وسخ", "وساخة", "حيوان",
    "كلب", "كلاب", "حقير", "واطي", "سافل", "نجس", "فاجر", "لقيط", "ابنالزنا",
    "يلعن", "العن", "تفو", "انقلع", "روحانقلع",
}

# --- Kurdish Sorani (sample + common patterns; same script as Arabic for many tokens) ---
_KU_TOKENS: Set[str] = {
    "جنێو", "گوبخۆ", "کەوڵە", "قەحبە", "قحبە", "کەولە", "گەوجە", "گەوادە",
    "کەر", "گەمژە", "نەفام", "نەفامە", "نەفامان", "حەیوان", "حەوان",
    "کۆسەک", "کوس", "شەرمەزا", "شەرمەزار", "قەوڵ", "گەندەڵ", "گەندە",
    "بێشرەف", "بێشەرەف", "ڕق", "بێڕێز", "قەپ", "قاپ", "گەوج", "گەمژ",
}

_ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+")
_LATIN_RE = re.compile(r"[A-Za-z]+")
_DIAC_RE = re.compile(r"[\u064B-\u065F\u0670\u0640\u06DF\u06E7\u06E8\u06EA-\u06ED]")
_TATWEEL = "\u0640"


def _strip_diacritics_ar(s: str) -> str:
    s = _DIAC_RE.sub("", s)
    return s.replace(_TATWEEL, "")


def _normalize_arabic_letters(s: str) -> str:
    """Loose normalization for Arabic/Kurdish shared script."""
    s = unicodedata.normalize("NFKC", s)
    s = _strip_diacritics_ar(s)
    repl = {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "\u0671": "ا",
        "ى": "ي",
        "ة": "ه",
        "ؤ": "و",
        "ئ": "ي",
    }
    out = []
    for ch in s:
        out.append(repl.get(ch, ch))
    return "".join(out)


def _collapse_repeats(s: str) -> str:
    return re.sub(r"(.)\1{2,}", r"\1\1", s)


def _english_compact(s: str) -> str:
    s = s.lower()
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[^a-z0-9]", "", s)
    return _collapse_repeats(s)


def _arabic_script_compact(s: str) -> str:
    s = _normalize_arabic_letters(s)
    s = re.sub(r"[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]", "", s)
    return _collapse_repeats(s)


def _english_tokens(s: str) -> Set[str]:
    return {m.group(0).lower() for m in _LATIN_RE.finditer(s)}


def _script_scores(text: str) -> Tuple[int, int]:
    """Rough (latin_chars, arabic_script_chars) counts."""
    latin = sum(len(m.group(0)) for m in _LATIN_RE.finditer(text))
    arabic = 0
    for m in _ARABIC_RE.finditer(text):
        arabic += len(m.group(0))
    return latin, arabic


def detect_matching_language(text: str, matched_en: bool, matched_ar: bool, matched_ku: bool) -> str:
    if matched_ku and not matched_ar:
        return "ku"
    if matched_ar and not matched_ku:
        return "ar"
    if matched_ar and matched_ku:
        ku_hits = sum(1 for t in _KU_TOKENS if t in text or t in _arabic_script_compact(text))
        if ku_hits:
            return "ku"
        return "ar"
    if matched_en:
        return "en"
    latin, arabic = _script_scores(text)
    if arabic > latin:
        return "ar"
    if latin > 0:
        return "en"
    return "en"


def profanity_match_details(text: str) -> Tuple[bool, str]:
    """
    Returns (is_profane, primary_language_code) with language in {en, ar, ku}.
    """
    if not text or not str(text).strip():
        return False, "en"

    raw = str(text).strip()
    matched_en = False
    matched_ar = False
    matched_ku = False

    # English
    tokens = _english_tokens(raw)
    compact_en = _english_compact(raw)
    for w in _EN_EXACT:
        if w in tokens or w in compact_en:
            matched_en = True
            break
    if not matched_en:
        for sub in _EN_SUBSTRINGS:
            if sub in compact_en:
                matched_en = True
                break

    # Arabic script (shared bucket for AR + KU lists)
    compact_ar = _arabic_script_compact(raw)
    norm_piece = _normalize_arabic_letters(raw)
    norm_piece_nospace = re.sub(r"\s+", "", norm_piece)

    for t in _AR_TOKENS:
        tn = _normalize_arabic_letters(t)
        if tn in compact_ar or tn in norm_piece_nospace or tn in norm_piece:
            matched_ar = True
            break

    for t in _KU_TOKENS:
        tn = _normalize_arabic_letters(t)
        if tn in compact_ar or tn in norm_piece_nospace or tn in norm_piece:
            matched_ku = True
            break

    if not (matched_en or matched_ar or matched_ku):
        return False, "en"

    lang = detect_matching_language(raw, matched_en, matched_ar, matched_ku)
    return True, lang


def roast_language_name(code: str) -> str:
    return {"en": "English", "ar": "Arabic", "ku": "Kurdish Sorani"}.get(code, "English")
