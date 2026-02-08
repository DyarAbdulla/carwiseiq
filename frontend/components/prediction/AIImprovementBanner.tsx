"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Sparkles } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { motion } from 'framer-motion'

interface ImprovementMetrics {
  improvement_percent: number
  improvement_absolute: number
  current_period: {
    accuracy_percent: number
    total_feedback: number
  }
}

export function AIImprovementBanner() {
  const t = useTranslations('feedback.metrics')
  const [metrics, setMetrics] = useState<ImprovementMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getFeedbackMetrics()

      if (data.improvement && data.improvement.improvement_percent > 0) {
        setMetrics({
          improvement_percent: data.improvement.improvement_percent,
          improvement_absolute: data.improvement.improvement_absolute,
          current_period: {
            accuracy_percent: data.improvement.current_period.accuracy_percent,
            total_feedback: data.improvement.current_period.total_feedback
          }
        })
      }
    } catch (error) {
      console.error('Error loading improvement metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics || metrics.improvement_percent <= 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="border-[#5B7FFF]/30 bg-gradient-to-r from-[#5B7FFF]/10 to-[#1a1d29]">
        <CardContent className="py-4 px-6">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="relative">
                <Sparkles className="h-8 w-8 text-[#5B7FFF]" />
                <TrendingUp className="h-5 w-5 text-green-400 absolute -bottom-1 -right-1" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium text-sm md:text-base">
                {t('improvement', {
                  percent: Math.round(metrics.improvement_percent)
                })}
              </p>
              <p className="text-[#94a3b8] text-xs mt-1">
                Current accuracy: {metrics.current_period.accuracy_percent.toFixed(1)}% •
                Based on {metrics.current_period.total_feedback} user feedback entries
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
