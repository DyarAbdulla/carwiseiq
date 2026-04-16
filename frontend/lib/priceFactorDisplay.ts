import { formatCurrency } from '@/lib/utils'
import type { PriceFactor } from '@/lib/types'

/**
 * Backend `price_factors[].impact` is a dollar delta vs a segment average, not a percent.
 */
export function formatPriceFactorImpactLabel(
  factor: Pick<PriceFactor, 'impact' | 'direction'>
): string {
  const raw = factor.impact
  if (!Number.isFinite(raw)) return '—'
  const sign = factor.direction === 'up' ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(raw))}`
}
