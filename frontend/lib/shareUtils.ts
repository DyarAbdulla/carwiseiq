import type { ReadonlyURLSearchParams } from 'next/navigation'

export interface ParsedCompareUrl {
  mode: 'prediction'
  state?: { cars: Array<{ features: unknown; prediction: unknown }> }
}

export function parseCompareUrl(searchParams: ReadonlyURLSearchParams | null): ParsedCompareUrl | null {
  if (!searchParams) return null
  const type = searchParams.get('type')
  const d = searchParams.get('d')
  if (type !== 'pred' || !d) return null
  try {
    const decoded = JSON.parse(decodeURIComponent(atob(d)))
    if (decoded?.mode === 'prediction' && decoded?.state?.cars?.length) {
      return { mode: 'prediction', state: decoded.state }
    }
  } catch {}
  return null
}

export function buildCompareUrl(params: { mode: 'prediction'; state: { cars: unknown[] } }): string {
  try {
    const payload = btoa(encodeURIComponent(JSON.stringify(params)))
    return `?type=pred&d=${payload}`
  } catch {
    return ''
  }
}
