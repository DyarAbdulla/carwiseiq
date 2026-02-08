"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { MarketComparison } from '@/lib/types'

interface DealAnalysisProps {
  dealAnalysis: 'excellent' | 'good' | 'fair' | 'poor'
  marketComparison: MarketComparison
  predictedPrice: number
}

export function DealAnalysis({ dealAnalysis, marketComparison, predictedPrice }: DealAnalysisProps) {
  const dealColors = {
    excellent: 'bg-green-500/20 text-green-400 border-green-500/50',
    good: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    fair: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    poor: 'bg-red-500/20 text-red-400 border-red-500/50',
  }

  const dealLabels = {
    excellent: 'Excellent Deal',
    good: 'Good Deal',
    fair: 'Fair Price',
    poor: 'Poor Deal',
  }

  const isAboveAverage = marketComparison.percentage_difference > 0
  const percentageText = `${isAboveAverage ? '+' : ''}${marketComparison.percentage_difference.toFixed(1)}%`
  
  // Calculate market position (0-100%)
  const marketRange = marketComparison.market_average * 0.4 // ±20% range
  const minPrice = marketComparison.market_average - marketRange
  const maxPrice = marketComparison.market_average + marketRange
  const position = Math.max(0, Math.min(100, ((predictedPrice - minPrice) / (maxPrice - minPrice)) * 100))

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Deal Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Badge className={dealColors[dealAnalysis]}>
            {dealLabels[dealAnalysis]}
          </Badge>
          <p className="text-sm text-[#94a3b8]">
            {percentageText} above market average
          </p>
        </div>

        {/* Market Position Bar */}
        <div className="relative h-12 bg-[#0f1117] rounded border border-[#2a2d3a]">
          {/* LOW marker */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8]">LOW</div>
          {/* HIGH marker */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8]">HIGH</div>
          {/* MARKET POSITION marker */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-[#94a3b8]">MARKET POSITION</div>
          
          {/* Orange bar showing position */}
          <div 
            className="absolute h-full bg-orange-500 rounded"
            style={{ width: `${position}%` }}
          />
        </div>

        {/* Price range text */}
        <p className="text-sm text-[#94a3b8]">
          Your Car: {formatCurrency(predictedPrice)} | Market Range: {formatCurrency(minPrice)} - {formatCurrency(maxPrice)}
        </p>

        {/* Description */}
        <p className="text-sm text-[#94a3b8]">
          This price is {dealAnalysis} and competitive. It&apos;s {percentageText} above the market average for similar cars ({formatCurrency(marketComparison.market_average)}). This is a reasonable price point.
        </p>
      </CardContent>
    </Card>
  )
}

