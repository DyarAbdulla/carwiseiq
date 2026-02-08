"use client"

import { Check, X } from 'lucide-react'

interface PasswordStrengthProps {
  password: string
  className?: string
}

interface Requirement {
  label: string
  test: (password: string) => boolean
}

const requirements: Requirement[] = [
  {
    label: 'At least 8 characters',
    test: (pwd) => pwd.length >= 8,
  },
  {
    label: 'At least one uppercase letter',
    test: (pwd) => /[A-Z]/.test(pwd),
  },
  {
    label: 'At least one lowercase letter',
    test: (pwd) => /[a-z]/.test(pwd),
  },
  {
    label: 'At least one number',
    test: (pwd) => /[0-9]/.test(pwd),
  },
  {
    label: 'At least one special character',
    test: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
  },
]

export function PasswordStrength({ password, className = '' }: PasswordStrengthProps) {
  if (!password) return null

  const metRequirements = requirements.filter((req) => req.test(password))
  const strength = metRequirements.length
  const strengthPercentage = (strength / requirements.length) * 100

  const getStrengthColor = () => {
    if (strengthPercentage < 40) return 'bg-red-500'
    if (strengthPercentage < 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStrengthText = () => {
    if (strengthPercentage < 40) return 'Weak'
    if (strengthPercentage < 80) return 'Medium'
    return 'Strong'
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#94a3b8]">Password strength:</span>
        <span className={`text-sm font-semibold ${
          strengthPercentage < 40 ? 'text-red-400' :
          strengthPercentage < 80 ? 'text-yellow-400' :
          'text-green-400'
        }`}>
          {getStrengthText()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full bg-[#2a2d3a] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${getStrengthColor()}`}
          style={{ width: `${strengthPercentage}%` }}
        />
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1.5 mt-3">
        {requirements.map((req, index) => {
          const met = req.test(password)
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              {met ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <X className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className={met ? 'text-green-400' : 'text-[#94a3b8]'}>
                {req.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
