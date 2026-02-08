"use client"

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface StarRatingProps {
  label?: string
  value: number
  onChange?: (value: number) => void
  maxStars?: number
  disabled?: boolean
  className?: string
}

export function StarRating({
  label,
  value,
  onChange,
  maxStars = 5,
  disabled = false,
  className
}: StarRatingProps) {
  const handleClick = (starValue: number) => {
    if (!disabled && onChange) {
      onChange(starValue)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-white">{label}</label>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: maxStars }).map((_, index) => {
          const starValue = index + 1
          const isFilled = starValue <= value
          
          return (
            <Button
              key={index}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-transparent"
              onClick={() => handleClick(starValue)}
              disabled={disabled || !onChange}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-[#2a2d3a] text-[#2a2d3a]"
                )}
              />
            </Button>
          )
        })}
        {value > 0 && (
          <span className="ml-2 text-sm text-[#94a3b8]">
            {value} / {maxStars}
          </span>
        )}
      </div>
    </div>
  )
}


