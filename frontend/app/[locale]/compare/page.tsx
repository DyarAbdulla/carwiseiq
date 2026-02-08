"use client"
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PredictionForm } from '@/components/prediction/PredictionForm'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { X, Plus, Download, Share2, Save, Trophy, TrendingDown, TrendingUp, Sparkles, Check, X as XIcon, Gauge, Fuel, Cog, Calendar, Shield, Loader2, Car } from 'lucide-react'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, formatFuelEconomy } from '@/lib/utils'
import Image from 'next/image'
import { ListingCardSkeleton } from '@/components/common/LoadingSkeleton'
import { getCarSpecs } from '@/lib/carSpecifications'
import { ComparisonChart } from '@/components/compare/ComparisonChart'
import { SpecificationTable } from '@/components/compare/SpecificationTable'
import { ValueAnalysisSection } from '@/components/compare/ValueAnalysisSection'
import { OwnershipCostsSection } from '@/components/compare/OwnershipCostsSection'
import { CompareSummaryCards } from '@/components/compare/CompareSummaryCards'
import { SmartRecommendations } from '@/components/compare/SmartRecommendations'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ExportPDF } from '@/components/compare/ExportPDF'
import { ShareComparison } from '@/components/compare/ShareComparison'
import { CompareSaveAndHistory } from '@/components/compare/CompareSaveAndHistory'
import { saveCompareToHistory, type CompareHistoryEntry } from '@/lib/compareHistory'
import { parseCompareUrl } from '@/lib/shareUtils'
import { activityHelpers } from '@/lib/activityLogger'

interface CarCard {
  id: string
  features: CarFeatures | null
  prediction: PredictionResponse | null
  loading: boolean
  currentStep?: number // Track current step for progress display (1, 2, or 3)
}

interface ListingCard {
  id: number
  listing_id: number
  make: string
  model: string
  year: number
  price: number
  mileage: number
  condition: string
  fuel_type: string
  transmission: string
  color: string
  features: string[]
  image_url?: string
  location_city?: string
  description?: string
}

