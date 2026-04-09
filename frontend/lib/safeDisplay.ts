import type { CarFeatures } from '@/lib/types'

/** Safe string/number for JSX text nodes — avoids React #300 when API sends objects. */

export function safeText(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return fallback
}

export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/** Coerce sessionStorage / URL prefill into safe CarFeatures (avoids objects in form JSX). */
export function sanitizeCarFeaturesFromUnknown(data: unknown): CarFeatures | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.make !== 'string' || typeof d.model !== 'string') return null
  return {
    make: safeText(d.make),
    model: safeText(d.model),
    year: Math.round(safeNumber(d.year, new Date().getFullYear())),
    mileage: safeNumber(d.mileage, 50000),
    engine_size: safeNumber(d.engine_size, 2),
    cylinders: Math.max(2, Math.min(12, Math.round(safeNumber(d.cylinders, 4)))),
    condition: safeText(d.condition, 'Good'),
    fuel_type: safeText(d.fuel_type, 'Gasoline'),
    location: safeText(d.location, ''),
    trim: d.trim != null && String(d.trim).trim() !== '' ? safeText(d.trim) : undefined,
    color: d.color != null ? safeText(d.color) : undefined,
  }
}
