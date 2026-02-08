"use client"

import { formatCurrency } from '@/lib/utils'

export interface SpecRow {
  label: string
  values: (string | number | null)[]
  suffix?: string
  format?: (v: string | number) => string
  higherIsBetter?: boolean
}

interface SpecificationTableProps {
  columnLabels: string[]
  rows: SpecRow[]
  bestDealIndex?: number
  mostExpensiveIndex?: number
  highlightBestInRow?: boolean
  showIcons?: boolean
}

export function SpecificationTable({
  columnLabels,
  rows,
  bestDealIndex,
  mostExpensiveIndex,
  highlightBestInRow,
  showIcons,
}: SpecificationTableProps) {
  if (!rows?.length || !columnLabels?.length) return null

  const format = (row: SpecRow, v: string | number | null) => {
    if (v == null) return '—'
    let s: string
    if (row.format) s = row.format(v)
    else if (typeof v === 'number' && row.label?.toLowerCase().includes('price')) s = formatCurrency(v)
    else s = String(v)
    if (row.suffix && !s.endsWith(row.suffix)) s = s + row.suffix
    return s || '—'
  }

  return (
    <div className="overflow-x-auto relative">
      {/* Green Glow behind Best Value Column */}
      {bestDealIndex !== undefined && (
        <div 
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to right, transparent ${bestDealIndex * (100 / columnLabels.length)}%, rgba(34, 197, 94, 0.1) ${bestDealIndex * (100 / columnLabels.length)}%, rgba(34, 197, 94, 0.1) ${(bestDealIndex + 1) * (100 / columnLabels.length)}%, transparent ${(bestDealIndex + 1) * (100 / columnLabels.length)}%)`,
          }}
        />
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left py-3 pr-4 text-xs uppercase tracking-wider text-gray-400 font-semibold">Spec</th>
            {columnLabels.map((l, i) => (
              <th 
                key={i} 
                className={`text-left py-3 px-2 text-white font-semibold max-w-[140px] truncate relative ${
                  i === bestDealIndex ? 'text-green-400' : ''
                }`}
              >
                {l}
                {i === bestDealIndex && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr 
              key={ri} 
              className="border-b border-white/5 hover:bg-white/5 transition-colors group"
            >
              <td className="py-3 pr-4 text-gray-400 font-medium">{row.label}</td>
              {row.values.map((v, ci) => {
                const isBest = highlightBestInRow && bestDealIndex === ci
                const isHigh = highlightBestInRow && mostExpensiveIndex === ci
                return (
                  <td
                    key={ci}
                    className={`py-3 px-2 max-w-[140px] truncate ${
                      isBest ? 'text-green-400 font-semibold' : isHigh ? 'text-amber-400' : 'text-white'
                    }`}
                  >
                    {format(row, v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
