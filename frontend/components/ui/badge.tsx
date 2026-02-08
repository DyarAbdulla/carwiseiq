"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "secondary" | "outline"
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  (props, ref) => {
    const { className, variant = "default", ...rest } = props
    const variantStyles: Record<string, string> = {
      default: "bg-[#5B7FFF] text-white",
      success: "bg-green-600 text-white",
      warning: "bg-yellow-600 text-white",
      destructive: "bg-red-600 text-white",
      secondary: "bg-[#2a2d3a] text-[#94a3b8]",
      outline: "border border-[#2a2d3a] text-white",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          variantStyles[variant] || variantStyles.default,
          className
        )}
        {...rest}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }

