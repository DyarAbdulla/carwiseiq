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
  const percentLabel = isCapped
    ? t('marketDiffVeryHigh')
    : `${sign}${absShown.toFixed(1)}%`

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white">{t('marketComparison')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="min-w-0 px-2">
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-1.5">{t('marketYourCar')}</p>
            <p
              className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis"
              title={formatCurrency(marketComparison.your_car)}
            >
              {formatCurrency(marketComparison.your_car)}
            </p>
          </div>
          <div className="min-w-0 px-2">
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-1.5">{t('marketAverageLabel')}</p>
            <p
              className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis"
              title={formatCurrency(marketComparison.market_average)}
            >
              {formatCurrency(marketComparison.market_average)}
            </p>
          </div>
          <div className="min-w-0 px-2">
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-1.5">{t('marketDifference')}</p>
            <p
              className={cn(
                'text-lg sm:text-xl md:text-2xl font-bold whitespace-nowrap overflow-hidden text-ellipsis',
                isAboveAverage ? 'text-red-400' : 'text-emerald-400'
              )}
              title={percentLabel}
            >
              {percentLabel}
            </p>
            <Badge
              variant={isAboveAverage ? 'warning' : 'success'}
              className="mt-1.5 text-xs"
            >
              {isAboveAverage ? t('aboveAverage') : t('belowAverage')}
            </Badge>
          </div>
        </div>

        {isCapped && isAboveAverage && (
          <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-100/95 leading-relaxed">
            {t('marketCappedNote')}
          </div>
        )}

        {isAboveAverage && !isCapped && (
          <p className="text-xs text-[#94a3b8] leading-relaxed">{t('marketAboveExplanation')}</p>
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
