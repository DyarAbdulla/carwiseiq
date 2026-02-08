"use client"

import { useEffect, useState, useRef, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { StarRating } from '@/components/ui/star-rating'
import { apiClient } from '@/lib/api'
import { YEAR_RANGE } from '@/lib/constants'
import type { SellCarRequest } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { useCarValidation } from '@/hooks/useCarValidation'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Loader2, Car, AlertTriangle, Star, Camera, MapPin, Mail, Phone, Upload, X, Save } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ProgressIndicator, type Step } from './ProgressIndicator'
import { useAutoSave, AutoSaveIndicator, getSavedFormData, clearSavedFormData } from './AutoSave'
import { ContinueModal } from './ContinueModal'
import { InteractiveTooltip, FIELD_TOOLTIPS } from './InteractiveTooltip'
import { CollapsibleSection } from './CollapsibleSection'
import { decodeVIN, validateVINFormat } from '@/utils/vinDecoder'
import { MileageValidator } from './MileageValidator'
import { FloatingPriceWidget, FloatingPriceWidgetMobile } from './FloatingPriceWidget'
import { PhotoGuidelines } from './PhotoGuidelines'
import { PhotoQualityChecker } from './PhotoQualityChecker'
import { DraggablePhotoGrid } from './DraggablePhotoGrid'
import { PhotoCountProgress } from './PhotoCountProgress'

const sellCarSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(2000).max(2025),
  mileage: z.number().min(0),
  location: z.string().min(1, "Location is required"),
  condition: z.string().min(1, "Condition is required"),
  trim: z.string().optional(),
  color: z.string().optional(),
  vin: z.string().optional(),
  // Condition Assessment
  overall_condition: z.number().min(1).max(5).optional(),
  interior_condition: z.number().min(1).max(5).optional(),
  exterior_condition: z.number().min(1).max(5).optional(),
  mechanical_condition: z.number().min(1).max(5).optional(),
  service_history: z.enum(['Full', 'Partial', 'None']).optional(),
  previous_owners: z.number().min(0).max(10).optional(),
  remaining_warranty: z.boolean().optional(),
  // Accident History
  has_accident: z.boolean(),
  damaged_parts_count: z.number().min(0).max(50).optional(),
  severity: z.string().optional(),
  affected_parts: z.array(z.string()).optional(),
  repaired: z.boolean().optional(),
  repair_quality: z.enum(['Excellent', 'Good', 'Fair', 'Poor']).optional(),
  // Premium Features
  premium_features: z.array(z.string()).optional(),
  // Contact
  asking_price: z.number().min(0).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(1, "Phone number is required").regex(/^[\d\s\-\+\(\)]+$/, "Please enter a valid phone number"),
}).refine((data) => {
  // Severity is required when has_accident is true
  if (data.has_accident && (!data.severity || data.severity.trim() === '')) {
    return false
  }
  return true
}, {
  message: "Severity is required when accident history is reported",
  path: ["severity"]
}).refine((data) => {
  // Severity must be one of the valid values if provided
  if (data.severity && !['minor', 'moderate', 'severe'].includes(data.severity)) {
    return false
  }
  return true
}, {
  message: "Severity must be one of: minor, moderate, severe",
  path: ["severity"]
})

type SellCarFormValues = z.infer<typeof sellCarSchema>

interface SellCarFormComprehensiveProps {
  onSubmit: (data: SellCarRequest) => void
  loading?: boolean
}

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor']
const COLORS = ['Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Green', 'Other']
const SEVERITIES = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]
const AFFECTED_PARTS = [
  'Front Bumper', 'Rear Bumper', 'Front Fender', 'Rear Fender', 'Hood', 'Trunk',
  'Front Door', 'Rear Door', 'Windshield', 'Rear Window', 'Side Mirror', 'Headlight',
  'Taillight', 'Grille', 'Roof', 'Quarter Panel', 'Frame', 'Other'
]
const PREMIUM_FEATURES = [
  'Leather Seats', 'Sunroof/Moonroof', 'Navigation System', 'Backup Camera',
  'Parking Sensors', 'Blind Spot Monitoring', 'Lane Departure Warning',
  'Adaptive Cruise Control', 'Heated Seats', 'Ventilated Seats',
  'Premium Sound System', 'Apple CarPlay/Android Auto', 'Keyless Entry',
  'Push Button Start', 'Alloy Wheels', 'Tow Package'
]

