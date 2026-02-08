"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const variantStyles = {
      default: "bg-[#5B7FFF] text-white hover:bg-[#4a6fff]",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      outline: "border border-slate-300 dark:border-[#2a2d3a] bg-transparent hover:bg-slate-100 dark:hover:bg-[#2a2d3a] text-slate-900 dark:text-white",
      secondary: "bg-slate-100 dark:bg-[#2a2d3a] text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-[#3a3d4a]",
      ghost: "hover:bg-slate-100 dark:hover:bg-[#2a2d3a] text-slate-900 dark:text-white",
      link: "text-[#5B7FFF] underline-offset-4 hover:underline",
    }

    const sizeStyles = {
      default: "h-10 sm:h-10 px-4 py-2 min-h-[48px] sm:min-h-[40px]",
      sm: "h-9 sm:h-9 rounded-md px-3 min-h-[48px] sm:min-h-[36px]",
      lg: "h-11 sm:h-11 rounded-md px-8 min-h-[48px] sm:min-h-[44px]",
      icon: "h-10 w-10 sm:h-10 sm:w-10 min-h-[48px] min-w-[48px] sm:min-h-[40px] sm:min-w-[40px]",
    }

    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }


