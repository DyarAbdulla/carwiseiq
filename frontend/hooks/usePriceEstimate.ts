"use client"

import { useState, useEffect, useCallback } from 'react'

export interface PriceEstimateParams {
  make?: string
  model?: string
  year?: number
  mileage?: number
  condition?: string
  has_accident?: boolean
  premium_features?: string[]
  location?: string
}

/**
 * Calculate price estimate based on form data
 */
export function calculatePriceEstimate(params: PriceEstimateParams): number {
  if (!params.make || !params.model || !params.year || !params.mileage) {
    return 0
  }

  // Base price (simplified - in production, this would come from API/database)
  const basePrices: Record<string, number> = {
    'Toyota': 25000,
    'Honda': 24000,
    'Ford': 28000,
    'Chevrolet': 26000,
    'BMW': 45000,
    'Mercedes-Benz': 50000,
    'Audi': 42000,
    'Volkswagen': 23000,
    'Nissan': 22000,
    'Hyundai': 21000,
  }

  const basePrice = basePrices[params.make] || 25000

  // Age depreciation (10% per year)
  const currentYear = new Date().getFullYear()
  const age = currentYear - params.year
  const ageMultiplier = Math.max(0.3, 1 - (age * 0.1))

  // Mileage adjustment (-$X per 1000km over average)
  const expectedMileage = age * 12000 // 12,000 km per year average
  const mileageOverAverage = Math.max(0, params.mileage - expectedMileage)
  const mileageDeduction = (mileageOverAverage / 1000) * 300 // -$300 per 1000km over average

  // Condition adjustment
  const conditionMultipliers: Record<string, number> = {
    'Excellent': 1.10,  // +10%
    'Good': 1.0,        // 0%
    'Fair': 0.85,       // -15%
    'Poor': 0.70,       // -30%
  }
  const conditionMultiplier = conditionMultipliers[params.condition || 'Good'] || 1.0

  // Accident history (-7% if yes)
  const accidentMultiplier = params.has_accident ? 0.93 : 1.0

  // Premium features (+$500 per feature)
  const premiumFeaturesBonus = (params.premium_features?.length || 0) * 500

  // Calculate final price
  let price = basePrice * ageMultiplier * conditionMultiplier * accidentMultiplier
  price = price - mileageDeduction + premiumFeaturesBonus

  return Math.max(1000, Math.round(price)) // Minimum $1,000
}

/**
 * Hook for price estimation with debouncing
 */
export function usePriceEstimate(formData: PriceEstimateParams) {
  const [price, setPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if we have minimum required data
    const hasRequiredData = 
      formData.make &&
      formData.model &&
      formData.year &&
      formData.mileage

    if (!hasRequiredData) {
      setPrice(0)
      setLoading(false)
      return
    }

    setLoading(true)

    // Debounce calculation (500ms)
    const timer = setTimeout(() => {
      const estimatedPrice = calculatePriceEstimate(formData)
      setPrice(estimatedPrice)
      setLoading(false)
    }, 500)

    return () => {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [
    formData.make,
    formData.model,
    formData.year,
    formData.mileage,
    formData.condition,
    formData.has_accident,
    formData.premium_features?.length,
    formData.location,
  ])

  return { price, loading }
}