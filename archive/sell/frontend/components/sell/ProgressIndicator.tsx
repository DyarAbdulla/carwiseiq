"use client"

import { motion } from 'framer-motion'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Step {
  id: number
  title: string
  completed: boolean
  active: boolean
}

interface ProgressIndicatorProps {
  steps: Step[]
  onStepClick?: (stepId: number) => void
}

const stepTitles = [
  'Vehicle Details',
  'Condition',
  'Accident & Features',
  'Contact & Photos'
]

export function ProgressIndicator({ steps, onStepClick }: ProgressIndicatorProps) {
  return (
    <div className="sticky top-0 z-40 bg-[#0f1117]/95 backdrop-blur-md border-b border-[#2a2d3a] mb-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Progress Bar */}
        <div className="relative">
          {/* Background Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-[#2a2d3a]">
            {/* Filled Line */}
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#5B7FFF] to-[#9333EA]"
              initial={{ width: '0%' }}
              animate={{
                width: `${((steps.filter(s => s.completed).length) / steps.length) * 100}%`
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Steps */}
          <div className="relative flex justify-between items-start">
            {steps.map((step, index) => {
              const isClickable = step.completed || step.active
              
              return (
                <motion.button
                  key={step.id}
                  type="button"
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "flex flex-col items-center gap-2 flex-1 max-w-[150px]",
                    isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}
                  whileHover={isClickable ? { scale: 1.05 } : {}}
                  whileTap={isClickable ? { scale: 0.95 } : {}}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Step Circle */}
                  <div className="relative z-10">
                    {step.completed ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        <CheckCircle2 className="h-10 w-10 text-[#5B7FFF]" fill="#5B7FFF" />
                      </motion.div>
                    ) : step.active ? (
                      <motion.div
                        className="h-10 w-10 rounded-full border-2 border-[#5B7FFF] bg-[#5B7FFF]/20 flex items-center justify-center"
                        animate={{
                          scale: [1, 1.1, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(91, 127, 255, 0.4)',
                            '0 0 0 8px rgba(91, 127, 255, 0)',
                            '0 0 0 0 rgba(91, 127, 255, 0)'
                          ]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut'
                        }}
                      >
                        <Circle className="h-6 w-6 text-[#5B7FFF]" fill="#5B7FFF" />
                      </motion.div>
                    ) : (
                      <div className="h-10 w-10 rounded-full border-2 border-[#2a2d3a] bg-[#1a1d29] flex items-center justify-center">
                        <Circle className="h-6 w-6 text-[#64748b]" />
                      </div>
                    )}
                    
                    {/* Step Number */}
                    {!step.completed && (
                      <span className={cn(
                        "absolute inset-0 flex items-center justify-center text-xs font-semibold",
                        step.active ? "text-white" : "text-[#64748b]"
                      )}>
                        {step.id}
                      </span>
                    )}
                  </div>

                  {/* Step Title */}
                  <div className="text-center">
                    <p className={cn(
                      "text-xs font-medium mb-0.5",
                      step.active ? "text-white" : step.completed ? "text-[#94a3b8]" : "text-[#64748b]"
                    )}>
                      Step {step.id} of {steps.length}
                    </p>
                    <p className={cn(
                      "text-xs",
                      step.active ? "text-white font-semibold" : "text-[#94a3b8]"
                    )}>
                      {step.title}
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}