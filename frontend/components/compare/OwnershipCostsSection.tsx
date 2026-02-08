"use client"

import { formatCurrency } from '@/lib/utils'

interface CarItem {
  name: string
  price: number
  mileage?: number
  fuelEconomyCity?: number
  fuelEconomyHighway?: number
  fuelType?: string
}

interface OwnershipCostsSectionProps {
  cars: CarItem[]
  bestDealIndex?: number
}

export function OwnershipCostsSection({ cars, bestDealIndex }: OwnershipCostsSectionProps) {
  if (!cars?.length) return null
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Ownership Costs</h3>
      <div className="flex flex-wrap gap-4">
        {cars.map((c, i) => (
          <div
            key={i}
            className={`bg-white/5 backdrop-blur-sm border rounded-xl px-4 py-3 min-w-[120px] hover:bg-white/10 transition-colors relative ${
              i === bestDealIndex 
                ? 'border-green-500/50 shadow-lg shadow-green-500/20' 
                : 'border-white/10'
            }`}
          >
            {/* Green Glow for Best Deal */}
            {i === bestDealIndex && (
              <div className="absolute inset-0 -z-10 bg-gradient-radial from-green-500/20 via-green-500/10 to-transparent blur-xl rounded-xl opacity-50" />
            )}
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1 truncate">{c.name}</p>
            <p className="text-white text-lg font-semibold">{formatCurrency(c.price)}</p>
            {c.mileage != null && <p className="text-xs text-gray-400 mt-1">{c.mileage.toLocaleString()} km</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
