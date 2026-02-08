"use client"

import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import type { PredictionResponse } from '@/lib/types'
import { TrendingUp, TrendingDown, MapPin, Gauge, Lightbulb, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SmartDealAnalystProps {
  result: PredictionResponse
}

/** Get deal status: 'great' | 'fair' | 'above' */
function getDealStatus(dealAnalysis?: string, dealScore?: { score: string }): 'great' | 'fair' | 'above' {
  const s = (dealAnalysis || dealScore?.score || 'fair').toLowerCase()
  if (s === 'excellent' || s === 'good') return 'great'
  if (s === 'poor') return 'above'
  return 'fair'
}

/** Get position 0-100 for gauge: great=75, fair=50, above=25 */
function getGaugePosition(status: 'great' | 'fair' | 'above'): number {
  switch (status) {
    case 'great': return 75
    case 'fair': return 50
    case 'above': return 25
    default: return 50
  }
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
  const dealStatus = getDealStatus(result.deal_analysis, result.deal_score)
  const gaugePosition = getGaugePosition(dealStatus)
  const gaugeColor = getGaugeColor(dealStatus)
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
    const mileageFactor = priceFactors.find(f => f.factor.toLowerCase().includes('mileage'))
    if (mileageFactor) {
      const impact = Math.abs(mileageFactor.impact)
      const direction = mileageFactor.direction
      insights.push({
        title: 'Mileage Impact',
        value: `${direction === 'up' ? '+' : '-'}${impact.toFixed(1)}%`,
        description: mileageFactor.description || `Low mileage ${direction === 'up' ? 'increased' : 'decreased'} value by ~${impact.toFixed(0)}%.`,
        icon: direction === 'up' ? ArrowUp : ArrowDown,
        color: direction === 'up' ? 'text-green-400' : 'text-amber-400',
      })
    }

    // Location impact
    const locationFactor = priceFactors.find(f => f.factor.toLowerCase().includes('location'))
    if (locationFactor) {
      insights.push({
        title: 'Location Impact',
        value: 'Stable',
        description: locationFactor.description || 'Location prices are trending stable.',
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
    const depreciationFactor = priceFactors.find(f =>
      f.factor.toLowerCase().includes('year') ||
      f.factor.toLowerCase().includes('age') ||
      f.factor.toLowerCase().includes('depreciation')
    )
    if (depreciationFactor) {
      insights.push({
        title: 'Value Retention',
        value: 'Good',
        description: depreciationFactor.description || 'This model holds value well.',
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
    const otherFactors = priceFactors.filter(f =>
      !f.factor.toLowerCase().includes('mileage') &&
      !f.factor.toLowerCase().includes('location') &&
      !f.factor.toLowerCase().includes('year') &&
      !f.factor.toLowerCase().includes('age') &&
      !f.factor.toLowerCase().includes('depreciation')
    ).slice(0, 1)

    if (otherFactors.length > 0 && insights.length < 4) {
      const factor = otherFactors[0]
      insights.push({
        title: factor.factor,
        value: `${factor.direction === 'up' ? '+' : '-'}${Math.abs(factor.impact).toFixed(1)}%`,
        description: factor.description || `${factor.factor} ${factor.direction === 'up' ? 'increased' : 'decreased'} value.`,
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

            {/* Current Status Badge */}
            <div className="mt-4 text-center">
              <span className={cn(
                "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium",
                dealStatus === 'great' && "bg-green-500/20 text-green-400 border border-green-500/50",
                dealStatus === 'fair' && "bg-blue-500/20 text-blue-400 border border-blue-500/50",
                dealStatus === 'above' && "bg-amber-500/20 text-amber-400 border border-amber-500/50"
              )}>
                {dealStatus === 'great' && '✓ Great Deal'}
                {dealStatus === 'fair' && '= Fair Price'}
                {dealStatus === 'above' && '⚠ Above Market'}
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
                    {insight.description}
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
