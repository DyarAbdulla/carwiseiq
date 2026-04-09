/**
 * Normalize vehicle condition labels (fixes duplicated tokens like "GoodGood" from bad API/state).
 */
export function normalizeConditionLabel(raw: string | undefined | null): string {
  if (raw == null) return ''
  let s = String(raw).trim().replace(/\s+/g, ' ')
  if (!s) return ''

  // Collapse accidental doubled tokens: "GoodGood", "NewNew"
  if (s.length >= 4 && s.length % 2 === 0) {
    const half = s.length / 2
    const a = s.slice(0, half)
    const b = s.slice(half)
    if (a.toLowerCase() === b.toLowerCase()) {
      s = a
    }
  }
  // Repeated word: "Good Good" -> "Good"
  const parts = s.split(' ')
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    s = parts[0]
  }

  const lower = s.toLowerCase()
  if (lower === 'used') return 'Good'

  // Title-case common labels
  const map: Record<string, string> = {
    new: 'New',
    'like new': 'Like New',
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    salvage: 'Salvage',
  }
  return map[lower] ?? s
}

/** Dedupe case-insensitively while preserving first-seen casing */
export function dedupeOptionList(items: string[], normalize?: (s: string) => string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const n = normalize ? normalize(item) : String(item).trim()
    if (!n) continue
    const k = n.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(n)
  }
  return out
}