export function SellCarFormComprehensive({ onSubmit, loading = false }: SellCarFormComprehensiveProps) {
  const t = useTranslations('sell')
  const { toast } = useToast()
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [selectedMake, setSelectedMake] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [vinDecoding, setVinDecoding] = useState(false)
  const [vinError, setVinError] = useState<string | null>(null)
  const [manualEntry, setManualEntry] = useState(false)
  const [mileageConfirmed, setMileageConfirmed] = useState(false)
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [showContinueModal, setShowContinueModal] = useState(false)
  const sectionsRef = useRef<{ [key: number]: HTMLDivElement | null }>({})
  const [stepCompletion, setStepCompletion] = useState({
    step1: false,
    step2: false,
    step3: false,
    step4: false,
  })

  // Define form steps with reactive completion status
  const steps: Step[] = useMemo(() => [
    { id: 1, title: 'Vehicle Details', completed: stepCompletion.step1, active: currentStep === 1 },
    { id: 2, title: 'Condition', completed: stepCompletion.step2, active: currentStep === 2 },
    { id: 3, title: 'Accident & Features', completed: stepCompletion.step3, active: currentStep === 3 },
    { id: 4, title: 'Contact & Photos', completed: stepCompletion.step4, active: currentStep === 4 },
  ], [currentStep, stepCompletion])

  const form = useForm<SellCarFormValues>({
    resolver: zodResolver(sellCarSchema),
    defaultValues: {
      make: '',
      model: '',
      year: 2020,
      mileage: 50000,
      location: '',
      condition: 'Good',
      trim: '',
      color: '',
      vin: '',
      overall_condition: 5,
      interior_condition: 5,
      exterior_condition: 5,
      mechanical_condition: 5,
      service_history: 'Full',
      previous_owners: 1,
      remaining_warranty: false,
      has_accident: false,
      damaged_parts_count: 0,
      severity: '',
      affected_parts: [],
      repaired: false,
      repair_quality: undefined,
      premium_features: [],
      asking_price: undefined,
      email: '',
      phone: '',
    },
  })

  const hasAccident = form.watch('has_accident')
  const premiumFeatures = form.watch('premium_features') || []
  const selectedModel = useWatch({ control: form.control, name: 'model' })
  
  // Get form values for validation
  const formValues = form.watch()
  const validationWarnings = useCarValidation(formValues)

  // Auto-save functionality
  const { isSaving, lastSaved, showIndicator, saveManually } = useAutoSave(formValues, true)

  // Check for saved data on mount
  useEffect(() => {
    const savedData = getSavedFormData()
    if (savedData && !form.formState.isDirty) {
      setShowContinueModal(true)
    }
  }, [])

  // Calculate step completion status
  useEffect(() => {
    const make = form.watch('make')
    const model = form.watch('model')
    const year = form.watch('year')
    const mileage = form.watch('mileage')
    const location = form.watch('location')
    
    // Step 1: Vehicle Details completed
    const step1Complete = !!(make && model && year && mileage && location)
    
    // Step 2: Condition completed
    const overallCondition = form.watch('overall_condition')
    const interiorCondition = form.watch('interior_condition')
    const exteriorCondition = form.watch('exterior_condition')
    const mechanicalCondition = form.watch('mechanical_condition')
    const step2Complete = !!(overallCondition && interiorCondition && exteriorCondition && mechanicalCondition)
    
    // Step 3: Accident & Features (always considered complete since accident is optional)
    const step3Complete = true
    
    // Step 4: Contact & Photos
    const phone = form.watch('phone')
    const step4Complete = !!(phone && images.length > 0)

    // Update step completion status
    setStepCompletion({
      step1: step1Complete,
      step2: step2Complete,
      step3: step3Complete,
      step4: step4Complete,
    })

    // Update current step based on completion
    if (!step1Complete) {
      setCurrentStep(1)
    } else if (!step2Complete) {
      setCurrentStep(2)
    } else if (!step4Complete) {
      setCurrentStep(4)
    } else {
      setCurrentStep(4)
    }
  }, [
    form.watch('make'),
    form.watch('model'),
    form.watch('year'),
    form.watch('mileage'),
    form.watch('location'),
    form.watch('overall_condition'),
    form.watch('interior_condition'),
    form.watch('exterior_condition'),
    form.watch('mechanical_condition'),
    form.watch('phone'),
    images.length
  ])

  // Handle step navigation
  const handleStepClick = (stepId: number) => {
    setCurrentStep(stepId)
    const sectionId = `section-${stepId}`
    const section = sectionsRef.current[stepId]
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Handle continue with saved data
  const handleContinueWithSaved = () => {
    const savedData = getSavedFormData()
    if (savedData) {
      Object.keys(savedData.formData).forEach((key) => {
        const value = savedData.formData[key]
        if (value !== undefined && value !== null) {
          form.setValue(key as any, value, { shouldDirty: true })
        }
      })
    }
    setShowContinueModal(false)
  }

  // Handle discard saved data
  const handleDiscardSaved = () => {
    clearSavedFormData()
    setShowContinueModal(false)
  }

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        const [makesData, locationsData] = await Promise.all([
          apiClient.getMakes().catch(() => null),
          apiClient.getLocations().catch(() => null),
        ])

        if (makesData && makesData.length > 0) {
          setMakes(makesData)
        } else {
          const { CAR_MAKES } = await import('@/lib/constants')
          setMakes(CAR_MAKES)
        }

        if (locationsData && locationsData.length > 0) {
          setLocations(locationsData)
        } else {
          setLocations(['California', 'New York', 'Texas', 'Florida', 'Illinois'])
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        const { CAR_MAKES } = await import('@/lib/constants')
        setMakes(CAR_MAKES)
        setLocations(['California', 'New York', 'Texas', 'Florida', 'Illinois'])
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load models when make changes
  useEffect(() => {
    const loadModels = async () => {
      if (!selectedMake) {
        setModels([])
        setTrims([])
        return
      }
      try {
        const modelList = await apiClient.getModels(selectedMake)
        setModels(modelList)
        form.setValue('model', '')
        setTrims([])
      } catch (error) {
        console.error('Failed to load models:', error)
      }
    }
    loadModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMake])

  // Load trims when model changes
  useEffect(() => {
    const loadTrims = async () => {
      if (!selectedMake || !selectedModel) {
        setTrims([])
        return
      }
      try {
        const trimList = await apiClient.getTrims(selectedMake, selectedModel)
        setTrims(trimList)
      } catch {
        setTrims([])
      }
    }
    loadTrims()
  }, [selectedMake, selectedModel])

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      const isValidSize = file.size <= 5 * 1024 * 1024 // 5MB
      return isValidType && isValidSize
    })

    if (validFiles.length + images.length > 10) {
      toast({
        title: t('form.tooManyImages'),
        description: t('form.maxImages'),
        variant: 'destructive',
      })
      return
    }

    const newImages = [...images, ...validFiles]
    setImages(newImages)

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreviews(prev => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Handle photo reordering
  const handlePhotoReorder = (newImages: File[], newPreviews: string[]) => {
    setImages(newImages)
    setImagePreviews(newPreviews)
  }

  const handleSubmit = (data: SellCarFormValues) => {
    // Validate phone and images before submission
    if (!data.phone || data.phone.trim() === '') {
      toast({
        title: 'Phone Required',
        description: 'Please enter your phone number',
        variant: 'destructive',
      })
      return
    }

    if (images.length === 0) {
      toast({
        title: 'Photos Required',
        description: 'Please upload at least 1 photo of your car',
        variant: 'destructive',
      })
      return
    }

    // Validate severity when has_accident is true
    if (data.has_accident && (!data.severity || data.severity.trim() === '')) {
      toast({
        title: 'Severity Required',
        description: 'Please select the accident severity',
        variant: 'destructive',
      })
      form.setError('severity', {
        type: 'manual',
        message: 'Severity is required when accident history is reported'
      })
      return
    }

    // Clear saved data on successful submission
    clearSavedFormData()

    const request: SellCarRequest = {
      make: data.make,
      model: data.model,
      year: data.year,
      mileage: data.mileage,
      location: data.location,
      condition: data.condition,
      trim: data.trim || undefined,
      color: data.color || undefined,
      vin: data.vin || undefined,
      overall_condition: data.overall_condition,
      interior_condition: data.interior_condition,
      exterior_condition: data.exterior_condition,
      mechanical_condition: data.mechanical_condition,
      service_history: data.service_history,
      previous_owners: data.previous_owners,
      remaining_warranty: data.remaining_warranty,
      has_accident: data.has_accident,
      damaged_parts_count: data.has_accident ? (data.damaged_parts_count || 0) : 0,
      // Severity is required when has_accident is true - validation above ensures it exists and is not empty
      severity: data.has_accident ? data.severity : undefined,
      affected_parts: data.has_accident ? data.affected_parts : undefined,
      repaired: data.has_accident ? data.repaired : undefined,
      repair_quality: data.has_accident && data.repair_quality ? (data.repair_quality as 'Excellent' | 'Good' | 'Fair' | 'Poor') : undefined,
      premium_features: data.premium_features && data.premium_features.length > 0 ? data.premium_features : undefined,
      asking_price: data.asking_price || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      images: images.length > 0 ? images : undefined,
    }
    onSubmit(request)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B7FFF]" />
        <span className="ml-3 text-[#94a3b8]">{t('form.loadingForm')}</span>
      </div>
    )
  }

  // Generate summary for completed sections
  const getVehicleSummary = () => {
    const make = form.watch('make')
    const model = form.watch('model')
    const year = form.watch('year')
    if (make && model && year) {
      return `${year} ${make} ${model}`
    }
    return undefined
  }

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <ProgressIndicator steps={steps} onStepClick={handleStepClick} />

      {/* Continue Modal */}
      {showContinueModal && getSavedFormData() && (
        <ContinueModal
          savedData={getSavedFormData()!}
          onContinue={handleContinueWithSaved}
          onDiscard={handleDiscardSaved}
          onClose={() => setShowContinueModal(false)}
        />
      )}

      {/* Auto-save Indicator */}
      <AutoSaveIndicator 
        isSaving={isSaving} 
        lastSaved={lastSaved} 
        showIndicator={showIndicator} 
      />

      {/* Floating Price Widget - Desktop */}
      <FloatingPriceWidget formData={formValues} />

      {/* Floating Price Widget - Mobile */}
      <FloatingPriceWidgetMobile formData={formValues} />

      {/* Save & Continue Later Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-40"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          type="button"
          onClick={saveManually}
          variant="outline"
          className="bg-[#1a1d29] border-[#2a2d3a] text-white hover:bg-[#2a2d3a] shadow-lg"
        >
          <Save className="h-4 w-4 mr-2" />
          Save & Continue Later
        </Button>
      </motion.div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* A) Vehicle Details */}
        <div ref={(el) => { sectionsRef.current[1] = el }}>
          <CollapsibleSection
            title="Vehicle Details"
            completed={steps[0].completed}
            summary={getVehicleSummary()}
            defaultExpanded={currentStep === 1}
            onEdit={() => {
              setCurrentStep(1)
              sectionsRef.current[1]?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <Card className="p-6 border-[#2a2d3a] bg-[#1a1d29]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Car className="h-5 w-5 text-[#5B7FFF]" />
            {t('form.basicInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Make */}
            <div className="space-y-2">
              <Label htmlFor="make" className="text-white">{t('form.make')} *</Label>
              <Select
                value={form.watch('make')}
                onValueChange={(value) => {
                  form.setValue('make', value)
                  setSelectedMake(value)
                }}
              >
                <SelectTrigger className="bg-[#0f1117] border-[#2a2d3a] text-white h-12">
                  <SelectValue placeholder={t('form.selectMake')} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                  {makes.map((make) => (
                    <SelectItem key={make} value={make} className="text-white hover:bg-[#2a2d3a]">
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.make && (
                <p className="text-red-400 text-sm">{form.formState.errors.make.message}</p>
              )}
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="model" className="text-white">{t('form.model')} *</Label>
              <Select
                value={form.watch('model')}
                onValueChange={(value) => form.setValue('model', value)}
                disabled={!selectedMake}
              >
                <SelectTrigger className="bg-[#0f1117] border-[#2a2d3a] text-white h-12">
                  <SelectValue placeholder={selectedMake ? t('form.selectModel') : t('form.selectMakeFirst')} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                  {models.map((model) => (
                    <SelectItem key={model} value={model} className="text-white hover:bg-[#2a2d3a]">
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.model && (
                <p className="text-red-400 text-sm">{form.formState.errors.model.message}</p>
              )}
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label className="text-white">{t('form.year')}: {form.watch('year')}</Label>
              <Slider
                value={[form.watch('year')]}
                onValueChange={([value]) => form.setValue('year', value)}
                min={YEAR_RANGE.min}
                max={YEAR_RANGE.max}
                step={1}
                className="py-4"
              />
            </div>

            {/* Trim */}
            <div className="space-y-2">
              <Label htmlFor="trim" className="text-white flex items-center gap-2">
                {t('form.trim')}
                <InteractiveTooltip content={FIELD_TOOLTIPS.trim} />
              </Label>
              <Select
                value={form.watch('trim') || ''}
                onValueChange={(value) => form.setValue('trim', value === '__none__' ? '' : value)}
                disabled={trims.length === 0}
              >
                <SelectTrigger className="bg-[#0f1117] border-[#2a2d3a] text-white h-12">
                  <SelectValue placeholder={trims.length > 0 ? t('form.selectTrim') : t('form.noTrims')} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                  <SelectItem value="__none__" className="text-white hover:bg-[#2a2d3a]">None</SelectItem>
                  {trims.map((trim) => (
                    <SelectItem key={trim} value={trim} className="text-white hover:bg-[#2a2d3a]">
                      {trim}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mileage */}
            <div className="space-y-2">
              <Label htmlFor="mileage" className="text-white flex items-center gap-2">
                {t('form.mileage')} *
                <InteractiveTooltip 
                  content={
                    form.watch('year') 
                      ? `${FIELD_TOOLTIPS.mileage} Average: ${Math.round(((new Date().getFullYear() - form.watch('year')) * 12000) / 1000)}k km/year.`
                      : `${FIELD_TOOLTIPS.mileage} Average: 12,000 km/year.`
                  } 
                />
              </Label>
              <Input
                type="number"
                id="mileage"
                {...form.register('mileage', { valueAsNumber: true })}
                className="bg-[#0f1117] border-[#2a2d3a] text-white h-12"
                placeholder={t('form.placeholderMileage')}
              />
              {form.formState.errors.mileage && (
                <p className="text-red-400 text-sm">{form.formState.errors.mileage.message}</p>
              )}
              <MileageValidator
                mileage={form.watch('mileage') || 0}
                year={form.watch('year') || new Date().getFullYear()}
                confirmed={mileageConfirmed}
                onConfirmedChange={setMileageConfirmed}
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color" className="text-white">{t('form.color')}</Label>
              <Select
                value={form.watch('color') || ''}
                onValueChange={(value) => form.setValue('color', value === '__none__' ? '' : value)}
              >
                <SelectTrigger className="bg-[#0f1117] border-[#2a2d3a] text-white h-12">
                  <SelectValue placeholder={t('form.selectColor')} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                  <SelectItem value="__none__" className="text-white hover:bg-[#2a2d3a]">None</SelectItem>
                  {COLORS.map((color) => (
                    <SelectItem key={color} value={color} className="text-white hover:bg-[#2a2d3a]">
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* VIN */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="vin" className="text-white flex items-center gap-2">
                  {t('form.vin')}
                  <InteractiveTooltip content={FIELD_TOOLTIPS.vin} />
                </Label>
                {!manualEntry && (
                  <button
                    type="button"
                    onClick={() => setManualEntry(true)}
                    className="text-xs text-[#5B7FFF] hover:text-[#4c6ee5] underline"
                  >
                    Skip VIN / Manual Entry
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type="text"
                  id="vin"
                  {...form.register('vin', {
                    onChange: async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const vinValue = e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '')
                      form.setValue('vin', vinValue)
                      setVinError(null)
                      
                      // Auto-decode when 17 characters entered
                      if (vinValue.length === 17 && !manualEntry && validateVINFormat(vinValue)) {
                        setVinDecoding(true)
                        try {
                          const vehicleData = await decodeVIN(vinValue)
                          
                          // Auto-populate form fields
                          if (vehicleData.make) {
                            form.setValue('make', vehicleData.make)
                            setSelectedMake(vehicleData.make)
                          }
                          if (vehicleData.model) {
                            // Wait for models to load before setting
                            setTimeout(() => {
                              form.setValue('model', vehicleData.model || '')
                            }, 500)
                          }
                          if (vehicleData.year) {
                            form.setValue('year', vehicleData.year)
                          }
                          if (vehicleData.trim) {
                            // Wait for trims to load before setting
                            setTimeout(() => {
                              form.setValue('trim', vehicleData.trim || '')
                            }, 1000)
                          }
                          
                          toast({
                            title: 'VIN Decoded Successfully',
                            description: `Auto-filled: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
                            variant: 'default',
                          })
                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : 'Failed to decode VIN'
                          setVinError(
                            errorMessage.includes('Invalid VIN') || errorMessage.includes('VIN not found')
                              ? 'Invalid VIN - VIN not found. Please enter manually.'
                              : 'Invalid VIN or unable to decode'
                          )
                          toast({
                            title: 'VIN Decode Error',
                            description: errorMessage.includes('Invalid VIN') || errorMessage.includes('VIN not found')
                              ? 'VIN not found - please enter manually'
                              : 'Invalid VIN or unable to decode',
                            variant: 'destructive',
                          })
                        } finally {
                          setVinDecoding(false)
                        }
                      } else if (vinValue.length === 17 && !validateVINFormat(vinValue)) {
                        setVinError('Invalid VIN format')
                      }
                    }
                  })}
                  className="bg-[#0f1117] border-[#2a2d3a] text-white h-12 pr-10"
                  placeholder={t('form.enterVin')}
                  maxLength={17}
                  disabled={vinDecoding}
                />
                {vinDecoding && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-5 w-5 animate-spin text-[#5B7FFF]" />
                  </div>
                )}
              </div>
              {vinError && (
                <p className="text-yellow-400 text-sm flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {vinError}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
          </CollapsibleSection>
        </div>

      {/* B) Condition Assessment */}
      <div ref={(el) => { sectionsRef.current[2] = el }}>
        <CollapsibleSection
          title="Condition Assessment"
          completed={steps[1].completed}
          defaultExpanded={currentStep === 2}
          onEdit={() => {
            setCurrentStep(2)
            sectionsRef.current[2]?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <Card className="p-6 border-[#2a2d3a] bg-[#1a1d29]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Star className="h-5 w-5 text-yellow-400" />
                {t('form.conditionAssessment')}
              </CardTitle>
            </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Condition */}
            <StarRating
              label={t('form.overallCondition')}
              value={form.watch('overall_condition') || 5}
              onChange={(value) => form.setValue('overall_condition', value)}
            />

            {/* Interior Condition */}
            <StarRating
              label={t('form.interiorCondition')}
              value={form.watch('interior_condition') || 5}
              onChange={(value) => form.setValue('interior_condition', value)}
            />

            {/* Exterior Condition */}
            <StarRating
              label={t('form.exteriorCondition')}
              value={form.watch('exterior_condition') || 5}
              onChange={(value) => form.setValue('exterior_condition', value)}
            />

            {/* Mechanical Condition */}
            <StarRating
              label={t('form.mechanicalCondition')}
              value={form.watch('mechanical_condition') || 5}
              onChange={(value) => form.setValue('mechanical_condition', value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2a2d3a]">
            {/* Service History */}
            <div className="space-y-2">
              <Label className="text-white">{t('form.serviceHistory')}</Label>
              <RadioGroup
                value={form.watch('service_history') || 'Full'}
                onValueChange={(value) => form.setValue('service_history', value as 'Full' | 'Partial' | 'None')}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Full" id="service-full" />
                  <Label htmlFor="service-full" className="text-white cursor-pointer">{t('form.full')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Partial" id="service-partial" />
                  <Label htmlFor="service-partial" className="text-white cursor-pointer">{t('form.partial')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="None" id="service-none" />
                  <Label htmlFor="service-none" className="text-white cursor-pointer">{t('form.noneService')}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Previous Owners */}
            <div className="space-y-2">
              <Label htmlFor="previous_owners" className="text-white">{t('form.previousOwners')}</Label>
              <Input
                type="number"
                id="previous_owners"
                {...form.register('previous_owners', { valueAsNumber: true })}
                className="bg-[#0f1117] border-[#2a2d3a] text-white h-12"
                min={0}
                max={10}
                placeholder={t('form.placeholderOwners')}
              />
            </div>

            {/* Remaining Warranty */}
            <div className="flex items-center justify-between md:col-span-2">
              <div className="space-y-0.5">
                <Label className="text-white">{t('form.remainingWarranty')}</Label>
                <p className="text-sm text-[#94a3b8]">{t('form.remainingWarrantyDesc')}</p>
              </div>
              <Switch
                checked={form.watch('remaining_warranty') || false}
                onCheckedChange={(checked) => form.setValue('remaining_warranty', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
        </CollapsibleSection>
      </div>

      {/* C) Accident History & Features */}
      <div ref={(el) => { sectionsRef.current[3] = el }}>
        <CollapsibleSection
          title="Accident History & Premium Features"
          completed={steps[2].completed}
          defaultExpanded={currentStep === 3}
          onEdit={() => {
            setCurrentStep(3)
            sectionsRef.current[3]?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
      {/* C) Accident History */}
      <Card className="p-6 border-[#2a2d3a] bg-[#1a1d29] mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('form.accidentHistory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Has Accident Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-white">{t('form.hasAccident')}</Label>
                <p className="text-sm text-[#94a3b8]">{t('form.hasAccidentDesc')}</p>
              </div>
              <Switch
                checked={hasAccident}
                onCheckedChange={(checked) => {
                  form.setValue('has_accident', checked)
                  if (!checked) {
                    form.setValue('damaged_parts_count', 0)
                    form.setValue('severity', '')
                    form.setValue('affected_parts', [])
                    form.setValue('repaired', false)
                    form.setValue('repair_quality', undefined)
                  }
                }}
              />
            </div>

            {/* Accident Details */}
            {hasAccident && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2a2d3a]"
              >
                {/* Severity */}
                <div className="space-y-2">
                  <Label htmlFor="severity" className="text-white">{t('form.severity')} *</Label>
                  <Select
                    value={form.watch('severity') || ''}
                    onValueChange={(value) => {
                      form.setValue('severity', value)
                      form.clearErrors('severity')
                    }}
                  >
                    <SelectTrigger className={`bg-[#0f1117] border-[#2a2d3a] text-white h-12 ${
                      form.formState.errors.severity ? 'border-red-500' : ''
                    }`}>
                      <SelectValue placeholder={t('form.selectSeverity')} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                      {SEVERITIES.map((sev) => (
                        <SelectItem key={sev.value} value={sev.value} className="text-white hover:bg-[#2a2d3a]">
                          {sev.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.severity && (
                    <p className="text-red-400 text-sm">{form.formState.errors.severity.message}</p>
                  )}
                </div>

                {/* Damaged Parts Count */}
                <div className="space-y-2">
                  <Label htmlFor="damaged_parts_count" className="text-white">{t('form.damagedParts')}</Label>
                  <Input
                    type="number"
                    id="damaged_parts_count"
                    {...form.register('damaged_parts_count', { valueAsNumber: true })}
                    className="bg-[#0f1117] border-[#2a2d3a] text-white h-12"
                    min={0}
                    max={50}
                    placeholder={t('form.placeholderOwners')}
                  />
                </div>

                {/* Affected Parts */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white">{t('form.affectedParts')}</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {AFFECTED_PARTS.map((part) => {
                      const isChecked = (form.watch('affected_parts') || []).includes(part)
                      return (
                        <div key={part} className="flex items-center space-x-2">
                          <Checkbox
                            id={`part-${part}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const current = form.watch('affected_parts') || []
                              if (checked) {
                                form.setValue('affected_parts', [...current, part])
                              } else {
                                form.setValue('affected_parts', current.filter(p => p !== part))
                              }
                            }}
                          />
                          <Label htmlFor={`part-${part}`} className="text-sm text-white cursor-pointer">
                            {part}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Repaired */}
                <div className="flex items-center justify-between md:col-span-2">
                  <Label className="text-white">{t('form.repaired')}</Label>
                  <Switch
                    checked={form.watch('repaired') || false}
                    onCheckedChange={(checked) => form.setValue('repaired', checked)}
                  />
                </div>

                {/* Repair Quality */}
                {form.watch('repaired') && (
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-white">{t('form.repairQuality')}</Label>
                    <Select
                      value={form.watch('repair_quality') || ''}
                      onValueChange={(value) => form.setValue('repair_quality', value as 'Excellent' | 'Good' | 'Fair' | 'Poor')}
                    >
                      <SelectTrigger className="bg-[#0f1117] border-[#2a2d3a] text-white h-12">
                        <SelectValue placeholder={t('form.selectRepairQuality')} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                        {CONDITIONS.map((cond) => (
                          <SelectItem key={cond} value={cond} className="text-white hover:bg-[#2a2d3a]">
                            {cond}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* D) Premium Features */}
      <Card className="p-6 border-[#2a2d3a] bg-[#1a1d29] mb-6">
        <CardHeader>
          <CardTitle className="text-white">{t('form.premiumFeatures')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PREMIUM_FEATURES.map((feature) => {
              const isChecked = premiumFeatures.includes(feature)
              return (
                <div key={feature} className="flex items-center space-x-2">
                  <Checkbox
                    id={`feature-${feature}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const current = form.watch('premium_features') || []
                      if (checked) {
                        form.setValue('premium_features', [...current, feature])
                      } else {
                        form.setValue('premium_features', current.filter(f => f !== feature))
                      }
                    }}
                  />
                  <Label htmlFor={`feature-${feature}`} className="text-sm text-white cursor-pointer">
                    {feature}
                  </Label>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
        </CollapsibleSection>
      </div>

      {/* E) Location & Contact & Photos */}
      <div ref={(el) => { sectionsRef.current[4] = el }}>
        <CollapsibleSection
          title="Contact, Location & Photos"
          completed={steps[3].completed}
          defaultExpanded={currentStep === 4}
          onEdit={() => {
            setCurrentStep(4)
            sectionsRef.current[4]?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
      {/* E) Location & Contact */}
      <Card className="p-6 border-[#2a2d3a] bg-[#1a1d29] mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <MapPin className="h-5 w-5 text-[#5B7FFF]" />
            {t('form.locationContact')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-white">{t('form.location')} *</Label>
              <Select
                value={form.watch('location')}
                onValueChange={(value) => form.setValue('location', value)}
              >
                <SelectTrigger className="bg-[#0f1117] border-[#2a2d3a] text-white h-12">
                  <SelectValue placeholder={t('form.selectLocation')} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1d29] border-[#2a2d3a] max-h-[200px]">
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc} className="text-white hover:bg-[#2a2d3a]">
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.location && (
                <p className="text-red-400 text-sm">{form.formState.errors.location.message}</p>
              )}
            </div>

            {/* Asking Price */}
            <div className="space-y-2">
              <Label htmlFor="asking_price" className="text-white">{t('form.askingPrice')}</Label>
              <Input
                type="number"
                id="asking_price"
                {...form.register('asking_price', { valueAsNumber: true })}
                className="bg-[#0f1117] border-[#2a2d3a] text-white h-12"
                placeholder={t('form.placeholderAskingPrice')}
                min={0}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('form.email')}
              </Label>
              <Input
                type="email"
                id="email"
                {...form.register('email')}
                className="bg-[#0f1117] border-[#2a2d3a] text-white h-12"
                placeholder={t('form.placeholderEmail')}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {t('form.phone')} *
              </Label>
              <Input
                type="tel"
                id="phone"
                {...form.register('phone')}
                className="bg-[#0f1117] border-[#2a2d3a] text-white h-12"
                placeholder={t('form.placeholderPhone')}
                required
              />
              {form.formState.errors.phone && (
                <p className="text-red-400 text-sm">{form.formState.errors.phone.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* F) Image Upload */}
      <Card className="p-6 border-[#2a2d3a] bg-[#1a1d29] mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Camera className="h-5 w-5 text-[#5B7FFF]" />
              {t('form.imageUpload')} *
            </CardTitle>
            <PhotoGuidelines />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Photo Count Progress */}
            <PhotoCountProgress count={images.length} maxRecommended={8} />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                images.length === 0
                  ? 'border-red-500/50 hover:border-red-500'
                  : 'border-[#2a2d3a] hover:border-[#5B7FFF]'
              }`}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-[#94a3b8]" />
              <p className="text-white mb-2">{t('form.dragDropImages')}</p>
              <p className="text-sm text-[#94a3b8]">{t('form.imageFormat')}</p>
              {images.length === 0 && (
                <p className="text-red-400 text-sm mt-2">At least 1 photo is required</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              className="hidden"
              capture="environment"
            />

            {/* Draggable Image Grid */}
            {imagePreviews.length > 0 && (
              <DraggablePhotoGrid
                images={images}
                previews={imagePreviews}
                onReorder={handlePhotoReorder}
                onRemove={removeImage}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <div className="space-y-2 mb-4">
          {validationWarnings.map((warning, index) => (
            <Alert
              key={index}
              variant={warning.severity === 'warning' ? 'warning' : 'info'}
              className="text-sm"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{warning.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Calculate Button */}
      <Button
        type="submit"
        disabled={loading || !form.formState.isValid || images.length === 0}
        className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 hover:from-blue-700 hover:via-purple-700 hover:to-blue-700 text-white py-6 text-lg font-semibold h-auto min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Calculating...
          </>
        ) : (
          <>
            {t('form.calculatePrice')}
          </>
        )}
      </Button>
      {images.length === 0 && (
        <p className="text-center text-red-400 text-sm -mt-2">Please upload at least 1 photo to continue</p>
      )}
        </CollapsibleSection>
      </div>
    </form>
      </div>
  )
}


