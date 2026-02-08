/**
 * Hook for validating car input data and providing warnings
 */

import { useMemo } from 'react'
import type { SellCarRequest } from '@/lib/types'

export interface ValidationWarning {
  field: string
  type: 'unusual' | 'mismatch' | 'inconsistent'
  message: string
  severity: 'warning' | 'info'
}

/**
 * Common engine sizes by make/model (mock data - in production, this would come from backend)
 */
function getCommonEngines(make: string, model: string): string[] {
  // Mock data - in production, this would be fetched from backend
  const commonEngines: Record<string, string[]> = {
    'toyota-camry': ['2.5', '3.5'],
    'honda-accord': ['1.5', '2.0'],
    'ford-f150': ['3.5', '5.0'],
    // Add more as needed
  }
  
  const key = `${make.toLowerCase()}-${model.toLowerCase()}`
  return commonEngines[key] || ['2.0', '2.5', '3.5']
}

export function useCarValidation(carDetails: Partial<SellCarRequest>): ValidationWarning[] {
  return useMemo(() => {
    const warnings: ValidationWarning[] = []
    
    // Check for unusual mileage
    if (carDetails.year && carDetails.mileage) {
      const currentYear = new Date().getFullYear()
      const carAge = currentYear - carDetails.year
      const expectedMaxMileage = carAge * 25000 // avg 25k km/year
      const expectedMinMileage = carAge * 5000   // min 5k km/year
      const averageMileage = carAge * 15000
      
      if (carDetails.mileage > expectedMaxMileage) {
        warnings.push({
          field: 'mileage',
          type: 'unusual',
          message: `⚠️ High mileage for a ${carAge}-year-old car. Average is ${averageMileage.toLocaleString()} km.`,
          severity: 'warning'
        })
      }
      
      if (carDetails.mileage < expectedMinMileage && carAge > 1) {
        warnings.push({
          field: 'mileage',
          type: 'unusual',
          message: `ℹ️ Very low mileage! This could increase the car's value.`,
          severity: 'info'
        })
      }
    }
    
    // Check condition vs mileage
    if (carDetails.condition === 'Excellent' && carDetails.mileage && carDetails.mileage > 100000) {
      warnings.push({
        field: 'condition',
        type: 'inconsistent',
        message: `⚠️ "Excellent" condition typically applies to cars with under 100,000 km. Consider selecting "Good" condition.`,
        severity: 'warning'
      })
    }
    
    if (carDetails.condition === 'New' && carDetails.mileage && carDetails.mileage > 1000) {
      warnings.push({
        field: 'condition',
        type: 'inconsistent',
        message: `⚠️ "New" cars typically have under 1,000 km. Consider selecting "Excellent" or "Good" condition.`,
        severity: 'warning'
      })
    }
    
    // Check accident history consistency
    if (carDetails.has_accident && !carDetails.severity) {
      warnings.push({
        field: 'severity',
        type: 'inconsistent',
        message: `⚠️ Please specify the accident severity when accident history is reported.`,
        severity: 'warning'
      })
    }
    
    // Check year range
    if (carDetails.year) {
      const currentYear = new Date().getFullYear()
      if (carDetails.year > currentYear) {
        warnings.push({
          field: 'year',
          type: 'unusual',
          message: `⚠️ Year cannot be in the future.`,
          severity: 'warning'
        })
      }
      
      if (carDetails.year < 1990) {
        warnings.push({
          field: 'year',
          type: 'unusual',
          message: `ℹ️ Very old vehicle. Limited market data may affect prediction accuracy.`,
          severity: 'info'
        })
      }
    }
    
    // Check mileage is not negative
    if (carDetails.mileage !== undefined && carDetails.mileage < 0) {
      warnings.push({
        field: 'mileage',
        type: 'unusual',
        message: `⚠️ Mileage cannot be negative.`,
        severity: 'warning'
      })
    }
    
    return warnings
  }, [carDetails])
}
