/**
 * Kurdistan cities first (user-facing order), then remaining Iraq cities A–Z.
 * Aliases cover common dataset/API spellings so matching does not silently fail.
 */
import { IRAQ_LOCATIONS_FALLBACK } from './constants'

/** Order: سلێمانی، هەولێر، دهۆک، هەڵەبجە، کەرکووک — API names + common alternates */
const KURDISTAN_GROUPS: readonly (readonly string[])[] = [
  ['Sulaymaniyah', 'Slemani', 'Slimany', 'Slêmany'],
  ['Erbil', 'Arbil', 'Hewler', 'Hewlêr'],
  ['Duhok', 'Dihok'],
  ['Halabja', 'Halabjah'],
  ['Kirkuk', 'Karkuk', 'Kerkuk'],
]

const lower = (s: string) => s.trim().toLowerCase()

export function orderLocationsKurdistanFirst(locations: string[]): string[] {
  if (!locations?.length) return []
  const first: string[] = []
  const used = new Set<string>()
  for (const group of KURDISTAN_GROUPS) {
    const found = locations.find((x) => {
      const xl = lower(x)
      return group.some((g) => xl === g.toLowerCase())
    })
    if (found) {
      first.push(found)
      used.add(lower(found))
    }
  }
  const rest = locations
    .filter((x) => !used.has(lower(x)))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return [...first, ...rest]
}

/** Fallback list with Kurdistan block first (for initial UI + API failure paths). */
export const ORDERED_IRAQ_LOCATIONS_FALLBACK = orderLocationsKurdistanFirst([...IRAQ_LOCATIONS_FALLBACK])
