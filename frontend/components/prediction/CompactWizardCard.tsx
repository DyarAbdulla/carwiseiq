"use client"

import { useEffect, useState, useRef, useMemo, useId, type ReactNode } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { SAMPLE_CAR, CONDITIONS, FUEL_TYPES, IRAQ_LOCATIONS_FALLBACK, FALLBACK_ENGINE_DISPLACEMENTS, PREDICT_YEAR_MIN, PREDICT_YEAR_MAX } from '@/lib/constants'
import { orderLocationsKurdistanFirst, ORDERED_IRAQ_LOCATIONS_FALLBACK } from '@/lib/locationOrdering'
import { getCylinderOptionsForDisplacement, getDefaultCylinderForDisplacement } from '@/lib/engineCylinderMapping'
import type { CarFeatures } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { useApiCache } from '@/hooks/use-api-cache'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FieldTooltip, FIELD_TOOLTIPS } from './FieldTooltip'
import { cn } from '@/lib/utils'
import BrandLogoGrid from '@/components/ui/BrandLogoGrid'

function buildEngineOptions(sizes: readonly number[]): Array<{ size: number; display: string }> {
  return sizes.map((size) => ({
    size,
    display: size === Math.floor(size) ? `${Math.floor(size)}L` : `${size}L`,
  }))
}

function dedupeEngineOptions(engines: Array<{ size: number; display: string }>): Array<{ size: number; display: string }> {
  const m = new Map<number, { size: number; display: string }>()
  for (const e of engines) {
    const k = Math.round(e.size * 100) / 100
    if (!m.has(k)) {
      const size = k
      m.set(k, {
        size,
        display: size === Math.floor(size) ? `${Math.floor(size)}L` : `${size}L`,
      })
    }
  }
  return Array.from(m.values()).sort((a, b) => a.size - b.size)
}

// Step validation schemas
const step1Schema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: z.string().optional(),
  year: z.number().min(PREDICT_YEAR_MIN).max(PREDICT_YEAR_MAX),
})

const ENGINE_SIZE_MAX = 8.0

const step2Schema = z.object({
  mileage: z.number().min(0).max(1000000),
  engine_size: z.number({ required_error: "Engine size is required" }).min(0.5).max(ENGINE_SIZE_MAX),
  cylinders: z.number().min(2).max(12),
  fuel_type: z.string().min(1),
})

const step3Schema = z.object({
  condition: z.string().min(1),
  location: z.string().min(1),
})

