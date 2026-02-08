'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, BarChart3, DollarSign } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoadingStage {
  id: number
  label: string
  icon: React.ReactNode
  duration: number
}

const STAGES: LoadingStage[] = [
  {
    id: 1,
    label: 'Scraping listing...',
    icon: <Search className="h-4 w-4" />,
    duration: 2000,
  },
  {
    id: 2,
    label: 'Extracting car details...',
    icon: <BarChart3 className="h-4 w-4" />,
    duration: 1500,
  },
  {
    id: 3,
    label: 'Calculating price prediction...',
    icon: <DollarSign className="h-4 w-4" />,
    duration: 1000,
  },
]

interface LoadingStagesProps {
  isLoading: boolean
  onComplete?: () => void
}

export function LoadingStages({ isLoading, onComplete }: LoadingStagesProps) {
  const [currentStage, setCurrentStage] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isLoading) {
      setCurrentStage(0)
      setProgress(0)
      return
    }

    let currentProgress = 0
    let stageIndex = 0
    const totalDuration = STAGES.reduce((sum, stage) => sum + stage.duration, 0)

    const updateProgress = () => {
      if (stageIndex < STAGES.length) {
        const stage = STAGES[stageIndex]
        const stageStartTime = STAGES.slice(0, stageIndex).reduce((sum, s) => sum + s.duration, 0)
        const elapsed = currentProgress - stageStartTime
        const stageProgress = Math.min(100, (elapsed / stage.duration) * 100)

        setProgress(((stageStartTime + (elapsed * stage.duration) / 100) / totalDuration) * 100)

        if (elapsed >= stage.duration) {
          setCurrentStage((prev) => {
            const next = prev + 1
            if (next >= STAGES.length && onComplete) {
              setTimeout(() => onComplete(), 100)
            }
            return next
          })
          stageIndex++
        }
      }

      if (isLoading && stageIndex < STAGES.length) {
        currentProgress += 50
        requestAnimationFrame(updateProgress)
      } else if (isLoading) {
        setProgress(100)
      }
    }

    const interval = setInterval(() => {
      if (isLoading) {
        updateProgress()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [isLoading, onComplete])

  if (!isLoading) return null

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="w-full h-1 bg-[#0f1117] rounded-full overflow-hidden border border-[#2a2d3a]">
        <motion.div
          className="h-full bg-gradient-to-r from-[#5B7FFF] to-[#8B5CF6]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Stage Indicators */}
      <div className="flex items-center justify-center gap-4">
        <AnimatePresence mode="wait">
          {STAGES.map((stage, index) => {
            const isActive = index === currentStage
            const isCompleted = index < currentStage

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: isActive || isCompleted ? 1 : 0.5, scale: isActive ? 1.1 : 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#5B7FFF]/20 border border-[#5B7FFF]/50'
                    : isCompleted
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-[#1a1d29] border border-[#2a2d3a]'
                }`}
              >
                {isCompleted ? (
                  <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#5B7FFF]" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-[#2a2d3a]" />
                )}
                <span
                  className={`text-sm font-medium ${
                    isActive ? 'text-[#5B7FFF]' : isCompleted ? 'text-green-500' : 'text-[#94a3b8]'
                  }`}
                >
                  {stage.label}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
