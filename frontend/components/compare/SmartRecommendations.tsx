"use client"

import { formatCurrency } from '@/lib/utils'

interface CarItem {
  name: string
  index: number
  year?: number
  price?: number
  horsepower?: number | null
  fuelEconomy?: number
  savings?: number
  reliability?: number | null
}

interface SmartRecommendationsProps {
  cars: CarItem[]
  bestDealIndex?: number
  mostExpensiveIndex?: number
  bestForPerformance?: number
  bestForEconomy?: number
  bestForReliability?: number
  savings?: number[]
}

export function SmartRecommendations({
  cars,
  bestDealIndex,
  mostExpensiveIndex,
  bestForPerformance,
  bestForEconomy,
  bestForReliability,
  savings,
}: SmartRecommendationsProps) {
  if (!cars?.length) return null
  const bestIdx = bestDealIndex ?? 0
  const best = cars[bestIdx]
  if (!best) return null

  const expensiveIdx =
    mostExpensiveIndex != null && cars[mostExpensiveIndex]
      ? mostExpensiveIndex
      : cars.reduce((maxI, c, i) => ((c.price ?? 0) > (cars[maxI]?.price ?? 0) ? i : maxI), 0)
  const expensive = cars[expensiveIdx]
  const saveVsHighest =
    savings?.[bestIdx] ??
    (best.price != null && expensive?.price != null && expensiveIdx !== bestIdx
      ? Math.max(0, expensive.price - best.price)
      : undefined)

  const bestYear = best.year
  const expYear = expensive?.year
  const yearDiff =
    bestYear != null && expYear != null ? Math.abs(bestYear - expYear) : null

  const bestTitle = [best.name, bestYear != null ? String(bestYear) : null].filter(Boolean).join(' ')
  const expensiveTitle = expensive
    ? [expensive.name, expYear != null ? String(expYear) : null].filter(Boolean).join(' ')
    : null

  let comparisonPhrase = ''
  if (expensiveTitle && expensiveIdx !== bestIdx) {
    const saved =
      saveVsHighest != null && saveVsHighest > 0
        ? formatCurrency(saveVsHighest)
        : best.price != null && expensive?.price != null && expensive.price > best.price
          ? formatCurrency(expensive.price - best.price)
          : null
    if (saved) {
      comparisonPhrase = ` — saves you ${saved} vs the ${expensiveTitle}`
      if (yearDiff != null && yearDiff > 0) {
        comparisonPhrase += ` with only ${yearDiff} year${yearDiff === 1 ? '' : 's'} difference`
      } else if (yearDiff === 0) {
        comparisonPhrase += ' (same model year)'
      }
    } else {
      comparisonPhrase = ` — compared with the ${expensiveTitle} in this set`
      if (yearDiff != null && yearDiff > 0) {
        comparisonPhrase += ` (${yearDiff} year${yearDiff === 1 ? '' : 's'} apart)`
      }
    }
  }

  const extras: string[] = []
  if (bestForPerformance != null && cars[bestForPerformance] && bestForPerformance !== bestIdx) {
    extras.push(`Strongest performance: ${cars[bestForPerformance].name}.`)
  }
  if (bestForEconomy != null && cars[bestForEconomy] && bestForEconomy !== bestIdx) {
    extras.push(`Best fuel economy in this set: ${cars[bestForEconomy].name}.`)
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-3">Smart Recommendations</h3>
      <p className="text-gray-300 text-sm leading-relaxed">
        Best value:{' '}
        <span className="text-green-400 font-semibold">{bestTitle}</span>
        {best.price != null && (
          <>
            {' '}
            at <span className="text-white font-medium tabular-nums">{formatCurrency(best.price)}</span>
          </>
        )}
        {comparisonPhrase}.
        {extras.length > 0 && (
          <span className="block mt-2 text-gray-400 text-sm">{extras.join(' ')}</span>
        )}
      </p>
    </div>
  )
}
