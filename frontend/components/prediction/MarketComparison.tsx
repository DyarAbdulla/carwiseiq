"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { MarketComparison as MarketComparisonType } from '@/lib/types'

interface MarketComparisonProps {
  marketComparison: MarketComparisonType
  precision?: number
}

export function MarketComparison({ marketComparison, precision }: MarketComparisonProps) {
  const isAboveAverage = marketComparison.percentage_difference > 0

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white">Market Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="min-w-0 px-2">
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-1.5">Your Car</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis" title={formatCurrency(marketComparison.your_car)}>
              {formatCurrency(marketComparison.your_car)}
            </p>
          </div>
          <div className="min-w-0 px-2">
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-1.5">Market Average</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis" title={formatCurrency(marketComparison.market_average)}>
              {formatCurrency(marketComparison.market_average)}
            </p>
          </div>
          <div className="min-w-0 px-2">
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-1.5">Difference</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-500 whitespace-nowrap overflow-hidden text-ellipsis" title={`${isAboveAverage ? '+' : ''}${marketComparison.percentage_difference.toFixed(1)}%`}>
              {isAboveAverage ? '+' : ''}{marketComparison.percentage_difference.toFixed(1)}%
            </p>
            <Badge variant={isAboveAverage ? 'warning' : 'success'} className="mt-1.5 text-xs">
              {isAboveAverage ? 'Above' : 'Below'} Average
            </Badge>
          </div>
        </div>

        {/* Info banner for wide range */}
        {precision && precision > 30 && (
          <div className="mt-4 p-3 bg-blue-900/20 rounded border border-blue-500/50">
            <p className="text-sm">
              💡 <strong>Wide Range Explained:</strong> This prediction has a broader confidence interval, which may indicate less historical data for similar vehicles or higher market variability for this make/model combination.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

