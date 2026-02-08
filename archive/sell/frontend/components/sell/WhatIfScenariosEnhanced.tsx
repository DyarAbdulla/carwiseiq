"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { Repeat, MapPin, Calendar, Star, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { SellCarResponse } from '@/lib/types'

interface WhatIfScenariosEnhancedProps {
  basePrediction: SellCarResponse
  onScenarioChange?: (updates: Partial<{ location: string; mileage: number; condition: string }>) => void
  initialLocation?: string
  initialMileage?: number
  initialCondition?: string
}

interface Scenario {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  options: {
    value: string
    label: string
    priceChange: number
  }[]
}

function ScenarioCard({ 
  scenario, 
  isActive, 
  onActivate, 
  onOptionSelect 
}: { 
  scenario: Scenario
  isActive: boolean
  onActivate: () => void
  onOptionSelect: (option: Scenario['options'][0]) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        isActive
          ? 'border-blue-500/50 bg-blue-500/10'
          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
      }`}
      onClick={onActivate}
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="text-blue-400">{scenario.icon}</div>
        <div className="flex-1">
          <h4 className="font-semibold text-white">{scenario.title}</h4>
          <p className="text-xs text-gray-400">{scenario.description}</p>
        </div>
      </div>
      
      {isActive && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 space-y-2"
        >
          {scenario.options.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation()
                onOptionSelect(option)
              }}
              className="w-full text-left p-2 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">{option.label}</span>
                <span className={`text-sm font-semibold ${
                  option.priceChange > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {option.priceChange > 0 ? '+' : ''}{formatCurrency(option.priceChange)}
                </span>
              </div>
            </button>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}

export function WhatIfScenariosEnhanced({
  basePrediction,
  onScenarioChange,
  initialLocation = '',
  initialMileage = 0,
  initialCondition = 'Good'
}: WhatIfScenariosEnhancedProps) {
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const [mileage, setMileage] = useState(initialMileage || basePrediction.base_price / 100) // Mock mileage
  const [condition, setCondition] = useState(initialCondition)
  const [selectedLocation, setSelectedLocation] = useState(initialLocation)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  
  const scenarios: Scenario[] = [
    {
      id: 'location',
      icon: <MapPin className="h-5 w-5" />,
      title: 'Different Location',
      description: 'See how location affects price',
      options: [
        { value: 'baghdad', label: 'Baghdad', priceChange: 2100 },
        { value: 'erbil', label: 'Erbil', priceChange: 1800 },
        { value: 'basra', label: 'Basra', priceChange: -400 },
        { value: 'mosul', label: 'Mosul', priceChange: -200 }
      ]
    },
    {
      id: 'time',
      icon: <Calendar className="h-5 w-5" />,
      title: 'Future Value',
      description: 'Predicted depreciation over time',
      options: [
        { value: '6months', label: 'In 6 months', priceChange: -850 },
        { value: '1year', label: 'In 1 year', priceChange: -1650 },
        { value: '2years', label: 'In 2 years', priceChange: -3200 },
        { value: '3years', label: 'In 3 years', priceChange: -4800 }
      ]
    },
    {
      id: 'features',
      icon: <Star className="h-5 w-5" />,
      title: 'Feature Additions',
      description: 'Value of premium features',
      options: [
        { value: 'sunroof', label: 'Sunroof', priceChange: 800 },
        { value: 'leather', label: 'Leather Seats', priceChange: 600 },
        { value: 'navigation', label: 'Navigation System', priceChange: 400 },
        { value: 'backup-camera', label: 'Backup Camera', priceChange: 300 }
      ]
    }
  ]

  // Calculate updated price
  let priceChange = 0
  let updatedPrice = basePrediction.final_price

  // Location change
  if (selectedLocation) {
    const locationOption = scenarios[0].options.find(opt => opt.value === selectedLocation)
    if (locationOption) priceChange += locationOption.priceChange
  }

  // Time depreciation
  if (selectedTime) {
    const timeOption = scenarios[1].options.find(opt => opt.value === selectedTime)
    if (timeOption) priceChange += timeOption.priceChange
  }

  // Feature addition
  if (selectedFeature) {
    const featureOption = scenarios[2].options.find(opt => opt.value === selectedFeature)
    if (featureOption) priceChange += featureOption.priceChange
  }

  // Mileage adjustment (simplified calculation)
  const mileageDiff = mileage - (initialMileage || 50000)
  if (Math.abs(mileageDiff) > 1000) {
    priceChange += (mileageDiff / 10000) * -200 // -$200 per 10k km
  }

  // Condition adjustment
  const conditionMultipliers: Record<string, number> = {
    'Excellent': 0.05,
    'Good': 0,
    'Fair': -0.10,
    'Poor': -0.25
  }
  if (condition !== initialCondition) {
    const baseChange = basePrediction.base_price * (conditionMultipliers[condition] - (conditionMultipliers[initialCondition] || 0))
    priceChange += baseChange
  }

  updatedPrice = basePrediction.final_price + priceChange
  updatedPrice = Math.max(updatedPrice, 100) // Minimum $100

  const handleScenarioChange = (scenarioId: string, option: Scenario['options'][0]) => {
    if (scenarioId === 'location') {
      setSelectedLocation(option.value)
      setSelectedTime(null)
      setSelectedFeature(null)
    } else if (scenarioId === 'time') {
      setSelectedTime(option.value)
      setSelectedLocation('')
      setSelectedFeature(null)
    } else if (scenarioId === 'features') {
      setSelectedFeature(option.value)
      setSelectedLocation('')
      setSelectedTime(null)
    }

    if (onScenarioChange) {
      onScenarioChange({
        location: scenarioId === 'location' ? option.value : undefined,
        mileage: scenarioId === 'location' ? undefined : mileage
      })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <div className="glassBorder rounded-2xl">
        <Card
          className="glassCard rounded-2xl"
          style={{
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            filter: 'none',
          }}
        >
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              What-If Scenarios
            </CardTitle>
            <p className="text-sm text-gray-400">
              Adjust parameters to see how they affect the predicted price
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mileage and Condition Sliders */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Mileage: {mileage.toLocaleString()} km</Label>
                <Slider
                  value={[mileage]}
                  onValueChange={([value]) => setMileage(value)}
                  min={0}
                  max={300000}
                  step={1000}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Condition</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Excellent">Excellent</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                    <SelectItem value="Poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {scenarios.map((scenario) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  isActive={activeScenario === scenario.id}
                  onActivate={() => setActiveScenario(activeScenario === scenario.id ? null : scenario.id)}
                  onOptionSelect={(option) => handleScenarioChange(scenario.id, option)}
                />
              ))}
            </div>

            {/* Updated Price Display */}
            {(activeScenario || priceChange !== 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Updated Predicted Price</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-400">
                      {formatCurrency(updatedPrice)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {priceChange > 0 ? '+' : ''}{formatCurrency(priceChange)} from base
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
