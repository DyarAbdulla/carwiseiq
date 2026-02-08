'use client'

import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'

interface UrlProgressBarProps {
  total: number
  completed: number
  processing: number
  failed: number
}

export function UrlProgressBar({ total, completed, processing, failed }: UrlProgressBarProps) {
  const progress = total > 0 ? ((completed + failed) / total) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#94a3b8]">
          Processing URL {completed + failed + processing} of {total}
        </span>
        <span className="text-[#5B7FFF] font-medium">
          {Math.round(progress)}%
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          {completed} completed
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#5B7FFF] animate-pulse" />
          {processing} processing
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          {failed} failed
        </span>
      </div>
    </motion.div>
  )
}
