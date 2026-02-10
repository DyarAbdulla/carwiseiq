"use client"

import { useState, useEffect, useRef } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api'
import { SAMPLE_CAR, YEAR_RANGE, MILEAGE_RANGE, CONDITIONS, FUEL_TYPES } from '@/lib/constants'
import type { CarFeatures } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { useApiCache } from '@/hooks/use-api-cache'
import { ChevronRight, ChevronLeft, Check, Car, Settings, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FieldTooltip, FIELD_TOOLTIPS } from './FieldTooltip'

// Validation schemas for each step
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

// Full schema for final validation
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

interface PredictionFormWizardProps {
  onSubmit: (data: CarFeatures) => void
  loading?: boolean
  prefillData?: CarFeatures | null
  onFormChange?: (data: Partial<CarFeatures> | null) => void
}

const STEPS = [
  { id: 1, title: "Car Identity", icon: Car },
  { id: 2, title: "Specs & Usage", icon: Settings },
  { id: 3, title: "Final Details", icon: MapPin },
]

export function PredictionFormWizard({ onSubmit, loading = false, prefillData = null, onFormChange }: PredictionFormWizardProps) {
  const t = useTranslations('predict.form')
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [makes, setMakes] = useState<string[]>([])
  const [modelsByMake, setModelsByMake] = useState<Record<string, string[]>>({})
  const [models, setModels] = useState<string[]>([])
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
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingTrims, setLoadingTrims] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [loadingEngines, setLoadingEngines] = useState(false)
  const [loadingCylinders, setLoadingCylinders] = useState(false)
  const [loadingColors, setLoadingColors] = useState(false)
  const [loadingFuelTypes, setLoadingFuelTypes] = useState(false)

  const optionsCache = useApiCache<any>(5 * 60 * 1000)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    mode: 'onChange',
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

  // Load initial data
  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      if (mounted) {
        setInitialLoading(true)
        await Promise.all([
          loadAllMakesAndModels(),
          loadLocations(),
          loadMetadata(),
          loadAllEngineSizes(),
        ])
        if (mounted) {
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
          setInitialLoading(false)
        }
      }
    }
    loadData()
    return () => { mounted = false }
  }, [])

  // Load trims, engines, colors, fuel types when make/model changes
  useEffect(() => {
    if (debouncedMake && debouncedModel && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      loadTrims(debouncedMake, debouncedModel)
      loadAvailableEngines(debouncedMake, debouncedModel)
      loadAvailableColors(debouncedMake, debouncedModel)
      loadAvailableFuelTypes(debouncedMake, debouncedModel)
    } else {
      setAvailableEngines(allEngineSizes)
      setAvailableColors([])
      setTrims([])
      form.setValue('trim', '')
      form.clearErrors('trim')
      loadMetadata()
    }
  }, [debouncedMake, debouncedModel, allEngineSizes])

  // Load cylinders when engine size changes
  useEffect(() => {
    if (debouncedMake && debouncedModel && debouncedEngineSize && debouncedMake.trim() !== '' && debouncedModel.trim() !== '') {
      loadAvailableCylinders(debouncedMake, debouncedModel, debouncedEngineSize)
    } else {
      setAvailableCylinders([])
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
  }, [makeValue, modelValue, yearValue, onFormChange])

  // Helper functions (simplified versions - you'll need to implement the full logic from PredictionForm.tsx)
  const loadAllEngineSizes = async () => {
    try {
      const engines = await apiClient.getAllEngineSizes()
      setAllEngineSizes(engines)
      if (!form.getValues('engine_size') && engines.length > 0) {
        form.setValue('engine_size', engines[0].size)
      }
    } catch (error) {
      const commonSizes = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]
      setAllEngineSizes(commonSizes.map((size) => ({
        size,
        display: size === Math.floor(size) ? `${Math.floor(size)}L` : `${size}L`
      })))
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
        } catch {
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
    } catch {
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
    setLoadingTrims(true)
    try {
      const trimsList = await optionsCache.getOrFetch(cacheKey, () => apiClient.getTrims(make, model))
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
      if (error.name !== 'AbortError') {
        console.error('Error loading trims:', error)
        setTrims([])
        form.setValue('trim', '')
      }
    } finally {
      setLoadingTrims(false)
    }
  }

  const loadAvailableEngines = async (make: string, model: string) => {
    if (loadingEngines || !make || !model || make.trim() === '' || model.trim() === '') {
      setAvailableEngines(allEngineSizes)
      return
    }
    const cacheKey = `engines:${make}:${model}`
    setLoadingEngines(true)
    try {
      const engines = await optionsCache.getOrFetch(cacheKey, () => apiClient.getAvailableEngines(make, model))
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
      if (error.name !== 'AbortError') {
        console.error('Error loading engines:', error)
        setAvailableEngines(allEngineSizes)
      }
    } finally {
      setLoadingEngines(false)
    }
  }

  const loadAvailableCylinders = async (make: string, model: string, engineSize: number) => {
    if (loadingCylinders || !make || !model || make.trim() === '' || model.trim() === '' || !engineSize) {
      setAvailableCylinders([])
      return
    }
    const cacheKey = `cylinders:${make}:${model}:${engineSize}`
    setLoadingCylinders(true)
    try {
      const cylinders = await optionsCache.getOrFetch(cacheKey, () => apiClient.getAvailableCylinders(make, model, engineSize))
      setAvailableCylinders(cylinders)
      if (cylinders.length === 1 && cylinders[0]) {
        form.setValue('cylinders', cylinders[0])
      } else if (cylinders.length > 0 && !cylinders.includes(form.getValues('cylinders'))) {
        if (cylinders[0]) {
          form.setValue('cylinders', cylinders[0])
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading cylinders:', error)
        setAvailableCylinders([4])
      }
    } finally {
      setLoadingCylinders(false)
    }
  }

  const loadAvailableColors = async (make: string, model: string) => {
    if (loadingColors || !make || !model || make.trim() === '' || model.trim() === '') {
      setAvailableColors([])
      return
    }
    const cacheKey = `colors:${make}:${model}`
    setLoadingColors(true)
    try {
      const colors = await optionsCache.getOrFetch(cacheKey, () => apiClient.getAvailableColors(make, model))
      setAvailableColors(colors)
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading colors:', error)
        setAvailableColors(['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Gold', 'Brown', 'Orange', 'Yellow', 'Purple', 'Beige', 'Other'])
      }
    } finally {
      setLoadingColors(false)
    }
  }

  const loadAvailableFuelTypes = async (make: string, model: string) => {
    if (!make || !model || make.trim() === '' || model.trim() === '') {
      try {
        const metadata = await optionsCache.getOrFetch('metadata', () => apiClient.getMetadata())
        if (metadata.fuel_types.length > 0) {
          setFuelTypes(metadata.fuel_types)
        }
      } catch {
        setFuelTypes(FUEL_TYPES)
      }
      return
    }
    if (loadingFuelTypes) return
    const cacheKey = `fuelTypes:${make}:${model}`
    setLoadingFuelTypes(true)
    try {
      const fuelTypesList = await optionsCache.getOrFetch(cacheKey, () => apiClient.getAvailableFuelTypes(make, model))
      if (fuelTypesList.length > 0) {
        setFuelTypes(fuelTypesList)
        if (fuelTypesList.length === 1) {
          form.setValue('fuel_type', fuelTypesList[0] as any)
        }
      } else {
        try {
          const metadata = await optionsCache.getOrFetch('metadata', () => apiClient.getMetadata())
          if (metadata.fuel_types.length > 0) {
            setFuelTypes(metadata.fuel_types)
          } else {
            setFuelTypes(FUEL_TYPES)
          }
        } catch {
          setFuelTypes(FUEL_TYPES)
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error loading fuel types:', error)
        setFuelTypes(FUEL_TYPES)
      }
    } finally {
      setLoadingFuelTypes(false)
    }
  }

  const loadLocations = async () => {
    try {
      const locationsList = await apiClient.getLocations()
      const list = Array.isArray(locationsList) && locationsList.length > 0 ? locationsList : []
      setLocations(list)
    } catch {
      setLocations([])
    }
  }

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
    } catch {
      // Use defaults
    } finally {
      setLoadingMetadata(false)
    }
  }

  // Step validation
  const validateStep = async (step: number): Promise<boolean> => {
    const values = form.getValues()
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
    const isValid = await validateStep(currentStep)
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
      // Scroll to top of form on step change
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      toast({
        title: "Please fill in all required fields",
        variant: "destructive",
      })
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (data: CarFormValues) => {
    const validFuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']
    const fuelType = String(data.fuel_type).trim()

    if (!validFuelTypes.includes(fuelType)) {
      form.setError('fuel_type', {
        type: 'manual',
        message: `Fuel type must be one of: ${validFuelTypes.join(', ')}`
      })
      return
    }

    const cleanedData: CarFeatures = {
      ...data,
      trim: String(data.trim).trim(),
      year: Number(data.year),
      mileage: Number(data.mileage),
      engine_size: Number(data.engine_size),
      cylinders: Number(data.cylinders),
      make: String(data.make).trim(),
      model: String(data.model).trim(),
      condition: String(data.condition).trim(),
      fuel_type: fuelType,
      location: String(data.location).trim(),
      color: data.color && data.color.trim() !== '' ? String(data.color).trim() : undefined,
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

  // Stepper Component
  const Stepper = () => (
    <div className="mb-8">
      <div className="mb-4 text-center">
        <span className="text-sm font-medium text-slate-400">
          Step {currentStep} of {STEPS.length}
        </span>
      </div>
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id
          const isLast = index === STEPS.length - 1

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${isActive
                    ? 'border-indigo-500 bg-indigo-500/20 scale-110'
                    : isCompleted
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-white/20 bg-white/5'
                    }`}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-green-400" />
                  ) : (
                    <Icon className={`w-6 h-6 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-slate-400'}`}>
                  {step.title}
                </span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-4 transition-all duration-300 ${isCompleted ? 'bg-green-500' : 'bg-white/10'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // Step 1: Car Identity
  const Step1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-white">Vehicle Details</h3>
        <p className="text-sm text-slate-400">Let's start with the basics.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.make}>
            <Label htmlFor="make">{t('make')}</Label>
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
          />
          {form.formState.errors.make && (
            <p className="text-sm text-red-400">{form.formState.errors.make.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.model}>
            <Label htmlFor="model">{t('model')}</Label>
          </FieldTooltip>
          <SearchableSelect
            value={form.watch('model') || ''}
            onValueChange={(value) => {
              form.setValue('model', value)
              setSelectedModel(value)
              form.setValue('trim', '')
              form.clearErrors('trim')
              setTrims([])
            }}
            options={models}
            placeholder={!selectedMake ? "Select make first" : models.length > 0 ? "Type to search models..." : "No models available"}
            disabled={!selectedMake || initialLoading}
            emptyMessage={selectedMake ? `No models found for ${selectedMake}` : "Select a make first"}
            searchPlaceholder="Type to search..."
          />
          {form.formState.errors.model && (
            <p className="text-sm text-red-400">{form.formState.errors.model.message}</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <FieldTooltip content={FIELD_TOOLTIPS.trim}>
            <Label htmlFor="trim">Trim</Label>
          </FieldTooltip>
          <Select
            value={form.watch('trim') || ''}
            onValueChange={(value) => {
              form.setValue('trim', value)
              form.clearErrors('trim')
            }}
            disabled={!selectedMake || !selectedModel || loadingTrims}
          >
            <SelectTrigger className={`h-12 md:h-10 ${form.formState.errors.trim ? 'border-red-500' : ''}`}>
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
                  No trim variants found for {selectedMake} {selectedModel}
                </div>
              ) : (
                <div className="p-2 text-center text-[#94a3b8]">Select make and model first</div>
              )}
            </SelectContent>
          </Select>
          {form.formState.errors.trim && (
            <p className="text-sm text-red-400 mt-1">{form.formState.errors.trim.message}</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <FieldTooltip content={FIELD_TOOLTIPS.year}>
            <Label htmlFor="year">{t('year')}: {form.watch('year')}</Label>
          </FieldTooltip>
          <Slider
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
        </div>
      </div>
    </motion.div>
  )

  // Step 2: Specs & Usage
  const Step2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-white">Engine & Usage</h3>
        <p className="text-sm text-slate-400">Tell us a bit more about the car's specs.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.mileage}>
            <Label htmlFor="mileage">{t('mileage')} (km)</Label>
          </FieldTooltip>
          <Input
            id="mileage"
            type="number"
            className={`h-12 md:h-10 border-white/20 md:border-white/10 bg-white/5 ${form.formState.errors.mileage ? 'border-red-500' : ''}`}
            {...form.register('mileage', { valueAsNumber: true })}
          />
          {form.formState.errors.mileage && (
            <p className="text-sm text-red-400">{form.formState.errors.mileage.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.engine_size}>
            <Label htmlFor="engine_size">{t('engineSize')} (L) <span className="text-red-400">*</span></Label>
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
            <SelectTrigger className={`h-12 md:h-10 ${form.formState.errors.engine_size ? 'border-red-500' : ''}`}>
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
            <p className="text-sm text-red-400 mt-1">{form.formState.errors.engine_size.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.cylinders}>
            <Label htmlFor="cylinders">{t('cylinders')}</Label>
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
            <SelectTrigger className="h-12 md:h-10">
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
        </div>

        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.fuel_type}>
            <Label>{t('fuelType')}</Label>
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
            <SelectTrigger className={`h-12 md:h-10 ${form.formState.errors.fuel_type ? 'border-red-500' : ''}`}>
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
            <p className="text-sm text-red-400 mt-1">{form.formState.errors.fuel_type.message}</p>
          )}
        </div>
      </div>
    </motion.div>
  )

  // Step 3: Final Details
  const Step3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h3 className="text-xl font-semibold text-white">Final Details</h3>
        <p className="text-sm text-slate-400">Where is the car located?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.condition}>
            <Label>{t('condition')}</Label>
          </FieldTooltip>
          <Select
            value={form.watch('condition') || ''}
            onValueChange={(value) => form.setValue('condition', value as any)}
          >
            <SelectTrigger className="h-12 md:h-10">
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
        </div>

        <div className="space-y-2">
          <FieldTooltip content={FIELD_TOOLTIPS.location}>
            <Label htmlFor="location">{t('location')}</Label>
          </FieldTooltip>
          <Select
            value={form.watch('location') || ''}
            onValueChange={(value) => form.setValue('location', value)}
            disabled={initialLoading}
          >
            <SelectTrigger className="h-12 md:h-10">
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
        </div>
      </div>
    </motion.div>
  )

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 overflow-visible relative pb-24 md:pb-0">
      <Stepper />

      <div className="min-h-[400px]">
        <AnimatePresence>
          {currentStep === 1 && <Step1 key="step1" />}
          {currentStep === 2 && <Step2 key="step2" />}
          {currentStep === 3 && <Step3 key="step3" />}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons - Desktop: Inline, Mobile: Sticky Bottom Bar */}
      <div className="hidden md:flex items-center justify-between pt-6 border-t border-white/10">
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

        {currentStep < STEPS.length ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={(() => {
              const values = form.getValues()
              if (currentStep === 1) {
                return !values.make || !values.model || !values.year
              }
              if (currentStep === 2) {
                const mileageValid = typeof values.mileage === 'number' && !isNaN(values.mileage) && values.mileage >= 0
                return !mileageValid || !values.engine_size || !values.cylinders || !values.fuel_type
              }
              return false
            })()}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-500 disabled:hover:to-purple-600"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2 rtl:rotate-180" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleFinalSubmit}
            disabled={loading || !form.formState.isValid}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing Market Data...' : 'Predict Price'}
          </Button>
        )}
      </div>

      {/* Mobile: Sticky Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-gray-900/95 backdrop-blur-xl z-50 border-t border-white/10 shadow-2xl">
        <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex-1 border-white/20 bg-white/5 hover:bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed h-12"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={(() => {
                const values = form.getValues()
                if (currentStep === 1) {
                  return !values.make || !values.model || !values.trim || !values.year
                }
                if (currentStep === 2) {
                  const mileageValid = typeof values.mileage === 'number' && !isNaN(values.mileage) && values.mileage >= 0
                  return !mileageValid || !values.engine_size || !values.cylinders || !values.fuel_type
                }
                return false
              })()}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-indigo-500 disabled:hover:to-purple-600 h-12"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2 rtl:rotate-180" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={loading || !form.formState.isValid}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed h-12"
            >
              {loading ? 'Analyzing...' : 'Predict Price'}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
