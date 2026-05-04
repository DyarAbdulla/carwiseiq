"use client"

import { cn, formatCurrency } from '@/lib/utils'

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

function isAllNA(row: SpecRow): boolean {
  return row.values.every((v) => v == null || v === 'N/A' || v === '')
}

const headCell =
  'border-b border-white/[0.06] bg-[rgba(20,20,20,0.78)] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(20,20,20,0.55)]'
const cornerHead = `${headCell} sticky top-0 left-0 z-30 min-w-[7.5rem] shadow-[1px_0_0_rgba(255,255,255,0.05)]`
const colHead = `${headCell} sticky top-0 z-20 min-w-[8.75rem] max-w-[10rem]`

export function SpecificationTable({
  columnLabels,
  rows,
  bestDealIndex,
  mostExpensiveIndex,
  highlightBestInRow,
  showIcons: _showIcons,
}: SpecificationTableProps) {
  if (!rows?.length || !columnLabels?.length) return null

  const visibleRows = rows.filter((row) => !isAllNA(row))
  if (!visibleRows.length) return null

  const format = (row: SpecRow, v: string | number | null) => {
    if (v == null || v === 'N/A') return 'N/A'
    let s: string
    if (row.format) s = row.format(v)
    else if (typeof v === 'number' && row.label?.toLowerCase().includes('price')) s = formatCurrency(v)
    else s = String(v)
    if (row.suffix && !s.endsWith(row.suffix) && s !== 'N/A') s = s + row.suffix
    return s || 'N/A'
  }

  return (
    <div className="overflow-x-auto relative rounded-xl">
      <table className="w-full border-collapse text-sm bg-transparent">
        <thead>
          <tr>
            <th
              className={cn(
                cornerHead,
                'py-3 pe-4 ps-1 text-start text-xs font-semibold uppercase tracking-wider text-gray-400'
              )}
            >
              Spec
            </th>
            {columnLabels.map((l, i) => (
              <th
                key={i}
                className={cn(
                  colHead,
                  'px-2 py-3 text-start font-semibold text-white max-w-[10rem] truncate',
                  i === bestDealIndex && 'text-emerald-300 shadow-[inset_0_-1px_0_rgba(52,211,153,0.35)]'
                )}
              >
                <span className="relative inline-block max-w-full truncate align-bottom">
                  {l}
                  {i === bestDealIndex && (
                    <span
                      className="pointer-events-none absolute -inset-1 -z-10 rounded-lg opacity-90 shadow-[0_0_28px_rgba(34,197,94,0.35)] ring-1 ring-emerald-400/30"
                      aria-hidden
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-transparent">
          {visibleRows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.05] transition-colors hover:bg-violet-500/[0.06]">
              <td
                className={cn(
                  'sticky left-0 z-10 bg-[rgba(5,5,5,0.45)] py-3 pe-4 ps-1 text-start font-medium text-gray-400 backdrop-blur-md supports-[backdrop-filter]:bg-[rgba(5,5,5,0.25)]',
                  'shadow-[1px_0_0_rgba(255,255,255,0.04)]'
                )}
              >
                {row.label}
              </td>
              {row.values.map((v, ci) => {
                const isBest = highlightBestInRow && bestDealIndex === ci
                const isHigh = highlightBestInRow && mostExpensiveIndex === ci
                return (
                  <td
                    key={ci}
                    className={cn(
                      'max-w-[10rem] truncate bg-transparent px-2 py-3 text-start',
                      isBest &&
                        'font-semibold text-emerald-300 shadow-[inset_0_0_48px_rgba(34,197,94,0.06)] ring-1 ring-emerald-500/20',
                      isHigh && !isBest && 'text-amber-300/95',
                      !isBest && !isHigh && 'text-white'
                    )}
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
