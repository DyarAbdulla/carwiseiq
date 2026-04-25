"use client"

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import type { PredictionResponse } from '@/lib/types'
import { TrendingUp, TrendingDown, MapPin, Lightbulb, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { safeText } from '@/lib/safeDisplay'
import { formatPriceFactorImpactLabel } from '@/lib/priceFactorDisplay'
import { computeMarketPercentDiff } from '@/lib/marketPercentDiff'

interface SmartDealAnalystProps {
  result: PredictionResponse
}

function getMarketDiffPercent(result: PredictionResponse): number | null {
  const m = result.market_comparison
  if (!m) return null
  return computeMarketPercentDiff(m.your_car, m.market_average)
}

type DealStatus = 'great' | 'fair' | 'above'

function getDealStatus(result: PredictionResponse, pd: number | null): DealStatus {
  const score = result.deal_score?.score
  if (score) {
    const s = String(score).toLowerCase()
    if (s === 'excellent' || s === 'good') return 'great'
    if (s === 'poor') return 'above'
    return 'fair'
  }
  const analysis = result.deal_analysis
  if (analysis) {
    const a = String(analysis).toLowerCase()
    if (a === 'excellent' || a === 'good') return 'great'
    if (a === 'poor') return 'above'
    return 'fair'
  }
  if (pd != null && Number.isFinite(pd)) {
    if (pd <= -5) return 'great'
    if (pd >= 15) return 'above'
    return 'fair'
  }
  return 'fair'
}

function getGaugeNeedlePercent(result: PredictionResponse, pd: number | null): number {
  if (pd != null && Number.isFinite(pd)) {
    const span = 25
    const needle = 50 + (pd / span) * 50
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

export function SmartDealAnalyst({ result }: SmartDealAnalystProps) {
  const t = useTranslations('predict.result')
  const pd = useMemo(() => getMarketDiffPercent(result), [result])
  const dealStatus = getDealStatus(result, pd)
  const gaugePosition = getGaugeNeedlePercent(result, pd)

  const badgeLabel = useMemo(() => {
    if (result.deal_score?.label?.trim()) return result.deal_score.label.trim()
    if (dealStatus === 'great') return t('dealLabelGreat')
    if (dealStatus === 'above') return t('dealLabelAbove')
    return t('dealLabelFair')
  }, [result.deal_score?.label, dealStatus, t])

  const proTipText = useMemo(() => {
    if (dealStatus === 'above' && pd != null) {
      return t('proTipAbove', {
        offer: formatCurrency(result.predicted_price * 0.85),
      })
    }
    if (dealStatus === 'great') return t('proTipGreat')
    return t('proTipFair')
  }, [dealStatus, pd, result.predicted_price, t])

  const priceFactors = result.price_factors || []

  const getInsights = () => {
    const insights: {
      title: string
      value: string
      description: string
      icon: typeof ArrowUp
      color: string
    }[] = []

    const mileageFactor = priceFactors.find((f) => safeText(f.factor, '').toLowerCase().includes('mileage'))
    if (mileageFactor) {
      const direction = mileageFactor.direction
      insights.push({
        title: t('insightMileage'),
        value: formatPriceFactorImpactLabel(mileageFactor),
        description: safeText(mileageFactor.description, '') || t('insightMileageDesc'),
        icon: direction === 'up' ? ArrowUp : ArrowDown,
        color: direction === 'up' ? 'text-emerald-400' : 'text-amber-400',
      })
    }

    const locationFactor = priceFactors.find((f) => safeText(f.factor, '').toLowerCase().includes('location'))
    if (locationFactor) {
      insights.push({
        title: t('insightLocation'),
        value: formatPriceFactorImpactLabel(locationFactor),
        description: safeText(locationFactor.description, '') || t('insightLocationDesc'),
        icon: MapPin,
        color: 'text-sky-400',
      })
    } else {
      insights.push({
        title: t('insightLocation'),
        value: t('valueStable'),
        description: t('insightLocationDefault'),
        icon: MapPin,
        color: 'text-sky-400',
      })
    }

    const depreciationFactor = priceFactors.find((f) => {
      const name = safeText(f.factor, '').toLowerCase()
      return name.includes('year') || name.includes('age') || name.includes('depreciation')
    })
    if (depreciationFactor) {
      insights.push({
        title: t('insightValue'),
        value: t('valueGood'),
        description: safeText(depreciationFactor.description, '') || t('insightValueDesc'),
        icon: TrendingUp,
        color: 'text-emerald-400',
      })
    } else {
      insights.push({
        title: t('insightValue'),
        value: t('valueGood'),
        description: t('insightValueDefault'),
        icon: TrendingUp,
        color: 'text-emerald-400',
      })
    }

    const otherFactors = priceFactors.filter((f) => {
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
      const title = safeText(factor.factor, t('insightOther'))
      insights.push({
        title,
        value: formatPriceFactorImpactLabel(factor),
        description: safeText(factor.description, '') || t('insightOtherDesc'),
        icon: factor.direction === 'up' ? ArrowUp : ArrowDown,
        color: factor.direction === 'up' ? 'text-emerald-400' : 'text-amber-400',
      })
    }

    return insights.slice(0, 4)
  }

  const insights = getInsights()
  const gaugeLabels = { left: t('gaugeGreat'), mid: t('gaugeFair'), right: t('gaugeAbove') }

  return (
    <div className="space-y-6">
      <div className="glassCard p-8 sm:p-10">
        <div className="mt-2">
          <div className="relative w-full max-w-md mx-auto">
            <svg className="w-full h-32" viewBox="0 0 200 100">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(gaugePosition / 100) * 251.2} 251.2`}
                style={{ transform: 'scaleX(-1)', transformOrigin: '100px 50px' }}
              />
              {(() => {
                const angle = (gaugePosition / 100) * Math.PI
                const radius = 80
                const centerX = 100
                const centerY = 20
                const dotX = centerX + radius * Math.cos(Math.PI - angle)
                const dotY = centerY + radius * Math.sin(Math.PI - angle)
                return <circle cx={dotX} cy={dotY} r="6" fill="white" className="drop-shadow-lg" />
              })()}
            </svg>
            <div className="flex justify-between items-center mt-2 px-2">
              <span className="text-xs sm:text-sm text-emerald-400 font-medium">{gaugeLabels.left}</span>
              <span className="text-xs sm:text-sm text-sky-400 font-medium">{gaugeLabels.mid}</span>
              <span className="text-xs sm:text-sm text-amber-400 font-medium">{gaugeLabels.right}</span>
            </div>
            <div className="mt-4 text-center">
              <span
                className={cn(
                  'inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium',
                  dealStatus === 'great' && 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50',
                  dealStatus === 'fair' && 'bg-sky-500/20 text-sky-300 border border-sky-500/50',
                  dealStatus === 'above' && 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                )}
              >
                {dealStatus === 'great' && '✓ '}
                {dealStatus === 'fair' && '= '}
                {dealStatus === 'above' && '⚠ '}
                {badgeLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

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
                <div className={cn('p-2 rounded-lg bg-white/5', insight.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
                    {insight.value && (
                      <span className={cn('text-xs font-bold shrink-0', insight.color)}>{insight.value}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">{safeText(insight.description, '')}</p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(
          'glassCard p-6 border-l-4',
          'border-sky-500/50 bg-sky-500/5',
          dealStatus === 'above' && 'border-amber-500/50 bg-amber-500/5',
          dealStatus === 'great' && 'border-emerald-500/50 bg-emerald-500/5'
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'p-2 rounded-lg flex items-center justify-center',
              'bg-violet-500/20 text-violet-200',
              dealStatus === 'above' && 'bg-amber-500/20 text-amber-200',
              dealStatus === 'great' && 'bg-emerald-500/20 text-emerald-200'
            )}
          >
            <span className="text-lg leading-none me-1" aria-hidden>
              💡
            </span>
            <Lightbulb className="h-5 w-5 opacity-95" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-white mb-2 flex flex-wrap items-center gap-2">
              {t('proTipTitle')}
            </h4>
            <p className="text-sm text-slate-200/95 leading-relaxed">{proTipText}</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
