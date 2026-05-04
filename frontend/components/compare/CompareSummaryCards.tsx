"use client"

import { formatApproxIqdFromUsd, formatCurrency } from '@/lib/utils'

interface CarItem {
  name: string
  price: number
  index: number
}

interface CompareSummaryCardsProps {
  cars: CarItem[]
  bestDealIndex?: number
  mostExpensiveIndex?: number
  savings?: number[]
}

export function CompareSummaryCards({
  cars,
  bestDealIndex,
  mostExpensiveIndex,
  savings,
}: CompareSummaryCardsProps) {
  if (!cars?.length) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cars.map((c, i) => (
        <div
          key={i}
          className={`predict-glass relative rounded-2xl p-6 ${
            i === bestDealIndex
              ? 'shadow-[0_0_36px_rgba(34,197,94,0.22)] ring-1 ring-emerald-500/35'
              : i === mostExpensiveIndex
                ? 'ring-1 ring-amber-500/35 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                : ''
          }`}
        >
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-2 truncate">{c.name}</p>
          <p className="text-white text-2xl font-bold mb-1">{formatCurrency(c.price)}</p>
          <p className="text-sm text-slate-400 font-medium tabular-nums mb-1">
            ≈ {formatApproxIqdFromUsd(c.price)} IQD
          </p>
          {savings != null && savings[i] != null && savings[i] > 0 && (
            <p className="text-xs text-green-400 font-medium">Save {formatCurrency(savings[i])}</p>
          )}
        </div>
      ))}
    </div>
  )
}
