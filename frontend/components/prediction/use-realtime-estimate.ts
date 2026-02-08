import { useMemo, useEffect } from 'react'
import { debounce } from '@/lib/utils'
import { apiClient } from '@/lib/api'
import type { CarFeatures, PredictionResponse } from '@/lib/types'

interface UseRealtimeEstimateOptions {
  features: Partial<CarFeatures> | null
  enabled?: boolean
  delay?: number
  onEstimate?: (estimate: PredictionResponse | null) => void
}

export function useRealtimeEstimate({
  features,
  enabled = true,
  delay = 500,
  onEstimate,
}: UseRealtimeEstimateOptions) {
  // Create debounced function using useMemo
  const debouncedEstimate = useMemo(() => {
    if (!enabled || !features) {
      return null
    }

    const estimateFn = async () => {
      try {
        // Validate that we have minimum required fields
        if (!features.make || !features.model || !features.year) {
          if (onEstimate) {
            onEstimate(null)
          }
          return
        }

        // Create a complete CarFeatures object with defaults
        const completeFeatures: CarFeatures = {
          year: features.year || 2020,
          mileage: features.mileage || 0,
          engine_size: features.engine_size || 2.0,
          cylinders: features.cylinders || 4,
          make: features.make,
          model: features.model,
          trim: features.trim,
          condition: features.condition || 'Good',
          fuel_type: features.fuel_type || 'Gasoline',
          location: features.location || 'California',
        }

        const result = await apiClient.predictPrice(completeFeatures)
        if (onEstimate) {
          onEstimate(result)
        }
      } catch (error) {
        console.error('Failed to get realtime estimate:', error)
        if (onEstimate) {
          onEstimate(null)
        }
      }
    }

    return debounce(estimateFn, delay)
  }, [features, enabled, delay, onEstimate])

  // Trigger debounced estimate when features change
  useEffect(() => {
    if (!debouncedEstimate || !enabled || !features) {
      return
    }

    // Call the debounced function
    debouncedEstimate()

    // Cleanup: cancel pending debounced call
    return () => {
      if (debouncedEstimate && debouncedEstimate.cancel) {
        debouncedEstimate.cancel()
      }
    }
  }, [debouncedEstimate, enabled, features])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debouncedEstimate && debouncedEstimate.cancel) {
        debouncedEstimate.cancel()
      }
    }
  }, [debouncedEstimate])
}
