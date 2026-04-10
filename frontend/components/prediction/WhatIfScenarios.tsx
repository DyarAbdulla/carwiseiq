"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { AnimatedPriceReveal } from './AnimatedPriceReveal'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { CONDITIONS } from '@/lib/constants'

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

  const debouncedMileage = useDebounce(mileage, 500)
  const debouncedCondition = useDebounce(condition, 500)

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
        const updatedFeatures: CarFeatures = {
          ...featuresRef.current,
          mileage: debouncedMileage,
          condition: debouncedCondition,
        }
        const result = await apiClient.predictPrice(updatedFeatures)
        if (cancelled) return
        setWhatIfResult(result)
        setPriceDiff(result.predicted_price - initialPrediction.predicted_price)
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to update prediction:', error)
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

  const displayPrice = whatIfResult
    ? whatIfResult.predicted_price
    : initialPrediction.predicted_price

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
            {!loading && priceDiff !== 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-1 text-sm font-semibold shrink-0 ${
                  priceDiff > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {priceDiff > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {priceDiff > 0 ? '+' : ''}
                {formatCurrency(priceDiff)}
              </motion.div>
            )}
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
              {CONDITIONS.map((cond) => (
                <SelectItem key={cond} value={cond} className="text-white">
                  {cond}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Updated Price Display */}
        <div className="pt-4 border-t border-[#2a2d3a] relative min-h-[120px]">
          {loading ? (
            <div className="text-center py-8 flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-[#5B7FFF]" />
              <p className="text-sm text-[#94a3b8]">Recalculating price…</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Label className="text-[#94a3b8] text-sm">Updated Predicted Price</Label>
              <div className="mt-2">
                <AnimatedPriceReveal key={`${displayPrice}-${debouncedMileage}-${debouncedCondition}`} price={displayPrice} />
              </div>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
