"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { AnimatedPriceReveal } from './AnimatedPriceReveal'
import type { PredictionResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ValuationCertificateProps {
  result: PredictionResponse
  /** Short 1-line friendly explanation shown under the certificate */
  explanation?: string
}

function getConfidencePct(level?: 'high' | 'medium' | 'low'): number {
  switch (level) {
    case 'high': return 95
    case 'medium': return 75
    case 'low': return 55
    default: return 75
  }
}

/** Value Meter: Low / Fair / High. Derived from deal_analysis or deal_score. */
function getValueLevel(dealAnalysis?: string, dealScore?: { score: string }): 'Low' | 'Fair' | 'High' {
  const s = (dealAnalysis || dealScore?.score || 'fair').toLowerCase()
  if (s === 'excellent' || s === 'good') return 'High'
  if (s === 'poor') return 'Low'
  return 'Fair'
}

/** Position 0–100 for the value meter pointer. High=75, Fair=50, Low=25. */
function getValuePosition(level: 'Low' | 'Fair' | 'High'): number {
  switch (level) {
    case 'High': return 75
    case 'Fair': return 50
    case 'Low': return 25
    default: return 50
  }
}

export function ValuationCertificate({ result, explanation }: ValuationCertificateProps) {
  const low = result.confidence_interval?.lower ?? result.predicted_price * 0.85
  const high = result.confidence_interval?.upper ?? result.predicted_price * 1.15
  const confidencePct = getConfidencePct(result.confidence_level)
  const valueLevel = getValueLevel(result.deal_analysis, result.deal_score)
  const valuePos = getValuePosition(valueLevel)

  const defaultExplanation = result.market_comparison
    ? `About ${result.market_comparison.percentage_difference >= 0 ? '' : ''}${Math.abs(result.market_comparison.percentage_difference).toFixed(0)}% ${result.market_comparison.percentage_difference >= 0 ? 'above' : 'below'} market average for similar cars.`
    : 'Based on similar vehicles, mileage, and condition.'

  const line = explanation || defaultExplanation

  return (
    <Card className="border border-[#2a2d3a] bg-[#1a1d29] overflow-visible">
      <CardContent className="p-6 sm:p-8">
        {/* Price range (min–max) */}
        <div className="flex justify-between items-center text-sm text-[#94a3b8] mb-2">
          <span>Range: {formatCurrency(low)} – {formatCurrency(high)}</span>
          <Badge
            variant={result.confidence_level === 'high' ? 'default' : result.confidence_level === 'low' ? 'destructive' : 'secondary'}
            className="bg-white/10 text-white border-0"
          >
            {confidencePct}% confidence
          </Badge>
        </div>

        {/* Predicted price (highlighted, big) */}
        <div className="my-4">
          <AnimatedPriceReveal price={result.predicted_price} />
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Predicted value</p>
        </div>

        {/* Value Meter: Low ——●—— Fair —— High */}
        <div className="mt-6">
          <p className="text-xs text-[#94a3b8] mb-2">Value vs market</p>
          <div className="relative h-10 rounded-lg bg-[#0f1117] border border-[#2a2d3a] overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] sm:text-xs text-[#94a3b8]">
              <span>Low</span>
              <span>Fair</span>
              <span>High</span>
            </div>
            <motion.div
              className="absolute top-1/2 w-3 h-3 rounded-full bg-[#5B7FFF] ring-2 ring-white/30 shadow-lg z-10"
              initial={{ left: '50%' }}
              animate={{ left: `${valuePos}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              style={{ transform: 'translate(-50%, -50%)' }}
            />
          </div>
          <p className="text-xs text-[#94a3b8] mt-1.5 text-center">
            {valueLevel} — {valueLevel === 'High' ? 'Good value vs similar listings' : valueLevel === 'Low' ? 'Above typical market' : 'In line with market'}
          </p>
        </div>

        {/* 1-line friendly explanation */}
        <p className={cn(
          "mt-4 text-sm text-slate-500 dark:text-slate-400",
          "border-t border-[#2a2d3a] pt-4"
        )}>
          {line}
        </p>
      </CardContent>
    </Card>
  )
}
