'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import type { BatchPredictionResult } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface DealQualityTooltipProps {
  result: BatchPredictionResult & { deal_rating?: 'Good' | 'Fair' | 'Poor' }
  averagePrice: number
  children: React.ReactNode
}

export function DealQualityTooltip({ result, averagePrice, children }: DealQualityTooltipProps) {
  const dealRating = result.deal_rating || 'Fair'
  const priceDiff = result.predicted_price - averagePrice
  const priceDiffPercent = averagePrice > 0 ? (priceDiff / averagePrice) * 100 : 0

  let explanation = ''
  let recommendation = ''

  if (dealRating === 'Good') {
    explanation = `${Math.abs(priceDiffPercent).toFixed(1)}% below market average (${formatCurrency(Math.abs(priceDiff))} less)`
    recommendation = '✅ Great deal - Buy now'
  } else if (dealRating === 'Poor') {
    explanation = `${Math.abs(priceDiffPercent).toFixed(1)}% above market average (${formatCurrency(Math.abs(priceDiff))} more)`
    recommendation = '❌ Keep looking for better deals'
  } else {
    explanation = `Matches market average price`
    recommendation = '💬 Try negotiating 5-10%'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <div>
              <p className="font-semibold text-sm mb-1">Why {dealRating}?</p>
              <p className="text-xs text-gray-300">{explanation}</p>
            </div>
            <div className="border-t border-gray-600 pt-2">
              <p className="text-xs font-medium">Recommendation:</p>
              <p className="text-xs text-gray-300 mt-1">{recommendation}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
