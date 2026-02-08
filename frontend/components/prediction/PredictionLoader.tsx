"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'

const ANALYSIS_MESSAGES = [
  "Scanning Local Market Data...",
  "Analyzing Depreciation Trends...",
  "Comparing 55,000+ Listings...",
  "Calculating Final Value..."
]

const PROGRESS_DURATION = 10 // seconds

export function PredictionLoader() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  // Cycle through messages every 3 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % ANALYSIS_MESSAGES.length)
    }, 3000)

    return () => clearInterval(messageInterval)
  }, [])

  // Animate progress bar from 0 to 100% over 10 seconds
  useEffect(() => {
    const startTime = Date.now()
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000 // seconds
      const newProgress = Math.min((elapsed / PROGRESS_DURATION) * 100, 100)
      setProgress(newProgress)

      if (newProgress >= 100) {
        clearInterval(progressInterval)
      }
    }, 50) // Update every 50ms for smooth animation

    return () => clearInterval(progressInterval)
  }, [])

  return (
    <Card className="glassCard border border-white/10 overflow-hidden">
      <CardContent className="p-8 sm:p-10">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-1">
                System Analysis
              </h3>
              <p className="text-sm text-[#94a3b8]">
                Processing your prediction...
              </p>
            </motion.div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-3">
            {/* Progress Bar Background */}
            <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
              {/* Animated Gradient Progress Bar */}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ 
                  duration: 0.1,
                  ease: "linear"
                }}
                style={{
                  background: "linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)",
                  boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)"
                }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    background: [
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)"
                    ],
                    backgroundPosition: ["-200% 0", "200% 0"]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              </motion.div>
            </div>

            {/* Progress Percentage */}
            <div className="flex justify-between items-center text-xs text-[#94a3b8]">
              <span>Progress</span>
              <span className="font-semibold text-white">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Dynamic Message Display */}
          <div className="min-h-[60px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-3">
                  {/* Pulsing Dot Indicator */}
                  <motion.div
                    className="w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <p className="text-base sm:text-lg font-medium text-white">
                    {ANALYSIS_MESSAGES[currentMessageIndex]}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Tech Details Footer */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center justify-center gap-6 text-xs text-[#94a3b8]">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>AI Model Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Database Connected</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
