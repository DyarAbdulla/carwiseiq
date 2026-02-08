"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { History, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
// Simple date formatting function (replaces date-fns)
function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  let result = ''
  if (diffMins < 1) result = 'just now'
  else if (diffMins < 60) result = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  else if (diffHours < 24) result = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  else if (diffDays < 7) result = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  else result = date.toLocaleDateString()
  
  return result
}
import type { SellCarResponse } from '@/lib/types'

interface PredictionHistoryItem extends SellCarResponse {
  timestamp: string
  carDetails?: {
    make?: string
    model?: string
    year?: number
  }
}

interface PredictionHistoryProps {
  currentPrediction?: SellCarResponse
  onLoadPrediction?: (prediction: PredictionHistoryItem) => void
}

export function PredictionHistory({ 
  currentPrediction,
  onLoadPrediction 
}: PredictionHistoryProps) {
  const [history, setHistory] = useState<PredictionHistoryItem[]>([])

  useEffect(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prediction_history')
      if (saved) {
        try {
          setHistory(JSON.parse(saved))
        } catch (error) {
          console.error('Failed to load prediction history:', error)
        }
      }
    }
  }, [])

  // Save current prediction to history
  useEffect(() => {
    if (currentPrediction && typeof window !== 'undefined') {
      const newItem: PredictionHistoryItem = {
        ...currentPrediction,
        timestamp: new Date().toISOString(),
      }
      
      setHistory(prev => {
        const updated = [newItem, ...prev.filter(item => 
          // Avoid duplicates - check if same price and recent
          Math.abs(item.final_price - newItem.final_price) > 100 ||
          new Date(item.timestamp).getTime() < Date.now() - 60000 // 1 minute ago
        )].slice(0, 10) // Keep last 10
        
        localStorage.setItem('prediction_history', JSON.stringify(updated))
        return updated
      })
    }
  }, [currentPrediction])

  const loadPrediction = (pred: PredictionHistoryItem) => {
    if (onLoadPrediction) {
      onLoadPrediction(pred)
    }
  }

  const clearHistory = () => {
    setHistory([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem('prediction_history')
    }
  }

  if (history.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
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
              <History className="h-5 w-5" />
              Recent Predictions ({history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <AnimatePresence>
                {history.map((pred, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 cursor-pointer transition-colors"
                    onClick={() => loadPrediction(pred)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🚗</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-200 truncate">
                          {pred.carDetails?.make && pred.carDetails?.model
                            ? `${pred.carDetails.year || ''} ${pred.carDetails.make} ${pred.carDetails.model}`.trim()
                            : 'Car Prediction'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {formatDistanceToNow(new Date(pred.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="font-bold text-blue-400">
                        {formatCurrency(pred.final_price)}
                      </div>
                      {pred.market_comparison && (
                        <div className="text-xs text-gray-400">
                          {pred.market_comparison.badge}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 w-full text-gray-400 hover:text-white"
                onClick={clearHistory}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
