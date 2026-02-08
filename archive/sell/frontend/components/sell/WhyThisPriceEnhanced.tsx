"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { SellAdjustment } from '@/lib/types'

interface PriceFactorProps {
  icon: React.ReactNode
  label: string
  value: string
  impact: number // +$12,105
  explanation: string
  details?: string
}

function PriceFactor({ icon, label, value, impact, explanation, details }: PriceFactorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const maxImpact = Math.abs(impact) // For visual bar calculation
  
  return (
    <motion.div
      className="p-4 bg-gradient-to-r from-green-900/20 to-transparent border-l-4 border-green-500 rounded-lg cursor-pointer hover:bg-green-900/30 transition-colors"
      onClick={() => setIsExpanded(!isExpanded)}
      whileHover={{ x: 4 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-green-400">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-200">{label}</span>
              {value && <span className="text-sm text-gray-400">({value})</span>}
            </div>
            <p className="text-sm text-gray-400 mt-1">{explanation}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`font-bold ${impact > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {impact > 0 ? '+' : ''}{formatCurrency(impact)}
          </span>
          {details && (
            <ChevronDown 
              className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </div>
      
      {/* Visual impact bar */}
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden mt-3">
        <motion.div
          className={`absolute h-full ${impact > 0 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min((Math.abs(impact) / 50000) * 100, 100)}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </div>
      
      <AnimatePresence>
        {isExpanded && details && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-gray-700"
          >
            <p className="text-sm text-gray-300">{details}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface WhyThisPriceEnhancedProps {
  basePrice: number
  finalPrice: number
  adjustments: SellAdjustment[]
}

export function WhyThisPriceEnhanced({ 
  basePrice, 
  finalPrice, 
  adjustments 
}: WhyThisPriceEnhancedProps) {
  // Convert adjustments to price factors
  const factors = adjustments.map((adj) => {
    const isPositive = adj.amount > 0
    const Icon = isPositive ? TrendingUp : TrendingDown
    
    // Generate more detailed explanation based on adjustment type
    let explanation = adj.reason || `${adj.name} adjustment`
    let details: string | undefined
    
    if (adj.name.toLowerCase().includes('condition')) {
      details = "The condition of your vehicle significantly impacts its market value. Excellent condition vehicles command premium prices, while those in poor condition require significant deductions."
    } else if (adj.name.toLowerCase().includes('mileage')) {
      details = "Mileage is a key factor in vehicle valuation. Lower mileage typically increases value, while high mileage reduces it. The impact is calculated based on the vehicle's age and expected average mileage."
    } else if (adj.name.toLowerCase().includes('accident')) {
      details = "Accident history can significantly reduce a vehicle's value. The deduction depends on the severity of the accident and the number of damaged parts. Professional repairs may mitigate some of this impact."
    } else {
      details = `This adjustment reflects how ${adj.name.toLowerCase()} affects the market value of your vehicle.`
    }
    
    return {
      icon: <Icon className="h-5 w-5" />,
      label: adj.name,
      value: '',
      impact: adj.amount,
      explanation,
      details
    }
  })

  // Add base price as the starting point
  const allFactors = [
    {
      icon: <TrendingUp className="h-5 w-5" />,
      label: 'Base Model Prediction',
      value: '',
      impact: basePrice,
      explanation: 'Starting price based on make, model, year, and standard features',
      details: 'This is the base prediction from our machine learning model, calculated using your vehicle\'s core specifications and comparing them to similar vehicles in our database.'
    },
    ...factors
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
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
            <CardTitle className="text-white flex items-center gap-2">
              💡 Why This Price?
            </CardTitle>
            <p className="text-sm text-gray-400 mt-2">
              Click on any factor to learn more about how it affects your car's value
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {allFactors.map((factor, index) => (
              <motion.div
                key={index}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <PriceFactor {...factor} />
              </motion.div>
            ))}
            
            {/* Final price summary */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: allFactors.length * 0.1 + 0.2 }}
              className="mt-4 p-4 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-lg">Final Estimated Price</span>
                <span className="text-indigo-400 font-bold text-xl">
                  {formatCurrency(finalPrice)}
                </span>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
