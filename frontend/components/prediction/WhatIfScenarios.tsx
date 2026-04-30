"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { CONDITIONS } from '@/lib/constants'

interface WhatIfScenariosProps {
  initialFeatures: CarFeatures
  initialPrediction: PredictionResponse
  onUpdate?: (updates: Partial<CarFeatures>) => void
}

function scenarioKey(f: CarFeatures, predictedPrice: number) {
  return [
    f.make,
    f.model,
    String(f.year),
    String(f.trim || ''),
    String(predictedPrice),
  ].join('|')
}

export function WhatIfScenarios({ initialFeatures, initialPrediction }: WhatIfScenariosProps) {
  const t = useTranslations('predict.result')
  const [mileage, setMileage] = useState(initialFeatures.mileage)
  const [condition, setCondition] = useState(initialFeatures.condition)
  const [loading, setLoading] = useState(false)
  const [whatIfResult, setWhatIfResult] = useState<PredictionResponse | null>(null)

  const featuresRef = useRef(initialFeatures)
  useEffect(() => {
    featuresRef.current = initialFeatures
  }, [initialFeatures])

  const baselineKeyRef = useRef(scenarioKey(initialFeatures, initialPrediction.predicted_price))
  const baselineMileageRef = useRef(initialFeatures.mileage)
  const baselineConditionRef = useRef(initialFeatures.condition)

  const debouncedMileage = useDebounce(mileage, 500)
  const debouncedCondition = useDebounce(condition, 500)

  const sessionKey = useMemo(
    () => scenarioKey(initialFeatures, initialPrediction.predicted_price),
    [
      initialFeatures.make,
      initialFeatures.model,
      initialFeatures.year,
      initialFeatures.trim,
      initialPrediction.predicted_price,
    ]
  )

  // Reset only when this prediction session changes — not on unrelated parent re-renders
  useEffect(() => {
    if (sessionKey === baselineKeyRef.current) return
    baselineKeyRef.current = sessionKey
    baselineMileageRef.current = initialFeatures.mileage
    baselineConditionRef.current = initialFeatures.condition
    setMileage(initialFeatures.mileage)
    setCondition(initialFeatures.condition)
    setWhatIfResult(null)
  }, [sessionKey, initialFeatures.mileage, initialFeatures.condition])

  useEffect(() => {
    const baseM = baselineMileageRef.current
    const baseC = baselineConditionRef.current
    if (debouncedMileage === baseM && debouncedCondition === baseC) {
      setWhatIfResult(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const run = async () => {
      try {
        const baseFeatures = featuresRef.current
        const updatedFeatures: CarFeatures = {
          ...baseFeatures,
          mileage: debouncedMileage,
          condition: debouncedCondition,
          trim: baseFeatures.trim?.trim() || '__none__',
          location: baseFeatures.location?.trim() || 'Erbil',
        }
        // Model already encodes mileage + condition; use API result as-is (no double adjustment)
        const result = await apiClient.predictPrice(updatedFeatures, undefined, {
          usageSource: 'estimate',
        })
        if (cancelled) return
        setWhatIfResult(result)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to update prediction:', error)
          setWhatIfResult(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [debouncedMileage, debouncedCondition])

  const baseMileage = baselineMileageRef.current
  const baseCondition = baselineConditionRef.current
  const atBaseline = mileage === baseMileage && condition === baseCondition

  const displayPrice = atBaseline
    ? initialPrediction.predicted_price
    : (whatIfResult?.predicted_price ?? initialPrediction.predicted_price)

  const baselinePriceRounded = Math.round(initialPrediction.predicted_price)
  const updatedPriceRounded = Math.round(displayPrice)
  const deltaRounded = updatedPriceRounded - baselinePriceRounded

  const conditionOptions = useMemo(() => {
    if (condition && !CONDITIONS.includes(condition)) {
      return [condition, ...CONDITIONS]
    }
    return [...CONDITIONS]
  }, [condition])

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white">{t('whatIfTitle')}</CardTitle>
        <CardDescription className="text-[#94a3b8]">
          {t('whatIfDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-white">
              {t('whatIfMileage', { km: mileage.toLocaleString() })}
            </Label>
          </div>
          <Slider
            value={[mileage]}
            onValueChange={([value]) => setMileage(value)}
            min={0}
            max={1000000}
            step={1000}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[#94a3b8]">
            <span>0 km</span>
            <span>1,000,000 km</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-white">{t('whatIfCondition')}</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger className="border-[#2a2d3a] bg-[#1a1d29]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
              {conditionOptions.map((cond) => (
                <SelectItem key={cond} value={cond} className="text-white">
                  {cond}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4 border-t border-[#2a2d3a] relative min-h-[140px]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Label className="text-[#94a3b8] text-sm">{t('whatIfComparisonLabel')}</Label>
              {loading && !atBaseline && (
                <Loader2
                  className="h-4 w-4 animate-spin text-violet-400 shrink-0"
                  aria-label={t('whatIfRecalculating')}
                />
              )}
            </div>

            <p className="text-base sm:text-lg text-white font-medium">
              <span className="text-[#94a3b8] font-normal">{t('whatIfOldLabel')} </span>
              <span className="tabular-nums">{formatCurrency(baselinePriceRounded)}</span>
              <span className="text-[#94a3b8] mx-1.5">→</span>
              <span className="text-[#94a3b8] font-normal">{t('whatIfNewLabel')} </span>
              <motion.span
                key={`${updatedPriceRounded}-${loading ? 'l' : 'i'}`}
                initial={{ opacity: 0.85, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="tabular-nums bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent"
              >
                {formatCurrency(updatedPriceRounded)}
              </motion.span>
            </p>

            {!atBaseline && (
              <p
                className={`text-sm font-semibold tabular-nums ${
                  deltaRounded > 0 ? 'text-emerald-400' : deltaRounded < 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {t('whatIfChangeLabel')}{' '}
                {deltaRounded > 0 ? '+' : deltaRounded < 0 ? '−' : ''}
                {deltaRounded !== 0 ? formatCurrency(Math.abs(deltaRounded)) : formatCurrency(0)}
                {deltaRounded > 0 ? (
                  <TrendingUp className="inline h-4 w-4 ms-1 align-text-bottom" />
                ) : deltaRounded < 0 ? (
                  <TrendingDown className="inline h-4 w-4 ms-1 align-text-bottom" />
                ) : null}
              </p>
            )}

            <div className={`transition-opacity ${loading && !atBaseline ? 'opacity-75' : 'opacity-100'}`}>
              <motion.div
                key={updatedPriceRounded}
                initial={{ opacity: 0.88, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22 }}
                className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-500 bg-clip-text text-transparent"
              >
                {formatCurrency(updatedPriceRounded)}
              </motion.div>
              <p className="text-[11px] text-[#94a3b8] mt-1">{t('whatIfHeroCaption')}</p>
            </div>

            {!atBaseline && loading && (
              <p className="text-xs text-violet-300/90">{t('whatIfRecalculating')}</p>
            )}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
