"use client"

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import type { PredictionResponse } from '@/lib/types'
import { TrendingUp, TrendingDown, MapPin, Gauge, Lightbulb, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { safeText } from '@/lib/safeDisplay'
import { formatPriceFactorImpactLabel } from '@/lib/priceFactorDisplay'

interface SmartDealAnalystProps {
  result: PredictionResponse
}

/**
 * UI buckets for colors — prefer API `deal_score` / `deal_analysis`, else infer from
 * `market_comparison.percentage_difference` (same thresholds as backend market_analyzer).
 */
function getDealStatus(result: PredictionResponse): 'great' | 'fair' | 'above' {
  const score = result.deal_score?.score
  if (score) {
    const s = score.toLowerCase()
    if (s === 'excellent' || s === 'good') return 'great'
    if (s === 'poor') return 'above'
    return 'fair'
  }
  const analysis = result.deal_analysis
  if (analysis) {
    const a = analysis.toLowerCase()
    if (a === 'excellent' || a === 'good') return 'great'
    if (a === 'poor') return 'above'
    return 'fair'
  }
  const pd = result.market_comparison?.percentage_difference
  if (pd != null && Number.isFinite(pd)) {
    if (pd <= -5) return 'great'
    if (pd >= 15) return 'above'
    return 'fair'
  }
  return 'fair'
}

/**
 * Needle position on the semicircle: 0 = left (great / below market), 50 = center (fair), 100 = right (above market).
 * Driven by `market_comparison.percentage_difference` when present (same signal as deal_analysis on the server).
 */
function getGaugeNeedlePercent(result: PredictionResponse): number {
  const pdRaw = result.market_comparison?.percentage_difference
  if (pdRaw != null && Number.isFinite(pdRaw)) {
    const span = 25
    const needle = 50 + (pdRaw / span) * 50
    return Math.min(100, Math.max(0, needle))
  }

  const score = result.deal_score?.score
  const analysis = result.deal_analysis
  const impliedPd =
    score === 'excellent' || analysis === 'excellent'
      ? -17
      : score === 'good' || analysis === 'good'
        ? -8
        : score === 'poor' || analysis === 'poor'
          ? 18
          : 2
  const span = 25
  return Math.min(100, Math.max(0, 50 + (impliedPd / span) * 50))
}

/** Get gauge color based on status */
function getGaugeColor(status: 'great' | 'fair' | 'above'): string {
  switch (status) {
    case 'great': return 'from-green-500 to-emerald-500'
    case 'fair': return 'from-blue-500 to-indigo-500'
    case 'above': return 'from-amber-500 to-orange-500'
    default: return 'from-blue-500 to-indigo-500'
  }
}

export function SmartDealAnalyst({ result }: SmartDealAnalystProps) {
  const low = result.confidence_interval?.lower ?? result.predicted_price * 0.85
  const high = result.confidence_interval?.upper ?? result.predicted_price * 1.15
  const dealStatus = getDealStatus(result)
  const gaugePosition = getGaugeNeedlePercent(result)
  const gaugeColor = getGaugeColor(dealStatus)
  const badgeLabel =
    result.deal_score?.label?.trim() ||
    (dealStatus === 'great'
      ? 'Great Deal'
      : dealStatus === 'above'
        ? 'Above Market'
        : 'Fair Price')
  const marketComparison = result.market_comparison
  const priceFactors = result.price_factors || []

  // Calculate negotiation tip
  const getNegotiationTip = () => {
    if (dealStatus === 'above' && marketComparison) {
      const suggestedPrice = result.predicted_price * 0.85 // 15% below predicted
      return {
        type: 'negotiate' as const,
        message: `This car is listed ~${Math.abs(marketComparison.percentage_difference).toFixed(0)}% above average. Consider offering **${formatCurrency(suggestedPrice)}** as a starting point.`,
      }
    } else if (dealStatus === 'great') {
      return {
        type: 'alert' as const,
        message: `This is a great price. We recommend contacting the seller quickly.`,
      }
    } else {
      return {
        type: 'info' as const,
        message: `This price is in line with market averages. You can still negotiate, but the seller's price is reasonable.`,
      }
    }
  }

  const negotiationTip = getNegotiationTip()

  // Get insights from price factors
  const getInsights = () => {
    const insights = []

    // Mileage impact
    const mileageFactor = priceFactors.find(f =>
      safeText(f.factor, '').toLowerCase().includes('mileage'))
    if (mileageFactor) {
      const direction = mileageFactor.direction
      insights.push({
        title: 'Mileage Impact',
        value: formatPriceFactorImpactLabel(mileageFactor),
        description:
          safeText(mileageFactor.description, '') ||
          'Estimated vs. similar mileage bands in our listing data (USD).',
        icon: direction === 'up' ? ArrowUp : ArrowDown,
        color: direction === 'up' ? 'text-green-400' : 'text-amber-400',
      })
    }

    // Location impact
    const locationFactor = priceFactors.find(f =>
      safeText(f.factor, '').toLowerCase().includes('location'))
    if (locationFactor) {
      insights.push({
        title: 'Location Impact',
        value: 'Stable',
        description: safeText(locationFactor.description, '') || 'Location prices are trending stable.',
        icon: MapPin,
        color: 'text-blue-400',
      })
    } else {
      // Default location insight
      insights.push({
        title: 'Location Impact',
        value: 'Stable',
        description: 'Market prices in your area are stable.',
        icon: MapPin,
        color: 'text-blue-400',
      })
    }

    // Depreciation/Value retention
    const depreciationFactor = priceFactors.find(f => {
      const name = safeText(f.factor, '').toLowerCase()
      return name.includes('year') || name.includes('age') || name.includes('depreciation')
    })
    if (depreciationFactor) {
      insights.push({
        title: 'Value Retention',
        value: 'Good',
        description: safeText(depreciationFactor.description, '') || 'This model holds value well.',
        icon: TrendingUp,
        color: 'text-green-400',
      })
    } else {
      insights.push({
        title: 'Value Retention',
        value: 'Good',
        description: 'This model holds value well.',
        icon: TrendingUp,
        color: 'text-green-400',
      })
    }

    // Add any other significant factors
    const otherFactors = priceFactors.filter(f => {
      const name = safeText(f.factor, '').toLowerCase()
      return (
        !name.includes('mileage') &&
        !name.includes('location') &&
        !name.includes('year') &&
        !name.includes('age') &&
        !name.includes('depreciation')
      )
    }).slice(0, 1)

    if (otherFactors.length > 0 && insights.length < 4) {
      const factor = otherFactors[0]
      insights.push({
        title: safeText(factor.factor, 'Factor'),
        value: formatPriceFactorImpactLabel(factor),
        description:
          safeText(factor.description, '') ||
          `Estimated vs. similar listings in our data (USD).`,
        icon: factor.direction === 'up' ? ArrowUp : ArrowDown,
        color: factor.direction === 'up' ? 'text-green-400' : 'text-amber-400',
      })
    }

    return insights.slice(0, 4) // Max 4 insights
  }

  const insights = getInsights()

  return (
    <div className="space-y-6">
      {/* Deal Analysis Gauge Card */}
      <div className="glassCard p-8 sm:p-10">
        {/* Semi-Circle Gauge */}
        <div className="mt-4">
          <div className="relative w-full max-w-md mx-auto">
            {/* Gauge Track Background */}
            <svg className="w-full h-32" viewBox="0 0 200 100">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>

              {/* Background arc */}
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Filled arc based on position */}
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(gaugePosition / 100) * 251.2} 251.2`}
                style={{
                  transform: 'scaleX(-1)',
                  transformOrigin: '100px 50px'
                }}
              />

              {/* Indicator dot - positioned on arc */}
              {(() => {
                // Convert position (0-100) to angle (0 to 180 degrees)
                // Position 0% = left (angle 0), 50% = top (angle π/2), 100% = right (angle π)
                const angle = (gaugePosition / 100) * Math.PI // 0 to π
                const radius = 80
                const centerX = 100
                const centerY = 20 // Arc center is above the arc
                // Calculate position on semicircle (left to right)
                const dotX = centerX + radius * Math.cos(Math.PI - angle)
                const dotY = centerY + radius * Math.sin(Math.PI - angle)
                return (
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r="6"
                    fill="white"
                    className="drop-shadow-lg"
                  />
                )
              })()}
            </svg>

            {/* Labels */}
            <div className="flex justify-between items-center mt-2 px-2">
              <span className="text-xs sm:text-sm text-green-400 font-medium">Great Deal</span>
              <span className="text-xs sm:text-sm text-blue-400 font-medium">Fair Price</span>
              <span className="text-xs sm:text-sm text-amber-400 font-medium">Above Market</span>
            </div>

            {/* Current Status Badge — label from API deal_score when available */}
            <div className="mt-4 text-center">
              <span className={cn(
                "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium",
                dealStatus === 'great' && "bg-green-500/20 text-green-400 border border-green-500/50",
                dealStatus === 'fair' && "bg-blue-500/20 text-blue-400 border border-blue-500/50",
                dealStatus === 'above' && "bg-amber-500/20 text-amber-400 border border-amber-500/50"
              )}>
                {dealStatus === 'great' && '✓ '}
                {dealStatus === 'fair' && '= '}
                {dealStatus === 'above' && '⚠ '}
                {badgeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Smart Insights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {insights.map((insight, index) => {
          const Icon = insight.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glassCard p-5 hover-lift"
            >
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg bg-white/5", insight.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
                    {insight.value && (
                      <span className={cn("text-xs font-bold", insight.color)}>
                        {insight.value}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">
                    {safeText(insight.description, '')}
                  </p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 3. Negotiation Assistant */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(
          "glassCard p-6 border-l-4",
          negotiationTip.type === 'negotiate' && "border-amber-500/50 bg-amber-500/5",
          negotiationTip.type === 'alert' && "border-green-500/50 bg-green-500/5",
          negotiationTip.type === 'info' && "border-blue-500/50 bg-blue-500/5"
        )}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            "p-2 rounded-lg",
            negotiationTip.type === 'negotiate' && "bg-amber-500/20 text-amber-400",
            negotiationTip.type === 'alert' && "bg-green-500/20 text-green-400",
            negotiationTip.type === 'info' && "bg-blue-500/20 text-blue-400"
          )}>
            <Lightbulb className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <span>Pro Tip</span>
              {negotiationTip.type === 'negotiate' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/50">
                  Negotiation
                </span>
              )}
              {negotiationTip.type === 'alert' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/50">
                  Market Alert
                </span>
              )}
            </h4>
            <p className="text-sm text-[#94a3b8] leading-relaxed">
              {negotiationTip.message.split('**').map((part, i) =>
                i % 2 === 1 ? (
                  <strong key={i} className="text-white font-semibold">{part}</strong>
                ) : (
                  part
                )
              )}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
