"use client"

interface ChartDataItem {
  name: string
  shortName?: string
  price: number
  horsepower?: number | null
  fuelEconomy?: number
  fullName?: string
  isBestDeal?: boolean
  isMostExpensive?: boolean
}

interface ComparisonChartProps {
  data: ChartDataItem[]
}

export function ComparisonChart({ data }: ComparisonChartProps) {
  if (!data?.length) return null
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Price &amp; Specs</h3>
      <div className="flex flex-wrap gap-4">
        {data.map((d, i) => (
          <div
            key={i}
            className="predict-glass rounded-xl px-4 py-3 min-w-[120px] transition-colors hover:ring-1 hover:ring-violet-500/25"
          >
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-1 truncate">{d.name}</p>
            <p className="text-white text-lg font-semibold">${d.price?.toLocaleString() ?? '—'}</p>
            {d.horsepower != null && <p className="text-xs text-gray-400 mt-1">{d.horsepower} hp</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
