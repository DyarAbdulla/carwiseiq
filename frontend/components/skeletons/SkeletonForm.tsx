"use client"

import { cn } from "@/lib/utils"

interface SkeletonFormProps {
  className?: string
  /** Number of form field rows */
  fields?: number
  /** Show submit button skeleton */
  showButton?: boolean
}

/**
 * Skeleton for form fields - matches prediction/valuation form layout.
 * Uses shimmer animation. Min 44px height for touch targets.
 */
export function SkeletonForm({
  className,
  fields = 4,
  showButton = true,
}: SkeletonFormProps) {
  return (
    <div
      className={cn("space-y-4", className)}
      role="status"
      aria-label="Loading form"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          {/* Label */}
          <div className="skeleton-shimmer h-4 w-24 rounded-md" />
          {/* Input - min 44px for touch targets */}
          <div className="skeleton-shimmer h-12 min-h-[44px] w-full rounded-lg" />
        </div>
      ))}
      {showButton && (
        <div className="pt-4">
          <div className="skeleton-shimmer h-12 min-h-[44px] w-full sm:w-40 rounded-xl" />
        </div>
      )}
    </div>
  )
}

/**
 * Skeleton for a single form field (label + input)
 */
export function SkeletonFormField({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading field">
      <div className="skeleton-shimmer h-4 w-24 rounded-md" />
      <div className="skeleton-shimmer h-12 min-h-[44px] w-full rounded-lg" />
    </div>
  )
}
