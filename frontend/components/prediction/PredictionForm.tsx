"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { SAMPLE_CAR, YEAR_RANGE, MILEAGE_RANGE, CONDITIONS, FUEL_TYPES } from '@/lib/constants'
import type { CarFeatures } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { useApiCache } from '@/hooks/use-api-cache'
import { RotateCcw, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { FieldTooltip, FIELD_TOOLTIPS } from './FieldTooltip'

// Step validation schemas
const step1Schema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: z.string().optional(),
  year: z.number().min(1900).max(2025),
})

const step2Schema = z.object({
  mileage: z.number().min(0).max(1000000),
  engine_size: z.number({ required_error: "Engine size is required" }).min(0.5).max(10.0),
  cylinders: z.number().min(2).max(12),
  fuel_type: z.string().min(1),
})

const step3Schema = z.object({
  condition: z.string().min(1),
  location: z.string().min(1),
})

// Base schema - validation ranges will be updated dynamically
const carFormSchema = z.object({
  year: z.number().min(1900).max(2025),
  mileage: z.number().min(0).max(1000000),
  engine_size: z.number({ required_error: "Engine size is required" }).min(0.5, { message: "Engine size must be at least 0.5L" }).max(10.0, { message: "Engine size must be at most 10.0L" }),
  cylinders: z.number().min(2).max(12),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  condition: z.string().min(1),
  fuel_type: z.string().min(1),
  location: z.string().min(1),
  color: z.string().optional(),
})

type CarFormValues = z.infer<typeof carFormSchema>

interface PredictionFormProps {
  onSubmit: (data: CarFeatures) => void
  loading?: boolean
  prefillData?: CarFeatures | null
  onFormChange?: (carId: string, data: Partial<CarFeatures> | null) => void
  onStepChange?: (carId: string, step: number) => void
  formId?: string // Unique identifier for this form instance (e.g., car card ID) - REQUIRED for isolation
}

