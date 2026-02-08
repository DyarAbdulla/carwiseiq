"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Clock, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { AutoSaveData } from './AutoSave'

interface ContinueModalProps {
  savedData: AutoSaveData
  onContinue: () => void
  onDiscard: () => void
  onClose: () => void
}

export function ContinueModal({ savedData, onContinue, onDiscard, onClose }: ContinueModalProps) {
  const savedDate = new Date(savedData.timestamp)
  const timeAgo = formatTimeAgo(savedDate)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative bg-[#1a1d29] border border-[#2a2d3a] rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#94a3b8] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-[#5B7FFF]/20 flex items-center justify-center">
              <Clock className="h-8 w-8 text-[#5B7FFF]" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-white mb-2">
              Continue where you left off?
            </h3>
            <p className="text-sm text-[#94a3b8] mb-4">
              We found saved form data from {timeAgo}
            </p>
            <div className="bg-[#0f1117] border border-[#2a2d3a] rounded-lg p-3 text-left">
              <p className="text-xs text-[#94a3b8] mb-1">Saved on:</p>
              <p className="text-sm text-white">
                {format(savedDate, 'PPpp')}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={onContinue}
              className="w-full bg-gradient-to-r from-[#5B7FFF] to-[#9333EA] hover:from-[#4c6ee5] hover:to-[#7c2dd8] text-white"
            >
              Continue with saved data
            </Button>
            <Button
              onClick={onDiscard}
              variant="outline"
              className="w-full border-[#2a2d3a] text-white hover:bg-[#2a2d3a]"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start fresh
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    return `${mins} minute${mins > 1 ? 's' : ''} ago`
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  }
  const days = Math.floor(seconds / 86400)
  return `${days} day${days > 1 ? 's' : ''} ago`
}