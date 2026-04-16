import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/** Display-only approximate IQD equivalent (not a live FX rate). */
export const USD_TO_IQD_APPROX = 1310

export function formatApproxIqdFromUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "0"
  return Math.round(usd * USD_TO_IQD_APPROX).toLocaleString("en-US")
}

/**
 * Normalize API `confidence_percent` (or string variants) to 0–100 for UI.
 * - Values in (0, 1] are treated as fractions (e.g. 0.75 → 75).
 * - Values in (100, ∞) are treated as invalid (returns null so callers can fall back).
 * - Slight overflow (100–101) clamps to 100.
 */
export function normalizeConfidencePercentForDisplay(raw: unknown): number | null {
  if (raw == null) return null
  let n: number
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    const t = trimmed.endsWith("%") ? trimmed.slice(0, -1).trim() : trimmed
    if (t === "") return null
    n = parseFloat(t)
  } else if (typeof raw === "number") {
    n = raw
  } else {
    return null
  }
  if (!Number.isFinite(n) || n < 0) return null
  if (n > 0 && n <= 1) n *= 100
  if (n > 100) {
    if (n <= 101) n = 100
    else return null
  }
  return Math.round(Math.min(100, Math.max(0, n)))
}

/**
 * Infer 0–100 confidence from interval width vs price when percent is missing.
 * Returns null if the result would be unreliable (e.g. width ≥ price).
 */
export function confidencePercentFromInterval(
  predictedPrice: number,
  interval: { lower: number; upper: number } | undefined
): number | null {
  if (!interval || typeof predictedPrice !== "number" || !Number.isFinite(predictedPrice) || predictedPrice <= 0) {
    return null
  }
  const lo = Math.min(interval.lower, interval.upper)
  const hi = Math.max(interval.lower, interval.upper)
  const width = hi - lo
  if (!Number.isFinite(width) || width < 0 || width >= predictedPrice) return null
  const raw = (1 - width / predictedPrice) * 100
  if (!Number.isFinite(raw)) return null
  return Math.round(Math.min(100, Math.max(0, raw)))
}

/** Re-export formatPrice for IQD/USD with locale support (use from @/lib/formatters for full options) */
export { formatPrice, formatPriceWithToggle } from "./formatters"

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

/**
 * Converts MPG (miles per gallon) to L/100km (liters per 100 kilometers)
 * Formula: L/100km = 235.214583 / MPG
 *
 * @param mpg - Miles per gallon value
 * @returns L/100km value rounded to 1 decimal place
 */
export function mpgToLPer100km(mpg: number): number {
  if (mpg <= 0 || !isFinite(mpg)) return 0
  return Math.round((235.214583 / mpg) * 10) / 10
}

/**
 * Formats fuel economy from MPG to L/100km display string
 *
 * @param cityMpg - City MPG value
 * @param highwayMpg - Highway MPG value
 * @returns Formatted string like "9.8 / 7.4 L/100km"
 */
export function formatFuelEconomy(cityMpg: number, highwayMpg: number): string {
  const cityL100km = mpgToLPer100km(cityMpg)
  const highwayL100km = mpgToLPer100km(highwayMpg)
  return `${cityL100km} / ${highwayL100km} L/100km`
}

/**
 * Formats fuel economy when values are already in L/100km (e.g. from CarQuery API)
 */
export function formatFuelEconomyL100km(cityL100km: number, highwayL100km: number): string {
  return `${cityL100km} / ${highwayL100km} L/100km`
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced function with a cancel method
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
    }, wait)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

/**
 * True if the URL points to a video file (by extension). Used to render <video> instead of <img>.
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (url == null || typeof url !== 'string') return false
  return /\.(mp4|mov|avi)(\?|$)/i.test(url)
}

/**
 * Resolve listing image src: full URLs as-is; /uploads/... prefixed with API base.
 */
export function listingImageUrl(
  src: string | null | undefined,
  apiBase?: string
): string {
  if (src == null || typeof src !== 'string' || !src) return ''
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  const base = (apiBase ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '')
  return base ? base + (src.startsWith('/') ? src : '/' + src) : src
}

