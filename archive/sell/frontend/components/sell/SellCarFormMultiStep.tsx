"use client"

import { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import type { SellCarRequest } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload, X, Image as ImageIcon, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const sellCarSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(2000).max(2025),
  mileage: z.number().min(0),
  location: z.string().min(1, "Location is required"),
  condition: z.string().min(1, "Condition is required"),
  trim: z.string().optional(),
  has_accident: z.boolean(),
  damaged_parts_count: z.number().min(0).max(50).optional(),
  severity: z.string().optional(),
})

type SellCarFormValues = z.infer<typeof sellCarSchema>

interface SellCarFormMultiStepProps {
  onSubmit: (data: SellCarRequest, imageFeatures?: number[]) => void
  loading?: boolean
}

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor']
const MAX_IMAGES = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function SellCarFormMultiStep({ onSubmit, loading }: SellCarFormMultiStepProps) {
  const t = useTranslations('sell')
  const { toast } = useToast()
  const [step, setStep] = useState(1)
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [analyzingImages, setAnalyzingImages] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState<{
    summary: string
    bullets: string[]
    guessed_make: string | null
    guessed_model: string | null
    guessed_color: string | null
    condition: string
    confidence: number
    image_features?: number[]
  } | null>(null)
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])

  const form = useForm<SellCarFormValues>({
    resolver: zodResolver(sellCarSchema),
    defaultValues: {
      make: '',
      model: '',
      year: 2020,
      mileage: 0,
      location: '',
      condition: 'Good',
      trim: '',
      has_accident: false,
      damaged_parts_count: 0,
      severity: undefined,
    },
  })

  const watchedMake = form.watch('make')
  const watchedModel = form.watch('model')

  // Load options
  useEffect(() => {
    Promise.all([
      apiClient.getMakes().catch(() => []),
      apiClient.getLocations().catch(() => []),
    ]).then(([makesData, locationsData]) => {
      setMakes(makesData)
      setLocations(locationsData)
    })
  }, [])

  // Load models when make changes
  useEffect(() => {
    if (watchedMake) {
      apiClient.getModels(watchedMake).then(setModels).catch(() => setModels([]))
    } else {
      setModels([])
    }
  }, [watchedMake])

  // Auto-fill from image analysis
  useEffect(() => {
    if (imageAnalysis) {
      if (imageAnalysis.guessed_make && !form.getValues('make')) {
        form.setValue('make', imageAnalysis.guessed_make)
      }
      if (imageAnalysis.guessed_model && !form.getValues('model')) {
        form.setValue('model', imageAnalysis.guessed_model)
      }
      if (imageAnalysis.condition && imageAnalysis.condition !== 'unknown') {
        const conditionMap: Record<string, string> = {
          excellent: 'Excellent',
          good: 'Good',
          fair: 'Fair',
          poor: 'Poor',
        }
        const mappedCondition = conditionMap[imageAnalysis.condition.toLowerCase()]
        if (mappedCondition) {
          form.setValue('condition', mappedCondition)
        }
      }
    }
  }, [imageAnalysis, form])

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return

    const newFiles: File[] = []
    const newPreviews: string[] = []

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not an image file`,
          variant: 'destructive',
        })
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds 5MB limit`,
          variant: 'destructive',
        })
        return
      }

      // Validate total count
      if (images.length + newFiles.length >= MAX_IMAGES) {
        toast({
          title: 'Too many images',
          description: `Maximum ${MAX_IMAGES} images allowed`,
          variant: 'destructive',
        })
        return
      }

      newFiles.push(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          newPreviews.push(e.target.result as string)
          setImagePreviews([...imagePreviews, ...newPreviews])
        }
      }
      reader.readAsDataURL(file)
    })

    setImages([...images, ...newFiles])
  }, [images, imagePreviews, toast])

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
    setImagePreviews(imagePreviews.filter((_, i) => i !== index))
  }

  const handleAnalyzeImages = async () => {
    if (images.length === 0) {
      toast({
        title: 'No images',
        description: 'Please upload at least one image',
        variant: 'destructive',
      })
      return
    }

    setAnalyzingImages(true)
    try {
      const result = await apiClient.analyzeImages(images)
      if (result.success && result.data) {
        setImageAnalysis(result.data)
        toast({
          title: 'Images analyzed',
          description: 'AI analysis complete',
        })
      }
    } catch (error: any) {
      toast({
        title: 'Analysis failed',
        description: error.message || 'Failed to analyze images',
        variant: 'destructive',
      })
    } finally {
      setAnalyzingImages(false)
    }
  }

  const handleNext = async () => {
    if (step === 1) {
      // Step 1: Analyze images if uploaded
      if (images.length > 0) {
        await handleAnalyzeImages()
      }
      setStep(2)
    } else if (step === 2) {
      // Step 2: Validate form
      const isValid = await form.trigger()
      if (isValid) {
        setStep(3)
      }
    }
  }

  const handleSubmit = async () => {
    const isValid = await form.trigger()
    if (!isValid) return

    const formData = form.getValues()
    const submitData: SellCarRequest = {
      make: formData.make,
      model: formData.model,
      year: formData.year,
      mileage: formData.mileage,
      location: formData.location,
      condition: formData.condition,
      trim: formData.trim,
      has_accident: formData.has_accident,
      damaged_parts_count: formData.damaged_parts_count || 0,
      severity: formData.severity as 'minor' | 'moderate' | 'severe' | undefined,
    }

    onSubmit(submitData, imageAnalysis?.image_features)
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= s ? 'bg-[#5B7FFF] text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`w-16 h-1 mx-2 ${step > s ? 'bg-[#5B7FFF]' : 'bg-gray-700'}`}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload Images */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Upload Car Images</CardTitle>
                <CardDescription>
                  Upload up to {MAX_IMAGES} images of your car (optional but recommended)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Image Upload Area */}
                <div
                  className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-[#5B7FFF] transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.add('border-[#5B7FFF]')
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('border-[#5B7FFF]')
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-[#5B7FFF]')
                    handleImageUpload(e.dataTransfer.files)
                  }}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.multiple = true
                    input.accept = 'image/*'
                    input.onchange = (e) => {
                      handleImageUpload((e.target as HTMLInputElement).files)
                    }
                    input.click()
                  }}
                >
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300 mb-2">
                    Drag & drop images here or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    JPG, PNG, WEBP up to 5MB each
                  </p>
                </div>

                {/* Image Gallery */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                          <Image
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            width={200}
                            height={200}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Image Analysis Results */}
                {imageAnalysis && (
                  <Card className="bg-blue-500/10 border-blue-500/50">
                    <CardHeader>
                      <CardTitle className="text-blue-400">AI Analysis Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-white mb-2">{imageAnalysis.summary}</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-300">
                        {imageAnalysis.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                      {imageAnalysis.guessed_make && (
                        <p className="mt-2 text-sm text-blue-300">
                          AI suggested: {imageAnalysis.guessed_make}{' '}
                          {imageAnalysis.guessed_model || ''}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={handleNext}
                    disabled={analyzingImages}
                    className="bg-[#5B7FFF] hover:bg-[#4A6EEF]"
                  >
                    {analyzingImages ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Car Details */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Step 2: Car Details</CardTitle>
                <CardDescription>
                  {imageAnalysis?.guessed_make && (
                    <span className="text-blue-400">
                      AI suggested: {imageAnalysis.guessed_make}{' '}
                      {imageAnalysis.guessed_model || ''} (edit if wrong)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Make *</Label>
                    <Select
                      value={form.watch('make')}
                      onValueChange={(value) => form.setValue('make', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select make" />
                      </SelectTrigger>
                      <SelectContent>
                        {makes.map((make) => (
                          <SelectItem key={make} value={make}>
                            {make}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.make && (
                      <p className="text-red-400 text-sm mt-1">
                        {form.formState.errors.make.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Model *</Label>
                    <Select
                      value={form.watch('model')}
                      onValueChange={(value) => form.setValue('model', value)}
                      disabled={!watchedMake}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.model && (
                      <p className="text-red-400 text-sm mt-1">
                        {form.formState.errors.model.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Year *</Label>
                    <Input
                      type="number"
                      {...form.register('year', { valueAsNumber: true })}
                    />
                    {form.formState.errors.year && (
                      <p className="text-red-400 text-sm mt-1">
                        {form.formState.errors.year.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Mileage (km) *</Label>
                    <Input
                      type="number"
                      {...form.register('mileage', { valueAsNumber: true })}
                    />
                    {form.formState.errors.mileage && (
                      <p className="text-red-400 text-sm mt-1">
                        {form.formState.errors.mileage.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Location *</Label>
                    <Select
                      value={form.watch('location')}
                      onValueChange={(value) => form.setValue('location', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.location && (
                      <p className="text-red-400 text-sm mt-1">
                        {form.formState.errors.location.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Condition *</Label>
                    <Select
                      value={form.watch('condition')}
                      onValueChange={(value) => form.setValue('condition', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((cond) => (
                          <SelectItem key={cond} value={cond}>
                            {cond}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.condition && (
                      <p className="text-red-400 text-sm mt-1">
                        {form.formState.errors.condition.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Trim (optional)</Label>
                    <Input {...form.register('trim')} />
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="bg-[#5B7FFF] hover:bg-[#4A6EEF]"
                  >
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Review & Predict */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Step 3: Review & Predict Price</CardTitle>
                <CardDescription>
                  Review your information and get price prediction
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Review Summary */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-white">Car Information:</h3>
                  <div className="grid grid-cols-2 gap-2 text-gray-300">
                    <div>Make: <span className="text-white">{form.watch('make')}</span></div>
                    <div>Model: <span className="text-white">{form.watch('model')}</span></div>
                    <div>Year: <span className="text-white">{form.watch('year')}</span></div>
                    <div>Mileage: <span className="text-white">{form.watch('mileage')} km</span></div>
                    <div>Location: <span className="text-white">{form.watch('location')}</span></div>
                    <div>Condition: <span className="text-white">{form.watch('condition')}</span></div>
                  </div>
                </div>

                {/* Image Preview */}
                {imagePreviews.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-white mb-2">Uploaded Images ({imagePreviews.length})</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {imagePreviews.slice(0, 4).map((preview, index) => (
                        <div key={index} className="aspect-square rounded-lg overflow-hidden bg-gray-800">
                          <Image
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            width={100}
                            height={100}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-[#5B7FFF] hover:bg-[#4A6EEF]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Predicting...
                      </>
                    ) : (
                      'Predict Price'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
