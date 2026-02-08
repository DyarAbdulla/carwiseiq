"use client"

export type MileageValidationState = 'normal' | 'warning' | 'error' | 'low'

export interface MileageValidationResult {
  state: MileageValidationState
  message: string
  color: string
  requiresConfirmation: boolean
  expectedMileage: number
  deviation: number
}

/**
 * Calculate expected mileage based on car year
 */
export function calculateExpectedMileage(year: number): number {
  const currentYear = new Date().getFullYear()
  const age = Math.max(0, currentYear - year)
  // Average 12,000 km per year
  return age * 12000
}

/**
 * Validate mileage and return validation state
 * Note: This is NOT a React hook despite the naming - it's a pure function
 */
export function validateMileage(year: number, mileage: number): MileageValidationResult {
  if (!year || !mileage || mileage <= 0) {
    return {
      state: 'normal',
      message: '',
      color: 'text-gray-400',
      requiresConfirmation: false,
      expectedMileage: 0,
      deviation: 0,
    }
  }

  const expectedMileage = calculateExpectedMileage(year)
  const deviation = ((mileage - expectedMileage) / expectedMileage) * 100

  // Low mileage (< 1000 km)
  if (mileage < 1000) {
    return {
      state: 'low',
      message: '🎉 Low mileage! This significantly increases your car&apos;s value.',
      color: 'text-green-400',
      requiresConfirmation: false,
      expectedMileage,
      deviation: 0,
    }
  }

  // Very high mileage (>100% above expected) - requires confirmation
  if (deviation > 100) {
    return {
      state: 'error',
      message: `⚠️ Very high mileage for a ${year} model. Expected ~${Math.round(expectedMileage / 1000)}k km, your car has ${Math.round(mileage / 1000)}k km (${Math.round(deviation)}% above average). Please confirm this is correct.`,
      color: 'text-red-400',
      requiresConfirmation: true,
      expectedMileage,
      deviation,
    }
  }

  // High mileage (50-100% above expected) - warning
  if (deviation >= 50) {
    return {
      state: 'warning',
      message: `⚠️ Unusually high mileage for a ${year} model. Expected ~${Math.round(expectedMileage / 1000)}k km, your car has ${Math.round(mileage / 1000)}k km (${Math.round(deviation)}% above average). Is this correct?`,
      color: 'text-yellow-400',
      requiresConfirmation: false,
      expectedMileage,
      deviation,
    }
  }

  // Normal mileage (within 50% of expected)
  if (deviation >= -50) {
    return {
      state: 'normal',
      message: 'Mileage within expected range',
      color: 'text-green-400',
      requiresConfirmation: false,
      expectedMileage,
      deviation,
    }
  }

  // Very low mileage (below 50% of expected) - still positive
  return {
    state: 'low',
    message: '🎉 Low mileage! This significantly increases your car&apos;s value.',
    color: 'text-green-400',
    requiresConfirmation: false,
    expectedMileage,
    deviation,
  }
}