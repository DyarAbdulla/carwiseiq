"use client"

import { formatCurrency } from '@/lib/utils'

interface CarItem {
  name: string
  price: number
  horsepower?: number
  mileage?: number
}

interface ValueAnalysisSectionProps {
  cars: CarItem[]
  bestDealIndex?: number
}

export function ValueAnalysisSection({ cars, bestDealIndex }: ValueAnalysisSectionProps) {
  if (!cars?.length) return null
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Value Analysis</h3>
      <div className="flex flex-wrap gap-4">
        {cars.map((c, i) => (
          <div
            key={i}
            className={`predict-glass relative rounded-xl px-4 py-3 min-w-[120px] transition-colors hover:ring-1 hover:ring-violet-500/20 ${
              i === bestDealIndex
                ? 'shadow-[0_0_32px_rgba(34,197,94,0.2)] ring-1 ring-emerald-500/35'
                : ''
            }`}
          >
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1 truncate">{c.name}</p>
            <p className="text-white text-lg font-semibold">{formatCurrency(c.price)}</p>
            {c.horsepower != null && <p className="text-xs text-gray-400 mt-1">{c.horsepower} hp</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
