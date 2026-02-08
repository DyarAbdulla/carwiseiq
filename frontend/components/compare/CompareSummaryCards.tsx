"use client"

import { formatCurrency } from '@/lib/utils'

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
          className={`bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative ${
            i === bestDealIndex
              ? 'border-green-500/50 shadow-lg shadow-green-500/20'
              : i === mostExpensiveIndex
                ? 'border-amber-500/50'
                : ''
          }`}
        >
          {/* Green Glow for Best Deal */}
          {i === bestDealIndex && (
            <div className="absolute inset-0 -z-10 bg-gradient-radial from-green-500/20 via-green-500/10 to-transparent blur-xl rounded-2xl opacity-50" />
          )}
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-2 truncate">{c.name}</p>
          <p className="text-white text-2xl font-bold mb-1">{formatCurrency(c.price)}</p>
          {savings != null && savings[i] != null && savings[i] > 0 && (
            <p className="text-xs text-green-400 font-medium">Save {formatCurrency(savings[i])}</p>
          )}
        </div>
      ))}
    </div>
  )
}
