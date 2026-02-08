"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import type { ConfidenceInterval } from '@/lib/types'

interface ConfidenceMeterProps {
  confidenceLevel?: 'high' | 'medium' | 'low'
  confidenceInterval?: ConfidenceInterval
  precision?: number
}

export function ConfidenceMeter({
  confidenceLevel = 'medium',
  confidenceInterval,
  precision
}: ConfidenceMeterProps) {
  const levelConfig = {
    high: {
      label: 'High Confidence',
      color: 'text-green-400',
      bgColor: 'bg-green-500',
      glowColor: 'rgba(34, 197, 94, 0.4)',
      badge: 'success',
      percentage: 85,
      description: 'Very reliable prediction based on similar vehicles'
    },
    medium: {
      label: 'Medium Confidence',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500',
      glowColor: 'rgba(234, 179, 8, 0.4)',
      badge: 'warning',
      percentage: 65,
      description: 'Moderate reliability - some market variability expected'
    },
    low: {
      label: 'Low Confidence',
      color: 'text-red-400',
      bgColor: 'bg-red-500',
      glowColor: 'rgba(239, 68, 68, 0.4)',
      badge: 'destructive',
      percentage: 40,
      description: 'Higher uncertainty - limited comparable data available'
    }
  }

  const config = levelConfig[confidenceLevel]

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29] relative overflow-visible">
      {/* Pulsing glow effect */}
      <motion.div
        className="absolute inset-0 opacity-0"
        animate={{
          opacity: [0, 0.3, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background: `radial-gradient(circle at center, ${config.glowColor}, transparent 70%)`,
        }}
      />

      <CardHeader className="relative z-10">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          📊 Confidence Meter
          <Badge variant={config.badge as any}>{config.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        {/* Visual Gauge with pulsing effect */}
        <div className="relative h-8 bg-[#0f1117] rounded-full border border-[#2a2d3a] overflow-hidden">
          <motion.div
            className={`h-full ${config.bgColor} rounded-full flex items-center justify-end pr-4 relative`}
            style={{ width: `${config.percentage}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${config.percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {/* Pulsing glow on the bar */}
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{
                boxShadow: [
                  `0 0 10px ${config.glowColor}`,
                  `0 0 20px ${config.glowColor}`,
                  `0 0 10px ${config.glowColor}`,
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <span className="text-xs font-semibold text-white relative z-10">
              {config.percentage}%
            </span>
          </motion.div>
        </div>

        {/* Range Explanation */}
        {confidenceInterval && (
          <div className="space-y-2">
            <p className="text-sm text-[#94a3b8]">
              <span className="font-medium text-white">Range:</span> The predicted price could vary by approximately{' '}
              {precision ? `±${precision.toFixed(1)}%` : '±20%'} based on market conditions.
            </p>
            {confidenceInterval.lower > 0 && (
              <div className="flex gap-4 text-xs text-[#94a3b8]">
                <div>
                  <span className="text-white">Lower:</span> ${confidenceInterval.lower.toLocaleString()}
                </div>
                <div>
                  <span className="text-white">Upper:</span> ${confidenceInterval.upper.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-[#94a3b8] italic">
          {config.description}
        </p>
      </CardContent>
    </Card>
  )
}





