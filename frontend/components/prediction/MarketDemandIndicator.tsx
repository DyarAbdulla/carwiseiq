"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MarketDemand } from '@/lib/types'

interface MarketDemandIndicatorProps {
  demand: MarketDemand
}

export function MarketDemandIndicator({ demand }: MarketDemandIndicatorProps) {
  const demandColors = {
    high: 'bg-green-500/20 text-green-400 border-green-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  }

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={demandColors[demand.level]}>
                {demand.badge}
              </Badge>
              {demand.description && (
                <span className="text-sm text-[#94a3b8]">
                  {demand.description}
                </span>
              )}
            </div>
            <p className="text-xs text-[#94a3b8] mt-1">
              Market demand for this make/model combination
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}