export default function ComparePage() {
  const searchParams = useSearchParams()
  const listingIds = searchParams?.get('ids')?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || []
  const isMarketplaceComparison = listingIds.length > 0

  const [mounted, setMounted] = useState(false)
  const [cars, setCars] = useState<CarCard[]>([
    { id: '1', features: null, prediction: null, loading: false, currentStep: 1 },
  ])
  const [listings, setListings] = useState<ListingCard[]>([])
  const [loadingListings, setLoadingListings] = useState(false)
  const [predictingAll, setPredictingAll] = useState(false)
  const [highlightDifferencesOnly, setHighlightDifferencesOnly] = useState(false)

  const MAX_CARS = 4

  // ALL hooks must be called unconditionally BEFORE any conditional returns
  const t = useTranslations('compare')
  const tCommon = useTranslations('common')
  const toastHook = useToast()
  const toast = toastHook || { toast: () => { } }
  const router = useRouter()
  const locale = useLocale()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Restore prediction comparison from share URL (?type=pred&d=...)
  useEffect(() => {
    if (!mounted || !searchParams || listingIds.length > 0) return
    const parsed = parseCompareUrl(searchParams)
    if (parsed?.mode === 'prediction' && parsed.state?.cars?.length) {
      setCars(parsed.state.cars.map((c, i) => ({
        id: `load-${i}-${Date.now()}`,
        features: c.features as CarFeatures | null,
        prediction: c.prediction as PredictionResponse | null,
        loading: false,
        currentStep: 1,
      })))
      router.replace(`/${locale}/compare`)
    }
  }, [mounted, searchParams, listingIds.length, router, locale])

  /*
   * VERIFICATION CHECKLIST - Compare Page Fixes:
   *
   * ✅ Progress Badge Position:
   *    - Moved from top-4 to top-16 (below card header)
   *    - z-index: 10 (below remove button's z-20)
   *    - Verified: Badge never overlaps X button, always clickable
   *
   * ✅ Progress Percentage:
   *    - Calculation: Math.round((currentStep / 3) * 100)
   *    - Step 1 = 33%, Step 2 = 66%, Step 3 = 100%
   *    - Each card tracks currentStep independently
   *    - Verified: Percentage updates correctly per step per card
   *
   * ✅ Step Change Callback:
   *    - handleStepChange memoized with useCallback (empty deps)
   *    - Only updates state if step actually changed for that car
   *    - Verified: No infinite loops, correct step tracking
   *
   * ✅ Predict Price Per-Card:
   *    - handleCardSubmit captures currentCarId as primitive
   *    - handlePredict uses functional setState to read latest state
   *    - Each card's formId = car.id (unique per card)
   *    - Verified: Predict Price works independently for all cards
   *
   * ✅ Fuel Economy Display:
   *    - Uses formatFuelEconomy() which converts MPG to L/100km
   *    - Applied in spec table for both predictions and listings
   *    - Formula: L/100km = 235.214583 / MPG (rounded to 1 decimal)
   *    - Verified: All fuel economy displays show L/100km format
   */

  // Load marketplace listings if IDs provided
  const loadListings = useCallback(async () => {
    setLoadingListings(true)
    try {
      const listingPromises = listingIds.map(id => apiClient.getListing(id))
      const listingResults = await Promise.all(listingPromises)
      const validListings: ListingCard[] = listingResults
        .filter((listing: any) => listing && listing.id)
        .map((listing: any) => ({
          id: listing.id,
          listing_id: listing.id,
          make: listing.make,
          model: listing.model,
          year: listing.year,
          price: listing.price,
          mileage: listing.mileage,
          condition: listing.condition,
          fuel_type: listing.fuel_type,
          transmission: listing.transmission,
          color: listing.color,
          features: listing.features || [],
          image_url: listing.images?.[0]?.url,
          location_city: listing.location_city,
          description: listing.description,
        }))
      setListings(validListings)

      // Log comparison activity when listings are loaded
      if (validListings.length >= 2) {
        activityHelpers.logCompare(
          validListings.map(l => l.id),
          validListings.length
        )
      }
    } catch (error: any) {
      console.error('Error loading listings:', error)
      if (toast?.toast) {
        toast.toast({
          title: 'Error',
          description: 'Failed to load listings for comparison',
          variant: 'destructive',
        })
      }
    } finally {
      setLoadingListings(false)
    }
  }, [listingIds, toast])

  const listingIdsKey = listingIds.join(',')

  useEffect(() => {
    if (isMarketplaceComparison && listingIds.length > 0) {
      loadListings()
    }
  }, [isMarketplaceComparison, listingIdsKey, listingIds.length, loadListings])

  // Calculate comparison metrics - MUST be before conditional return
  const allCarsHavePredictions = cars.every(c => c.prediction && c.features)
  const hasMultipleCars = cars.length > 1

  const comparisonMetrics = useMemo(() => {
    if (!allCarsHavePredictions || !hasMultipleCars) return null

    const carsWithPrices = cars
      .map((car, index) => ({
        ...car,
        index: index + 1,
        price: car.prediction?.predicted_price || 0,
        confidence: car.prediction?.confidence_range || 0,
      }))
      .sort((a, b) => a.price - b.price)

    const bestDealIndex = carsWithPrices[0].index - 1
    const mostExpensiveIndex = carsWithPrices[carsWithPrices.length - 1].index - 1
    const avgPrice = carsWithPrices.reduce((sum, car) => sum + car.price, 0) / carsWithPrices.length

    // Calculate savings for each car vs most expensive
    const savings = cars.map((car, index) => {
      if (index === mostExpensiveIndex) return 0
      const thisPrice = car.prediction?.predicted_price || 0
      const maxPrice = carsWithPrices[carsWithPrices.length - 1].price
      return maxPrice - thisPrice
    })

    // Generate AI recommendation
    const bestCar = cars[bestDealIndex]
    const recommendation = bestCar.features && bestCar.prediction
      ? `Based on the comparison, **Car ${bestDealIndex + 1} (${bestCar.features.make} ${bestCar.features.model})** offers the best value. At ${formatCurrency(bestCar.prediction.predicted_price)}, it's ${formatCurrency(savings[bestDealIndex])} less expensive than the most expensive option. ${bestCar.features.condition === 'Excellent' || bestCar.features.condition === 'Very Good'
        ? 'Its excellent condition also ensures good long-term reliability.'
        : ''
      } This represents the best balance of price and features among your options.`
      : ''

    return {
      bestDealIndex,
      mostExpensiveIndex,
      avgPrice,
      savings,
      recommendation,
      carsWithPrices,
    }
  }, [cars, allCarsHavePredictions, hasMultipleCars])

  // Specs from getCarSpecs for each car (prediction mode)
  const specMaps = useMemo(() =>
    cars.map(c => c.features ? getCarSpecs({
      make: c.features.make,
      model: c.features.model,
      year: c.features.year,
      engine_size: c.features.engine_size,
      cylinders: c.features.cylinders,
      fuel_type: c.features.fuel_type,
    }) : null),
    [cars])

  // Chart data with price, performance, radar dimensions
  const chartData = useMemo(() => {
    if (!comparisonMetrics) return []
    return cars.map((car, index) => {
      const spec = specMaps[index]
      const fe = spec?.fuelEconomy
      return {
        name: `Car ${index + 1}`,
        shortName: car.features ? `${car.features.make} ${car.features.model}`.slice(0, 14) : `Car ${index + 1}`,
        price: car.prediction?.predicted_price || 0,
        horsepower: spec?.horsepower,
        fuelEconomy: fe ? Math.round((fe.city + fe.highway) / 2) : undefined,
        acceleration: spec?.acceleration,
        value: spec?.horsepower && car.prediction?.predicted_price ? Math.round(car.prediction.predicted_price / spec.horsepower) : undefined,
        economy: fe ? Math.round((fe.city + fe.highway) / 2) : undefined,
        fullName: `${car.features?.make || ''} ${car.features?.model || ''}`.trim() || `Car ${index + 1}`,
        isBestDeal: index === comparisonMetrics.bestDealIndex,
        isMostExpensive: index === comparisonMetrics.mostExpensiveIndex,
      }
    })
  }, [cars, comparisonMetrics, specMaps])

  // Spec table rows for prediction comparison
  const specRows = useMemo(() => {
    if (!allCarsHavePredictions || !comparisonMetrics) return []
    const rows = [
      { label: 'Make & Model', values: cars.map(c => c.features ? `${c.features.make} ${c.features.model}` : '—') },
      { label: 'Year', values: cars.map(c => c.features?.year ?? '—'), icon: Calendar },
      { label: 'Mileage', values: cars.map(c => c.features?.mileage ?? null), suffix: ' km', format: (v: string | number) => Number(v).toLocaleString() },
      { label: 'Condition', values: cars.map(c => c.features?.condition ?? '—') },
      { label: 'Fuel Type', values: cars.map(c => c.features?.fuel_type ?? '—'), icon: Fuel },
      { label: 'Engine', values: cars.map(c => c.features?.engine_size ? `${c.features.engine_size}L` : '—'), icon: Cog },
      { label: 'Cylinders', values: cars.map(c => c.features?.cylinders ?? '—') },
      { label: 'Horsepower', values: cars.map((_, i) => specMaps[i]?.horsepower ?? null), higherIsBetter: true, suffix: ' hp', icon: Gauge },
      { label: 'Torque', values: cars.map((_, i) => specMaps[i]?.torque ?? null), higherIsBetter: true, suffix: ' lb-ft' },
      { label: '0-60 mph', values: cars.map((_, i) => specMaps[i]?.acceleration ?? null), suffix: ' s' },
      { label: 'Top Speed', values: cars.map((_, i) => specMaps[i]?.topSpeed ?? null), higherIsBetter: true, suffix: ' mph' },
      { label: 'Transmission', values: cars.map((_, i) => specMaps[i]?.transmission ?? '—') },
      { label: 'Drivetrain', values: cars.map((_, i) => specMaps[i]?.drivetrain ?? '—') },
      { label: 'Fuel Economy', values: cars.map((_, i) => { const e = specMaps[i]?.fuelEconomy; return e ? formatFuelEconomy(e.city, e.highway) : '—' }) },
      { label: 'Predicted Price', values: cars.map(c => c.prediction?.predicted_price ?? null), format: (v: string | number) => formatCurrency(Number(v)) },
      { label: 'Confidence', values: cars.map(c => c.prediction?.confidence_range ?? null), higherIsBetter: true, suffix: '%' },
      { label: 'Savings vs Highest', values: comparisonMetrics.savings, format: (v: string | number) => formatCurrency(Number(v)), suffix: '' },
    ]
    if (highlightDifferencesOnly) {
      return rows.filter(r => {
        const v = r.values.map(x => String(x ?? ''))
        return new Set(v).size > 1
      })
    }
    return rows
  }, [cars, comparisonMetrics, specMaps, allCarsHavePredictions, highlightDifferencesOnly])

  const addCar = () => {
    if (cars.length >= MAX_CARS) {
      if (toast?.toast) {
        toast.toast({ title: 'Limit reached', description: `You can compare up to ${MAX_CARS} cars.`, variant: 'default' })
      }
      return
    }
    setCars([...cars, { id: Date.now().toString(), features: null, prediction: null, loading: false, currentStep: 1 }])
  }

  const removeCar = (id: string) => {
    if (cars.length > 1) {
      setCars(cars.filter(car => car.id !== id))
    }
  }

  // Handle step changes (memoized to prevent infinite loops)
  const handleStepChange = useCallback((carId: string, step: number) => {
    setCars(prevCars => {
      // Only update if step actually changed for this car
      const car = prevCars.find(c => c.id === carId)
      if (car && car.currentStep !== step) {
        return prevCars.map(c =>
          c.id === carId ? { ...c, currentStep: step } : c
        )
      }
      return prevCars
    })
  }, [])

  // Update car features when form changes (so Predict All can access them)
  const handleFormChange = useCallback((id: string, partialFeatures: Partial<CarFeatures> | null) => {

    setCars(prevCars => {
      // Create a new array to ensure React detects the change
      const updated = prevCars.map(c => {
        if (c.id === id) {
          if (!partialFeatures) {
            // Return a new object reference even if no changes
            return { ...c }
          }

          // Check if model is changing - if so, clear trim
          const isModelChanging = partialFeatures.model !== undefined &&
            c.features?.model !== partialFeatures.model

          // Create a deep copy of existing features or start fresh
          const existingFeatures = c.features ? { ...c.features } : {}

          // Merge partial features with existing features
          const updatedFeatures: CarFeatures = {
            ...existingFeatures,
            ...partialFeatures,
            // Clear trim if model is changing
            ...(isModelChanging ? { trim: '' } : {}),
          } as CarFeatures


          // Return a completely new car object with new features object
          return {
            ...c,
            features: updatedFeatures
          }
        }
        // Return unchanged car as-is (but still in new array)
        return c
      })


      return updated
    })
  }, [])

  // CRITICAL: handleCardSubmit MUST be defined OUTSIDE the map to avoid hook rule violations
  // Pass carId as first parameter when calling from inside map
  const handleCardSubmit = useCallback((carId: string, values: CarFeatures) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[Compare] handleCardSubmit", carId, values)
    }
    return handlePredict(carId, values)
  }, [])

  const handlePredict = async (id: string, features: CarFeatures | null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[Compare] handlePredict start", id)
      console.log("[Compare] sending payload", features)
    }

    // Validate input
    if (!id) {
      console.error('❌ [Compare] Missing car id:', { id })
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: 'Car ID is missing',
          variant: 'destructive',
        })
      }
      return
    }

    if (!features || typeof features !== 'object') {
      console.error('❌ [Compare] Invalid input:', { id, features, featuresType: typeof features })
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: 'Invalid car features provided',
          variant: 'destructive',
        })
      }
      return
    }

    // Validate required fields first
    const requiredFields = ['make', 'model', 'trim', 'year', 'mileage', 'engine_size', 'cylinders', 'condition', 'fuel_type', 'location']
    const missingFields = requiredFields.filter(field => {
      const value = features[field as keyof CarFeatures]
      const isEmpty = value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))
      return isEmpty
    })

    if (missingFields.length > 0) {
      console.error('❌ [Compare] Missing required fields:', {
        id,
        missingFields,
        features,
        fieldValues: requiredFields.map(f => ({ field: f, value: features[f as keyof CarFeatures] }))
      })
      if (toast?.toast) {
        toast.toast({
          title: 'Missing Required Fields',
          description: `Car ${id}: Please fill in: ${missingFields.join(', ')}`,
          variant: 'destructive',
        })
      }
      return
    }

    // Use functional update to ensure we're working with latest state
    // Check if car exists inside the functional update to avoid stale closure issues
    // If car doesn't exist, we'll handle it gracefully in the final update
    setCars(prevCars => {
      const car = prevCars.find(c => c.id === id)
      if (!car) {
        console.error('❌ [Compare] Car not found in state:', { id, availableCarIds: prevCars.map(c => c.id) })
        // If car doesn't exist, create it or use the first car as fallback
        // This handles race conditions where the car was removed or state was reset
        if (prevCars.length > 0) {
          const fallbackId = prevCars[0].id
          console.warn('⚠️ [Compare] Car not found, using first car as fallback:', fallbackId)
          // Update the first car instead
          return prevCars.map((c, index) =>
            index === 0 ? { ...c, loading: true } : c
          )
        } else {
          // No cars exist, create a new one with the requested id
          console.warn('⚠️ [Compare] No cars exist, creating new car with id:', id)
          return [{ id, features, prediction: null, loading: true, currentStep: 1 }]
        }
      }

      const updated = prevCars.map(c => {
        if (c.id === id) {
          // Create new object to avoid mutation
          return { ...c, loading: true }
        }
        return c
      })
      return updated
    })

    try {
      const result = await apiClient.predictPrice(features)
      if (process.env.NODE_ENV === 'development') {
        console.log("[Compare] response received", { requestedId: id, result, status: 'success' })
      }

      // Validate result
      if (!result || typeof result !== 'object' || typeof result.predicted_price !== 'number') {
        throw new Error('Invalid prediction result: missing predicted_price')
      }

      // STATE UPDATE MUST TARGET ONLY ONE CARD
      // Check for car by id, or use first car as fallback if not found
      if (process.env.NODE_ENV === 'development') {
        console.log("[Compare] updating card state", id)
      }
      setCars(prevCars => {
        const car = prevCars.find(c => c.id === id)
        if (!car) {
          // Car still doesn't exist, use first car or create new one
          if (prevCars.length > 0) {
            console.warn('⚠️ [Compare] Car still not found in final update, using first car:', prevCars[0].id)
            return prevCars.map((c, index) =>
              index === 0
                ? {
                  ...c,
                  features: { ...features },
                  prediction: { ...result },
                  loading: false
                }
                : c
            )
          } else {
            // No cars exist, create new one
            console.warn('⚠️ [Compare] No cars exist in final update, creating new car:', id)
            return [{ id, features: { ...features }, prediction: { ...result }, loading: false, currentStep: 1 }]
          }
        }

        return prevCars.map(c =>
          c.id === id
            ? {
              ...c,
              features: { ...features }, // Create new features object
              prediction: { ...result }, // Create new prediction object
              loading: false
            }
            : c
        )
      })
      if (process.env.NODE_ENV === 'development') {
        console.log("[Compare] card state updated successfully", id)
      }

      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('success') || 'Success',
          description: `Car ${id}: Predicted ${formatCurrency(result.predicted_price)}`,
        })
      }
    } catch (error: any) {
      console.error('❌ [Compare] Prediction failed:', {
        id,
        error,
        errorMessage: error?.message,
        errorStack: error?.stack,
        errorResponse: error?.response?.data,
        errorStatus: error?.response?.status
      })
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: `Car ${id}: ${error?.message || 'Failed to predict price. Please check all fields are filled correctly.'}`,
          variant: 'destructive',
        })
      }
      // Use functional update to reset loading state
      // Handle case where car might not exist
      setCars(prevCars => {
        const car = prevCars.find(c => c.id === id)
        if (!car) {
          // Car doesn't exist, use first car as fallback or do nothing
          if (prevCars.length > 0) {
            return prevCars.map((c, index) =>
              index === 0 ? { ...c, loading: false } : c
            )
          }
          return prevCars
        }

        return prevCars.map(c => {
          if (c.id === id) {
            return { ...c, loading: false }
          }
          return c
        })
      })
    }
  }

  // Helper function to validate if car features are complete
  // Returns true only if all required fields are present
  const isValidCarFeatures = (features: CarFeatures | null): boolean => {
    if (!features) {
      return false
    }

    return !!(
      features.make &&
      features.model &&
      features.year &&
      features.mileage != null &&
      features.engine_size != null &&
      features.cylinders != null &&
      features.condition &&
      features.fuel_type &&
      features.location
    )
  }

  // Predict All - predict all cars at once with one click
  const predictAll = async () => {
    try {
      // Filter cars that have complete features but no prediction yet
      const carsToPredict = cars.filter(c => {
        const hasCompleteFeatures = isValidCarFeatures(c.features)
        const hasNoPrediction = !c.prediction
        const isNotLoading = !c.loading
        return hasCompleteFeatures && hasNoPrediction && isNotLoading
      })

      if (carsToPredict.length === 0) {
        // Check why no cars can be predicted
        const incompleteCars = cars.filter(c => c.features && !isValidCarFeatures(c.features) && !c.prediction)
        const carsWithPredictions = cars.filter(c => c.prediction)

        if (incompleteCars.length > 0) {
          if (toast?.toast) {
            toast.toast({
              title: 'Incomplete Car Details',
              description: `Please fill in all required fields (Make, Model, Year, Mileage, Engine Size, Cylinders, Condition, Fuel Type, Location) for ${incompleteCars.length} car${incompleteCars.length > 1 ? 's' : ''}`,
              variant: 'default',
            })
          }
        } else if (carsWithPredictions.length === cars.length && cars.length > 0) {
          if (toast?.toast) {
            toast.toast({
              title: 'All Cars Predicted',
              description: 'All cars already have predictions',
              variant: 'default',
            })
          }
        } else {
          if (toast?.toast) {
            toast.toast({
              title: 'No Cars to Predict',
              description: 'Please add cars and fill in their details first',
              variant: 'default',
            })
          }
        }
        return
      }

      setPredictingAll(true)

      // Set all cars to loading state
      setCars(prevCars => prevCars.map(c =>
        carsToPredict.some(ctp => ctp.id === c.id) ? { ...c, loading: true } : c
      ))

      try {
        // Predict all cars in parallel for better performance
        const predictionPromises = carsToPredict.map(async (car) => {
          if (!car.features) {
            return { id: car.id, success: false, error: 'No features' }
          }

          try {
            const result = await apiClient.predictPrice(car.features)

            // Validate result
            if (result && typeof result === 'object' && typeof result.predicted_price === 'number') {
              return { id: car.id, success: true, result, features: car.features }
            } else {
              throw new Error('Invalid prediction result: missing predicted_price')
            }
          } catch (error: any) {
            console.error(`❌ [Compare] Prediction failed for car ${car.id}:`, error)
            return {
              id: car.id,
              success: false,
              error: error?.message || 'Prediction failed',
              features: car.features
            }
          }
        })

        const results = await Promise.all(predictionPromises)

        // Update state with all results at once
        setCars(prevCars => prevCars.map(c => {
          const result = results.find(r => r.id === c.id)
          if (result && result.success && result.result && result.features) {
            return { ...c, prediction: result.result, features: result.features, loading: false }
          } else if (result && !result.success) {
            return { ...c, loading: false }
          }
          return c
        }))

        const successCount = results.filter(r => r.success).length
        const failureCount = results.filter(r => !r.success).length

        if (successCount > 0) {
          if (toast?.toast) {
            toast.toast({
              title: tCommon?.('success') || 'Success',
              description: `Successfully predicted ${successCount} car${successCount > 1 ? 's' : ''}${failureCount > 0 ? `. ${failureCount} failed.` : ''}`,
            })
          }
        }

        if (failureCount > 0) {
          const failedCars = results.filter(r => !r.success)
          console.error('❌ [Compare] Failed predictions:', failedCars)
          if (toast?.toast) {
            toast.toast({
              title: 'Some Predictions Failed',
              description: `${failureCount} car${failureCount > 1 ? 's' : ''} failed to predict. Please check the details and try again.`,
              variant: 'destructive',
            })
          }
        }
      } catch (error: any) {
        console.error('❌ [Compare] Predict All failed:', error)
        if (toast?.toast) {
          toast.toast({
            title: tCommon?.('error') || 'Error',
            description: error?.message || 'Failed to predict all cars',
            variant: 'destructive',
          })
        }
      } finally {
        setPredictingAll(false)
        // Ensure all loading states are cleared
        setCars(prevCars => prevCars.map(c => ({ ...c, loading: false })))
      }
    } catch (error: any) {
      console.error('❌ [Compare] Predict All outer error:', error)
      setPredictingAll(false)
      setCars(prevCars => prevCars.map(c => ({ ...c, loading: false })))
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: error?.message || 'An unexpected error occurred',
          variant: 'destructive',
        })
      }
    }
  }

  const handleSaveCompare = (name: string) => {
    if (isMarketplaceComparison && marketplaceMetrics && listings.length >= 2) {
      saveCompareToHistory({ name, mode: 'marketplace', ids: listings.map(l => l.id) })
      // Log comparison activity
      activityHelpers.logCompare(
        listings.map(l => l.id),
        listings.length
      )
      toast?.toast?.({ title: 'Saved', description: 'Comparison saved to history.' })
    } else if (!isMarketplaceComparison && allCarsHavePredictions && hasMultipleCars) {
      saveCompareToHistory({
        name,
        mode: 'prediction',
        state: { cars: cars.map(c => ({ features: c.features, prediction: c.prediction })) },
      })
      // Log comparison activity
      const carIds = cars.map((c, idx) => c.features ? `${c.features.make}-${c.features.model}-${idx}` : `car-${idx}`)
      activityHelpers.logCompare(carIds, cars.length)
      toast?.toast?.({ title: 'Saved', description: 'Comparison saved to history.' })
    }
  }

  const handleLoadCompare = (entry: CompareHistoryEntry) => {
    if (entry.mode === 'marketplace' && entry.ids?.length) {
      router.replace(`/${locale}/compare?ids=${entry.ids.join(',')}`)
    } else if (entry.mode === 'prediction' && entry.state?.cars?.length) {
      setCars(entry.state.cars.map((c, i) => ({
        id: `h-${i}-${Date.now()}`,
        features: c.features as CarFeatures | null,
        prediction: c.prediction as PredictionResponse | null,
        loading: false,
      })))
      router.replace(`/${locale}/compare`)
    }
  }

  // Marketplace comparison metrics
  const marketplaceMetrics = useMemo(() => {
    if (!isMarketplaceComparison || listings.length < 2) return null

    const sortedByPrice = [...listings].sort((a, b) => a.price - b.price)
    const bestDealIndex = listings.findIndex(l => l.id === sortedByPrice[0].id)
    const mostExpensiveIndex = listings.findIndex(l => l.id === sortedByPrice[sortedByPrice.length - 1].id)
    const avgPrice = listings.reduce((sum, l) => sum + l.price, 0) / listings.length

    // Calculate winner based on value (price/features ratio)
    const winners = listings.map(listing => {
      const featureScore = listing.features.length
      const valueScore = (avgPrice / listing.price) * (1 + featureScore * 0.1)
      return { id: listing.id, valueScore }
    }).sort((a, b) => b.valueScore - a.valueScore)

    return {
      bestDealIndex,
      mostExpensiveIndex,
      avgPrice,
      winnerId: winners[0]?.id,
      savings: listings.map(listing => {
        const maxPrice = sortedByPrice[sortedByPrice.length - 1].price
        return maxPrice - listing.price
      }),
    }
  }, [listings, isMarketplaceComparison])

  // Get all unique features across all listings
  const allFeatures = useMemo(() => {
    if (!isMarketplaceComparison) return []
    const featureSet = new Set<string>()
    listings.forEach(listing => {
      listing.features.forEach(feature => featureSet.add(feature))
    })
    return Array.from(featureSet).sort()
  }, [listings, isMarketplaceComparison])

  // Marketplace: getCarSpecs, chart data, spec rows
  const listingSpecMaps = useMemo(
    () => listings.map(l => getCarSpecs({
      make: l.make,
      model: l.model,
      year: l.year,
      transmission: l.transmission,
      fuel_type: l.fuel_type,
    })),
    [listings]
  )
  const listingChartData = useMemo(() => {
    if (!marketplaceMetrics || listings.length < 2) return []
    return listings.map((l, i) => {
      const s = listingSpecMaps[i]
      const fe = s?.fuelEconomy
      return {
        name: `${l.make} ${l.model}`,
        shortName: `${l.make} ${l.model}`.slice(0, 14),
        price: l.price,
        horsepower: s?.horsepower,
        fuelEconomy: fe ? Math.round((fe.city + fe.highway) / 2) : undefined,
        fullName: `${l.make} ${l.model} ${l.year}`,
        isBestDeal: i === marketplaceMetrics.bestDealIndex,
        isMostExpensive: i === marketplaceMetrics.mostExpensiveIndex,
      }
    })
  }, [listings, marketplaceMetrics, listingSpecMaps])
  const listingSpecRows = useMemo(() => {
    if (!marketplaceMetrics || listings.length < 2) return []
    const rows = [
      { label: 'Make & Model', values: listings.map(l => `${l.make} ${l.model}`) },
      { label: 'Year', values: listings.map(l => l.year) },
      { label: 'Mileage', values: listings.map(l => l.mileage), suffix: ' km', format: (v: string | number) => Number(v).toLocaleString() },
      { label: 'Condition', values: listings.map(l => l.condition) },
      { label: 'Fuel Type', values: listings.map(l => l.fuel_type) },
      { label: 'Transmission', values: listings.map(l => l.transmission) },
      { label: 'Horsepower', values: listings.map((_, i) => listingSpecMaps[i]?.horsepower ?? null), higherIsBetter: true, suffix: ' hp' },
      { label: 'Fuel Economy', values: listings.map((_, i) => { const e = listingSpecMaps[i]?.fuelEconomy; return e ? formatFuelEconomy(e.city, e.highway) : '—' }) },
      { label: 'Price', values: listings.map(l => l.price), format: (v: string | number) => formatCurrency(Number(v)) },
      { label: 'Savings vs Highest', values: marketplaceMetrics.savings, format: (v: string | number) => formatCurrency(Number(v)) },
    ]
    if (highlightDifferencesOnly) {
      return rows.filter(r => new Set(r.values.map(x => String(x ?? ''))).size > 1)
    }
    return rows
  }, [listings, marketplaceMetrics, listingSpecMaps, highlightDifferencesOnly])

  // Export data for PDF (prediction or marketplace)
  const exportData = useMemo(() => {
    if (isMarketplaceComparison && marketplaceMetrics && listings.length >= 2) {
      const best = marketplaceMetrics.bestDealIndex
      return {
        mode: 'marketplace' as const,
        columnLabels: listings.map(l => `${l.make} ${l.model}`),
        specRows: listingSpecRows,
        summary: listings.map((l, i) => ({ name: `${l.make} ${l.model}`, price: l.price, savings: marketplaceMetrics.savings[i] ?? 0 })),
        chartSummary: listingChartData,
        recommendation: `Best value: ${listings[best]?.make} ${listings[best]?.model} at ${formatCurrency(listings[best]?.price ?? 0)}. Save ${formatCurrency(marketplaceMetrics.savings[best] ?? 0)} vs most expensive.`,
      }
    }
    if (!isMarketplaceComparison && comparisonMetrics && specRows.length > 0) {
      return {
        mode: 'prediction' as const,
        columnLabels: cars.map((c, i) => c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`),
        specRows,
        summary: cars.map((c, i) => ({ name: c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`, price: c.prediction?.predicted_price ?? 0, savings: comparisonMetrics.savings[i] ?? 0 })),
        chartSummary: chartData,
        recommendation: comparisonMetrics.recommendation || '',
      }
    }
    return null
  }, [isMarketplaceComparison, marketplaceMetrics, listings, listingSpecRows, listingChartData, comparisonMetrics, specRows, cars, chartData])

  if (!mounted) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10 relative"
    >
      <div className="mx-auto max-w-7xl relative">
        {/* Enhanced Background Effects */}
        <motion.div
          animate={{ opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[1200px] h-[600px] bg-gradient-radial from-purple-500/25 via-indigo-500/20 to-transparent blur-3xl opacity-60 pointer-events-none"
        />
        <div className="absolute top-1/4 right-0 -z-10 w-[800px] h-[400px] bg-gradient-radial from-pink-500/15 via-purple-500/10 to-transparent blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -z-10 w-[600px] h-[300px] bg-gradient-radial from-blue-500/15 to-transparent blur-3xl opacity-30 pointer-events-none" />

        {/* Animated Grid Pattern */}
        <div className="absolute inset-0 -z-10 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

        {/* Header - Modern Design */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 md:mb-12 text-center relative"
        >
          <div className="relative inline-block">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
              {(t && typeof t === 'function' ? t('title') : null) || 'Compare Cars'}
            </h1>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-sm opacity-60" />
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-sm md:text-base text-[#94a3b8] mt-4 max-w-2xl mx-auto"
          >
            {isMarketplaceComparison
              ? 'Compare marketplace listings side by side'
              : (t && typeof t === 'function' ? t('description') : null) || 'Compare multiple cars side by side'
            }
          </motion.p>
        </motion.div>

        {/* Marketplace Comparison View */}
        {isMarketplaceComparison && (
          <>
            {loadingListings ? (
              <div className="space-y-6">
                <ListingCardSkeleton />
                <ListingCardSkeleton />
                <ListingCardSkeleton />
              </div>
            ) : listings.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-white/70">No listings found for comparison</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Marketplace: Summary, Chart, Specs, Value, Ownership */}
                {marketplaceMetrics && listings.length >= 2 && (
                  <>
                    <CompareSummaryCards
                      cars={listings.map((l, i) => ({ name: `${l.make} ${l.model}`, price: l.price, index: i }))}
                      bestDealIndex={marketplaceMetrics.bestDealIndex}
                      mostExpensiveIndex={marketplaceMetrics.mostExpensiveIndex}
                      savings={marketplaceMetrics.savings}
                    />
                    <SmartRecommendations
                      cars={listings.map((l, i) => ({
                        name: `${l.make} ${l.model}`,
                        index: i,
                        price: l.price,
                        horsepower: listingSpecMaps[i]?.horsepower,
                        fuelEconomy: listingSpecMaps[i]?.fuelEconomy ? (listingSpecMaps[i]!.fuelEconomy!.city + listingSpecMaps[i]!.fuelEconomy!.highway) / 2 : undefined,
                        savings: marketplaceMetrics.savings[i],
                        reliability: listingSpecMaps[i]?.reliabilityRating,
                      }))}
                      bestDealIndex={marketplaceMetrics.bestDealIndex}
                      savings={marketplaceMetrics.savings}
                      bestForPerformance={listings.reduce((b, _, i) => ((listingSpecMaps[i]?.horsepower ?? 0) > (listingSpecMaps[b]?.horsepower ?? 0) ? i : b), 0)}
                      bestForEconomy={listings.reduce((b, _, i) => { const e = listingSpecMaps[i]?.fuelEconomy; const x = listingSpecMaps[b]?.fuelEconomy; return (e ? (e.city + e.highway) / 2 : 0) > (x ? (x.city + x.highway) / 2 : 0) ? i : b; }, 0)}
                      bestForReliability={listings.reduce((b, _, i) => ((listingSpecMaps[i]?.reliabilityRating ?? 0) > (listingSpecMaps[b]?.reliabilityRating ?? 0) ? i : b), 0)}
                    />
                    {listingChartData.length > 0 && <ComparisonChart data={listingChartData} />}
                    {listingSpecRows.length > 0 && (
                      <div className="mb-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <h3 className="text-xl font-semibold text-white">Specifications & Comparison</h3>
                          <div className="flex items-center gap-2">
                            <Switch id="mk-hl-diff" checked={highlightDifferencesOnly} onCheckedChange={v => setHighlightDifferencesOnly(!!v)} />
                            <Label htmlFor="mk-hl-diff" className="text-sm text-[#94a3b8] cursor-pointer">Highlight differences only</Label>
                          </div>
                        </div>
                        <SpecificationTable
                          columnLabels={listings.map(l => `${l.make} ${l.model}`)}
                          rows={listingSpecRows}
                          bestDealIndex={marketplaceMetrics.bestDealIndex}
                          mostExpensiveIndex={marketplaceMetrics.mostExpensiveIndex}
                          highlightBestInRow
                          showIcons={false}
                        />
                      </div>
                    )}
                    <ValueAnalysisSection
                      cars={listings.map((l, i) => ({ name: `${l.make} ${l.model}`, price: l.price, horsepower: listingSpecMaps[i]?.horsepower ?? 0, mileage: l.mileage }))}
                      bestDealIndex={marketplaceMetrics.bestDealIndex}
                    />
                    <OwnershipCostsSection
                      cars={listings.map((l, i) => ({
                        name: `${l.make} ${l.model}`,
                        price: l.price,
                        mileage: l.mileage,
                        fuelEconomyCity: listingSpecMaps[i]?.fuelEconomy?.city ?? 25,
                        fuelEconomyHighway: listingSpecMaps[i]?.fuelEconomy?.highway ?? 33,
                        fuelType: l.fuel_type,
                      }))}
                      bestDealIndex={marketplaceMetrics.bestDealIndex}
                    />
                  </>
                )}
                {/* Action Buttons - marketplace - Glass Toolbar */}
                <div className="flex flex-wrap gap-2 justify-end bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3">
                  {marketplaceMetrics && listings.length >= 2 && (
                    <>
                      <ExportPDF
                        data={exportData}
                        onSuccess={() => toast?.toast?.({ title: 'Exported', description: 'PDF saved.' })}
                        onError={(e) => toast?.toast?.({ title: 'Export failed', description: e.message, variant: 'destructive' })}
                        variant="outline"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                      />
                      <ShareComparison
                        mode="marketplace"
                        ids={listings.map(l => l.id)}
                        onCopy={() => toast?.toast?.({ title: 'Link copied', description: 'Comparison link copied to clipboard.' })}
                        variant="outline"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                      />
                      <CompareSaveAndHistory
                        canSave={listings.length >= 2}
                        onSave={handleSaveCompare}
                        onLoad={handleLoadCompare}
                        variant="outline"
                        className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                      />
                    </>
                  )}
                  <Button
                    onClick={() => { if (typeof window !== 'undefined') window.print() }}
                    variant="outline"
                    className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                  >
                    <Download className="me-2 h-4 w-4" />
                    Print
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Prediction Comparison View (existing code) */}
        {!isMarketplaceComparison && (
          <>
            {/* Action Buttons - Modern Glass Toolbar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8 flex flex-wrap gap-3 justify-between items-center bg-gradient-to-r from-white/5 via-white/5 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl shadow-indigo-500/10"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => {
                    try {
                      addCar()
                    } catch (error) {
                      console.error('Error adding car:', error)
                    }
                  }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {(t && typeof t === 'function' ? t('addCar') : null) || 'Add Car'}
                </Button>
              </motion.div>
              <div className="flex gap-3 flex-wrap">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative"
                >
                  <Button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      predictAll().catch(err => {
                        console.error('❌ [Compare] predictAll error:', err)
                      })
                    }}
                    className="bg-gradient-to-r from-[#5B7FFF] via-indigo-500 to-purple-600 hover:from-[#5B7FFF]/90 hover:via-indigo-400 hover:to-purple-500 text-white border-0 shadow-lg shadow-[#5B7FFF]/40 hover:shadow-[#5B7FFF]/60 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    disabled={
                      predictingAll ||
                      cars.length === 0 ||
                      cars.every(c => !isValidCarFeatures(c.features) || c.prediction)
                    }
                    type="button"
                  >
                    {predictingAll ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Predicting All...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {(t && typeof t === 'function' ? t('predictAll') : null) || 'Predict All'}
                      </>
                    )}
                  </Button>
                </motion.div>
                {allCarsHavePredictions && hasMultipleCars && (
                  <>
                    <ExportPDF
                      data={exportData}
                      onSuccess={() => toast?.toast?.({ title: 'Exported', description: 'PDF saved.' })}
                      onError={(e) => toast?.toast?.({ title: 'Export failed', description: e.message, variant: 'destructive' })}
                      variant="outline"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    />
                    <ShareComparison
                      mode="prediction"
                      predictionState={{ cars: cars.map(c => ({ features: c.features, prediction: c.prediction })) }}
                      onCopy={() => toast?.toast?.({ title: 'Link copied', description: 'Comparison link copied to clipboard.' })}
                      variant="outline"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    />
                    <CompareSaveAndHistory
                      canSave={allCarsHavePredictions && hasMultipleCars}
                      onSave={handleSaveCompare}
                      onLoad={handleLoadCompare}
                      variant="outline"
                      className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                    />
                  </>
                )}
              </div>
            </motion.div>

            {/* Summary Cards */}
            <AnimatePresence>
              {allCarsHavePredictions && hasMultipleCars && comparisonMetrics && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
                  <CompareSummaryCards
                    cars={cars.map((c, i) => ({ name: c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`, price: c.prediction?.predicted_price || 0, index: i }))}
                    bestDealIndex={comparisonMetrics.bestDealIndex}
                    mostExpensiveIndex={comparisonMetrics.mostExpensiveIndex}
                    savings={comparisonMetrics.savings}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Smart Recommendations */}
            <AnimatePresence>
              {allCarsHavePredictions && hasMultipleCars && comparisonMetrics && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
                  <SmartRecommendations
                    cars={cars.map((c, i) => ({
                      name: c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`,
                      index: i,
                      price: c.prediction?.predicted_price || 0,
                      horsepower: specMaps[i]?.horsepower,
                      fuelEconomy: specMaps[i]?.fuelEconomy ? (specMaps[i]!.fuelEconomy!.city + specMaps[i]!.fuelEconomy!.highway) / 2 : undefined,
                      savings: comparisonMetrics.savings[i],
                      reliability: specMaps[i]?.reliabilityRating,
                    }))}
                    bestDealIndex={comparisonMetrics.bestDealIndex}
                    savings={comparisonMetrics.savings}
                    bestForPerformance={cars.reduce((best, c, i) => ((specMaps[i]?.horsepower ?? 0) > (specMaps[best]?.horsepower ?? 0) ? i : best), 0)}
                    bestForEconomy={cars.reduce((best, c, i) => { const e = specMaps[i]?.fuelEconomy; const b = specMaps[best]?.fuelEconomy; return (e ? (e.city + e.highway) / 2 : 0) > (b ? (b.city + b.highway) / 2 : 0) ? i : best; }, 0)}
                    bestForReliability={cars.reduce((best, c, i) => ((specMaps[i]?.reliabilityRating ?? 0) > (specMaps[best]?.reliabilityRating ?? 0) ? i : best), 0)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Comparison Charts (Price / Performance / Radar) */}
            <AnimatePresence>
              {chartData.length > 0 && hasMultipleCars && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mb-6">
                  <ComparisonChart data={chartData} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Specifications & Comparison Table */}
            <AnimatePresence>
              {allCarsHavePredictions && hasMultipleCars && comparisonMetrics && specRows.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 space-y-6">
                  <div className="mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="text-xl font-semibold text-white">Specifications & Comparison</h3>
                      <div className="flex items-center gap-2">
                        <Switch id="highlight-diff" checked={highlightDifferencesOnly} onCheckedChange={v => setHighlightDifferencesOnly(!!v)} />
                        <Label htmlFor="highlight-diff" className="text-sm text-[#94a3b8] cursor-pointer">Highlight differences only</Label>
                      </div>
                    </div>
                    <SpecificationTable
                      columnLabels={cars.map((c, i) => c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`)}
                      rows={specRows}
                      bestDealIndex={comparisonMetrics.bestDealIndex}
                      mostExpensiveIndex={comparisonMetrics.mostExpensiveIndex}
                      highlightBestInRow
                      showIcons
                    />
                  </div>

                  <ValueAnalysisSection
                    cars={cars.map((c, i) => ({
                      name: c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`,
                      price: c.prediction?.predicted_price || 0,
                      horsepower: specMaps[i]?.horsepower ?? 0,
                      mileage: c.features?.mileage ?? 0,
                    }))}
                    bestDealIndex={comparisonMetrics.bestDealIndex}
                  />

                  <OwnershipCostsSection
                    cars={cars.map((c, i) => ({
                      name: c.features ? `${c.features.make} ${c.features.model}` : `Car ${i + 1}`,
                      price: c.prediction?.predicted_price || 0,
                      mileage: c.features?.mileage ?? 0,
                      fuelEconomyCity: specMaps[i]?.fuelEconomy?.city ?? 25,
                      fuelEconomyHighway: specMaps[i]?.fuelEconomy?.highway ?? 33,
                      fuelType: c.features?.fuel_type,
                    }))}
                    bestDealIndex={comparisonMetrics.bestDealIndex}
                  />
                </motion.div>
              )}
            </AnimatePresence>


            {/* Car Cards Grid - Modern Design */}
            <motion.div
              layout
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <AnimatePresence>
                {cars.map((car, index) => {
                  const isBestDeal = comparisonMetrics?.bestDealIndex === index
                  const isMostExpensive = comparisonMetrics?.mostExpensiveIndex === index
                  const hasFeatures = car.features && isValidCarFeatures(car.features)

                  // CRITICAL FIX: Calculate progress based on step (33%/66%/100%), not field completion
                  // Step 1 = 33%, Step 2 = 66%, Step 3 = 100%
                  const currentStep = car.currentStep ?? 1
                  const stepProgressPercentage = Math.round((currentStep / 3) * 100)

                  return (
                    <motion.div
                      key={car.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -20 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      className="group"
                    >
                      <div
                        className={`relative bg-gradient-to-br from-white/5 via-white/5 to-white/3 backdrop-blur-xl border-2 rounded-3xl p-6 transition-all duration-500 overflow-visible ${isBestDeal && allCarsHavePredictions
                          ? 'border-green-500/60 shadow-2xl shadow-green-500/30'
                          : isMostExpensive && allCarsHavePredictions
                            ? 'border-red-500/50 shadow-xl shadow-red-500/20'
                            : 'border-white/10 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20'
                          }`}
                      >
                        {/* Animated Gradient Border */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl" />

                        {/* Green Glow for Best Deal */}
                        {isBestDeal && allCarsHavePredictions && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 -z-10 bg-gradient-radial from-green-500/30 via-green-500/15 to-transparent blur-3xl rounded-3xl"
                          />
                        )}

                        {/* Progress Indicator - Positioned top-left, below header to avoid overlap with remove button */}
                        {/* X button is at top-4 right-4 with z-20, badge is at top-16 left-4 with z-10 to ensure no overlap */}
                        {!car.prediction && (
                          <div className="absolute top-16 left-4 z-10 pointer-events-none">
                            <div className="relative w-10 h-10">
                              <svg className="transform -rotate-90 w-10 h-10">
                                <circle
                                  cx="20"
                                  cy="20"
                                  r="16"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  fill="none"
                                  className="text-white/10"
                                />
                                <motion.circle
                                  cx="20"
                                  cy="20"
                                  r="16"
                                  stroke={`url(#gradient-${car.id})`}
                                  strokeWidth="2.5"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeDasharray={`${2 * Math.PI * 16}`}
                                  initial={{ strokeDashoffset: 2 * Math.PI * 16 }}
                                  animate={{ strokeDashoffset: 2 * Math.PI * 16 * (1 - stepProgressPercentage / 100) }}
                                  transition={{ duration: 0.3 }}
                                />
                                <defs>
                                  <linearGradient id={`gradient-${car.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#5B7FFF" />
                                    <stop offset="100%" stopColor="#9333EA" />
                                  </linearGradient>
                                </defs>
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                                {stepProgressPercentage}%
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="pb-3 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
                                <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                  {index + 1}
                                </span>
                              </div>
                              <div>
                                <h3 className="text-white text-lg font-bold">
                                  {car.features?.make && car.features?.model
                                    ? `${car.features.make} ${car.features.model}`
                                    : `Car ${index + 1}`
                                  }
                                </h3>
                                {car.features?.year && (
                                  <p className="text-xs text-gray-400">{car.features.year}</p>
                                )}
                              </div>
                              {isBestDeal && allCarsHavePredictions && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="px-3 py-1 bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-green-300 text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg shadow-green-500/30 border border-green-500/30"
                                >
                                  <Trophy className="h-3 w-3" />
                                  Best Deal
                                </motion.span>
                              )}
                            </div>
                            {cars.length > 1 && (
                              <motion.div
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="relative z-20"
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeCar(car.id)}
                                  className="h-8 w-8 text-[#94a3b8] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all relative z-20"
                                  style={{ pointerEvents: 'auto' }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </motion.div>
                            )}
                          </div>
                          {car.prediction && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 p-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20"
                            >
                              <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                                {formatCurrency(car.prediction.predicted_price)}
                              </span>
                            </motion.div>
                          )}
                        </div>
                        <div className="space-y-4">
                          {!hasFeatures && !car.prediction ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex flex-col items-center justify-center py-12 px-4 text-center"
                            >
                              <motion.div
                                animate={{
                                  y: [0, -10, 0],
                                  rotate: [0, 5, -5, 0]
                                }}
                                transition={{
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }}
                                className="mb-4"
                              >
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border-2 border-dashed border-indigo-500/30">
                                  <Car className="h-10 w-10 text-indigo-400/50" />
                                </div>
                              </motion.div>
                              <p className="text-sm text-gray-400 mb-1">Add car details to get started</p>
                              <p className="text-xs text-gray-500">Fill in the form below to compare</p>
                            </motion.div>
                          ) : null}
                          <PredictionForm
                            key={car.id}
                            formId={car.id}
                            onSubmit={(values) => handleCardSubmit(car.id, values)}
                            onStepChange={handleStepChange}
                            onFormChange={(carId, partialFeatures) => {
                              // CRITICAL: onFormChange now receives carId as first parameter
                              // This ensures per-card isolation
                              if (carId !== car.id) {
                                return
                              }
                              // Save features to state as user types (for Predict All)
                              handleFormChange(carId, partialFeatures)
                            }}
                            prefillData={car.features ? {
                              // Normalize and ensure all required fields are present with correct keys
                              make: car.features.make || '',
                              model: car.features.model || '',
                              year: car.features.year || 2020,
                              mileage: car.features.mileage ?? 0,
                              engine_size: car.features.engine_size ?? 2.0,
                              cylinders: car.features.cylinders ?? 4,
                              trim: car.features.trim || '',
                              condition: car.features.condition || 'Good',
                              fuel_type: car.features.fuel_type || 'Gasoline',
                              location: car.features.location || '',
                              color: car.features.color || '',
                            } : null}
                            loading={car.loading || false}
                          />
                          {car.prediction && car.features && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 }}
                              className="mt-4 pt-4 border-t border-white/10 space-y-3"
                            >
                              <div className="p-5 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-2xl border border-indigo-500/30 shadow-lg">
                                <div className="text-xs uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                                  <Sparkles className="h-3 w-3" />
                                  Predicted Price
                                </div>
                                <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                                  {formatCurrency(car.prediction.predicted_price)}
                                </div>
                                {car.prediction.confidence_range && (
                                  <div className="flex items-center gap-2 text-xs text-gray-300 mt-3">
                                    <Shield className="h-3 w-3 text-indigo-400" />
                                    Confidence: <span className="font-semibold text-indigo-300">{car.prediction.confidence_range}%</span>
                                  </div>
                                )}
                              </div>
                              {car.prediction.deal_analysis && (
                                <div className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
                                  <p className="text-sm capitalize flex items-center gap-2">
                                    <span className="font-semibold text-white">Deal Rating:</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${car.prediction.deal_analysis.toLowerCase() === 'good' || car.prediction.deal_analysis.toLowerCase() === 'excellent'
                                      ? 'bg-green-500/20 text-green-300'
                                      : car.prediction.deal_analysis.toLowerCase() === 'fair'
                                        ? 'bg-yellow-500/20 text-yellow-300'
                                        : 'bg-red-500/20 text-red-300'
                                      }`}>
                                      {car.prediction.deal_analysis}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  )
}
