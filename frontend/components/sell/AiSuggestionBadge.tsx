"use client"

import { Sparkles } from 'lucide-react'
import type { ConfidenceLabel } from '@/lib/types'

type AiSuggestionBadgeProps = {
  label?: ConfidenceLabel
  percent?: number
  compact?: boolean
}

const colors: Record<ConfidenceLabel, string> = {
  HIGH: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  LOW: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
}

export function AiSuggestionBadge({ label = 'LOW', percent, compact }: AiSuggestionBadgeProps) {
  const c = colors[label] || colors.LOW
  const p = percent != null ? Math.round(percent) : null

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${c}`}
      >
        <Sparkles className="h-3 w-3" />
        <span>{label}</span>
        {p != null && <span>{p}%</span>}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium ${c}`}
    >
      <Sparkles className="h-3.5 w-3" />
      <span>AI: {label}</span>
      {p != null && <span>({p}%)</span>}
    </span>
  )
}
