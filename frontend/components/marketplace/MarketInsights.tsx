"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, TrendingDown as TrendingDownIcon, Flame, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface MarketInsightsProps {
  listingPrice: number
  averagePrice: number
  priceComparison: number // percentage difference
  marketDemand: 'high' | 'medium' | 'low'
  similarCarsCount?: number
  soldRecently?: number
}

export function MarketInsights({
  listingPrice,
  averagePrice,
  priceComparison,
  marketDemand,
  similarCarsCount = 0,
  soldRecently = 0,
}: MarketInsightsProps) {
  const isBelowMarket = priceComparison < 0
  const isAboveMarket = priceComparison > 0
  const absComparison = Math.abs(priceComparison)

  const demandBadges = {
    high: { color: 'bg-green-500/20 text-green-500 border-green-500/30', label: 'High Demand' },
    medium: { color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', label: 'Medium Demand' },
    low: { color: 'bg-red-500/20 text-red-500 border-red-500/30', label: 'Low Demand' },
  }

  const demandBadge = demandBadges[marketDemand]

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Market Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Average Price */}
        <div className="p-4 bg-[#2a2d3a] rounded-lg">
          <p className="text-sm text-[#94a3b8] mb-1">Average Price for Similar Cars</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-white">
              {formatCurrency(averagePrice)}
            </p>
            <span className="text-sm text-[#94a3b8]">
              ± {formatCurrency(averagePrice * 0.1)}
            </span>
          </div>
        </div>

        {/* Price Comparison */}
        <div className="p-4 bg-[#2a2d3a] rounded-lg">
          <p className="text-sm text-[#94a3b8] mb-2">Price Comparison</p>
          <div className="flex items-center gap-2">
            {isBelowMarket ? (
              <>
                <TrendingDownIcon className="h-5 w-5 text-green-500" />
                <span className="text-lg font-bold text-green-500">
                  {absComparison.toFixed(1)}% below market average
                </span>
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                  Great Deal
                </Badge>
              </>
            ) : isAboveMarket ? (
              <>
                <TrendingUp className="h-5 w-5 text-red-500" />
                <span className="text-lg font-bold text-red-500">
                  {absComparison.toFixed(1)}% above market average
                </span>
                <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
                  Higher Price
                </Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-bold text-yellow-500">
                  At market average
                </span>
              </>
            )}
          </div>
        </div>

        {/* Market Demand */}
        <div className="p-4 bg-[#2a2d3a] rounded-lg">
          <p className="text-sm text-[#94a3b8] mb-2">Market Demand</p>
          <div className="flex items-center gap-2">
            <Badge className={demandBadge.color}>
              {demandBadge.label}
            </Badge>
            {soldRecently > 0 && (
              <span className="text-sm text-white/70">
                {soldRecently} similar cars sold in last 30 days
              </span>
            )}
          </div>
        </div>

        {/* Similar Cars Price Range */}
        {similarCarsCount > 0 && (
          <div className="p-4 bg-[#2a2d3a] rounded-lg">
            <p className="text-sm text-[#94a3b8] mb-1">Similar Cars Price Range</p>
            <p className="text-white font-semibold">
              {formatCurrency(averagePrice * 0.85)} - {formatCurrency(averagePrice * 1.15)}
            </p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Based on {similarCarsCount} similar listings
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
