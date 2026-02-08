export interface CompareHistoryEntry {
  id?: string
  name: string
  mode: 'marketplace' | 'prediction'
  ids?: number[]
  state?: { cars: Array<{ features: unknown; prediction: unknown }> }
  createdAt?: number
}

const STORAGE_KEY = 'compare_history'

function loadHistory(): CompareHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(entries: CompareHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

export function saveCompareToHistory(entry: Omit<CompareHistoryEntry, 'id' | 'createdAt'>) {
  const list = loadHistory()
  const newEntry: CompareHistoryEntry = {
    ...entry,
    id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
  }
  list.unshift(newEntry)
  if (list.length > 50) list.length = 50
  saveHistory(list)
}

export function getCompareHistory(): CompareHistoryEntry[] {
  return loadHistory()
}
