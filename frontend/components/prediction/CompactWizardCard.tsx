"use client"

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { SAMPLE_CAR, YEAR_RANGE, MILEAGE_RANGE, CONDITIONS, FUEL_TYPES, IRAQ_LOCATIONS_FALLBACK } from '@/lib/constants'
import type { CarFeatures } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { useApiCache } from '@/hooks/use-api-cache'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

// Full schema
const carFormSchema = z.object({
  year: z.number().min(1900).max(2025),
  mileage: z.number().min(0).max(1000000),
  engine_size: z.number({ required_error: "Engine size is required" }).min(0.5).max(10.0),
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

interface CompactWizardCardProps {
  onSubmit: (data: CarFeatures) => void
  loading?: boolean
  prefillData?: CarFeatures | null
  onFormChange?: (data: Partial<CarFeatures>) => void
}

export function CompactWizardCard({ onSubmit, loading = false, prefillData = null, onFormChange }: CompactWizardCardProps) {
  const t = useTranslations('predict.form')
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [makes, setMakes] = useState<string[]>([])
  const [modelsByMake, setModelsByMake] = useState<Record<string, string[]>>({})
  const [models, setModels] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>(IRAQ_LOCATIONS_FALLBACK)
  const [conditions, setConditions] = useState<string[]>(CONDITIONS)
  const [fuelTypes, setFuelTypes] = useState<string[]>(FUEL_TYPES)
  const [yearRange, setYearRange] = useState(YEAR_RANGE)
  const [mileageRange, setMileageRange] = useState(MILEAGE_RANGE)
  const [selectedMake, setSelectedMake] = useState<string>(SAMPLE_CAR.make || '')
  const [selectedModel, setSelectedModel] = useState<string>(SAMPLE_CAR.model || '')
  const [allEngineSizes, setAllEngineSizes] = useState<Array<{ size: number; display: string }>>([])
  const [availableEngines, setAvailableEngines] = useState<Array<{ size: number; display: string }>>([])
  const [availableCylinders, setAvailableCylinders] = useState<number[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingTrims, setLoadingTrims] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [loadingEngines, setLoadingEngines] = useState(false)
  const [loadingCylinders, setLoadingCylinders] = useState(false)
  const [loadingFuelTypes, setLoadingFuelTypes] = useState(false)

  const optionsCache = useApiCache(5 * 60 * 1000)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
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

  const makeValue = form.watch('make')
  const modelValue = form.watch('model')
  const yearValue = form.watch('year')
  const engineSizeValue = form.watch('engine_size')

  const debouncedMake = useDebounce(makeValue, 1000)
  const debouncedModel = useDebounce(modelValue, 1000)
  const debouncedEngineSize = useDebounce(engineSizeValue, 1000)

  // Load engine sizes on mount
  useEffect(() => {
    const sizes = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.5, 2.7, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 8.0]
    setAllEngineSizes(sizes.map(size => ({ size, display: `${size}L` })))
    setAvailableEngines(sizes.map(size => ({ size, display: `${size}L` })))
  }, [])

  // Load data on mount
  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      setInitialLoading(true)
      try {
        const results = await Promise.all([
          loadAllMakesAndModels(),
          loadLocations(),
          loadMetadata()
        ])
        const locationsList = (results[1] ?? []) as string[]

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
            if (defaultModel && defaultModel.trim() !== '') {
              setSelectedModel(defaultModel)
              await loadTrims(defaultMake, defaultModel)
            }
          }
          if (allEngineSizes.length > 0) {
            setAvailableEngines(allEngineSizes)
          }
        }
      } finally {
        if (mounted) {
          setInitialLoading(false)
        }
      }
    }
    loadData()
    return () => {
      mounted = false
    }
  }, [])

  // Update models when make changes
  useEffect(() => {
    if (selectedMake) {
      updateModelsForMake(selectedMake)
    }
  }, [selectedMake, modelsByMake])

  // Load trims when make/model change
  useEffect(() => {
    if (debouncedMake && debouncedModel && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      loadTrims(debouncedMake, debouncedModel)
    }
  }, [debouncedMake, debouncedModel])

  // Load engines when make/model change
  useEffect(() => {
    if (debouncedMake && debouncedModel && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      loadAvailableEngines(debouncedMake, debouncedModel)
    }
  }, [debouncedMake, debouncedModel])

  // Load cylinders when engine size changes
  useEffect(() => {
    if (debouncedMake && debouncedModel && debouncedEngineSize && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      loadAvailableCylinders(debouncedMake, debouncedModel, debouncedEngineSize)
    }
  }, [debouncedMake, debouncedModel, debouncedEngineSize])

  // Notify parent of form changes
  useEffect(() => {
    if (onFormChange) {
      const values = form.getValues()
      if (values.make || values.model || values.year) {
        onFormChange({
          make: values.make,
          model: values.model,
          year: values.year,
        } as Partial<CarFeatures>)
      }
    }
  }, [makeValue, modelValue, yearValue])

  // Update form when prefillData changes
  useEffect(() => {
    if (prefillData) {
      form.reset({
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
      })
      setSelectedMake(prefillData.make)
      updateModelsForMake(prefillData.make)
    }
  }, [prefillData])

  const loadMetadata = async () => {
    setLoadingMetadata(true)
    try {
      const metadata = await apiClient.getMetadata()
      if (metadata.conditions.length > 0) setConditions(metadata.conditions)
      if (metadata.fuel_types.length > 0) setFuelTypes(metadata.fuel_types)
      if (metadata.year_range) setYearRange(metadata.year_range)
      if (metadata.mileage_range) setMileageRange(metadata.mileage_range)
    } catch (error) {
      // Use defaults
    } finally {
      setLoadingMetadata(false)
    }
  }

  const loadAllMakesAndModels = async () => {
    try {
      const makesList = await apiClient.getMakes()
      setMakes(makesList.length > 0 ? makesList : [])

      const modelsPromises = makesList.map(async (make) => {
        try {
          const modelsList = await apiClient.getModels(make)
          return { make, models: modelsList }
        } catch (error) {
          return { make, models: [] }
        }
      })

      const modelsResults = await Promise.all(modelsPromises)
      const modelsCache: Record<string, string[]> = {}
      modelsResults.forEach(({ make, models }) => {
        modelsCache[make] = models
      })

      setModelsByMake(modelsCache)

      const defaultMake = SAMPLE_CAR.make || form.getValues('make')
      if (defaultMake && modelsCache[defaultMake]) {
        setModels(modelsCache[defaultMake])
      }
    } catch (error) {
      setMakes([])
      setModelsByMake({})
    }
  }

  const updateModelsForMake = (make: string) => {
    if (!make || make.trim() === '') {
      setModels([])
      return
    }
    const cachedModels = modelsByMake[make] || []
    setModels(cachedModels)
    form.setValue('model', '')
    setSelectedModel('')
    setTrims([])
    form.setValue('trim', '')
    form.clearErrors('trim')
  }

  const loadTrims = async (make: string, model: string) => {
    if (loadingTrims || !make || !model || make.trim() === '' || model.trim() === '') {
      setTrims([])
      form.setValue('trim', '')
      form.clearErrors('trim')
      return
    }

    const cacheKey = `trims:${make}:${model}`
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
            if (error.name === 'AbortError') throw error
            throw error
          }
        }
      )

      if (abortController.signal.aborted) return

      if (trimsList.length > 0) {
        setTrims(trimsList)
        const currentTrim = form.getValues('trim')
        if (!currentTrim || !trimsList.includes(currentTrim)) {
          form.setValue('trim', trimsList[0])
          form.clearErrors('trim')
        }
      } else {
        setTrims([])
        form.setValue('trim', '')
        form.clearErrors('trim')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return
      console.error('Error loading trims:', error)
      setTrims([])
      form.setValue('trim', '')
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingTrims(false)
    }
  }

  const loadAvailableEngines = async (make: string, model: string) => {
    if (loadingEngines || !make || !model || make.trim() === '' || model.trim() === '') {
      setAvailableEngines(allEngineSizes)
      return
    }

    const cacheKey = `engines:${make}:${model}`
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
            if (error.name === 'AbortError') throw error
            throw error
          }
        }
      )

      if (abortController.signal.aborted) return

      if (engines.length > 0) {
        setAvailableEngines(engines)
        if (engines.length === 1 && engines[0].size) {
          form.setValue('engine_size', engines[0].size)
          await loadAvailableCylinders(make, model, engines[0].size)
        }
      } else {
        setAvailableEngines(allEngineSizes)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return
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
            if (error.name === 'AbortError') throw error
            throw error
          }
        }
      )

      if (abortController.signal.aborted) return

      setAvailableCylinders(cylinders)

      if (cylinders.length === 1 && cylinders[0]) {
        form.setValue('cylinders', cylinders[0])
      } else if (cylinders.length > 0 && !cylinders.includes(form.getValues('cylinders'))) {
        if (cylinders[0]) {
          form.setValue('cylinders', cylinders[0])
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return
      setAvailableCylinders([4])
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingCylinders(false)
    }
  }

  const loadLocations = async (): Promise<string[]> => {
    try {
      const locationsList = await apiClient.getLocations()
      const list = Array.isArray(locationsList) && locationsList.length > 0
        ? [...locationsList].sort((a, b) => a.localeCompare(b))
        : IRAQ_LOCATIONS_FALLBACK
      setLocations(list)
      return list
    } catch {
      setLocations(IRAQ_LOCATIONS_FALLBACK)
      return IRAQ_LOCATIONS_FALLBACK
    }
  }

  const validateStep = async (step: number): Promise<boolean> => {
    let schema
    const values = form.getValues()

    if (step === 1) {
      schema = step1Schema
    } else if (step === 2) {
      schema = step2Schema
    } else {
      schema = step3Schema
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
    const isValid = await validateStep(currentStep)
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 3))
    } else {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive",
      })
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = (data: CarFormValues) => {
    const cleanedData: CarFeatures = {
      year: data.year,
      mileage: data.mileage,
      engine_size: data.engine_size,
      cylinders: data.cylinders,
      make: data.make,
      model: data.model,
      trim: data.trim || '__none__',
      condition: data.condition,
      fuel_type: data.fuel_type,
      location: data.location,
      color: data.color || '',
    }
    onSubmit(cleanedData)
  }

  const handleFinalSubmit = async () => {
    const isValid = await validateStep(3)
    if (isValid) {
      form.handleSubmit(handleSubmit)()
    } else {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive",
      })
    }
  }

  const isStepValid = () => {
    const values = form.getValues()
    if (currentStep === 1) {
      return !!(values.make && values.model && values.year)
    }
    if (currentStep === 2) {
      const mileageValid = typeof values.mileage === 'number' && !isNaN(values.mileage) && values.mileage >= 0
      return !!(mileageValid && values.engine_size && values.cylinders && values.fuel_type)
    }
    if (currentStep === 3) {
      return !!(values.condition && values.location)
    }
    return false
  }

  return (
    <div className="p-0 h-full flex flex-col">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent drop-shadow-lg">
          {t('carWiseIQ')}
        </h2>
      </div>

      {/* Horizontal Progress Bar Stepper */}
      <div className="mb-6">
        <div className="mb-3 text-center">
          <span className="text-sm font-semibold text-white drop-shadow-sm">
            {t('stepOf', { step: currentStep })}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="relative h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-600 rounded-full"
            initial={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            animate={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
          {/* Step Indicators */}
          <div className="absolute inset-0 flex items-center justify-between px-1">
            {[1, 2, 3].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`relative z-10 w-6 h-6 rounded-full border-2 transition-all duration-300 ${step <= currentStep
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400 shadow-lg shadow-indigo-500/50 scale-110'
                  : 'bg-white/10 border-white/20 scale-100'
                  } hover:scale-125 cursor-pointer`}
              >
                {step < currentStep && (
                  <Check className="w-3 h-3 text-white absolute inset-0 m-auto" />
                )}
                {step === currentStep && (
                  <span className="text-xs font-bold text-white absolute inset-0 flex items-center justify-center">{step}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        {/* Step Labels */}
        <div className="flex justify-between mt-3 px-1">
          <span className={`text-xs font-semibold transition-all duration-300 drop-shadow-sm ${currentStep >= 1 ? 'text-white' : 'text-white/60'}`}>
            {t('carBasicsStep')}
          </span>
          <span className={`text-xs font-semibold transition-all duration-300 drop-shadow-sm ${currentStep >= 2 ? 'text-white' : 'text-white/60'}`}>
            {t('specsStep')}
          </span>
          <span className={`text-xs font-semibold transition-all duration-300 drop-shadow-sm ${currentStep >= 3 ? 'text-white' : 'text-white/60'}`}>
            {t('detailsStep')}
          </span>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col">
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.make}>
                      <Label htmlFor="make" className="text-white font-medium text-sm drop-shadow-sm">{t('make')}</Label>
                    </FieldTooltip>
                    <SearchableSelect
                      value={form.watch('make') || ''}
                      onValueChange={(value) => {
                        if (value && value !== selectedMake) {
                          form.setValue('make', value)
                          setSelectedMake(value)
                          updateModelsForMake(value)
                        }
                      }}
                      options={makes}
                      placeholder={initialLoading ? "Loading..." : "Type to search makes..."}
                      disabled={initialLoading}
                      emptyMessage="No makes available"
                      searchPlaceholder="Type to search..."
                      className="border-white/20 bg-black/30 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.model}>
                      <Label htmlFor="model" className="text-white font-medium text-sm drop-shadow-sm">{t('model')}</Label>
                    </FieldTooltip>
                    <SearchableSelect
                      value={form.watch('model') || ''}
                      onValueChange={(value) => {
                        form.setValue('model', value)
                        setSelectedModel(value)
                        setAvailableEngines([])
                        setAvailableCylinders([])
                        form.setValue('trim', '')
                        form.clearErrors('trim')
                        setTrims([])
                      }}
                      options={models}
                      placeholder={!selectedMake ? "Select make first" : models.length > 0 ? "Type to search models..." : "No models available"}
                      disabled={!selectedMake || initialLoading}
                      emptyMessage={selectedMake ? `No models found for ${selectedMake}` : "Select a make first"}
                      searchPlaceholder="Type to search..."
                      className="border-white/20 bg-black/30 backdrop-blur-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldTooltip content={FIELD_TOOLTIPS.trim}>
                      <Label htmlFor="trim" className="text-white font-medium text-sm drop-shadow-sm">{t('trim')}</Label>
                    </FieldTooltip>
                    <Select
                      key={`trim-select-${selectedMake}-${selectedModel}`}
                      value={form.watch('trim') || ''}
                      onValueChange={(value) => {
                        form.setValue('trim', value)
                        form.clearErrors('trim')
                      }}
                      disabled={!selectedMake || !selectedModel || loadingTrims}
                    >
                      <SelectTrigger className={`${form.formState.errors.trim ? 'border-red-500' : 'border-white/20'} bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300`}>
                        <SelectValue placeholder={loadingTrims ? t('loadingTrims') : selectedMake && selectedModel ? (trims.length > 0 ? t('selectTrim') : t('noTrimsAvailable')) : t('selectMakeModelFirst')} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] bg-[#1a1d29] border-[#2a2d3a]">
                        {loadingTrims ? (
                          <div className="p-2 text-center text-[#94a3b8]">{t('loadingTrims')}</div>
                        ) : trims.length > 0 ? (
                          (trims || []).map((trim) => (
                            <SelectItem key={trim} value={trim} className="text-white">
                              {trim}
                            </SelectItem>
                          ))
                        ) : selectedMake && selectedModel ? (
                          <div className="p-2 text-center text-[#94a3b8] text-xs">
                            No trim variants found for {selectedMake} {selectedModel}
                          </div>
                        ) : (
                          <div className="p-2 text-center text-[#94a3b8]">{t('selectMakeModelFirst')}</div>
                        )}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.trim && (
                      <p className="text-sm text-red-400 mt-1">{form.formState.errors.trim.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldTooltip content={FIELD_TOOLTIPS.year}>
                      <Label htmlFor="year" className="text-white/90 text-sm font-medium">
                        {t('year')}: <span className="text-blue-400 font-bold text-base">{form.watch('year')}</span>
                      </Label>
                    </FieldTooltip>
                    <div className="relative">
                      <Slider
                        value={[form.watch('year')]}
                        onValueChange={([value]) => form.setValue('year', value)}
                        min={yearRange.min}
                        max={yearRange.max}
                        step={1}
                        className="w-full"
                      />
                      {/* Year Range Labels */}
                      <div className="flex justify-between mt-2 text-xs text-white/60">
                        <span>{yearRange.min}</span>
                        <span>{yearRange.max}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.mileage}>
                      <Label htmlFor="mileage" className="text-white font-medium text-sm drop-shadow-sm">{t('mileage')} (km)</Label>
                    </FieldTooltip>
                    <Input
                      id="mileage"
                      type="number"
                      className="border-white/20 bg-black/30 backdrop-blur-sm text-white h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                      {...form.register('mileage', { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.engine_size}>
                      <Label htmlFor="engine_size" className="text-white font-medium text-sm drop-shadow-sm">{t('engineSize')} <span className="text-red-400 font-bold">*</span></Label>
                    </FieldTooltip>
                    <Select
                      value={form.watch('engine_size') ? form.watch('engine_size').toString() : ''}
                      onValueChange={(value) => {
                        if (value && value !== '') {
                          const engineSize = parseFloat(value)
                          form.setValue('engine_size', engineSize)
                          form.clearErrors('engine_size')
                          if (selectedMake && selectedModel) {
                            loadAvailableCylinders(selectedMake, selectedModel, engineSize)
                          }
                        }
                      }}
                      disabled={loadingEngines || (allEngineSizes.length === 0 && availableEngines.length === 0)}
                    >
                      <SelectTrigger className={`${form.formState.errors.engine_size ? 'border-red-500' : 'border-white/20'} bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300`}>
                        <SelectValue placeholder={loadingEngines ? "Loading..." : (allEngineSizes.length > 0 || availableEngines.length > 0) ? "Select engine size" : "Loading engine sizes..."} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
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
                      <p className="text-sm text-red-400 mt-1">{form.formState.errors.engine_size.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.cylinders}>
                      <Label htmlFor="cylinders" className="text-white font-medium text-sm drop-shadow-sm">{t('cylinders')}</Label>
                    </FieldTooltip>
                    <Select
                      value={form.watch('cylinders') ? form.watch('cylinders').toString() : ''}
                      onValueChange={(value) => {
                        if (value && value !== '') {
                          form.setValue('cylinders', parseInt(value))
                        }
                      }}
                      disabled={!selectedMake || !selectedModel || !engineSizeValue || loadingCylinders || availableCylinders.length === 0}
                    >
                      <SelectTrigger className="border-white/20 bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300">
                        <SelectValue placeholder={loadingCylinders ? "Loading..." : availableCylinders.length > 0 ? "Select cylinders" : selectedMake && selectedModel && engineSizeValue ? "No cylinders available" : "Select make, model, and engine first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                        {loadingCylinders ? (
                          <div className="p-2 text-center text-[#94a3b8]">Loading cylinders...</div>
                        ) : availableCylinders.length > 0 ? (
                          availableCylinders.map((cyl) => (
                            <SelectItem key={cyl} value={cyl.toString()} className="text-white">
                              {cyl}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-[#94a3b8]">Select make, model, and engine first</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.fuel_type}>
                      <Label className="text-white font-medium text-sm drop-shadow-sm">{t('fuelType')}</Label>
                    </FieldTooltip>
                    <Select
                      value={form.watch('fuel_type')}
                      onValueChange={(value) => {
                        form.setValue('fuel_type', value as any)
                        if (form.formState.errors.fuel_type) {
                          form.clearErrors('fuel_type')
                        }
                      }}
                      disabled={!selectedMake || !selectedModel || loadingFuelTypes}
                    >
                      <SelectTrigger className="border-white/20 bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300">
                        <SelectValue placeholder={loadingFuelTypes ? "Loading..." : selectedMake && selectedModel ? (fuelTypes.length > 0 ? "Select fuel type" : "No fuel types available") : "Select make and model first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                        {loadingFuelTypes ? (
                          <div className="p-2 text-center text-[#94a3b8]">Loading fuel types...</div>
                        ) : fuelTypes.length > 0 ? (
                          fuelTypes.map((fuel) => (
                            <SelectItem key={fuel} value={fuel} className="text-white">
                              {fuel}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-[#94a3b8]">Select make and model first</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.condition}>
                      <Label className="text-white font-medium text-sm drop-shadow-sm">{t('condition')}</Label>
                    </FieldTooltip>
                    <Select
                      value={form.watch('condition') || ''}
                      onValueChange={(value) => form.setValue('condition', value as any)}
                    >
                      <SelectTrigger className="border-white/20 bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                        {conditions.map((condition) => (
                          <SelectItem key={condition} value={condition} className="text-white">
                            {condition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <FieldTooltip content={FIELD_TOOLTIPS.location}>
                      <Label htmlFor="location" className="text-white font-medium text-sm drop-shadow-sm">{t('location')}</Label>
                    </FieldTooltip>
                    <Select
                      value={form.watch('location') || ''}
                      onValueChange={(value) => form.setValue('location', value)}
                    >
                      <SelectTrigger className="border-white/20 bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] bg-[#1a1d29] border-[#2a2d3a]">
                        {locations.length > 0 ? (
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
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-4 pt-3 border-t border-white/10">
          {currentStep === 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!isStepValid()}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('next')}
              <ChevronRight className="w-4 h-4 ml-2 rtl:rotate-180" />
            </Button>
          ) : currentStep === 2 ? (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {t('back')}
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                disabled={!isStepValid()}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('next')}
                <ChevronRight className="w-4 h-4 ml-2 rtl:rotate-180" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className="border-white/20 bg-white/5 hover:bg-white/10 text-white"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                {t('back')}
              </Button>
              <Button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading || !isStepValid()}
                className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('analyzingMarketData') : t('predictButton')}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
