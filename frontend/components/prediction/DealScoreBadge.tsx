"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DealScore } from '@/lib/types'
import { safeText, safeNumber } from '@/lib/safeDisplay'

interface DealScoreBadgeProps {
  dealScore: DealScore
  marketAverage: number
}

export function DealScoreBadge({ dealScore, marketAverage }: DealScoreBadgeProps) {
  const scoreKey = ['excellent', 'good', 'fair', 'poor'].includes(String(dealScore.score))
    ? dealScore.score
    : 'fair'
  const scoreColors: Record<string, string> = {
    excellent: 'bg-green-500/20 text-green-400 border-green-500/50',
    good: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    fair: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    poor: 'bg-red-500/20 text-red-400 border-red-500/50',
  }

  const badgeEmoji = safeText(dealScore.badge, '✅')
  const labelText = safeText(dealScore.label, 'Deal')
  const pct = safeNumber(dealScore.percentage, 0)
  const avg = safeNumber(marketAverage, 0)

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{badgeEmoji}</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={scoreColors[scoreKey] ?? scoreColors.fair}>
                  {labelText}
                </Badge>
                <span className="text-sm text-[#94a3b8]">
                  {pct}% {scoreKey === 'poor' ? 'above' : 'below'} market average
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1">
                Market average: ${avg.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}






