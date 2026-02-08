"use client"

import { cn } from '@/lib/utils'

interface SoldBadgeProps {
  variant?: 'corner' | 'default'
  className?: string
}

export function SoldBadge({ variant = 'default', className }: SoldBadgeProps) {
  if (variant === 'corner') {
    return (
      <div
        className={cn(
          'absolute top-2 right-2 z-10 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rotate-12 shadow-md',
          className
        )}
        aria-hidden
      >
        SOLD
      </div>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400',
        className
      )}
    >
      Sold
    </span>
  )
}
