"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Lightbulb, Bell, CheckCircle } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { SellCarResponse } from '@/lib/types'

interface Alert {
  type: 'warning' | 'tip' | 'info' | 'success'
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface SmartAlertsProps {
  prediction: SellCarResponse
  marketData?: {
    averagePrice: number
    averageMileage: number
  }
  onScrollToSection?: (section: string) => void
}

function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss?: () => void }) {
  const alertStyles = {
    warning: 'bg-red-500/10 border-red-500/50 text-red-200',
    tip: 'bg-blue-500/10 border-blue-500/50 text-blue-200',
    info: 'bg-purple-500/10 border-purple-500/50 text-purple-200',
    success: 'bg-green-500/10 border-green-500/50 text-green-200'
  }

  const icons = {
    warning: <AlertTriangle className="h-4 w-4" />,
    tip: <Lightbulb className="h-4 w-4" />,
    info: <Bell className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Alert variant={alert.type} className={alertStyles[alert.type]}>
        <div className="flex items-start gap-3">
          {icons[alert.type]}
          <div className="flex-1">
            <AlertTitle>{alert.title}</AlertTitle>
            <AlertDescription className="mt-1">
              {alert.message}
              {alert.action && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-1 text-xs"
                  onClick={alert.action.onClick}
                >
                  {alert.action.label} →
                </Button>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </motion.div>
  )
}

export function SmartAlerts({ 
  prediction, 
  marketData,
  onScrollToSection 
}: SmartAlertsProps) {
  const alerts: Alert[] = []
  
  const { final_price, market_comparison, adjustments } = prediction
  const marketAvg = market_comparison?.market_average || marketData?.averagePrice || 0
  const differencePercent = market_comparison?.percentage_difference || 0
  
  // Overpriced alert
  if (market_comparison && (differencePercent > 50 || market_comparison.badge === 'Above Average')) {
    alerts.push({
      type: 'warning',
      title: 'Price Alert: Significantly Overpriced',
      message: `This car is ${Math.abs(differencePercent).toFixed(1)}% above market average. Similar models sell for ~${formatCurrency(marketAvg)}.`,
      action: onScrollToSection ? {
        label: 'See Similar Cars',
        onClick: () => onScrollToSection('similar-cars')
      } : undefined
    })
  }
  
  // Great deal alert
  if (market_comparison && differencePercent < -15 && market_comparison.badge === 'Below Market') {
    alerts.push({
      type: 'success',
      title: 'Great Deal Found!',
      message: `This price is ${Math.abs(differencePercent).toFixed(1)}% below market average. Act quickly!`
    })
  }
  
  // Low mileage tip (if we have mileage data from adjustments)
  const mileageAdjustment = adjustments.find(adj => adj.name.toLowerCase().includes('mileage'))
  if (mileageAdjustment && mileageAdjustment.amount > 0 && marketData?.averageMileage) {
    // This is a simplified check - in production, you'd get actual mileage from the request
    alerts.push({
      type: 'tip',
      title: 'Low Mileage Advantage',
      message: `Your car's low mileage is increasing its value. This is a strong selling point to highlight.`
    })
  }
  
  // Condition-based tips
  const conditionAdjustment = adjustments.find(adj => adj.name.toLowerCase().includes('condition'))
  if (conditionAdjustment) {
    if (conditionAdjustment.amount > 0) {
      alerts.push({
        type: 'tip',
        title: 'Excellent Condition Bonus',
        message: `Your car's excellent condition adds significant value. Consider professional photos to showcase this.`
      })
    } else if (conditionAdjustment.amount < -1000) {
      alerts.push({
        type: 'warning',
        title: 'Condition Impact',
        message: `The condition of your vehicle is reducing its value. Consider minor repairs or detailing to improve the selling price.`
      })
    }
  }
  
  // Accident history warning
  const accidentAdjustment = adjustments.find(adj => adj.name.toLowerCase().includes('accident'))
  if (accidentAdjustment && accidentAdjustment.amount < 0) {
    alerts.push({
      type: 'warning',
      title: 'Accident History Impact',
      message: `Accident history is reducing your car's value. Provide repair documentation to build buyer trust.`
    })
  }
  
  // Price tracking info (always show if we have market comparison)
  if (market_comparison) {
    alerts.push({
      type: 'info',
      title: 'Track Price Changes',
      message: 'Enable notifications to get alerts when similar cars drop in price.',
      action: {
        label: 'Enable Alerts',
        onClick: () => {
          // In production, this would open a notification settings modal
          if (typeof window !== 'undefined' && 'Notification' in window) {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                console.log('Notifications enabled')
              }
            })
          }
        }
      }
    })
  }
  
  // Limit to 3 most important alerts
  const displayAlerts = alerts.slice(0, 3)
  
  if (displayAlerts.length === 0) {
    return null
  }
  
  return (
    <div className="space-y-3 mb-6">
      <AnimatePresence>
        {displayAlerts.map((alert, index) => (
          <AlertCard key={index} alert={alert} />
        ))}
      </AnimatePresence>
    </div>
  )
}
