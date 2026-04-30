"use client"

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { MarketComparison as MarketComparisonType } from '@/lib/types'
import { computeMarketPercentDiff } from '@/lib/marketPercentDiff'
import { cn } from '@/lib/utils'

interface MarketComparisonProps {
  marketComparison: MarketComparisonType
  precision?: number
}

const CAP_PERCENT = 100

export function MarketComparison({ marketComparison, precision }: MarketComparisonProps) {
  const t = useTranslations('predict.result')

  const { displayPercent, isCapped, isAboveAverage } = useMemo(() => {
    const raw = computeMarketPercentDiff(
      marketComparison.your_car,
      marketComparison.market_average
    )
    const isAbove = raw > 0
    if (raw > CAP_PERCENT) {
      return { displayPercent: raw, isCapped: true, isAboveAverage: isAbove }
    }
    return { displayPercent: raw, isCapped: false, isAboveAverage: isAbove }
  }, [marketComparison.your_car, marketComparison.market_average])

  const sign = displayPercent > 0 ? '+' : displayPercent < 0 ? '−' : ''
  const absShown = Math.min(Math.abs(displayPercent), 9999)
  const percentLabel = isCapped ? t('marketDiffVeryHigh') : `${sign}${absShown.toFixed(1)}%`

  const pdRaw = computeMarketPercentDiff(
    marketComparison.your_car,
    marketComparison.market_average
  )
  let dealKey: 'great' | 'fair' | 'above' = 'fair'
  if (pdRaw != null && Number.isFinite(pdRaw)) {
    if (pdRaw <= -5) dealKey = 'great'
    else if (pdRaw >= 15) dealKey = 'above'
  }
  const statusLabel =
    dealKey === 'great' ? t('dealLabelGreat') : dealKey === 'above' ? t('dealLabelAbove') : t('dealLabelFair')

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white">{t('marketComparison')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[280px] text-sm">
            <tbody>
              <tr className="border-b border-white/10">
                <th className="text-start font-medium text-[#94a3b8] py-3 px-3 w-[42%]">
                  {t('marketYourCar')}
                </th>
                <td className="py-3 px-3 font-bold text-white tabular-nums">{formatCurrency(marketComparison.your_car)}</td>
              </tr>
              <tr className="border-b border-white/10">
                <th className="text-start font-medium text-[#94a3b8] py-3 px-3">{t('marketAverageLabel')}</th>
                <td className="py-3 px-3 font-bold text-white tabular-nums">
                  {formatCurrency(marketComparison.market_average)}
                </td>
              </tr>
              <tr className="border-b border-white/10">
                <th className="text-start font-medium text-[#94a3b8] py-3 px-3">{t('marketDifference')}</th>
                <td
                  className={cn(
                    'py-3 px-3 font-bold tabular-nums',
                    isAboveAverage ? 'text-red-400' : 'text-emerald-400'
                  )}
                  title={percentLabel}
                >
                  {percentLabel}
                </td>
              </tr>
              <tr>
                <th className="text-start font-medium text-[#94a3b8] py-3 px-3">{t('marketStatusCol')}</th>
                <td className="py-3 px-3">
                  <Badge
                    variant={dealKey === 'above' ? 'warning' : dealKey === 'great' ? 'success' : 'secondary'}
                    className="text-xs"
                  >
                    {statusLabel}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-[#94a3b8] leading-relaxed">{t('marketAverageExplainer')}</p>

        {isCapped && isAboveAverage && (
          <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-100/95 leading-relaxed">
            {t('marketCappedNote')}
          </div>
        )}

        {/* Info banner for wide range */}
        {precision && precision > 30 && (
          <div className="mt-2 p-3 bg-blue-900/20 rounded border border-blue-500/50">
            <p className="text-sm text-blue-100/90">
              {t('wideRangeHint')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
