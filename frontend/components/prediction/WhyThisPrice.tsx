"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { PriceFactor } from '@/lib/types'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface WhyThisPriceProps {
  factors: PriceFactor[]
}

export function WhyThisPrice({ factors }: WhyThisPriceProps) {
  if (!factors || factors.length === 0) {
    return null
  }

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white text-lg">💡 Why This Price?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[#94a3b8] mb-4">
          Top factors influencing this price prediction:
        </p>
        <div className="space-y-2">
          {factors.slice(0, 6).map((factor, index) => {
            const isPositive = factor.direction === 'up'
            const Icon = isPositive ? TrendingUp : TrendingDown
            const color = isPositive ? 'text-green-400' : 'text-red-400'
            const bgColor = isPositive ? 'bg-green-500/10' : 'bg-red-500/10'

            return (
              <div
                key={index}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg ${bgColor} border border-[#2a2d3a] gap-2 sm:gap-0`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
                  <Icon className={`h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap">
                      <span className="text-white font-medium text-sm sm:text-base">{factor.factor}</span>
                      {factor.description && (
                        <Badge variant="secondary" className="text-xs w-fit">
                          {factor.description}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`font-semibold ${color} ml-0 sm:ml-2 flex-shrink-0 text-sm sm:text-base`}>
                  {isPositive ? '+' : '-'}{formatCurrency(Math.abs(factor.impact))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

