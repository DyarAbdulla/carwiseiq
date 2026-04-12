/**
 * Iraqi mobile numbers for UI next to a fixed +964 prefix.
 * National format is 10 digits without a trunk 0 (e.g. 7755450573), not 07755450573.
 */

/** Digits only: national mobile (max 10), no964, no leading trunk 0. */
export function normalizeIraqiNationalDigits(input: string): string {
  let x = String(input ?? "").replace(/\D/g, "")
  if (x.startsWith("964")) x = x.slice(3)
  while (x.length > 1 && x[0] === "0") x = x.slice(1)
  if (x.length > 10) x = x.slice(-10)
  return x.slice(0, 10)
}

export function isValidIraqiMobileNational(nationalDigits: string): boolean {
  return /^7\d{9}$/.test(nationalDigits)
}

/** E.164-style compact string for APIs: +9647XXXXXXXXX */
export function toIraqE164(national10: string): string {
  const d = normalizeIraqiNationalDigits(national10)
  if (!isValidIraqiMobileNational(d)) return ""
  return `+964${d}`
}

/** Masked review display: +964 *** *** **XX */
export function maskIraqiMobileDisplay(stored: string): string {
  const d = normalizeIraqiNationalDigits(stored)
  if (d.length < 2) return "+964 ••• ••• ••••"
  return `+964 *** *** **${d.slice(-2)}`
}
