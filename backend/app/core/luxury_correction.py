"""
Post-prediction correction for luxury / performance vehicles.
Dataset is economy-heavy; ML undervalues RS/AMG/M/etc. This layer never touches training data or model files.
Price bands are USD-equivalent typical Iraqi/Kurdistan resale (import/grey market), not US MSRP.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Reference year/mileage for stored min/typical/max bands
REF_YEAR = 2022
REF_KM = 5000.0


@dataclass(frozen=True)
class LuxuryBand:
    """Known market band for a trim (Iraq/Kurdistan resale, USD-equivalent)."""

    make_needles: Tuple[str, ...]
    model_needles: Tuple[str, ...]
    min_price: float
    typical_price: float
    max_price: float


@dataclass
class LuxuryCorrectionResult:
    price: float
    luxury_adjusted: bool
    used_brand_multiplier_only: bool
    note: Optional[str]


# min / typical / max at REF_YEAR, REF_KM, "Good" — condition/mileage/year adjust on top.
# More specific model rows must appear before generic ones (e.g. Velar before generic Range Rover).
LUXURY_BANDS: List[LuxuryBand] = [
    # Audi RS / R8
    LuxuryBand(("audi",), ("rs3",), 28000, 42000, 55000),
    LuxuryBand(("audi",), ("rs4",), 35000, 52000, 68000),
    LuxuryBand(("audi",), ("rs5",), 38000, 55000, 72000),
    LuxuryBand(("audi",), ("rs6",), 55000, 78000, 105000),
    LuxuryBand(("audi",), ("rs7",), 55000, 75000, 95000),
    LuxuryBand(("audi",), ("r8",), 85000, 125000, 180000),
    LuxuryBand(("audi",), ("e-tron gt", "etron gt", "e tron gt"), 65000, 88000, 115000),
    # BMW M
    LuxuryBand(("bmw",), ("m2",), 32000, 48000, 62000),
    LuxuryBand(("bmw",), ("m3",), 42000, 62000, 82000),
    LuxuryBand(("bmw",), ("m4",), 45000, 65000, 85000),
    LuxuryBand(("bmw",), ("m5",), 45000, 65000, 85000),
    LuxuryBand(("bmw",), ("m8",), 62000, 88000, 115000),
    LuxuryBand(("bmw",), ("x3 m", "x3m"), 45000, 62000, 82000),
    LuxuryBand(("bmw",), ("x5 m", "x5m"), 55000, 75000, 98000),
    LuxuryBand(("bmw",), ("x6 m", "x6m"), 58000, 78000, 102000),
    LuxuryBand(("bmw",), ("i8",), 55000, 75000, 95000),
    # Mercedes AMG
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("c43", "amg c43"), 32000, 45000, 58000),
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("c63", "amg c63"), 42000, 58000, 75000),
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("e53", "amg e53"), 38000, 52000, 68000),
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("e63", "amg e63"), 48000, 68000, 88000),
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("s63", "amg s63"), 65000, 95000, 130000),
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("amg gt",), 72000, 105000, 145000),
    LuxuryBand(("mercedes", "mercedes-benz", "mercedes benz"), ("g63", "g 63", "amg g63"), 80000, 120000, 160000),
    # Porsche
    LuxuryBand(("porsche",), ("911",), 70000, 95000, 130000),
    LuxuryBand(("porsche",), ("cayenne",), 42000, 62000, 88000),
    LuxuryBand(("porsche",), ("panamera",), 48000, 72000, 98000),
    LuxuryBand(("porsche",), ("macan",), 35000, 52000, 70000),
    LuxuryBand(("porsche",), ("taycan",), 62000, 88000, 115000),
    # Land Rover — specific before generic
    LuxuryBand(("land rover", "range rover"), ("defender",), 52000, 75000, 98000),
    LuxuryBand(("land rover", "range rover"), ("range rover sport", "rr sport"), 42000, 62000, 85000),
    LuxuryBand(("land rover", "range rover"), ("evoque",), 28000, 42000, 55000),
    LuxuryBand(("land rover", "range rover"), ("velar",), 35000, 52000, 70000),
    LuxuryBand(("land rover", "range rover"), ("vogue", "autobiography", "svautobiography"), 50000, 75000, 100000),
    LuxuryBand(("land rover", "range rover"), ("range rover",), 50000, 75000, 100000),
    # Lexus F / flagship
    LuxuryBand(("lexus",), ("lc500", "lc500h", "lc 500", "lc"), 52000, 72000, 95000),
    LuxuryBand(("lexus",), ("lx", "lx570", "lx600"), 55000, 78000, 105000),
    LuxuryBand(("lexus",), ("is f", "isf"), 28000, 40000, 52000),
    LuxuryBand(("lexus",), ("rc f", "rcf"), 38000, 55000, 72000),
    # Maserati
    LuxuryBand(("maserati",), ("ghibli",), 28000, 42000, 58000),
    LuxuryBand(("maserati",), ("levante",), 35000, 52000, 72000),
    LuxuryBand(("maserati",), ("quattroporte",), 38000, 55000, 75000),
    # Bentley
    LuxuryBand(("bentley",), ("continental",), 95000, 140000, 195000),
    LuxuryBand(("bentley",), ("bentayga",), 105000, 155000, 210000),
    LuxuryBand(("bentley",), ("flying spur",), 90000, 135000, 185000),
    # Rolls-Royce
    LuxuryBand(("rolls", "rolls-royce", "rolls royce"), ("ghost",), 140000, 195000, 260000),
    LuxuryBand(("rolls", "rolls-royce", "rolls royce"), ("wraith",), 130000, 185000, 245000),
    LuxuryBand(("rolls", "rolls-royce", "rolls royce"), ("cullinan",), 220000, 310000, 420000),
    # Lamborghini
    LuxuryBand(("lamborghini",), ("urus",), 140000, 195000, 260000),
    LuxuryBand(("lamborghini",), ("huracan", "huracán"), 125000, 175000, 240000),
    LuxuryBand(("lamborghini",), ("aventador",), 180000, 260000, 380000),
    # Ferrari
    LuxuryBand(("ferrari",), ("roma",), 160000, 220000, 290000),
    LuxuryBand(("ferrari",), ("f8",), 200000, 280000, 380000),
    LuxuryBand(("ferrari",), ("296",), 210000, 290000, 390000),
    LuxuryBand(("ferrari",), ("sf90",), 280000, 380000, 520000),
    # McLaren
    LuxuryBand(("mclaren",), ("720", "720s", "765"), 140000, 195000, 265000),
    LuxuryBand(("mclaren",), ("gt",), 110000, 155000, 205000),
    LuxuryBand(("mclaren",), ("artura",), 155000, 210000, 280000),
    # Genesis
    LuxuryBand(("genesis",), ("g80",), 28000, 42000, 55000),
    LuxuryBand(("genesis",), ("g90",), 42000, 58000, 75000),
    LuxuryBand(("genesis",), ("gv80",), 32000, 48000, 62000),
    # Dodge SRT
    LuxuryBand(("dodge",), ("srt", "hellcat", "demon"), 38000, 58000, 95000),
    # Ford performance
    LuxuryBand(("ford",), ("shelby", "gt500"), 42000, 65000, 92000),
    LuxuryBand(("ford",), ("mustang gt",), 22000, 32000, 45000),
    # Chevrolet
    LuxuryBand(("chevrolet", "chevy"), ("corvette",), 48000, 72000, 105000),
    LuxuryBand(("chevrolet", "chevy"), ("camaro", "zl1"), 32000, 48000, 65000),
    # GMC
    LuxuryBand(("gmc",), ("hummer",), 65000, 95000, 130000),
    # Cadillac Escalade — band only lifts when ML is below it (see apply_luxury_correction)
    LuxuryBand(("cadillac",), ("escalade",), 55000, 82000, 115000),
    # Toyota
    LuxuryBand(("toyota",), ("land cruiser", "landcruiser"), 45000, 65000, 85000),
    LuxuryBand(("toyota",), ("supra",), 38000, 52000, 68000),
    # Nissan
    LuxuryBand(("nissan",), ("gt-r", "gtr", "gt r"), 55000, 78000, 105000),
    LuxuryBand(("nissan",), ("patrol", "armada"), 28000, 45000, 65000),
]

# When make indicates a luxury marque but no band matched — scale raw ML output (minimum floor vs prediction).
BRAND_FALLBACK_MULTIPLIER: Dict[str, float] = {
    "porsche": 2.5,
    "ferrari": 3.0,
    "lamborghini": 2.8,
    "bentley": 2.2,
    "rolls": 2.2,
    "mclaren": 2.6,
    "maserati": 1.85,
    "aston": 2.0,
    "audi": 1.65,
    "bmw": 1.55,
    "mercedes": 1.75,
    "mercedes-benz": 1.75,
    "lexus": 1.4,
    "land rover": 1.6,
    "range rover": 1.6,
    "genesis": 1.35,
    "jaguar": 1.45,
    "alfa": 1.5,
    "cadillac": 1.35,
    "lincoln": 1.2,
    "infiniti": 1.25,
    "acura": 1.2,
}


def _make_matches(make: str, needles: Tuple[str, ...]) -> bool:
    ml = (make or "").lower().strip()
    return any(n in ml for n in needles)


def _model_line(model: str, trim: Optional[str]) -> str:
    parts = [model or "", trim or ""]
    return " ".join(p for p in parts if p).lower().strip()


def _model_has_needle(line: str, needle: str) -> bool:
    n = needle.lower().strip()
    if not n:
        return False
    if len(n) <= 2:
        return bool(re.search(r"\b" + re.escape(n) + r"\b", line))
    return n in line


def _band_matches(make: str, model: str, trim: Optional[str], band: LuxuryBand) -> bool:
    if not _make_matches(make, band.make_needles):
        return False
    line = _model_line(model, trim)
    return any(_model_has_needle(line, needle) for needle in band.model_needles)


def _find_matching_band(make: str, model: str, trim: Optional[str]) -> Optional[LuxuryBand]:
    for band in LUXURY_BANDS:
        if _band_matches(make, model, trim, band):
            return band
    return None


def _luxury_brand_key(make: str) -> Optional[str]:
    ml = (make or "").lower()
    for key in sorted(BRAND_FALLBACK_MULTIPLIER.keys(), key=len, reverse=True):
        if key in ml:
            return key
    return None


# Apply full marque multiplier without a band match (e.g. any Porsche).
SUPERCAR_BRAND_KEYS = frozenset(
    {
        "porsche",
        "ferrari",
        "lamborghini",
        "bentley",
        "rolls",
        "mclaren",
        "maserati",
        "aston",
    }
)

# German volume + Lexus: only scale if trim suggests performance / AMG / M / RS.
_PERF_HINTS = (
    "amg",
    "rs",
    "m2",
    "m3",
    "m4",
    "m5",
    "m6",
    "m8",
    "g63",
    "s63",
    "srt",
    "hellcat",
    "turbo s",
    "competition",
    "black badge",
    "trackhawk",
    "svr",
    "type r",
    "nismo",
)


def _should_apply_brand_multiplier(bkey: str, model: str, trim: Optional[str]) -> bool:
    if bkey in SUPERCAR_BRAND_KEYS:
        return True
    mult = BRAND_FALLBACK_MULTIPLIER.get(bkey, 1.0)
    if mult >= 2.0:
        return True
    line = _model_line(model, trim)
    return any(h in line for h in _PERF_HINTS)


def _year_factor(year: int) -> float:
    diff = int(year) - REF_YEAR
    if diff >= 0:
        return 1.0 + 0.02 * min(diff, 8)
    return max(0.65, 1.0 + 0.025 * diff)


def _mileage_factor(km: float) -> float:
    try:
        k = float(km)
    except (TypeError, ValueError):
        k = REF_KM
    ex = max(0.0, k - REF_KM)
    return max(0.55, 1.0 - 0.025 * (ex / 10000.0))


def _condition_weights(condition: Optional[str]) -> Tuple[float, float, float]:
    c = (condition or "Good").strip().lower()
    if c in ("new", "excellent", "like new", "ممتاز"):
        return (0.08, 0.22, 0.70)
    if c in ("good", "جيد"):
        return (0.12, 0.76, 0.12)
    if c in ("fair", "average", "متوسط"):
        return (0.42, 0.48, 0.10)
    return (0.72, 0.25, 0.03)


def _blend_price(band: LuxuryBand, year: int, mileage: float, condition: Optional[str]) -> float:
    yf = _year_factor(year)
    mf = _mileage_factor(mileage)
    adj_min = band.min_price * yf * mf
    adj_typ = band.typical_price * yf * mf
    adj_max = band.max_price * yf * mf
    w_min, w_typ, w_max = _condition_weights(condition)
    price = w_min * adj_min + w_typ * adj_typ + w_max * adj_max
    lo = adj_min * 0.92
    hi = adj_max * 1.08
    return max(lo, min(hi, price))


def count_make_model_in_dataset(df: Any, make: str, model: str) -> int:
    """Exact make+model row count (case-insensitive), for confidence scoring."""
    if df is None or getattr(df, "empty", True):
        return 0
    try:
        mk = df["make"].astype(str).str.strip().str.lower()
        md = df["model"].astype(str).str.strip().str.lower()
        m = (make or "").strip().lower()
        mo = (model or "").strip().lower()
        return int(((mk == m) & (md == mo)).sum())
    except Exception as e:
        logger.warning("count_make_model_in_dataset failed: %s", e)
        return 0


def compute_confidence_percent(
    count: int, luxury_adjusted: bool
) -> Tuple[float, Optional[str]]:
    """Returns (confidence 40–95, optional user-facing note)."""
    if luxury_adjusted:
        # 70–80% band; tie to count slightly for repeatability
        base = 72.0 + min(6.0, (count % 7))
        return (round(min(80.0, max(70.0, base)), 1), "Limited data for this model. Price estimated using market reference data.")

    if count > 50:
        conf = 90.0 + min(5.0, (count - 50) / 100.0 * 5.0)
    elif count >= 20:
        conf = 80.0 + (count - 20) / 30.0 * 10.0
    elif count >= 5:
        conf = 65.0 + (count - 5) / 15.0 * 15.0
    else:
        conf = 40.0 + max(0, count) * 5.0

    conf = max(40.0, min(95.0, conf))
    return (round(conf, 1), None)


def apply_luxury_correction(raw_price: float, car_data: Dict[str, Any]) -> LuxuryCorrectionResult:
    """
    Replace ML price when a known luxury band matches; otherwise optionally scale by brand multiplier.
    """
    try:
        rp = float(raw_price)
    except (TypeError, ValueError):
        rp = 0.0

    make = str(car_data.get("make") or "").strip()
    model = str(car_data.get("model") or "").strip()
    trim = car_data.get("trim")
    trim_s = str(trim).strip() if trim else None
    year = int(car_data.get("year") or REF_YEAR)
    try:
        mileage = float(car_data.get("mileage") if car_data.get("mileage") is not None else REF_KM)
    except (TypeError, ValueError):
        mileage = REF_KM
    condition = car_data.get("condition")

    band = _find_matching_band(make, model, trim_s)
    if band is not None:
        band_price = _blend_price(band, year, mileage, str(condition) if condition else None)
        # Do not replace a strong ML price that already matches or exceeds the band
        if rp >= band_price * 0.88:
            return LuxuryCorrectionResult(
                price=round(rp, 2),
                luxury_adjusted=False,
                used_brand_multiplier_only=False,
                note=None,
            )
        if rp >= band.min_price * 0.82:
            blended = 0.52 * rp + 0.48 * band_price
            logger.info(
                "Luxury band blend: %s %s -> %.0f (was %.0f, ref %.0f)",
                make,
                model,
                blended,
                rp,
                band_price,
            )
            return LuxuryCorrectionResult(
                price=round(blended, 2),
                luxury_adjusted=True,
                used_brand_multiplier_only=False,
                note="Limited data for this model. Price estimated using market reference data.",
            )
        logger.info(
            "Luxury band correction: %s %s -> %.0f (was %.0f)",
            make,
            model,
            band_price,
            rp,
        )
        return LuxuryCorrectionResult(
            price=round(band_price, 2),
            luxury_adjusted=True,
            used_brand_multiplier_only=False,
            note="Limited data for this model. Price estimated using market reference data.",
        )

    bkey = _luxury_brand_key(make)
    if bkey is not None and _should_apply_brand_multiplier(bkey, model, trim_s):
        mult = BRAND_FALLBACK_MULTIPLIER.get(bkey, 1.5)
        adjusted = max(rp * mult, rp)
        logger.info(
            "Luxury brand fallback: %s x %.2f -> %.0f (was %.0f)",
            bkey,
            mult,
            adjusted,
            rp,
        )
        return LuxuryCorrectionResult(
            price=round(adjusted, 2),
            luxury_adjusted=True,
            used_brand_multiplier_only=True,
            note="Limited data for this model. Price estimated using market reference data.",
        )

    return LuxuryCorrectionResult(
        price=round(rp, 2),
        luxury_adjusted=False,
        used_brand_multiplier_only=False,
        note=None,
    )