export function PredictionForm({ onSubmit, loading = false, prefillData = null, onFormChange, onStepChange, formId }: PredictionFormProps) {
  // Debug logs only in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PredictionForm] onSubmit prop check', {
        formId,
        hasOnSubmit: !!onSubmit,
        onSubmitType: typeof onSubmit,
        onSubmitName: onSubmit?.name || 'anonymous'
      })
    }
  }, [formId, onSubmit])

  const t = useTranslations('predict.form')
  const toastHook = useToast()
  const { toast } = toastHook || { toast: () => { } }
  const [currentStep, setCurrentStep] = useState(1)

  // Safe translation helper - never throws, always returns a string
  // Catches IntlError.MISSING_MESSAGE and returns fallback
  const safeT = (key: string, fallback?: string): string => {
    try {
      const result = t(key)
      // Ensure we always return a string
      return typeof result === 'string' ? result : (fallback || key)
    } catch (error: any) {
      // Catch IntlError.MISSING_MESSAGE or any other error
      // Always return a fallback string to prevent UI crashes
      return fallback || key
    }
  }
  const [makes, setMakes] = useState<string[]>([])
  const [modelsByMake, setModelsByMake] = useState<Record<string, string[]>>({}) // Cache all models by make
  const [models, setModels] = useState<string[]>([]) // Filtered models for current make
  const [trims, setTrims] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [conditions, setConditions] = useState<string[]>(CONDITIONS)
  const [fuelTypes, setFuelTypes] = useState<string[]>(FUEL_TYPES)
  const [yearRange, setYearRange] = useState(YEAR_RANGE)
  const [mileageRange, setMileageRange] = useState(MILEAGE_RANGE)
  const [selectedMake, setSelectedMake] = useState<string>(SAMPLE_CAR.make || '')
  const [selectedModel, setSelectedModel] = useState<string>(SAMPLE_CAR.model || '')
  const [allEngineSizes, setAllEngineSizes] = useState<Array<{ size: number; display: string }>>([])
  const [availableEngines, setAvailableEngines] = useState<Array<{ size: number; display: string }>>([])
  const [availableCylinders, setAvailableCylinders] = useState<number[]>([])
  const [availableColors, setAvailableColors] = useState<string[]>([])
  const [initialLoading, setInitialLoading] = useState(true) // Only show loading on initial page load
  const [loadingTrims, setLoadingTrims] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [loadingEngines, setLoadingEngines] = useState(false)
  const [loadingCylinders, setLoadingCylinders] = useState(false)
  const [loadingColors, setLoadingColors] = useState(false)
  const [loadingFuelTypes, setLoadingFuelTypes] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)

  // API cache for options endpoints
  const optionsCache = useApiCache<any>(5 * 60 * 1000) // 5 minute cache
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    shouldUnregister: false, // CRITICAL FIX: Keeps data alive when steps are hidden
    defaultValues: prefillData ? {
      year: prefillData.year,
      mileage: prefillData.mileage,
      engine_size: prefillData.engine_size,
      cylinders: prefillData.cylinders,
      make: prefillData.make,
      model: prefillData.model,
      trim: prefillData.trim || '',
      condition: prefillData.condition as any,
      fuel_type: prefillData.fuel_type as any,
      location: prefillData.location,
      color: prefillData.color || '',
    } : {
      year: SAMPLE_CAR.year,
      mileage: SAMPLE_CAR.mileage,
      engine_size: SAMPLE_CAR.engine_size,
      cylinders: SAMPLE_CAR.cylinders,
      make: SAMPLE_CAR.make,
      model: SAMPLE_CAR.model,
      trim: '',
      condition: SAMPLE_CAR.condition as any,
      fuel_type: SAMPLE_CAR.fuel_type as any,
      location: SAMPLE_CAR.location,
      color: '',
    },
  })

  // Watch form values for car preview
  const makeValue = form.watch('make')
  const modelValue = form.watch('model')
  const yearValue = form.watch('year')
  const engineSizeValue = form.watch('engine_size')

  // Watch Step 2 values for isStepValid calculation (no auto-validation to prevent loops)
  const mileageValue = form.watch('mileage')
  const cylindersValue = form.watch('cylinders')
  const fuelTypeValue = form.watch('fuel_type')

  // Watch Step 3 values for isStepValid calculation
  const conditionValue = form.watch('condition')
  const locationValue = form.watch('location')


  // Sync selectedMake with form value to ensure Model dropdown works correctly
  useEffect(() => {
    if (makeValue && makeValue !== selectedMake) {
      setSelectedMake(makeValue)
    } else if (!makeValue && selectedMake) {
      setSelectedMake('')
    }
  }, [makeValue, selectedMake])

  // Clear trim when make or model changes
  useEffect(() => {
    if (selectedMake && selectedModel) {
      // Trim will be loaded by loadTrims useEffect
      return
    }
    // Clear trim if make or model is cleared - BUT ONLY if trims are not loading
    if (!selectedMake || !selectedModel) {
      // CRITICAL FIX: Don't clear trim if trims are currently loading
      if (!loadingTrims) {
        const currentTrim = form.getValues('trim');
        console.log('[TRIM DEBUG] [useEffect] Clearing trim because make/model cleared. Current trim:', currentTrim);
        form.setValue('trim', '', { shouldDirty: true, shouldTouch: true })
        form.clearErrors('trim')
      }
      setTrims([])
    }
  }, [selectedMake, selectedModel, form, loadingTrims])


  // Debounce make/model changes to prevent excessive API calls (increased to 1000ms)
  const debouncedMake = useDebounce(makeValue, 1000)
  const debouncedModel = useDebounce(modelValue, 1000)
  const debouncedEngineSize = useDebounce(engineSizeValue, 1000)

  // Load all engine sizes on mount
  useEffect(() => {
    const loadAllEngineSizes = async () => {
      try {
        const engines = await apiClient.getAllEngineSizes()
        setAllEngineSizes(engines)
        // If no engine size is set, use the first available or default
        if (!form.getValues('engine_size') && engines.length > 0) {
          form.setValue('engine_size', engines[0].size)
        }
      } catch (error) {
        console.error('Error loading all engine sizes:', error)
        // Use common engine sizes as fallback
        const commonSizes = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]
        setAllEngineSizes(commonSizes.map((size) => ({
          size,
          display: size === Math.floor(size) ? `${Math.floor(size)}L` : `${size}L`
        })))
      }
    }
    loadAllEngineSizes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load trims, engines, colors, and fuel types when make/model changes (debounced)
  useEffect(() => {
    // Cancel any pending requests
    abortControllersRef.current.forEach((controller) => controller.abort())
    abortControllersRef.current.clear()

    if (debouncedMake && debouncedModel && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      // Load trims first when make/model changes
      loadTrims(debouncedMake, debouncedModel)
      loadAvailableEngines(debouncedMake, debouncedModel)
      loadAvailableColors(debouncedMake, debouncedModel)
      loadAvailableFuelTypes(debouncedMake, debouncedModel)
    } else {
      // Use all engine sizes when make/model is not selected
      setAvailableEngines(allEngineSizes)
      setAvailableColors([])
      setTrims([])
      // CRITICAL FIX: Only clear trim if trims are not loading
      if (!loadingTrims) {
        const currentTrim = form.getValues('trim');
        console.log('[TRIM DEBUG] [debouncedMake/Model] Clearing trim because make/model empty. Current trim:', currentTrim);
        form.setValue('trim', '', { shouldValidate: true })
        form.clearErrors('trim')
      }
      // Trigger Step 1 validation if on Step 1 to update Next button state
      if (currentStep === 1) {
        form.trigger(['make', 'model', 'trim', 'year'])
      }
      // Reset to all fuel types when make/model is not selected
      loadMetadata()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMake, debouncedModel, allEngineSizes])

  // Load cylinders when engine size changes (debounced)
  useEffect(() => {
    if (debouncedMake && debouncedModel && debouncedEngineSize && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      loadAvailableCylinders(debouncedMake, debouncedModel, debouncedEngineSize)
    } else {
      setAvailableCylinders([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMake, debouncedModel, debouncedEngineSize])

  // Notify parent of form changes (prevents infinite loops by tracking previous values)
  const prevValuesRef = useRef<{ make?: string; model?: string; year?: number }>({})
  const isUpdatingFromPrefillRef = useRef(false) // Flag to prevent onFormChange when updating from prefillData

  useEffect(() => {
    if (!onFormChange) return
    // Skip if we're currently updating from prefillData (parent gave us this data, don't echo back)
    if (isUpdatingFromPrefillRef.current) return

    const currentValues = {
      make: makeValue,
      model: modelValue,
      year: yearValue,
    }

    // Only call onFormChange if values actually changed (prevents infinite loops)
    const hasChanged =
      prevValuesRef.current.make !== currentValues.make ||
      prevValuesRef.current.model !== currentValues.model ||
      prevValuesRef.current.year !== currentValues.year

    if (hasChanged && (currentValues.make || currentValues.model || currentValues.year)) {

      // CRITICAL: Pass formId (carId) as first parameter for per-card isolation
      if (formId && onFormChange) {
        onFormChange(formId, {
          make: currentValues.make,
          model: currentValues.model,
          year: currentValues.year,
        } as Partial<CarFeatures>)
      }

      // Update ref with current values
      prevValuesRef.current = currentValues
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makeValue, modelValue, yearValue, formId, onFormChange])

  // Update form when prefillData changes (CRITICAL: Do NOT trigger onFormChange - parent gave us this data)
  useEffect(() => {
    if (!prefillData) return

    // Don't reset form if user is actively filling it
    const currentValues = form.getValues()
    const hasUserData = currentValues.make && currentValues.model
    const hasUserTrim = currentValues.trim && typeof currentValues.trim === 'string' && currentValues.trim.trim() !== ''
    const prefillIsEmpty = !prefillData.make && !prefillData.model && !prefillData.year
    const prefillTrimEmpty = !prefillData.trim || (typeof prefillData.trim === 'string' && prefillData.trim.trim() === '')
    console.log('[TRIM DEBUG] [prefillData] Checking if reset needed:', {
      hasUserData,
      hasUserTrim,
      prefillIsEmpty,
      prefillTrimEmpty,
      currentTrim: currentValues.trim,
      prefillTrim: prefillData.trim,
      currentMake: currentValues.make,
      prefillMake: prefillData.make
    });

    // Don't reset if user has entered data and prefillData is empty/null
    if (hasUserData && prefillIsEmpty) {
      console.log('[TRIM DEBUG] [prefillData] Skipping reset - user has data, prefill is empty:', {
        userMake: currentValues.make,
        userModel: currentValues.model,
        userTrim: currentValues.trim,
        prefillMake: prefillData.make,
        prefillModel: prefillData.model
      })
      return
    }

    // CRITICAL: Don't reset if user has selected a trim
    if (hasUserTrim && prefillTrimEmpty) {
      console.log('[TRIM DEBUG] [prefillData] Skipping reset - user has selected trim:', {
        userTrim: currentValues.trim,
        prefillTrim: prefillData.trim,
        prefillTrimEmpty,
        userMake: currentValues.make,
        userModel: currentValues.model
      })
      return
    }

    // Set flag to prevent onFormChange from firing during this update
    console.log('[TRIM DEBUG] [prefillData] About to reset form. Current trim:', currentValues.trim, 'Prefill trim:', prefillData.trim);
    isUpdatingFromPrefillRef.current = true

    // Normalize prefillData to ensure correct field names and handle any data mapping issues
    // Handle potential mismatches like makeValue -> make, modelValue -> model, etc.
    const normalizedData = {
      make: prefillData.make || (prefillData as any).makeValue || '',
      model: prefillData.model || (prefillData as any).modelValue || '',
      year: prefillData.year || (prefillData as any).yearValue || 2020,
      mileage: prefillData.mileage ?? (prefillData as any).mileageValue ?? 0,
      engine_size: prefillData.engine_size ?? (prefillData as any).engineSize ?? 2.0,
      cylinders: prefillData.cylinders ?? (prefillData as any).cylindersValue ?? 4,
      trim: prefillData.trim || (prefillData as any).trimValue || '',
      condition: prefillData.condition || (prefillData as any).conditionValue || 'Good',
      fuel_type: prefillData.fuel_type || (prefillData as any).fuelType || 'Gasoline',
      location: prefillData.location || (prefillData as any).locationValue || '',
      color: prefillData.color || (prefillData as any).colorValue || '',
    }

    const formValues = {
      year: normalizedData.year,
      mileage: normalizedData.mileage,
      engine_size: normalizedData.engine_size,
      cylinders: normalizedData.cylinders,
      make: normalizedData.make,
      model: normalizedData.model,
      trim: normalizedData.trim,
      condition: normalizedData.condition as any,
      fuel_type: normalizedData.fuel_type as any,
      location: normalizedData.location,
      color: normalizedData.color,
    }


    // Update prevValuesRef BEFORE resetting form to prevent change detection
    // This ensures the onFormChange useEffect sees these as the "previous" values
    // Use normalized data to ensure consistency
    prevValuesRef.current = {
      make: normalizedData.make,
      model: normalizedData.model,
      year: normalizedData.year,
    }


    // Reset form with new values (this will trigger watched values to update)
    console.log('[TRIM DEBUG] [prefillData] Resetting form with values:', {
      trim: formValues.trim,
      make: formValues.make,
      model: formValues.model,
      fullFormValues: formValues
    });
    form.reset(formValues)
    const afterResetTrim = form.getValues('trim');
    console.log('[TRIM DEBUG] [prefillData] Trim after reset:', afterResetTrim);
    // Use normalized data to ensure correct state updates
    setSelectedMake(normalizedData.make)
    setSelectedModel(normalizedData.model)
    // Preserve model when updating from prefillData (don't clear it)
    updateModelsForMake(normalizedData.make, true)

    // CRITICAL: Trigger form validation after reset to ensure isStepValid reflects correct state
    // Trigger validation for all fields to ensure form state is correct
    form.trigger()

    // Clear the flag after a brief delay to allow form.reset to complete
    // This prevents the onFormChange useEffect from firing during the reset
    // Use requestAnimationFrame to ensure form.reset has completed
    requestAnimationFrame(() => {
      isUpdatingFromPrefillRef.current = false
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillData])

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      if (mounted) {
        setInitialLoading(true)
        // Load all makes and models once, locations, metadata, and engine sizes in parallel
        const results = await Promise.all([
          loadAllMakesAndModels(),
          loadLocations(),
          loadMetadata()
        ])
        const locationsList = (results[1] ?? []) as string[]

        // After data is loaded, set up defaults
        if (mounted) {
          // Ensure location has a valid value so the Select always shows a selection
          const currentLocation = form.getValues('location')?.trim() || ''
          const hasMatch = currentLocation && locationsList?.some(
            (loc) => loc.trim().toLowerCase() === currentLocation.toLowerCase()
          )
          if (!hasMatch && locationsList?.length > 0) {
            const first = locationsList[0]
            form.setValue('location', first, { shouldValidate: true, shouldDirty: false })
          }

          const defaultMake = SAMPLE_CAR.make || form.getValues('make')
          const defaultModel = SAMPLE_CAR.model || form.getValues('model')
          if (defaultMake && defaultMake.trim() !== '') {
            setSelectedMake(defaultMake)
            updateModelsForMake(defaultMake)
            // Load trims if default model also exists
            if (defaultModel && defaultModel.trim() !== '') {
              setSelectedModel(defaultModel)
              await loadTrims(defaultMake, defaultModel)
            }
          }
          // Ensure engine sizes are available even if make/model not selected
          if (allEngineSizes.length > 0) {
            setAvailableEngines(allEngineSizes)
          }
          setInitialLoading(false)
        }
      }
    }
    loadData()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load models for a specific make (fallback if not in cache)
  // CRITICAL: Use formId in cache key to ensure per-card isolation
  const loadModelsForMake = useCallback(async (make: string) => {
    if (!make || make.trim() === '') {
      setModels([])
      setLoadingModels(false)
      return
    }

    // CRITICAL FIX: Include formId in cache key for per-card isolation
    // This ensures each card's model loading is independent
    const cacheKey = `models:${formId || 'default'}:${make}`
    const existingController = abortControllersRef.current.get(cacheKey)
    if (existingController) {
      existingController.abort()
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(cacheKey, abortController)

    setLoadingModels(true)

    // If not in cache, load from API
    try {
      const modelsList = await apiClient.getModels(make)

      // Check if request was aborted
      if (abortController.signal.aborted) {
        abortControllersRef.current.delete(cacheKey)
        setLoadingModels(false)
        return
      }

      // CRITICAL FIX: Check if this request is still relevant for THIS card
      // Only apply results if the selectedMake still matches what we requested AND formId matches
      // This prevents cross-card contamination
      if (selectedMake !== make) {
        abortControllersRef.current.delete(cacheKey)
        setLoadingModels(false)
        return
      }

      // Ensure modelsList is an array
      const modelsArray = Array.isArray(modelsList) ? modelsList : (modelsList ? [modelsList] : [])

      if (modelsArray.length > 0) {
        // Update cache (shared across cards, but that's OK - it's just a cache)
        setModelsByMake(prev => ({
          ...prev,
          [make]: modelsArray
        }))
        setModels(modelsArray)
      } else {
        setModels([])
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        abortControllersRef.current.delete(cacheKey)
        // CRITICAL: Always clear loading state even on abort
        setLoadingModels(false)
        return
      }
      console.error(`[Compare] Error loading models for ${formId}:${make}:`, error)
      setModels([])
      // CRITICAL: Always clear loading state on error
      setLoadingModels(false)
    } finally {
      // CRITICAL: Always clear loading state and cleanup, even if we returned early
      // Check if this is still the current request before clearing
      const currentController = abortControllersRef.current.get(cacheKey)
      if (currentController === abortController) {
        abortControllersRef.current.delete(cacheKey)
        // Double-check selectedMake still matches before clearing loading
        if (selectedMake === make) {
          setLoadingModels(false)
        }
      }
    }
  }, [selectedMake, formId])

  // Filter models locally based on selected make (no API call)
  const updateModelsForMake = useCallback((make: string, preserveModel: boolean = false) => {
    if (!make || make.trim() === '') {
      setModels([])
      setLoadingModels(false)
      if (!preserveModel) {
        form.setValue('model', '')
        setSelectedModel('')
      }
      return
    }

    // Check cache first
    const cachedModels = modelsByMake[make]
    if (cachedModels && Array.isArray(cachedModels) && cachedModels.length > 0) {
      // Use spread operator to create new array reference and ensure React detects the change
      const modelsArray = [...cachedModels]
      setModels(modelsArray)
      // CRITICAL: Always clear loading state when using cache
      setLoadingModels(false)
    } else {
      // If not in cache, load it
      loadModelsForMake(make)
    }

    // Only clear model selection when make changes if not preserving (e.g., during prefillData update)
    if (!preserveModel) {
      form.setValue('model', '')
      setSelectedModel('')
      setTrims([])
      // Don't validate trim here - let loadTrims handle setting the value after model is selected
      form.clearErrors('trim')
    }
  }, [modelsByMake, form, loadModelsForMake, formId])

  // Update models when make changes (local filtering, no API call)
  useEffect(() => {
    if (selectedMake) {
      updateModelsForMake(selectedMake)
    } else {
      // Ensure models is always a valid array, never undefined/null
      setModels([])
      setLoadingModels(false)
    }
  }, [selectedMake, updateModelsForMake])

  // Ensure models is always a valid array (defensive check)
  useEffect(() => {
    if (!Array.isArray(models)) {
      setModels([])
    }
  }, [models])

  const loadMetadata = async () => {
    setLoadingMetadata(true)
    try {
      const metadata = await apiClient.getMetadata()
      if (metadata.conditions.length > 0) {
        setConditions(metadata.conditions)
      }
      if (metadata.fuel_types.length > 0) {
        setFuelTypes(metadata.fuel_types)
      }
      if (metadata.year_range) {
        setYearRange(metadata.year_range)
      }
      if (metadata.mileage_range) {
        setMileageRange(metadata.mileage_range)
      }
    } catch (error) {
      // Use defaults from constants - silent fail
    } finally {
      setLoadingMetadata(false)
    }
  }

  // Load all makes and models once on mount
  const loadAllMakesAndModels = async () => {
    try {
      const makesList = await apiClient.getMakes()
      const safeMakesList = Array.isArray(makesList) ? makesList : []
      setMakes(safeMakesList.length > 0 ? safeMakesList : [])

      // Load models for all makes in parallel
      const modelsPromises = safeMakesList.map(async (make: string) => {
        try {
          const modelsList = await apiClient.getModels(make)
          const safeModels = Array.isArray(modelsList) ? modelsList : []
          return { make, models: safeModels }
        } catch (error) {
          console.error(`Error loading models for ${make}:`, error)
          return { make, models: [] }
        }
      })

      const modelsResults = await Promise.all(modelsPromises)
      const modelsCache: Record<string, string[]> = {}
      modelsResults.forEach(({ make, models }) => {
        const safeModels = Array.isArray(models) ? models : []
        modelsCache[make] = safeModels.length > 0 ? safeModels : []
      })

      setModelsByMake(modelsCache)

      // Set initial models if default make exists
      const defaultMake = SAMPLE_CAR.make || form.getValues('make')
      if (defaultMake && modelsCache[defaultMake] && Array.isArray(modelsCache[defaultMake]) && modelsCache[defaultMake].length > 0) {
        setModels([...modelsCache[defaultMake]])
      }
    } catch (error) {
      console.error('Error loading makes and models:', error)
      setMakes([])
      setModelsByMake({})
      setModels([])
    }
  }

  const loadTrims = async (make: string, model: string) => {
    // Prevent multiple simultaneous calls
    if (loadingTrims) {
      // Already loading - don't clear trim, just return
      return
    }
    // Only clear trim if make/model are actually empty
    if (!make || !model || make.trim() === '' || model.trim() === '') {
      const currentTrim = form.getValues('trim');
      console.log('[TRIM DEBUG] [loadTrims] Clearing trim because make/model empty. Current trim:', currentTrim);
      setTrims([])
      form.setValue('trim', '')
      form.clearErrors('trim')
      return
    }

    const cacheKey = `trims:${make}:${model}`

    // Cancel any pending request for this key
    const existingController = abortControllersRef.current.get(cacheKey)
    if (existingController) {
      existingController.abort()
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(cacheKey, abortController)

    setLoadingTrims(true)
    try {
      const trimsList = await optionsCache.getOrFetch(
        cacheKey,
        async () => {
          try {
            return await apiClient.getTrims(make, model)
          } catch (error: any) {
            if (error.name === 'AbortError') {
              throw error
            }
            throw error
          }
        }
      )

      if (abortController.signal.aborted) {
        return
      }

      if (trimsList.length > 0) {
        const currentTrim = form.getValues('trim');
        console.log('[TRIM DEBUG] [loadTrims] Trims loaded. Current trim:', currentTrim, 'Available trims:', trimsList);
        setTrims(trimsList)
        form.clearErrors('trim')
      } else {
        setTrims([])
        if (process.env.NODE_ENV === 'development') {
          console.log('[PredictionForm] No trims found for:', { make, model })
        }
        form.setValue('trim', '', { shouldValidate: true, shouldDirty: true, shouldTouch: true })
        form.clearErrors('trim')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      console.error('Error loading trims:', error)
      setTrims([])
      form.setValue('trim', '', { shouldValidate: true, shouldDirty: true, shouldTouch: true })
      form.clearErrors('trim')
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingTrims(false)
    }
  }

  const loadAvailableEngines = async (make: string, model: string) => {
    if (loadingEngines || !make || !model || make.trim() === '' || model.trim() === '') {
      // Use all engine sizes when make/model not selected
      setAvailableEngines(allEngineSizes)
      return
    }

    const cacheKey = `engines:${make}:${model}`

    // Cancel any pending request for this key
    const existingController = abortControllersRef.current.get(cacheKey)
    if (existingController) {
      existingController.abort()
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(cacheKey, abortController)

    setLoadingEngines(true)
    try {
      const engines = await optionsCache.getOrFetch(
        cacheKey,
        async () => {
          try {
            return await apiClient.getAvailableEngines(make, model)
          } catch (error: any) {
            if (error.name === 'AbortError') {
              throw error
            }
            throw error
          }
        }
      )

      if (abortController.signal.aborted) {
        return
      }

      // If engines found for this make/model, use them; otherwise use all engine sizes
      if (engines.length > 0) {
        setAvailableEngines(engines)
        // If only one engine option, auto-select it
        if (engines.length === 1 && engines[0].size) {
          form.setValue('engine_size', engines[0].size)
          // Also load cylinders for this engine
          await loadAvailableCylinders(make, model, engines[0].size)
        }
      } else {
        // Fallback to all engine sizes if none found for this make/model
        setAvailableEngines(allEngineSizes)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      console.error('Error loading engines:', error)
      // Fallback to all engine sizes on error
      setAvailableEngines(allEngineSizes)
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingEngines(false)
    }
  }

  const loadAvailableCylinders = async (make: string, model: string, engineSize: number) => {
    if (loadingCylinders || !make || !model || make.trim() === '' || model.trim() === '' || !engineSize) {
      setAvailableCylinders([])
      return
    }

    const cacheKey = `cylinders:${make}:${model}:${engineSize}`

    // Cancel any pending request for this key
    const existingController = abortControllersRef.current.get(cacheKey)
    if (existingController) {
      existingController.abort()
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(cacheKey, abortController)

    setLoadingCylinders(true)
    try {
      const cylinders = await optionsCache.getOrFetch(
        cacheKey,
        async () => {
          try {
            return await apiClient.getAvailableCylinders(make, model, engineSize)
          } catch (error: any) {
            if (error.name === 'AbortError') {
              throw error
            }
            throw error
          }
        }
      )

      if (abortController.signal.aborted) {
        return
      }

      setAvailableCylinders(cylinders)

      // If only one cylinder option, auto-select it
      if (cylinders.length === 1 && cylinders[0]) {
        form.setValue('cylinders', cylinders[0])
      } else if (cylinders.length > 0 && !cylinders.includes(form.getValues('cylinders'))) {
        // If current value is not in available options, select first one
        if (cylinders[0]) {
          form.setValue('cylinders', cylinders[0])
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      console.error('Error loading cylinders:', error)
      setAvailableCylinders([4]) // Default to 4
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingCylinders(false)
    }
  }

  const loadAvailableColors = async (make: string, model: string) => {
    if (loadingColors || !make || !model || make.trim() === '' || model.trim() === '') {
      setAvailableColors([])
      return
    }

    const cacheKey = `colors:${make}:${model}`

    // Cancel any pending request for this key
    const existingController = abortControllersRef.current.get(cacheKey)
    if (existingController) {
      existingController.abort()
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(cacheKey, abortController)

    setLoadingColors(true)
    try {
      const colors = await optionsCache.getOrFetch(
        cacheKey,
        async () => {
          try {
            return await apiClient.getAvailableColors(make, model)
          } catch (error: any) {
            if (error.name === 'AbortError') {
              throw error
            }
            throw error
          }
        }
      )

      if (abortController.signal.aborted) {
        return
      }

      setAvailableColors(colors)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      console.error('Error loading colors:', error)
      // Use default colors
      setAvailableColors(['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Gold', 'Brown', 'Orange', 'Yellow', 'Purple', 'Beige', 'Other'])
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingColors(false)
    }
  }

  const loadAvailableFuelTypes = async (make: string, model: string) => {
    if (!make || !model || make.trim() === '' || model.trim() === '') {
      // Reset to all fuel types from metadata when make/model is cleared
      try {
        const metadata = await optionsCache.getOrFetch('metadata', () => apiClient.getMetadata())
        if (metadata.fuel_types.length > 0) {
          setFuelTypes(metadata.fuel_types)
        }
      } catch (error) {
        // Use default fuel types
        setFuelTypes(FUEL_TYPES)
      }
      return
    }

    if (loadingFuelTypes) {
      return
    }

    const cacheKey = `fuelTypes:${make}:${model}`

    // Cancel any pending request for this key
    const existingController = abortControllersRef.current.get(cacheKey)
    if (existingController) {
      existingController.abort()
    }

    const abortController = new AbortController()
    abortControllersRef.current.set(cacheKey, abortController)

    setLoadingFuelTypes(true)
    try {
      const fuelTypesList = await optionsCache.getOrFetch(
        cacheKey,
        async () => {
          try {
            return await apiClient.getAvailableFuelTypes(make, model)
          } catch (error: any) {
            if (error.name === 'AbortError') {
              throw error
            }
            throw error
          }
        }
      )

      if (abortController.signal.aborted) {
        return
      }
      if (fuelTypesList.length > 0) {
        setFuelTypes(fuelTypesList)
        const currentFuelType = form.getValues('fuel_type')

        // If only one fuel type available, auto-select it
        if (fuelTypesList.length === 1) {
          form.setValue('fuel_type', fuelTypesList[0] as any)
        }
        // If current fuel type is not in the new list, reset it to the first available
        else if (currentFuelType && !fuelTypesList.includes(currentFuelType)) {
          form.setValue('fuel_type', fuelTypesList[0] as any)
        }
      } else {
        // Fallback to all fuel types if none found for this make/model
        try {
          const metadata = await optionsCache.getOrFetch('metadata', () => apiClient.getMetadata())
          if (metadata.fuel_types.length > 0) {
            setFuelTypes(metadata.fuel_types)
          } else {
            setFuelTypes(FUEL_TYPES)
          }
        } catch (error) {
          setFuelTypes(FUEL_TYPES)
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return // Request was cancelled, ignore
      }
      console.error('Error loading fuel types:', error)
      // Fallback to all fuel types from metadata
      try {
        const metadata = await optionsCache.getOrFetch('metadata', () => apiClient.getMetadata())
        if (metadata.fuel_types.length > 0) {
          setFuelTypes(metadata.fuel_types)
        } else {
          setFuelTypes(FUEL_TYPES)
        }
      } catch (metaError) {
        setFuelTypes(FUEL_TYPES)
      }
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingFuelTypes(false)
    }
  }

  const loadLocations = async (): Promise<string[]> => {
    try {
      const locationsList = await apiClient.getLocations()
      const list = Array.isArray(locationsList) && locationsList.length > 0 ? locationsList : []
      setLocations(list)
      return list
    } catch {
      setLocations([])
      return []
    }
  }

  // Step validation
  const validateStep = async (step: number): Promise<boolean> => {
    const values = form.getValues()
    console.log('[TRIM DEBUG] [validateStep] Validating step', step, 'with values:', {
      trim: values.trim,
      trimType: typeof values.trim,
      trimLength: values.trim?.length,
      allValues: values
    });
    let schema: z.ZodSchema

    switch (step) {
      case 1:
        schema = step1Schema
        break
      case 2:
        schema = step2Schema
        break
      case 3:
        schema = step3Schema
        break
      default:
        return false
    }

    try {
      await schema.parseAsync(values)
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          const field = err.path[0] as keyof CarFormValues
          form.setError(field, { message: err.message })
        })
      }
      return false
    }
  }

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate Step 1 fields: make, model, trim, year
      const step1Valid = await form.trigger(["make", "model", "trim", "year"], { shouldFocus: true })
      const errors = form.formState.errors
      const step1Errors = Object.entries(errors)
        .filter(([field]) => ['make', 'model', 'trim', 'year'].includes(field))
        .filter(([_, error]) => error)

      if (!step1Valid || step1Errors.length > 0) {
        const missingFields = step1Errors.map(([field, error]) => `${field}: ${error?.message || 'required'}`)
        toast({
          title: "Please fill in all required fields",
          description: missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : "Please fill in Make, Model, Trim, and Year",
          variant: "destructive",
        })
        return
      }
    } else if (currentStep === 2) {
      // Validate Step 2 fields: mileage, engine_size, cylinders, fuel_type
      const step2Valid = await form.trigger(["mileage", "engine_size", "cylinders", "fuel_type"], { shouldFocus: true })
      const errors = form.formState.errors
      const step2Errors = Object.entries(errors)
        .filter(([field]) => ['mileage', 'engine_size', 'cylinders', 'fuel_type'].includes(field))
        .filter(([_, error]) => error)

      if (!step2Valid || step2Errors.length > 0) {
        const missingFields = step2Errors.map(([field, error]) => `${field}: ${error?.message || 'required'}`)
        toast({
          title: "Please fill in all required fields",
          description: missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : "Please fill in all Step 2 fields",
          variant: "destructive",
        })
        return
      }
    }

    // Validation passed: advance to next step
    const newStep = Math.min(currentStep + 1, 3)
    setCurrentStep(newStep)
    if (formId && onStepChange) {
      onStepChange(formId, newStep)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleBack = () => {
    // Save current trim before navigation
    const currentTrim = form.getValues('trim')
    console.log('[TRIM DEBUG] [handleBack] Preserving trim on back:', currentTrim, 'Full form state:', form.getValues())

    const newStep = Math.max(currentStep - 1, 1)
    setCurrentStep(newStep)
    // Notify parent of step change for progress tracking
    if (formId && onStepChange) {
      onStepChange(formId, newStep)
    }

    // Restore trim after navigation to prevent it from being cleared
    if (currentTrim) {
      setTimeout(() => {
        const beforeRestore = form.getValues('trim');
        console.log('[TRIM DEBUG] [handleBack] Restoring trim. Before restore:', beforeRestore, 'Should restore:', currentTrim);
        form.setValue('trim', currentTrim, {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true
        })
        form.clearErrors('trim')
        const afterRestore = form.getValues('trim');
        console.log('[TRIM DEBUG] [handleBack] Trim restored after back navigation:', afterRestore, 'Full form state:', form.getValues())
      }, 100)
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Notify parent of step changes (guarded to prevent infinite loops)
  const prevStepRef = useRef<number>(currentStep)
  useEffect(() => {
    // Only call onStepChange if step actually changed (prevents infinite loops)
    if (formId && onStepChange && currentStep !== prevStepRef.current) {
      prevStepRef.current = currentStep
      onStepChange(formId, currentStep)
    }
  }, [formId, onStepChange, currentStep])

  const handleSubmit = async (data: CarFormValues) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("[PredictionForm] inside handleSubmit callback", formId, data)
    }

    // Validate fuel_type before submission
    const validFuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']
    const fuelType = String(data.fuel_type).trim()

    if (!validFuelTypes.includes(fuelType)) {
      console.error('❌ [PredictionForm] Invalid fuel type:', { formId, fuelType, validFuelTypes })
      // Show inline error and prevent submission
      form.setError('fuel_type', {
        type: 'manual',
        message: `Fuel type must be one of: ${validFuelTypes.join(', ')}`
      })
      toast({
        title: "Invalid Fuel Type",
        description: `Fuel type must be one of: ${validFuelTypes.join(', ')}`,
        variant: "destructive",
      })
      return
    }

    // Clean the data before submission
    console.log('[PredictionForm] Raw form data before cleaning:', {
      mileage: data.mileage,
      mileageType: typeof data.mileage,
      year: data.year,
      engine_size: data.engine_size,
      cylinders: data.cylinders,
      trim: data.trim,
      fullData: data
    });

    const cleanedData: CarFeatures = {
      ...data,
      // Trim is now required, ensure it's a valid string
      trim: String(data.trim).trim(),
      // Ensure all required fields are present and valid
      year: Number(data.year),
      mileage: Number(data.mileage),
      engine_size: Number(data.engine_size),
      cylinders: Number(data.cylinders),
      make: String(data.make).trim(),
      model: String(data.model).trim(),
      condition: String(data.condition).trim(),
      fuel_type: fuelType, // Use validated fuel type
      location: String(data.location).trim(),
      color: data.color && data.color.trim() !== '' ? String(data.color).trim() : undefined,
    }

    console.log('[PredictionForm] Cleaned data after conversion:', {
      mileage: cleanedData.mileage,
      mileageType: typeof cleanedData.mileage,
      isNaN: isNaN(cleanedData.mileage as number),
      year: cleanedData.year,
      engine_size: cleanedData.engine_size,
      cylinders: cleanedData.cylinders,
      trim: cleanedData.trim,
      fullCleanedData: cleanedData
    });

    // Validate all required fields are present
    const requiredFields = ['make', 'model', 'trim', 'year', 'mileage', 'engine_size', 'cylinders', 'condition', 'fuel_type', 'location']
    const missingFields = requiredFields.filter(field => {
      const value = cleanedData[field as keyof CarFeatures]
      // Check for undefined, null, or NaN (for numeric fields)
      if (value === undefined || value === null) return true
      if (typeof value === 'number' && isNaN(value)) return true
      // For strings, check if empty
      if (typeof value === 'string' && value.trim() === '') return true
      return false
    })

    if (missingFields.length > 0) {
      console.error('❌ [PredictionForm] Missing required fields:', { formId, missingFields, cleanedData })
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive",
      })
      return
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log("[PredictionForm] calling parent onSubmit now", formId)
      }

      console.log('[PredictionForm] Submitting to API:', cleanedData)
      console.log('[PredictionForm] Mileage value being sent:', {
        mileage: cleanedData.mileage,
        mileageType: typeof cleanedData.mileage,
        isNaN: isNaN(cleanedData.mileage as number),
        isValid: cleanedData.mileage !== undefined && cleanedData.mileage !== null && !isNaN(cleanedData.mileage as number)
      })

      if (!onSubmit) {
        console.error('❌ [PredictionForm] onSubmit is not defined!', { formId })
        toast({
          title: "Submission Error",
          description: "Form submission handler is not configured",
          variant: "destructive",
        })
        return
      }

      // Call the parent's onSubmit callback - signature: onSubmit(values)
      await onSubmit(cleanedData)
    } catch (error) {
      console.error('❌ [PredictionForm] Error calling onSubmit:', { formId, error, errorStack: error instanceof Error ? error.stack : undefined })
      toast({
        title: "Submission Error",
        description: error instanceof Error ? error.message : 'Failed to submit form',
        variant: "destructive",
      })
    }
  }

  const handleFinalSubmit = async () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PredictionForm] Predict Price clicked', { formId, currentStep })
    }

    // CRITICAL: Check if onSubmit exists before proceeding
    if (!onSubmit) {
      console.error('❌ [PredictionForm] onSubmit is undefined!', { formId })
      toast({
        title: "Submission Error",
        description: "Form submission handler is not configured. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    // DEBUG: Log full form state before validation
    const formValuesBeforeValidation = form.getValues()
    const formStateBeforeValidation = {
      values: formValuesBeforeValidation,
      errors: form.formState.errors,
      touchedFields: form.formState.touchedFields,
      dirtyFields: form.formState.dirtyFields,
      isValid: form.formState.isValid,
    }
    console.log('[TRIM DEBUG] [handleFinalSubmit] Form state BEFORE validation:', {
      formId,
      trim: formValuesBeforeValidation.trim,
      trimType: typeof formValuesBeforeValidation.trim,
      trimLength: formValuesBeforeValidation.trim?.length,
      watchedTrim: form.watch('trim'),
      fullState: formStateBeforeValidation,
    })

    // CRITICAL FIX: Ensure trim value is properly set before validation
    // Sometimes the Controller value might not sync immediately, so we check and sync if needed
    const currentTrim = form.getValues('trim')
    console.log('[TRIM DEBUG] [handleFinalSubmit] Current trim from getValues:', currentTrim);
    if (!currentTrim || (typeof currentTrim === 'string' && currentTrim.trim() === '')) {
      // Try to get the value from the watched value as a fallback
      const watchedTrim = form.watch('trim')
      console.log('[TRIM DEBUG] [handleFinalSubmit] Trim is empty, checking watched value:', watchedTrim);
      if (watchedTrim && watchedTrim.trim() !== '') {
        console.log('[TRIM DEBUG] [handleFinalSubmit] Syncing trim value from watch:', watchedTrim)
        form.setValue('trim', watchedTrim, { shouldValidate: false, shouldDirty: true, shouldTouch: true })
        const afterSyncTrim = form.getValues('trim');
        console.log('[TRIM DEBUG] [handleFinalSubmit] Trim after sync:', afterSyncTrim);
      } else {
        console.error('[TRIM DEBUG] [handleFinalSubmit] Trim is empty and watched value is also empty!');
      }
    }

    // ONE final submit path: trigger validation, if invalid return, else call handleSubmit
    const trimBeforeTrigger = form.getValues('trim');
    console.log('[TRIM DEBUG] [handleFinalSubmit] Trim value BEFORE trigger:', trimBeforeTrigger);
    const ok = await form.trigger(undefined, { shouldFocus: true })
    const errors = form.formState.errors

    // DEBUG: Log form state after validation
    const formValuesAfterValidation = form.getValues()
    console.log('[TRIM DEBUG] [handleFinalSubmit] Form state AFTER validation:', {
      formId,
      validationPassed: ok,
      trim: formValuesAfterValidation.trim,
      trimType: typeof formValuesAfterValidation.trim,
      trimLength: formValuesAfterValidation.trim?.length,
      trimBeforeTrigger,
      errors: errors,
      trimError: errors.trim,
      fullValues: formValuesAfterValidation,
    })

    if (!ok) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PredictionForm] Validation failed', { formId, errors, formValues: form.getValues() })
      }

      // Auto-navigate to first invalid step
      const errorFields = Object.entries(errors).filter(([_, error]) => error).map(([field]) => field)
      const hasStep1Error = errorFields.some(field => ['make', 'model', 'trim', 'year'].includes(field))
      const hasStep2Error = errorFields.some(field => ['mileage', 'engine_size', 'cylinders', 'fuel_type'].includes(field))

      if (hasStep1Error) {
        setCurrentStep(1)
        if (formId && onStepChange) onStepChange(formId, 1)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (hasStep2Error) {
        setCurrentStep(2)
        if (formId && onStepChange) onStepChange(formId, 2)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }

      const missingFields = Object.entries(errors).filter(([_, error]) => error).map(([field, error]) => `${field}: ${error?.message || 'required'}`)
      toast({
        title: "Validation Failed",
        description: missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Validation passed: call handleSubmit with parent onSubmit
    await form.handleSubmit(
      async (values) => {
        if (process.env.NODE_ENV === 'development') {
          console.log("[PredictionForm] inside handleSubmit", formId, values)
        }
        await onSubmit?.(values)
      }
    )()
  }

  const loadSampleCar = () => {
    form.reset({
      year: SAMPLE_CAR.year,
      mileage: SAMPLE_CAR.mileage,
      engine_size: SAMPLE_CAR.engine_size,
      cylinders: SAMPLE_CAR.cylinders,
      make: SAMPLE_CAR.make,
      model: SAMPLE_CAR.model,
      trim: SAMPLE_CAR.trim || '', // Use sample trim or empty (will be loaded by useEffect)
      condition: SAMPLE_CAR.condition as any,
      fuel_type: SAMPLE_CAR.fuel_type as any,
      location: SAMPLE_CAR.location,
      color: '',
    })
    setSelectedMake(SAMPLE_CAR.make)
    updateModelsForMake(SAMPLE_CAR.make)
    // Trim will be loaded automatically by useEffect when make/model are set
  }

  const clearForm = () => {
    form.reset()
    setSelectedMake('')
    setModels([])
  }

  // Check if current step is valid for button enabling
  const isStepValid = () => {
    const values = form.getValues()

    if (currentStep === 1) {
      // CRITICAL: Properly validate Step 1 fields - check for non-empty strings and valid year
      const makeValid = typeof values.make === 'string' && values.make.trim() !== ''
      const modelValid = typeof values.model === 'string' && values.model.trim() !== ''
      const yearValid = typeof values.year === 'number' && values.year >= 1900 && values.year <= 2025
      const isValid = makeValid && modelValid && yearValid
      return isValid
    }

    if (currentStep === 2) {
      // Validate Step 2 fields
      const mileageValid = typeof values.mileage === 'number' && values.mileage >= 0 && !isNaN(values.mileage)
      const engineSizeValid = typeof values.engine_size === 'number' && values.engine_size > 0 && !isNaN(values.engine_size)
      const cylindersValid = typeof values.cylinders === 'number' && values.cylinders >= 2 && !isNaN(values.cylinders)
      const fuelTypeValid = typeof values.fuel_type === 'string' && values.fuel_type.trim() !== ''

      return mileageValid && engineSizeValid && cylindersValid && fuelTypeValid
    }

    if (currentStep === 3) {
      return !!(values.condition && values.location)
    }

    return false
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 overflow-visible relative">
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-400">Step {currentStep} of 3</span>
          <div className="flex gap-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-2 w-8 rounded-full transition-all duration-300 ${step === currentStep
                  ? 'bg-indigo-500'
                  : step < currentStep
                    ? 'bg-green-500'
                    : 'bg-white/10'
                  }`}
              />
            ))}
          </div>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps Container */}
      <div className="min-h-[400px] relative">
        {/* Step 1 - Always Rendered, Hidden with CSS */}
        <div
          className={`space-y-6 transition-all duration-300 ${currentStep === 1
            ? 'relative opacity-100 translate-x-0 z-10'
            : 'absolute inset-0 opacity-0 -translate-x-4 pointer-events-none z-0'
            }`}
        >
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-white">{safeT('vehicleDetails', 'Vehicle Details')}</h3>
            <p className="text-sm text-slate-400">{safeT('vehicleDetailsDesc', "Let's start with the basics.")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.make}>
                <Label htmlFor={`${formId || 'form'}-make`}>{t('make')}</Label>
              </FieldTooltip>
              <SearchableSelect
                key={`${formId || 'form'}-make-${selectedMake || 'none'}`}
                id={`${formId || 'form'}-make`}
                name="make"
                value={form.watch('make') || ''}
                onValueChange={(value) => {
                  if (value && value !== selectedMake) {
                    form.setValue('make', value)
                    setSelectedMake(value)
                    // updateModelsForMake will be called by useEffect when selectedMake changes
                  } else if (!value) {
                    // Clear make selection
                    form.setValue('make', '')
                    setSelectedMake('')
                    setModels([])
                  }
                }}
                options={Array.isArray(makes) ? makes : []}
                placeholder={initialLoading ? "Loading..." : "Type to search makes..."}
                disabled={initialLoading}
                emptyMessage="No makes available"
                searchPlaceholder="Type to search..."
              />
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.model}>
                <Label htmlFor={`${formId || 'form'}-model`}>{t('model')}</Label>
              </FieldTooltip>
              <SearchableSelect
                key={`${formId || 'form'}-model-${selectedMake || 'none'}`}
                id={`${formId || 'form'}-model`}
                name="model"
                value={form.watch('model') || ''}
                onValueChange={(value) => {
                  form.setValue('model', value)
                  setSelectedModel(value)
                  // Clear engine and cylinders when model changes
                  setAvailableEngines([])
                  setAvailableCylinders([])
                  // Clear trim options - new trim will be auto-selected by loadTrims
                  // Don't validate trim here - let loadTrims handle setting the value first
                  setTrims([])
                  form.clearErrors('trim')
                  // Trim will be loaded and auto-selected by the debounced useEffect
                }}
                options={Array.isArray(models) && models.length > 0 ? models : []}
                placeholder={
                  !makeValue
                    ? "Select make first"
                    : loadingModels
                      ? "Loading models..."
                      : models.length > 0
                        ? "Type to search models..."
                        : "No models available"
                }
                disabled={!makeValue || loadingModels}
                emptyMessage={makeValue ? (loadingModels ? "Loading models..." : `No models found for ${makeValue}`) : "Select a make first"}
                searchPlaceholder="Type to search..."
              />
            </motion.div>

            <motion.div
              className="space-y-2 sm:col-span-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.trim}>
                <Label htmlFor={`${formId || 'form'}-trim`}>Trim</Label>
              </FieldTooltip>
              <Select
                id={`${formId || 'form'}-trim`}
                value={form.watch('trim') || ''}
                onValueChange={(value) => {
                  console.log('[TRIM DEBUG] [Select] Setting value:', value);
                  console.log('[TRIM DEBUG] [Select] Current form state before setValue:', form.getValues());
                  form.setValue('trim', value, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true
                  });
                  form.clearErrors('trim');
                  const immediateValue = form.getValues('trim');
                  console.log('[TRIM DEBUG] [Select] Immediate value after setValue:', immediateValue);
                  setTimeout(() => {
                    const currentValue = form.getValues('trim');
                    console.log('[TRIM DEBUG] [Select] Verified value in form (100ms later):', currentValue);
                    console.log('[TRIM DEBUG] [Select] Full form state:', form.getValues());
                    if (currentValue !== value) {
                      console.error('[TRIM DEBUG] [Select] VALUE NOT PERSISTED! Expected:', value, 'Got:', currentValue);
                      console.error('[TRIM DEBUG] [Select] Retrying setValue...');
                      form.setValue('trim', value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                    }
                  }, 100);
                }}
                disabled={!selectedMake || !selectedModel || loadingTrims}
              >
                <SelectTrigger className={form.formState.errors.trim ? 'border-red-500' : ''}>
                  <SelectValue placeholder={loadingTrims ? "Loading trims..." : selectedMake && selectedModel ? (trims.length > 0 ? "Select trim level" : "No trims available") : "Select make and model first"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {loadingTrims ? (
                    <div className="p-2 text-center text-[#94a3b8]">Loading trims...</div>
                  ) : trims.length > 0 ? (
                    (trims || []).map((trim) => (
                      <SelectItem key={trim} value={trim} className="text-white">
                        {trim}
                      </SelectItem>
                    ))
                  ) : selectedMake && selectedModel ? (
                    <div className="p-2 text-center text-[#94a3b8] text-xs">
                      No trim variants found for {selectedMake} {selectedModel} in our dataset.
                    </div>
                  ) : (
                    <div className="p-2 text-center text-[#94a3b8]">Select make and model first</div>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.trim && (
                <p className="text-sm text-red-400 mt-1">
                  {form.formState.errors.trim.message}
                </p>
              )}
              {!form.formState.errors.trim && selectedMake && selectedModel && trims.length > 0 && (
                <p className="text-xs text-[#94a3b8] mt-1">
                  ℹ️ Trim level is required and affects price prediction.
                </p>
              )}
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.year}>
                <Label htmlFor={`${formId || 'form'}-year`}>{t('year')}: {form.watch('year')}</Label>
              </FieldTooltip>
              <Slider
                id={`${formId || 'form'}-year`}
                name="year"
                value={[form.watch('year')]}
                onValueChange={([value]) => form.setValue('year', value)}
                min={yearRange.min}
                max={yearRange.max}
                step={1}
                className="w-full"
              />
              {form.formState.errors.year && (
                <p className="text-sm text-red-400">{form.formState.errors.year.message}</p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Step 2 - Always Rendered, Hidden with CSS */}
        <div
          className={`space-y-6 transition-all duration-300 ${currentStep === 2
            ? 'relative opacity-100 translate-x-0 z-10'
            : 'absolute inset-0 opacity-0 -translate-x-4 pointer-events-none z-0'
            }`}
        >
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-white">Engine & Usage</h3>
            <p className="text-sm text-slate-400">Tell us a bit more about the car's specs.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.mileage}>
                <Label htmlFor={`${formId || 'form'}-mileage`}>{t('mileage')} (km)</Label>
              </FieldTooltip>
              <Input
                id={`${formId || 'form'}-mileage`}
                type="number"
                className={`border-white/20 md:border-white/10 bg-white/5 ${form.formState.errors.mileage ? 'border-red-500' : ''}`}
                {...form.register('mileage', { valueAsNumber: true })}
              />
              {form.formState.errors.mileage && (
                <p className="text-sm text-red-400">
                  {form.formState.errors.mileage.message}
                </p>
              )}
            </motion.div>
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.engine_size}>
                <Label htmlFor={`${formId || 'form'}-engine_size`}>{t('engineSize')} <span className="text-red-400">*</span></Label>
              </FieldTooltip>
              <Select
                id={`${formId || 'form'}-engine_size`}
                name="engine_size"
                value={form.watch('engine_size') != null && form.watch('engine_size') > 0 ? form.watch('engine_size').toString() : ''}
                onValueChange={(value) => {
                  if (value && value !== '') {
                    const engineSize = parseFloat(value)
                    form.setValue('engine_size', engineSize)
                    // Clear any validation errors
                    form.clearErrors('engine_size')
                    // Load cylinders for selected engine if make/model are selected
                    if (selectedMake && selectedModel) {
                      loadAvailableCylinders(selectedMake, selectedModel, engineSize)
                    }
                  }
                }}
                disabled={loadingEngines || (allEngineSizes.length === 0 && availableEngines.length === 0)}
              >
                <SelectTrigger className={form.formState.errors.engine_size ? 'border-red-500' : ''}>
                  <SelectValue placeholder={loadingEngines ? "Loading..." : (allEngineSizes.length > 0 || availableEngines.length > 0) ? "Select engine size" : "Loading engine sizes..."} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {loadingEngines ? (
                    <div className="p-2 text-center text-[#94a3b8]">Loading engines...</div>
                  ) : (availableEngines.length > 0 || allEngineSizes.length > 0) ? (
                    (availableEngines.length > 0 ? availableEngines : allEngineSizes).map((engine) => (
                      <SelectItem key={engine.size} value={engine.size.toString()} className="text-white">
                        {engine.display}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-[#94a3b8]">No engine sizes available</div>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.engine_size && (
                <p className="text-sm text-red-400 mt-1">
                  {form.formState.errors.engine_size.message}
                </p>
              )}
              {!form.formState.errors.engine_size && (
                <p className="text-xs text-[#94a3b8] mt-1">
                  ℹ️ Engine size is required and affects price prediction.
                </p>
              )}
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.cylinders}>
                <Label htmlFor={`${formId || 'form'}-cylinders`}>{t('cylinders')}</Label>
              </FieldTooltip>
              <Select
                id={`${formId || 'form'}-cylinders`}
                name="cylinders"
                value={form.watch('cylinders') != null && form.watch('cylinders') !== 0 ? form.watch('cylinders').toString() : ''}
                onValueChange={(value) => {
                  if (value && value !== '') {
                    form.setValue('cylinders', parseInt(value))
                  }
                }}
                disabled={!selectedMake || !selectedModel || !engineSizeValue || loadingCylinders || availableCylinders.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingCylinders ? "Loading..." : availableCylinders.length > 0 ? "Select cylinders" : selectedMake && selectedModel && engineSizeValue ? "No cylinders available" : "Select make, model, and engine first"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingCylinders ? (
                    <div className="p-2 text-center text-[#94a3b8]">Loading cylinders...</div>
                  ) : availableCylinders.length > 0 ? (
                    availableCylinders.map((cyl) => (
                      <SelectItem key={cyl} value={cyl.toString()} className="text-white">
                        {cyl}
                      </SelectItem>
                    ))
                  ) : selectedMake && selectedModel && engineSizeValue ? (
                    <div className="p-2 text-center text-[#94a3b8]">No cylinders found</div>
                  ) : (
                    <div className="p-2 text-center text-[#94a3b8]">Select make, model, and engine first</div>
                  )}
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div
              className="space-y-2 sm:col-span-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.35 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.fuel_type}>
                <Label htmlFor={`${formId || 'form'}-fuel_type`}>{t('fuelType')}</Label>
              </FieldTooltip>
              <Select
                id={`${formId || 'form'}-fuel_type`}
                name="fuel_type"
                value={form.watch('fuel_type')}
                onValueChange={(value) => {
                  form.setValue('fuel_type', value as any)
                  // Clear error when user selects a valid value
                  if (form.formState.errors.fuel_type) {
                    form.clearErrors('fuel_type')
                  }
                }}
                disabled={!selectedMake || !selectedModel || loadingFuelTypes}
              >
                <SelectTrigger className={form.formState.errors.fuel_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder={loadingFuelTypes ? "Loading..." : selectedMake && selectedModel ? (fuelTypes.length > 0 ? "Select fuel type" : "No fuel types available") : "Select make and model first"} />
                </SelectTrigger>
                <SelectContent>
                  {loadingFuelTypes ? (
                    <div className="p-2 text-center text-[#94a3b8]">Loading fuel types...</div>
                  ) : fuelTypes.length > 0 ? (
                    fuelTypes.map((fuel) => (
                      <SelectItem key={fuel} value={fuel} className="text-white">
                        {fuel}
                      </SelectItem>
                    ))
                  ) : selectedMake && selectedModel ? (
                    <div className="p-2 text-center text-[#94a3b8]">No fuel types found for {selectedMake} {selectedModel}</div>
                  ) : (
                    <div className="p-2 text-center text-[#94a3b8]">Select make and model first</div>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.fuel_type && (
                <p className="text-sm text-red-400 mt-1">
                  {form.formState.errors.fuel_type.message}
                </p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Step 3 - Always Rendered, Hidden with CSS */}
        <div
          className={`space-y-6 transition-all duration-300 ${currentStep === 3
            ? 'relative opacity-100 translate-x-0 z-10'
            : 'absolute inset-0 opacity-0 -translate-x-4 pointer-events-none z-0'
            }`}
        >
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-white">Final Details</h3>
            <p className="text-sm text-slate-400">Where is the car located?</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.condition}>
                <Label htmlFor={`${formId || 'form'}-condition`}>{t('condition')}</Label>
              </FieldTooltip>
              <Select
                id={`${formId || 'form'}-condition`}
                name="condition"
                value={form.watch('condition') || ''}
                onValueChange={(value) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[PredictionForm] Condition selected:', value)
                  }
                  form.setValue('condition', value as any, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
                  form.clearErrors('condition')
                  // Trigger Step 3 validation to update form state
                  if (currentStep === 3) {
                    form.trigger(['condition', 'location'])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((condition) => (
                    <SelectItem key={condition} value={condition} className="text-white">
                      {condition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.condition && (
                <p className="text-sm text-red-400">{form.formState.errors.condition.message}</p>
              )}
            </motion.div>

            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.45 }}
            >
              <FieldTooltip content={FIELD_TOOLTIPS.location}>
                <Label htmlFor={`${formId || 'form'}-location`}>{t('location')}</Label>
              </FieldTooltip>
              <Select
                key="location-select"
                id={`${formId || 'form'}-location`}
                name="location"
                value={form.watch('location') || ''}
                onValueChange={(value) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.log('[PredictionForm] Location selected:', value)
                  }
                  form.setValue('location', value, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
                  form.clearErrors('location')
                  // Trigger Step 3 validation to update form state
                  if (currentStep === 3) {
                    form.trigger(['condition', 'location'])
                  }
                }}
                disabled={initialLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={initialLoading ? "Loading locations..." : "Select location"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {initialLoading ? (
                    <div className="p-2 text-center text-[#94a3b8]">Loading locations...</div>
                  ) : locations.length > 0 ? (
                    (locations || []).map((location) => (
                      <SelectItem key={location} value={location} className="text-white">
                        {location}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-[#94a3b8]">No locations available</div>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.location && (
                <p className="text-sm text-red-400">{form.formState.errors.location.message}</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-6 border-t border-white/10">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          className="border-white/20 md:border-white/10 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {currentStep < 3 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!isStepValid()}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-500 disabled:hover:to-purple-600"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2 rtl:rotate-180" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleFinalSubmit()
            }}
            disabled={loading || !isStepValid()}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-500 disabled:hover:to-purple-600"
          >
            {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Analyzing Market Data...' : 'Predict Price'}
          </Button>
        )}
      </div>
    </form>
  )
}

/*
 * VERIFICATION CHECKLIST - Compare Cars Page Fixes:
 *
 * ✅ Model Dropdown Fix:
 *    - Removed form.watch('model') from SearchableSelect key to prevent remounts
 *    - Key now: `${formId}-model-${selectedMake}` (stable, only changes when make changes)
 *    - Each card has isolated model loading via formId-specific cache keys
 *    - Verified: Model dropdown opens reliably after Make selection
 *
 * ✅ Step 2 Validation Fix:
 *    - Added prevStep2ValuesRef guard to prevent unnecessary validation triggers
 *    - Validation only runs when Step 2 values actually change
 *    - isStepValid() properly checks: mileage >= 0, engine_size > 0, cylinders >= 2, fuel_type non-empty
 *    - form.trigger() called after prefillData reset to ensure Next button state updates
 *    - Verified: Next button enables correctly when Step 2 fields are valid
 *
 * ✅ Predict Price Fix:
 *    - handleCardSubmit captures currentCarId as primitive (not car object)
 *    - Each card's submit handler is bound to correct carId via closure
 *    - handlePredict uses functional setState to read latest car state
 *    - Verified: Predict Price works independently for each card
 *
 * ✅ Render Loop Prevention:
 *    - onStepChange callback memoized with useCallback in Compare page
 *    - prevStepRef guard prevents calling onStepChange unless step actually changed
 *    - prevDisplayValueRef guard prevents unnecessary setDisplayValue calls
 *    - prevStep2ValuesRef guard prevents unnecessary form.trigger calls
 *    - Verified: No "Maximum update depth exceeded" errors
 *
 * ✅ Progress Badge:
 *    - Position moved to top-16 (below header) to avoid overlap with X button
 *    - Percentage calculation: (currentStep / 3) * 100 (33%/66%/100%)
 *    - Verified: Badge doesn't block X button, percentage updates correctly
 */