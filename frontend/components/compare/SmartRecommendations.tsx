"use client"

interface CarItem {
  name: string
  index: number
  price?: number
  horsepower?: number | null
  fuelEconomy?: number
  savings?: number
  reliability?: number | null
}

interface SmartRecommendationsProps {
  cars: CarItem[]
  bestDealIndex?: number
  bestForPerformance?: number
  bestForEconomy?: number
  bestForReliability?: number
  savings?: number[]
}

export function SmartRecommendations({
  cars,
  bestDealIndex,
  bestForPerformance,
  bestForEconomy,
  bestForReliability,
}: SmartRecommendationsProps) {
  if (!cars?.length) return null
  const best = cars[bestDealIndex ?? 0]
  if (!best) return null
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-3">Smart Recommendations</h3>
      <p className="text-gray-300 text-sm">
        Best value: <span className="text-green-400 font-semibold">{best.name}</span>
        {best.price != null && ` at $${best.price.toLocaleString()}`}.
      </p>
    </div>
  )
}
