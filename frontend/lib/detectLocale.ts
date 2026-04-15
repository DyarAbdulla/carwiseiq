/**
 * Detect preferred locale from:
 * 1. Stored preference (cookie/localStorage)
 * 2. IP geolocation (Iraq/Kurdistan → ku, other Arab → ar)
 * 3. Browser Accept-Language
 * 4. Fallback: ku (site default)
 */
export type Locale = "en" | "ku" | "ar"

const IRAQ_KURDISTAN_COUNTRIES = ["IQ"] // Iraq
const ARAB_COUNTRIES = ["SA", "AE", "EG", "JO", "LB", "SY", "YE", "KW", "BH", "OM", "QA", "PS", "MA", "DZ", "TN", "LY", "SD", "MR"]

export async function detectLocaleFromRequest(request: Request): Promise<Locale> {
  // 1. Check cookie (NEXT_LOCALE set by next-intl)
  const cookie = request.headers.get("cookie") || ""
  const localeMatch = cookie.match(/NEXT_LOCALE=([^;]+)/)
  if (localeMatch) {
    const v = localeMatch[1].trim().toLowerCase()
    if (v === "ku" || v === "ar" || v === "en") return v as Locale
  }

  // 2. Try IP geolocation (lightweight - use free API)
  try {
    const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    const ip = forwarded?.split(",")[0]?.trim()
    if (ip && !ip.startsWith("127.") && !ip.startsWith("192.168")) {
      const country = await fetchCountryFromIP(ip)
      if (country === "IQ") return "ku" // Iraq/Kurdistan → Kurdish
      if (ARAB_COUNTRIES.includes(country)) return "ar"
    }
  } catch {
    // Ignore geolocation errors
  }

  // 3. Accept-Language header
  const acceptLang = request.headers.get("accept-language") || ""
  if (acceptLang.includes("ku") || acceptLang.includes("ckb")) return "ku"
  if (acceptLang.includes("ar")) return "ar"
  if (acceptLang.includes("en")) return "en"

  return "ku"
}

async function fetchCountryFromIP(ip: string): Promise<string> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/country/`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const code = (await res.text()).trim().toUpperCase()
      if (code.length === 2) return code
    }
  } catch {
    // Timeout or network error
  }
  return ""
}
