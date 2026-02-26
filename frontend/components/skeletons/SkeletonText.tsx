"use client"

import { cn } from "@/lib/utils"

interface SkeletonTextProps {
  className?: string
  lines?: number
  /** Width of each line: 'full' | '3/4' | '1/2' | '1/3' | '1/4' */
  width?: "full" | "3/4" | "1/2" | "1/3" | "1/4"
  /** Line height: 'sm' | 'md' | 'lg' */
  size?: "sm" | "md" | "lg"
}

const widthMap = {
  full: "w-full",
  "3/4": "w-3/4",
  "1/2": "w-1/2",
  "1/3": "w-1/3",
  "1/4": "w-1/4",
}

const sizeMap = {
  sm: "h-3",
  md: "h-4",
  lg: "h-5",
}

/**
 * Skeleton for text content - paragraphs, titles, etc.
 * Uses shimmer animation.
 */
export function SkeletonText({
  className,
  lines = 1,
  width = "full",
  size = "md",
}: SkeletonTextProps) {
  const heightClass = sizeMap[size]
  const widthClass = widthMap[width]

  return (
    <div
      className={cn("space-y-2", className)}
      role="status"
      aria-label="Loading text"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "skeleton-shimmer rounded-md",
            heightClass,
            i === lines - 1 && lines > 1 ? widthClass : "w-full"
          )}
        />
      ))}
    </div>
  )
}
