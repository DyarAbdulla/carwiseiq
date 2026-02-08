"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DealScore } from '@/lib/types'

interface DealScoreBadgeProps {
  dealScore: DealScore
  marketAverage: number
}

export function DealScoreBadge({ dealScore, marketAverage }: DealScoreBadgeProps) {
  const scoreColors = {
    excellent: 'bg-green-500/20 text-green-400 border-green-500/50',
    good: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    fair: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    poor: 'bg-red-500/20 text-red-400 border-red-500/50',
  }

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{dealScore.badge}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={scoreColors[dealScore.score]}>
                  {dealScore.label}
                </Badge>
                <span className="text-sm text-[#94a3b8]">
                  {dealScore.percentage}% {dealScore.score === 'poor' ? 'above' : 'below'} market average
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1">
                Market average: ${marketAverage.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}






