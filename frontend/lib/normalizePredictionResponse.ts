/**
 * Coerce API prediction payloads so UI never renders raw objects (React #300).
 */
import type {
  PredictionResponse,
  DealScore,
  PriceFactor,
  MarketTrend,
  SimilarCar,
  MarketComparison,
  MarketDemand,
  ConfidenceInterval,
} from '@/lib/types'
import { normalizeConfidencePercentForDisplay } from '@/lib/utils'

function asString(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return fallback
}

function asFiniteNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function normalizeConfidenceInterval(
  ci: ConfidenceInterval | undefined | null
): ConfidenceInterval | undefined {
  if (!ci || typeof ci !== 'object') return undefined
  return {
    lower: asFiniteNumber((ci as ConfidenceInterval).lower, 0),
    upper: asFiniteNumber((ci as ConfidenceInterval).upper, 0),
  }
}

function normalizeDealScore(raw: unknown): DealScore | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const d = raw as Record<string, unknown>
  const score = asString(d.score, 'fair')
  return {
    score: ['excellent', 'good', 'fair', 'poor'].includes(score)
      ? (score as DealScore['score'])
      : 'fair',
    badge: asString(d.badge, '✅'),
    label: asString(d.label, 'Fair Price'),
    percentage: asFiniteNumber(d.percentage, 0),
  }
}

function normalizePriceFactors(raw: unknown): PriceFactor[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PriceFactor[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const f = item as Record<string, unknown>
    const dir = asString(f.direction, 'up').toLowerCase()
    out.push({
      factor: asString(f.factor, 'Factor'),
      impact: asFiniteNumber(f.impact, 0),
      direction: dir === 'down' ? 'down' : 'up',
      description: f.description != null ? asString(f.description, '') : undefined,
    })
  }
  return out.length ? out : undefined
}

function normalizeMarketTrends(raw: unknown): MarketTrend[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: MarketTrend[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    out.push({
      month: asString(t.month, ''),
      average_price: asFiniteNumber(t.average_price, 0),
      date: t.date != null ? asString(t.date, '') : undefined,
    })
  }
  return out.length ? out : undefined
}

function normalizeSimilarCars(raw: unknown): SimilarCar[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: SimilarCar[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const c = item as Record<string, unknown>
    out.push({
      year: Math.round(asFiniteNumber(c.year, 0)),
      mileage: Math.round(asFiniteNumber(c.mileage, 0)),
      condition: asString(c.condition, 'Unknown'),
      price: asFiniteNumber(c.price, 0),
      make: c.make != null ? asString(c.make, '') : undefined,
      model: c.model != null ? asString(c.model, '') : undefined,
      link: c.link != null ? asString(c.link, '') : undefined,
      image_id: c.image_id != null ? asString(c.image_id, '') : undefined,
      image_url: c.image_url != null ? asString(c.image_url, '') : undefined,
    })
  }
  return out.length ? out : undefined
}

function normalizeMarketComparison(raw: unknown): MarketComparison | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Record<string, unknown>
  return {
    your_car: asFiniteNumber(m.your_car, 0),
    market_average: asFiniteNumber(m.market_average, 0),
    difference: asFiniteNumber(m.difference, 0),
    percentage_difference: asFiniteNumber(m.percentage_difference, 0),
  }
}

function normalizeMarketDemand(raw: unknown): MarketDemand | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const m = raw as Record<string, unknown>
  const level = asString(m.level, 'medium').toLowerCase()
  return {
    level: ['high', 'medium', 'low'].includes(level)
      ? (level as MarketDemand['level'])
      : 'medium',
    badge: asString(m.badge, 'Medium'),
    description: m.description != null ? asString(m.description, '') : undefined,
  }
}

/**
 * Normalize a prediction API response for safe rendering.
 */
export function normalizePredictionResponse(data: unknown): PredictionResponse {
  if (!data || typeof data !== 'object') {
    return {
      predicted_price: 0,
      message: 'Invalid response from server',
    }
  }
  const d = data as Record<string, unknown>

  const predicted_price = asFiniteNumber(d.predicted_price, 0)

  let message: string | undefined
  if (d.message == null) message = undefined
  else if (typeof d.message === 'string') message = d.message
  else message = asString(d.message, '') || undefined

  const confidence_level_raw = d.confidence_level
  let confidence_level: PredictionResponse['confidence_level']
  if (typeof confidence_level_raw === 'string') {
    const c = confidence_level_raw.toLowerCase()
    if (c === 'high' || c === 'medium' || c === 'low') confidence_level = c
  }

  const deal_analysis =
    d.deal_analysis == null ? undefined : asString(d.deal_analysis, '')

  const confidence_percent_raw = normalizeConfidencePercentForDisplay(d.confidence_percent)
  const confidence_percent: number | undefined =
    confidence_percent_raw != null ? confidence_percent_raw : undefined

  const luxury_adjusted =
    typeof d.luxury_adjusted === 'boolean' ? d.luxury_adjusted : undefined
  const luxury_reference_note =
    d.luxury_reference_note != null ? asString(d.luxury_reference_note, '') : undefined

  return {
    predicted_price,
    message,
    confidence_interval: normalizeConfidenceInterval(
      d.confidence_interval as ConfidenceInterval | undefined
    ),
    confidence_range:
      d.confidence_range != null ? asFiniteNumber(d.confidence_range, 0) : undefined,
    precision: d.precision != null ? asFiniteNumber(d.precision, 20) : undefined,
    confidence_level,
    confidence_percent,
    luxury_adjusted,
    luxury_reference_note:
      luxury_reference_note === '' ? undefined : luxury_reference_note,
    market_comparison: normalizeMarketComparison(d.market_comparison),
    deal_analysis:
      deal_analysis === ''
        ? undefined
        : (deal_analysis as PredictionResponse['deal_analysis']),
    deal_score: normalizeDealScore(d.deal_score),
    price_factors: normalizePriceFactors(d.price_factors),
    market_demand: normalizeMarketDemand(d.market_demand),
    similar_cars: normalizeSimilarCars(d.similar_cars),
    market_trends: normalizeMarketTrends(d.market_trends),
    car_image_path:
      d.car_image_path != null ? asString(d.car_image_path, '') : undefined,
    preview_image: d.preview_image != null ? asString(d.preview_image, '') : undefined,
    image_match_type: d.image_match_type as PredictionResponse['image_match_type'],
    image_match_info:
      d.image_match_info != null ? asString(d.image_match_info, '') : undefined,
  }
}
