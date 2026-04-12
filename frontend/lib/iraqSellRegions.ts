/** Region ids for grouping cities in the sell flow (labels via i18n `sell.region*` keys). */

export const SELL_REGION_ORDER = [
  "kurdistan",
  "baghdad",
  "basra_south",
  "mosul_north",
  "central",
  "other",
] as const

export type SellRegionId = (typeof SELL_REGION_ORDER)[number]

const KURDISTAN = /sulaymaniyah|slemani|erbil|arbil|hewler|duhok|dohuk|zakho|kirkuk|halabja|rania|penjwen|soran|rawanduz|akre|choman|kalar|derbendikhan/i
const BAGHDAD = /baghdad|bagdad|karrada|mansour|sadr|jadriya|adhamiyah|dora|zayouna|kadhimiya|rusafa|karada/i
const BASRA_SOUTH = /basra|basrah|najaf|karbala|kufa|nasiryah|nasiriyah|amara|maysan|dhi qar|muthanna|wasit|babylon|babil|hillah|diwaniyah|samawah|uthmaniyah/i
const MOSUL_NORTH = /mosul|nineveh|dohuk|erbil|zakho|tal afar|sinjar|duhok|kirkuk/i

/** Classify a city name from the API into a region bucket (first match wins). */
export function classifySellRegion(city: string): SellRegionId {
  const s = city.trim()
  if (!s) return "other"
  if (KURDISTAN.test(s)) return "kurdistan"
  if (BAGHDAD.test(s)) return "baghdad"
  if (BASRA_SOUTH.test(s)) return "basra_south"
  if (MOSUL_NORTH.test(s)) return "mosul_north"
  if (/karbala|najaf|hilla|diwaniyah|kut|ramadi|fallujah|tikrit|samarra/i.test(s)) return "central"
  return "other"
}

export function groupCitiesByRegion(cities: string[]): Map<SellRegionId, string[]> {
  const map = new Map<SellRegionId, string[]>()
  for (const r of SELL_REGION_ORDER) map.set(r, [])
  const seen = new Set<string>()
  for (const raw of cities) {
    const c = raw?.trim()
    if (!c || seen.has(c)) continue
    seen.add(c)
    const region = classifySellRegion(c)
    map.get(region)!.push(c)
  }
  for (const r of SELL_REGION_ORDER) {
    map.set(
      r,
      map.get(r)!.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    )
  }
  return map
}

/** Normalized key for `neighborhoodExamples` in messages (sell namespace). */
export function neighborhoodExampleLocaleKey(city: string): string {
  const k = city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
 .replace(/^_|_$/g, "")

  const aliases: Record<string, string> = {
    sulaymaniyah: "sulaymaniyah",
    slemani: "sulaymaniyah",
    erbil: "erbil",
    hewler: "erbil",
    arbil: "erbil",
    baghdad: "baghdad",
    basra: "basra",
    basrah: "basra",
    najaf: "najaf",
    karbala: "karbala",
    mosul: "mosul",
    duhok: "duhok",
    kirkuk: "kirkuk",
    erbil_governorate: "erbil",
  }
  return aliases[k] || "default"
}
