"use client"

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import { validateMileage, calculateExpectedMileage } from '@/hooks/useMileageValidation'
import { InteractiveTooltip } from './InteractiveTooltip'

interface MileageValidatorProps {
  mileage: number
  year: number
  onConfirm?: (confirmed: boolean) => void
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
}

export function MileageValidator({
  mileage,
  year,
  onConfirm,
  confirmed,
  onConfirmedChange,
}: MileageValidatorProps) {
  if (!mileage || !year) return null

  const validation = validateMileage(year, mileage)

  // Low mileage (< 1000 km or significantly below average)
  if (validation.state === 'low') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2"
      >
        <Alert className="bg-green-500/10 border-green-500/50">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-300">
            {validation.message}
          </AlertDescription>
        </Alert>
      </motion.div>
    )
  }

  // Very high mileage (>100% above expected) - requires confirmation
  if (validation.state === 'error' && !confirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 space-y-2"
      >
        <Alert className="bg-red-500/10 border-red-500/50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-200">
            {validation.message}
            <div className="flex items-center space-x-2 mt-3">
              <Checkbox
                id="confirm-mileage-error"
                checked={confirmed}
                onCheckedChange={(checked) => {
                  onConfirmedChange(checked as boolean)
                  onConfirm?.(checked as boolean)
                }}
              />
              <Label htmlFor="confirm-mileage-error" className="text-sm text-red-200 cursor-pointer">
                Confirm mileage is correct
              </Label>
            </div>
          </AlertDescription>
        </Alert>
      </motion.div>
    )
  }

  // High mileage (50-100% above expected) - warning
  if (validation.state === 'warning') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2"
      >
        <Alert className="bg-yellow-500/10 border-yellow-500/50">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-yellow-200">
            {validation.message}
          </AlertDescription>
        </Alert>
      </motion.div>
    )
  }

  // Normal mileage (within expected range) or confirmed
  if (validation.state === 'normal' || confirmed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-2"
      >
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>{validation.message}</span>
        </div>
      </motion.div>
    )
  }

  return null
}

// Export for use in tooltip
export { calculateExpectedMileage }