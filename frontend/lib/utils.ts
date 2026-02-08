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

