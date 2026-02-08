/**
 * Prediction validation utilities
 * Validates predictions against market data to detect suspicious results
 */

export interface PredictionValidation {
  isValid: boolean
  warning?: string
  suggestedRange?: {
    min: number
    max: number
  }
  ratio?: number
  differencePercent?: number
}

/**
 * Validates a predicted price against market average
 * @param predicted - The predicted price
 * @param marketAvg - The market average price
 * @returns Validation result with warnings if suspicious
 */
export function validatePrediction(
  predicted: number,
  marketAvg: number
): PredictionValidation {
  if (!marketAvg || marketAvg <= 0) {
    return {
      isValid: true, // Can't validate without market data
    }
  }

  const ratio = predicted / marketAvg
  const differencePercent = Math.abs((predicted - marketAvg) / marketAvg) * 100

  // Check if prediction is suspicious (>150% or <60% of market average)
  if (ratio > 2.5 || ratio < 0.4) {
    return {
      isValid: false,
      warning: `This prediction seems unusual. The predicted price is ${differencePercent.toFixed(1)}% ${
        predicted > marketAvg ? 'above' : 'below'
      } the market average. Please verify your inputs.`,
      suggestedRange: {
        min: marketAvg * 0.7,
        max: marketAvg * 1.5,
      },
      ratio,
      differencePercent,
    }
  }

  // Warning threshold (>150% or <60% but not as severe)
  if (ratio > 1.5 || ratio < 0.6) {
    return {
      isValid: true, // Still valid but with warning
      warning: `Note: This prediction is ${differencePercent.toFixed(1)}% ${
        predicted > marketAvg ? 'above' : 'below'
      } the market average. This may indicate unique features or market conditions.`,
      suggestedRange: {
        min: marketAvg * 0.7,
        max: marketAvg * 1.5,
      },
      ratio,
      differencePercent,
    }
  }

  return {
    isValid: true,
    ratio,
    differencePercent,
  }
}

/**
 * Logs suspicious predictions for analysis
 * @param predicted - The predicted price
 * @param marketAvg - The market average
 * @param carDetails - Car details for context
 */
export function logSuspiciousPrediction(
  predicted: number,
  marketAvg: number,
  carDetails?: Record<string, unknown>
): void {
  const validation = validatePrediction(predicted, marketAvg)
  
  if (!validation.isValid && validation.ratio) {
    console.warn('Suspicious prediction detected:', {
      predicted,
      marketAvg,
      ratio: validation.ratio,
      differencePercent: validation.differencePercent,
      carDetails,
      timestamp: new Date().toISOString(),
    })
    
    // In production, you might want to send this to an analytics service
    // Example: analytics.track('suspicious_prediction', { ... })
  }
}
