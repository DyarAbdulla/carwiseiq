"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { AnimatedPriceReveal } from './AnimatedPriceReveal'
import { formatCurrency } from '@/lib/utils'

interface WhatIfScenariosProps {
  initialFeatures: CarFeatures
  initialPrediction: PredictionResponse
  onUpdate?: (updates: Partial<CarFeatures>) => void
}

export function WhatIfScenarios({ 
  initialFeatures, 
  initialPrediction,
  onUpdate 
}: WhatIfScenariosProps) {
  const [mileage, setMileage] = useState(initialFeatures.mileage)
  const [condition, setCondition] = useState(initialFeatures.condition)
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [priceDiff, setPriceDiff] = useState(0)

  const updatePrediction = async () => {
    setLoading(true)
    try {
      const updatedFeatures: CarFeatures = {
        ...initialFeatures,
        mileage,
        condition,
      }
      const result = await apiClient.predictPrice(updatedFeatures)
      setPrediction(result)
      const diff = result.predicted_price - initialPrediction.predicted_price
      setPriceDiff(diff)
      
      if (onUpdate) {
        onUpdate({ mileage, condition })
      }
    } catch (error) {
      console.error('Failed to update prediction:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      updatePrediction()
    }, 500) // Debounce 500ms

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mileage, condition])

  const currentPrice = prediction?.predicted_price || initialPrediction.predicted_price
  const conditions = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor']

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-[#5B7FFF]" />
          What-If Scenarios
        </CardTitle>
        <CardDescription className="text-[#94a3b8]">
          Adjust mileage and condition to see how they affect the predicted price
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mileage Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-white">Mileage: {mileage.toLocaleString()} km</Label>
            {priceDiff !== 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-1 text-sm font-semibold ${
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
            max={500000}
            step={1000}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[#94a3b8]">
            <span>0 km</span>
            <span>500,000 km</span>
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
              {conditions.map((cond) => (
                <SelectItem key={cond} value={cond} className="text-white">
                  {cond}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Updated Price Display */}
        <div className="pt-4 border-t border-[#2a2d3a]">
          {loading ? (
            <div className="text-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin text-[#5B7FFF] mx-auto" />
              <p className="text-sm text-[#94a3b8] mt-2">Recalculating...</p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Label className="text-[#94a3b8] text-sm">Updated Predicted Price</Label>
              <div className="mt-2">
                <AnimatedPriceReveal price={currentPrice} />
              </div>
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

