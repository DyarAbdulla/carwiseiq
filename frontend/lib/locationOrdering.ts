/**
 * Kurdistan cities first (user-facing order), then remaining Iraq cities A–Z.
 */
/** Match API/English names; order is Sulaymaniyah, Erbil, Duhok, Halabja, Kirkuk first */
const KURDISTAN_ORDER = ['Sulaymaniyah', 'Erbil', 'Duhok', 'Halabja', 'Kirkuk'] as const

export function orderLocationsKurdistanFirst(locations: string[]): string[] {
  if (!locations?.length) return []
  const first: string[] = []
  const used = new Set<string>()
  for (const k of KURDISTAN_ORDER) {
    const found = locations.find((x) => x.trim().toLowerCase() === k.toLowerCase())
    if (found) {
      first.push(found)
      used.add(found.toLowerCase())
    }
  }
  const rest = locations
    .filter((x) => !used.has(x.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return [...first, ...rest]
}
