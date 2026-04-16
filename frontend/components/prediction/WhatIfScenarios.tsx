"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
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
import { CONDITIONS, getConditionPriceMultiplier } from '@/lib/constants'

/** Quick mileage preview while the API runs (monotonic: lower km → higher price). */
function previewPriceFromMileage(
  baselinePrice: number,
  baselineMileage: number,
  newMileage: number
): number {
  if (!Number.isFinite(baselinePrice) || baselinePrice <= 0) return baselinePrice
  const b = Math.max(baselineMileage, 1)
  const m = Math.max(newMileage, 1)
  const factor = Math.sqrt(b / m)
  return Math.round(baselinePrice * Math.min(1.5, Math.max(0.55, factor)))
}

interface WhatIfScenariosProps {
  initialFeatures: CarFeatures
  initialPrediction: PredictionResponse
  onUpdate?: (updates: Partial<CarFeatures>) => void
}

export function WhatIfScenarios({ initialFeatures, initialPrediction }: WhatIfScenariosProps) {
  const [mileage, setMileage] = useState(initialFeatures.mileage)
  const [condition, setCondition] = useState(initialFeatures.condition)
  const [loading, setLoading] = useState(false)
  const [whatIfResult, setWhatIfResult] = useState<PredictionResponse | null>(null)
  const [priceDiff, setPriceDiff] = useState(0)

  const featuresRef = useRef(initialFeatures)
  useEffect(() => {
    featuresRef.current = initialFeatures
  }, [initialFeatures])

  const baselineRef = useRef({ mileage: initialFeatures.mileage, condition: initialFeatures.condition })
  useEffect(() => {
    baselineRef.current = {
      mileage: initialFeatures.mileage,
      condition: initialFeatures.condition,
    }
    setMileage(initialFeatures.mileage)
    setCondition(initialFeatures.condition)
    setWhatIfResult(null)
    setPriceDiff(0)
  }, [
    initialFeatures.make,
    initialFeatures.model,
    initialFeatures.year,
    initialFeatures.mileage,
    initialFeatures.condition,
    initialPrediction.predicted_price,
  ])

  const debouncedMileage = useDebounce(mileage, 250)
  const debouncedCondition = useDebounce(condition, 250)

  useEffect(() => {
    const base = baselineRef.current
    if (debouncedMileage === base.mileage && debouncedCondition === base.condition) {
      setWhatIfResult(null)
      setPriceDiff(0)
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
        const result = await apiClient.predictPrice(updatedFeatures, undefined, {
          usageSource: 'estimate',
        })
        if (cancelled) return
        const multWhatIf = getConditionPriceMultiplier(debouncedCondition)
        const multBaseline = getConditionPriceMultiplier(base.condition)
        const ratio = multBaseline !== 0 ? multWhatIf / multBaseline : 1
        const adjustedPrice = result.predicted_price * ratio
        setWhatIfResult({ ...result, predicted_price: adjustedPrice })
        setPriceDiff(adjustedPrice - initialPrediction.predicted_price)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to update prediction:', error)
          setWhatIfResult(null)
          setPriceDiff(0)
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
  }, [debouncedMileage, debouncedCondition, initialPrediction.predicted_price])

  const baseMileage = baselineRef.current.mileage
  const baseCondition = baselineRef.current.condition
  const atBaseline = mileage === baseMileage && condition === baseCondition

  const mileagePreview =
    !atBaseline &&
    condition === baseCondition &&
    mileage !== baseMileage
      ? previewPriceFromMileage(
          initialPrediction.predicted_price,
          baseMileage,
          mileage
        )
      : null

  const conditionOnlyPreview =
    !atBaseline &&
    mileage === baseMileage &&
    condition !== baseCondition
      ? Math.round(
          initialPrediction.predicted_price *
            (getConditionPriceMultiplier(condition) /
              Math.max(getConditionPriceMultiplier(baseCondition), 0.01))
        )
      : null

  const displayPrice = atBaseline
    ? initialPrediction.predicted_price
    : whatIfResult
      ? whatIfResult.predicted_price
      : mileagePreview ??
        conditionOnlyPreview ??
        initialPrediction.predicted_price

  const conditionOptions = useMemo(() => {
    if (condition && !CONDITIONS.includes(condition)) {
      return [condition, ...CONDITIONS]
    }
    return [...CONDITIONS]
  }, [condition])

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white">What-If Scenarios</CardTitle>
        <CardDescription className="text-[#94a3b8]">
          Adjust mileage and condition to see how they affect the predicted price
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mileage Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-white">
              Mileage: {mileage.toLocaleString()} km
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

        {/* Condition Select */}
        <div className="space-y-2">
          <Label className="text-white">Condition</Label>
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

        {/* Updated Price Display — price updates live; model refines in background */}
        <div className="pt-4 border-t border-[#2a2d3a] relative min-h-[120px]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Label className="text-[#94a3b8] text-sm">Updated Predicted Price</Label>
                {loading && (
                  <Loader2 className="h-4 w-4 animate-spin text-[#5B7FFF] shrink-0" aria-hidden />
                )}
              </div>
              {(() => {
                const delta = displayPrice - initialPrediction.predicted_price
                if (atBaseline || delta === 0) return null
                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center gap-1 text-sm font-semibold shrink-0 ${
                      delta > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                    title="Change vs. your original prediction"
                  >
                    {delta > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {delta > 0 ? '+' : ''}
                    {formatCurrency(delta)}
                  </motion.div>
                )
              })()}
            </div>
            <div className="mt-2">
              <motion.div
                key={Math.round(displayPrice)}
                initial={{ opacity: 0.92 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-500 bg-clip-text text-transparent"
              >
                {formatCurrency(displayPrice)}
              </motion.div>
              {!atBaseline && loading && (mileagePreview != null || conditionOnlyPreview != null) && (
                <p className="text-xs text-[#94a3b8] mt-2">Refining with full model…</p>
              )}
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
