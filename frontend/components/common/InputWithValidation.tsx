"use client"

import { forwardRef, InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface InputWithValidationProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: boolean
  icon?: React.ReactNode
  helperText?: string
}

export const InputWithValidation = forwardRef<HTMLInputElement, InputWithValidationProps>(
  ({ label, error, success, icon, helperText, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(7)}`

    return (
      <div className="space-y-2">
        {label && (
          <Label htmlFor={inputId} className="text-white">
            {label}
          </Label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
              {icon}
            </div>
          )}
          <Input
            ref={ref}
            id={inputId}
            className={cn(
              icon && 'pl-10',
              (error || success) && 'pr-10',
              error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : success
                ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                : 'border-[#2a2d3a] focus:border-[#5B7FFF]',
              'bg-[#0f1117] text-white placeholder:text-[#94a3b8]',
              className
            )}
            {...props}
          />
          {error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="h-4 w-4 text-red-500" />
            </div>
          )}
          {success && !error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs text-[#94a3b8]">{helperText}</p>
        )}
      </div>
    )
  }
)

InputWithValidation.displayName = 'InputWithValidation'
