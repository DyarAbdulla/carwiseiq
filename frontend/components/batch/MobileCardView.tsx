'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heart, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { BatchPredictionResult } from '@/lib/types'

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

interface MobileCardViewProps {
  results: ExtendedResult[]
  isFavorite: (index: number) => boolean
  onToggleFavorite: (index: number) => void
  onViewDetails: (index: number) => void
}

export function MobileCardView({
  results,
  isFavorite,
  onToggleFavorite,
  onViewDetails,
}: MobileCardViewProps) {
  return (
    <div className="space-y-4 md:hidden">
      {results.map((result, index) => (
        <Card
          key={index}
          className="border-[#2a2d3a] bg-[#1a1d29] hover:border-[#5B7FFF]/30 transition-colors"
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">
                  {result.car.make} {result.car.model}
                </h3>
                <p className="text-sm text-[#94a3b8]">{result.car.year}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleFavorite(index)}
                className={`h-8 w-8 p-0 ${isFavorite(index) ? 'text-red-500' : 'text-[#94a3b8]'}`}
              >
                <Heart className={`h-5 w-5 ${isFavorite(index) ? 'fill-red-500' : ''}`} />
              </Button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94a3b8]">Price</span>
                <span className="text-xl font-bold text-[#5B7FFF]">
                  {formatCurrency(result.predicted_price)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94a3b8]">Mileage</span>
                <span className="text-sm text-white">
                  {result.car.mileage.toLocaleString()} km
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#94a3b8]">Condition</span>
                <span className="text-sm text-white">{result.car.condition}</span>
              </div>
              {result.confidence_percent !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94a3b8]">Confidence</span>
                  <span
                    className={`text-sm font-medium ${result.confidence_percent >= 80
                        ? 'text-green-500'
                        : result.confidence_percent >= 60
                          ? 'text-yellow-500'
                          : 'text-red-500'
                      }`}
                  >
                    {result.confidence_percent}%
                  </span>
                </div>
              )}
              {result.deal_rating && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94a3b8]">Deal</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${result.deal_rating === 'Good'
                        ? 'bg-green-500/20 text-green-500'
                        : result.deal_rating === 'Poor'
                          ? 'bg-red-500/20 text-red-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}
                  >
                    {result.deal_rating}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full border-[#2a2d3a] hover:bg-[#2a2d3a]"
              onClick={() => onViewDetails(index)}
            >
              View Details
              <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
