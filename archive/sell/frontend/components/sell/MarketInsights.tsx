"use client"

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, TrendingUp, TrendingDown, Clock, DollarSign } from 'lucide-react'
import type { SellCarResponse } from '@/lib/types'

interface MarketInsightsProps {
  make?: string
  model?: string
  location?: string
  marketComparison?: {
    market_average: number
    percentage_difference: number
  }
}

interface InsightItemProps {
  icon: React.ReactNode
  label: string
  value: string
  description: string
}

function InsightItem({ icon, label, value, description }: InsightItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-white/[0.02] backdrop-blur-sm rounded-lg border border-white/10"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/60 mb-1">{label}</p>
          <p className="text-lg font-bold text-white mb-1">{value}</p>
          <p className="text-xs text-white/50">{description}</p>
        </div>
      </div>
    </motion.div>
  )
}

export function MarketInsights({ 
  make, 
  model, 
  location,
  marketComparison 
}: MarketInsightsProps) {
  // Mock insights - in production, these would come from the backend
  const insights = {
    bestTimeToSell: {
      months: ['March', 'April'],
      priceIncrease: 12
    },
    demandTrend: {
      direction: 'decreasing' as 'increasing' | 'stable' | 'decreasing',
      advice: 'Consider selling soon to maximize value'
    },
    daysOnMarket: {
      average: 45,
      thisModel: 38
    },
    negotiationRoom: {
      typical: { min: 8, max: 15 },
      advice: 'Buyers typically offer 8-15% below asking price'
    },
    competitionLevel: {
      level: 'medium' as 'low' | 'medium' | 'high',
      activeListings: 23
    }
  }

  // Adjust based on market comparison if available
  if (marketComparison) {
    if (marketComparison.percentage_difference > 20) {
      insights.demandTrend.direction = 'decreasing'
      insights.demandTrend.advice = 'Price is above market - consider adjusting'
    } else if (marketComparison.percentage_difference < -10) {
      insights.demandTrend.direction = 'increasing'
      insights.demandTrend.advice = 'Great pricing - expect quick sale'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
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
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-purple-400" />
              Market Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Best time to sell */}
              <InsightItem
                icon={<Calendar className="h-5 w-5 text-green-400" />}
                label="Best Time to Sell"
                value={insights.bestTimeToSell.months.join(' - ')}
                description={`Prices ${insights.bestTimeToSell.priceIncrease}% higher`}
              />
              
              {/* Demand trend */}
              <InsightItem
                icon={
                  insights.demandTrend.direction === 'increasing' ? 
                  <TrendingUp className="h-5 w-5 text-green-400" /> :
                  insights.demandTrend.direction === 'decreasing' ?
                  <TrendingDown className="h-5 w-5 text-red-400" /> :
                  <TrendingUp className="h-5 w-5 text-yellow-400" />
                }
                label="Demand Trend"
                value={insights.demandTrend.direction.charAt(0).toUpperCase() + insights.demandTrend.direction.slice(1)}
                description={insights.demandTrend.advice}
              />
              
              {/* Days on market */}
              <InsightItem
                icon={<Clock className="h-5 w-5 text-blue-400" />}
                label="Days on Market"
                value={`${insights.daysOnMarket.thisModel} days`}
                description={`Average: ${insights.daysOnMarket.average} days`}
              />
              
              {/* Negotiation room */}
              <InsightItem
                icon={<DollarSign className="h-5 w-5 text-yellow-400" />}
                label="Negotiation Room"
                value={`${insights.negotiationRoom.typical.min}-${insights.negotiationRoom.typical.max}%`}
                description={insights.negotiationRoom.advice}
              />
            </div>
            
            {/* Competition meter */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Competition Level</span>
                <span className="text-sm font-medium text-gray-200">
                  {insights.competitionLevel.activeListings} active listings
                </span>
              </div>
              <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${
                    insights.competitionLevel.level === 'low' ? 'bg-green-500' :
                    insights.competitionLevel.level === 'medium' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ 
                    width: insights.competitionLevel.level === 'low' ? '33%' :
                           insights.competitionLevel.level === 'medium' ? '66%' : '100%'
                  }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
