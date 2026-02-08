"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, CheckCircle2, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CollapsibleSectionProps {
  title: string
  completed: boolean
  summary?: string
  children: React.ReactNode
  defaultExpanded?: boolean
  onEdit?: () => void
}

export function CollapsibleSection({
  title,
  completed,
  summary,
  children,
  defaultExpanded = false,
  onEdit
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!completed || defaultExpanded)

  return (
    <div className="border border-[#2a2d3a] rounded-lg bg-[#1a1d29] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          "hover:bg-[#0f1117]",
          isExpanded && "bg-[#0f1117]"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Checkmark or Number */}
          {completed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex-shrink-0"
            >
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </motion.div>
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-[#2a2d3a] bg-[#0f1117] flex items-center justify-center flex-shrink-0">
              <div className="h-2 w-2 rounded-full bg-[#64748b]" />
            </div>
          )}

          {/* Title and Summary */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-base font-semibold mb-0.5",
              completed ? "text-white" : "text-[#94a3b8]"
            )}>
              {title}
            </h3>
            {completed && summary && (
              <p className="text-sm text-[#64748b] truncate">
                {summary}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {completed && onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="text-[#5B7FFF] hover:text-[#4c6ee5] hover:bg-[#2a2d3a]"
            >
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-[#94a3b8] flex-shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-[#94a3b8] flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-[#2a2d3a]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}