// Full schema
const carFormSchema = z.object({
  year: z.number().min(PREDICT_YEAR_MIN).max(PREDICT_YEAR_MAX),
  mileage: z.number().min(0).max(1000000),
  engine_size: z.number({ required_error: "Engine size is required" }).min(0.5).max(ENGINE_SIZE_MAX),
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
  /** Shown on the final step above the Predict Price / Back row */
  usageNearPredict?: ReactNode
  /** When true, the final submit stays disabled even if the form is valid */
  predictSubmitExtraDisabled?: boolean
}

export function CompactWizardCard({
  onSubmit,
  loading = false,
  prefillData = null,
  onFormChange,
  usageNearPredict,
  predictSubmitExtraDisabled = false,
}: CompactWizardCardProps) {
  const t = useTranslations('predict.form')
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [makes, setMakes] = useState<string[]>([])
  const [modelsByMake, setModelsByMake] = useState<Record<string, string[]>>({})
  const [models, setModels] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>(ORDERED_IRAQ_LOCATIONS_FALLBACK)
  const [conditions, setConditions] = useState<string[]>(CONDITIONS)
  const [fuelTypes, setFuelTypes] = useState<string[]>(FUEL_TYPES)
  const [selectedMake, setSelectedMake] = useState<string>(SAMPLE_CAR.make || '')
  const [selectedModel, setSelectedModel] = useState<string>(SAMPLE_CAR.model || '')
  const [allEngineSizes, setAllEngineSizes] = useState<Array<{ size: number; display: string }>>(() =>
    buildEngineOptions(FALLBACK_ENGINE_DISPLACEMENTS)
  )
  const [availableEngines, setAvailableEngines] = useState<Array<{ size: number; display: string }>>(() =>
    buildEngineOptions(FALLBACK_ENGINE_DISPLACEMENTS)
  )
  const [availableCylinders, setAvailableCylinders] = useState<number[]>(() =>
    getCylinderOptionsForDisplacement(SAMPLE_CAR.engine_size)
  )
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingTrims, setLoadingTrims] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [loadingEngines, setLoadingEngines] = useState(false)
  const [loadingFuelTypes, setLoadingFuelTypes] = useState(false)
  const [mileageFocused, setMileageFocused] = useState(false)
  const [engineDefaultNote, setEngineDefaultNote] = useState(false)

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = PREDICT_YEAR_MAX; y >= PREDICT_YEAR_MIN; y--) years.push(y)
    return years
  }, [])

  const engineDatalistId = useId()

  const optionsCache = useApiCache(5 * 60 * 1000)
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carFormSchema),
    defaultValues: prefillData ? {
      year: Math.min(PREDICT_YEAR_MAX, Math.max(PREDICT_YEAR_MIN, prefillData.year)),
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
      year: Math.min(PREDICT_YEAR_MAX, Math.max(PREDICT_YEAR_MIN, SAMPLE_CAR.year)),
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
  const trimValue = form.watch('trim')
  const engineSizeValue = form.watch('engine_size')

  const step1Preview = useMemo(() => {
    if (!yearValue || !makeValue?.trim() || !modelValue?.trim()) return ''
    const trimPart =
      trimValue?.trim() && trims.length > 0 ? ` ${trimValue.trim()}` : ''
    return `${yearValue} ${makeValue.trim()} ${modelValue.trim()}${trimPart}`.trim()
  }, [yearValue, makeValue, modelValue, trimValue, trims.length])

  const debouncedMake = useDebounce(makeValue, 1000)
  const debouncedModel = useDebounce(modelValue, 1000)

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

          const defaultMake = (form.getValues('make') || SAMPLE_CAR.make || '').trim()
          const defaultModel = (form.getValues('model') || SAMPLE_CAR.model || '').trim()
          if (defaultMake) {
            setSelectedMake(defaultMake)
            if (defaultModel) {
              updateModelsForMake(defaultMake, { resetModel: false })
              form.setValue('model', defaultModel, { shouldValidate: true })
              setSelectedModel(defaultModel)
              await loadTrims(defaultMake, defaultModel)
            } else {
              updateModelsForMake(defaultMake, { resetModel: true })
            }
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

  // When make/model cache loads, refresh model list without wiping a valid prefill
  useEffect(() => {
    if (!selectedMake) return
    const list = modelsByMake[selectedMake] || []
    setModels(list)
    const currentModel = form.getValues('model')?.trim() || ''
    if (currentModel && list.length > 0 && !list.includes(currentModel)) {
      form.setValue('model', '', { shouldValidate: true })
      setSelectedModel('')
      setTrims([])
      form.setValue('trim', '')
      form.clearErrors('trim')
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

  // Cylinder options from displacement (realistic bands)
  useEffect(() => {
    if (typeof engineSizeValue !== 'number' || isNaN(engineSizeValue) || engineSizeValue < 0.5) {
      setAvailableCylinders([4])
      return
    }
    const opts = getCylinderOptionsForDisplacement(engineSizeValue)
    setAvailableCylinders(opts)
    const current = form.getValues('cylinders')
    const def = getDefaultCylinderForDisplacement(engineSizeValue)
    if (!opts.includes(current)) {
      form.setValue('cylinders', def, { shouldValidate: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-filter when displacement changes
  }, [engineSizeValue])

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

  // Update form when prefillData changes (URL params, sessionStorage, etc.)
  useEffect(() => {
    if (!prefillData) return
    form.reset({
      year: Math.min(PREDICT_YEAR_MAX, Math.max(PREDICT_YEAR_MIN, prefillData.year)),
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
    updateModelsForMake(prefillData.make, { resetModel: false })
    form.setValue('model', prefillData.model, { shouldValidate: true })
    setSelectedModel(prefillData.model)
    void loadTrims(prefillData.make, prefillData.model)

    const step1Check = step1Schema.safeParse({
      make: prefillData.make,
      model: prefillData.model,
      year: prefillData.year,
      trim: prefillData.trim || '',
    })
    if (step1Check.success) {
      setCurrentStep(2)
    }
  }, [prefillData])

  const loadMetadata = async () => {
    setLoadingMetadata(true)
    try {
      const metadata = await apiClient.getMetadata()
      if (metadata.conditions.length > 0) setConditions(metadata.conditions)
      if (metadata.fuel_types.length > 0) setFuelTypes(metadata.fuel_types)
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

  const updateModelsForMake = (make: string, opts?: { resetModel?: boolean }) => {
    const resetModel = opts?.resetModel !== false
    if (!make || make.trim() === '') {
      setModels([])
      if (resetModel) {
        form.setValue('model', '')
        setSelectedModel('')
        setTrims([])
        form.setValue('trim', '')
        form.clearErrors('trim')
      }
      return
    }
    const cachedModels = modelsByMake[make] || []
    setModels(cachedModels)
    if (resetModel) {
      form.setValue('model', '')
      setSelectedModel('')
      setTrims([])
      form.setValue('trim', '')
      form.clearErrors('trim')
    }
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
    const fallback = buildEngineOptions(FALLBACK_ENGINE_DISPLACEMENTS)
    if (!make || !model || make.trim() === '' || model.trim() === '') {
      setAvailableEngines(fallback)
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
        const deduped = dedupeEngineOptions(engines)
        setAvailableEngines(deduped)
        setAllEngineSizes(deduped)
        if (deduped.length === 1 && deduped[0].size) {
          const sz = Math.min(ENGINE_SIZE_MAX, Math.max(0.5, deduped[0].size))
          form.setValue('engine_size', sz, { shouldValidate: true })
        }
      } else {
        setAvailableEngines(fallback)
        setAllEngineSizes(fallback)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return
      setAvailableEngines(fallback)
      setAllEngineSizes(fallback)
    } finally {
      abortControllersRef.current.delete(cacheKey)
      setLoadingEngines(false)
    }
  }

  const loadLocations = async (): Promise<string[]> => {
    try {
      const locationsList = await apiClient.getLocations()
      const raw =
        Array.isArray(locationsList) && locationsList.length > 0 ? locationsList : IRAQ_LOCATIONS_FALLBACK
      const list = orderLocationsKurdistanFirst([...raw])
      setLocations(list)
      return list
    } catch {
      setLocations(ORDERED_IRAQ_LOCATIONS_FALLBACK)
      return ORDERED_IRAQ_LOCATIONS_FALLBACK
    }
  }

  const validateStep = async (step: number): Promise<boolean> => {
    const values = form.getValues()

    if (step === 1) {
      try {
        await step1Schema.parseAsync(values)
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach((err) => {
            const field = err.path[0] as keyof CarFormValues
            form.setError(field, { message: err.message })
          })
        }
        return false
      }
      if (trims.length > 0 && (!values.trim || String(values.trim).trim() === '')) {
        form.setError('trim', { message: t('trimRequired') })
        return false
      }
      form.clearErrors('trim')
      return true
    }

    const schema = step === 2 ? step2Schema : step3Schema
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
      const trimOk = trims.length === 0 ? true : !!(values.trim && String(values.trim).trim() !== '')
      return !!(values.make && values.model && values.year && trimOk)
    }
    if (currentStep === 2) {
      const mileageValid = typeof values.mileage === 'number' && !isNaN(values.mileage) && values.mileage >= 0
      const eng = values.engine_size
      const engineValid =
        typeof eng === 'number' &&
        !isNaN(eng) &&
        eng >= 0.5 &&
        eng <= ENGINE_SIZE_MAX
      return !!(mileageValid && engineValid && values.cylinders && values.fuel_type)
    }
    if (currentStep === 3) {
      return !!(values.condition && values.location)
    }
    return false
  }

  const stepLabels = [t('carBasicsStep'), t('specsStep'), t('detailsStep')] as const
  const trackFillPercent = ((currentStep - 1) / 2) * 100

  return (
    <div className="p-0 h-full flex flex-col">
      {/* Title */}
      <div className="mb-4">
        <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent drop-shadow-lg">
          {t('carWiseIQ')}
        </h2>
      </div>

      {/* Stepper: thin track + dots; labels hidden on xs, full row from sm (RTL-safe) */}
      <div className="mb-6 w-full min-w-0 px-0.5 sm:px-0">
        <p className="mb-3 w-full text-center text-sm font-semibold leading-snug text-white drop-shadow-sm">
          {t('stepOf', { step: currentStep })}
        </p>

        <div className="relative py-2 sm:py-2.5">
          <div
            className="pointer-events-none absolute start-2 end-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-white/10 sm:start-3 sm:end-3 sm:h-1"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute start-2 end-2 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full sm:start-3 sm:end-3 sm:h-1"
            aria-hidden
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-600 shadow-[0_0_10px_rgba(99,102,241,0.35)] rtl:bg-gradient-to-l"
              initial={false}
              animate={{ width: `${trackFillPercent}%` }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            />
          </div>

          <div className="relative flex items-center justify-between gap-0.5 sm:gap-2">
            {([1, 2, 3] as const).map((step) => {
              const isDone = step < currentStep
              const isActive = step === currentStep
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => setCurrentStep(step)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={stepLabels[step - 1]}
                  className={cn(
                    'relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full sm:h-14 sm:w-14',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400'
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full border-2 transition-all duration-300',
                      'h-4 w-4 sm:h-5 sm:w-5',
                      isDone &&
                      'border-emerald-400/90 bg-emerald-500/25 shadow-[0_0_8px_rgba(52,211,153,0.35)]',
                      isActive &&
                      'border-indigo-300 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/40 ring-2 ring-white/20 sm:ring-[3px]',
                      !isDone &&
                      !isActive &&
                      'border-white/35 bg-transparent hover:border-white/50 hover:bg-white/[0.06]'
                    )}
                  >
                    {isDone && (
                      <Check className="h-[7px] w-[7px] text-emerald-100 sm:h-2.5 sm:w-2.5" strokeWidth={3} aria-hidden />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <p
          className="mt-2.5 px-2 text-center text-xs font-medium leading-snug text-white/90 sm:hidden"
          dir="auto"
        >
          {stepLabels[currentStep - 1]}
        </p>

        <div className="mt-3 hidden min-w-0 sm:flex sm:justify-between sm:gap-2 sm:px-1 md:gap-4">
          {stepLabels.map((label, i) => (
            <span
              key={i}
              dir="auto"
              className={cn(
                'min-w-0 flex-1 basis-0 text-center text-xs font-medium leading-snug transition-colors duration-300',
                currentStep >= i + 1 ? 'text-white' : 'text-white/55'
              )}
            >
              {label}
            </span>
          ))}
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
                className="space-y-3 min-w-0 w-full"
              >
                <BrandLogoGrid
                  selectedMake={form.watch('make') || ''}
                  allMakes={makes}
                  onSelectMake={(make) => {
                    form.setValue('make', make, { shouldValidate: true, shouldDirty: true })
                    form.clearErrors('make')
                    setSelectedMake(make)
                    updateModelsForMake(make, { resetModel: true })
                  }}
                />
                {step1Preview ? (
                  <div
                    className="rounded-xl border border-violet-500/30 bg-white/[0.06] px-3 py-2.5 text-center backdrop-blur-sm"
                    role="status"
                    aria-live="polite"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-violet-200/85">
                      {t('selectedCarPreviewLabel')}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">{step1Preview}</p>
                  </div>
                ) : null}
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
                          updateModelsForMake(value, { resetModel: true })
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
                        form.setValue('trim', '')
                        form.clearErrors('trim')
                        setTrims([])
                      }}
                      options={models}
                      placeholder={
                        !selectedMake
                          ? t('selectMakeFirst')
                          : models.length > 0
                            ? t('selectModelPlaceholder')
                            : t('noModelsAvailable')
                      }
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
                      <SelectTrigger className={`${form.formState.errors.trim ? 'border-red-500' : 'border-white/20'} bg-black/30 backdrop-blur-sm h-11 min-h-11 sm:h-10 sm:min-h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300`}>
                        <SelectValue
                          placeholder={
                            loadingTrims
                              ? t('loadingTrims')
                              : selectedMake && selectedModel
                                ? trims.length > 0
                                  ? t('selectTrimPlaceholder')
                                  : t('noTrimsAvailable')
                                : t('selectMakeModelFirst')
                          }
                        />
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
                    {trims.length > 0 ? (
                      <p className="text-[11px] text-white/55">{t('trimRequiredHint')}</p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <FieldTooltip content={FIELD_TOOLTIPS.year}>
                      <Label htmlFor="year" className="text-white font-medium text-sm drop-shadow-sm">{t('year')}</Label>
                    </FieldTooltip>
                    <Select
                      value={form.watch('year') ? String(form.watch('year')) : ''}
                      onValueChange={(value) => {
                        form.setValue('year', parseInt(value, 10), { shouldValidate: true })
                      }}
                      disabled={initialLoading}
                    >
                      <SelectTrigger
                        id="year"
                        className="border-white/20 bg-black/30 backdrop-blur-sm h-11 min-h-11 sm:h-10 sm:min-h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                      >
                        <SelectValue placeholder={t('year')} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px] bg-[#1a1d29] border-[#2a2d3a]">
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)} className="text-white">
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-white/55 leading-snug">{t('yearAccuracyHint')}</p>
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
                      <Label htmlFor="mileage" className="text-white font-medium text-sm drop-shadow-sm">{t('mileage')}</Label>
                    </FieldTooltip>
                    <Controller
                      name="mileage"
                      control={form.control}
                      render={({ field }) => {
                        const raw =
                          typeof field.value === 'number' && !Number.isNaN(field.value)
                            ? field.value
                            : 0
                        const display = mileageFocused
                          ? raw === 0
                            ? ''
                            : String(raw)
                          : `${raw.toLocaleString()} km`
                        return (
                          <Input
                            id="mileage"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            className="border-white/20 bg-black/30 backdrop-blur-sm text-white h-11 min-h-11 sm:h-10 sm:min-h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300"
                            aria-describedby="mileage-format-hint"
                            value={display}
                            onFocus={() => setMileageFocused(true)}
                            onBlur={(e) => {
                              setMileageFocused(false)
                              field.onBlur()
                              const digits = e.target.value.replace(/\D/g, '')
                              const n =
                                digits === ''
                                  ? 0
                                  : Math.min(1000000, Math.max(0, parseInt(digits, 10)))
                              field.onChange(n)
                              form.clearErrors('mileage')
                            }}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '')
                              if (digits === '') {
                                field.onChange(0)
                                return
                              }
                              const n = Math.min(1000000, Math.max(0, parseInt(digits, 10)))
                              field.onChange(n)
                              if (n < 0) {
                                form.setError('mileage', { message: t('mileageNegativeError') })
                              } else {
                                form.clearErrors('mileage')
                              }
                            }}
                            name={field.name}
                            ref={field.ref}
                          />
                        )
                      }}
                    />
                    <p id="mileage-format-hint" className="text-[10px] text-white/45">
                      {t('mileageFormatHint')}
                    </p>
                    {form.formState.errors.mileage && (
                      <p className="text-sm text-red-400">{form.formState.errors.mileage.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <FieldTooltip content={t('engineSizeHint')}>
                      <Label htmlFor="engine_size" className="text-white font-medium text-sm drop-shadow-sm">
                        {t('engineSize')} <span className="text-red-400 font-bold">*</span>
                      </Label>
                    </FieldTooltip>
                    <Controller
                      name="engine_size"
                      control={form.control}
                      render={({ field }) => (
                        <>
                          <Input
                            id="engine_size"
                            type="number"
                            step={0.1}
                            min={0.5}
                            max={ENGINE_SIZE_MAX}
                            list={engineDatalistId}
                            disabled={loadingEngines}
                            placeholder={loadingEngines ? t('engineLoadingPlaceholder') : t('engineExamplePlaceholder')}
                            className={`${form.formState.errors.engine_size ? 'border-red-500' : 'border-white/20'} bg-black/30 backdrop-blur-sm text-white h-11 min-h-11 sm:h-10 sm:min-h-10 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300`}
                            value={
                              field.value === undefined || field.value === null || Number.isNaN(field.value)
                                ? ''
                                : field.value
                            }
                            onChange={(e) => {
                              const raw = e.target.value
                              setEngineDefaultNote(false)
                              if (raw === '') return
                              const n = parseFloat(raw)
                              if (Number.isNaN(n)) return
                              const clamped = Math.min(
                                ENGINE_SIZE_MAX,
                                Math.max(0.5, Math.round(n * 10) / 10)
                              )
                              field.onChange(clamped)
                              form.clearErrors('engine_size')
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                          <datalist id={engineDatalistId}>
                            {(availableEngines.length > 0 ? availableEngines : allEngineSizes)
                              .filter((eng) => eng.size <= ENGINE_SIZE_MAX)
                              .map((eng) => (
                              <option key={`${eng.size}-${eng.display}`} value={eng.size} label={eng.display} />
                            ))}
                          </datalist>
                        </>
                      )}
                    />
                    <p className="text-[10px] text-white/50 leading-tight">{t('engineLitersHint')}</p>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-violet-300/95 underline underline-offset-2 hover:text-violet-200"
                      onClick={() => {
                        const list =
                          availableEngines.length > 0 ? availableEngines : allEngineSizes
                        const capped = list.filter((e) => e.size <= ENGINE_SIZE_MAX && e.size >= 0.5)
                        const pick =
                          capped[Math.floor(capped.length / 2)] ??
                          capped[0] ?? { size: 2 }
                        form.setValue('engine_size', pick.size, { shouldValidate: true, shouldDirty: true })
                        form.clearErrors('engine_size')
                        setEngineDefaultNote(true)
                      }}
                    >
                      {t('engineUnknownLink')}
                    </button>
                    {engineDefaultNote && (
                      <p className="text-[10px] text-emerald-200/85">{t('engineDefaultApplied')}</p>
                    )}
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
                          form.setValue('cylinders', parseInt(value, 10))
                        }
                      }}
                      disabled={
                        typeof engineSizeValue !== 'number' || isNaN(engineSizeValue) || engineSizeValue < 0.5
                      }
                    >
                      <SelectTrigger className="border-white/20 bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50 focus:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-300">
                        <SelectValue
                          placeholder={
                            availableCylinders.length > 0 ? 'Select cylinders' : 'Enter engine size first'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                        {availableCylinders.length > 0 ? (
                          availableCylinders.map((cyl) => (
                            <SelectItem key={cyl} value={cyl.toString()} className="text-white">
                              {cyl}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-[#94a3b8]">Enter engine size first</div>
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
                    <SearchableSelect
                      id="location"
                      value={form.watch('location') || ''}
                      onValueChange={(value) => form.setValue('location', value)}
                      options={locations || []}
                      placeholder="Select location"
                      searchPlaceholder="Type to search cities..."
                      emptyMessage="No locations available"
                      className="border-white/20 bg-black/30 backdrop-blur-sm h-9 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div
          className={cn(
            'mt-4 pt-3 border-t border-white/10',
            currentStep === 3 &&
              'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:mt-0 max-md:border-t max-md:border-white/15 max-md:bg-zinc-950/95 max-md:px-4 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] max-md:pt-3 max-md:backdrop-blur-md max-md:shadow-[0_-8px_32px_rgba(0,0,0,0.45)]'
          )}
        >
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
            <div className="space-y-2">
              {usageNearPredict ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-center text-xs leading-snug text-white/90">
                  {usageNearPredict}
                </div>
              ) : null}
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
                  disabled={loading || !isStepValid() || predictSubmitExtraDisabled}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('analyzingMarketData') : t('predictButton')}
                </Button>
              </div>
            </div>
          )}
        </div>
        {currentStep === 3 ? <div className="max-md:h-[5.75rem] max-md:shrink-0 md:hidden" aria-hidden /> : null}
      </form>
    </div>
  )
}
