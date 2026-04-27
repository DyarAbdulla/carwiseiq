"use client"
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CompactWizardCard } from '@/components/prediction/CompactWizardCard'
import { PredictionResultSkeleton } from '@/components/prediction/PredictionResultSkeleton'
import { SmartDealAnalystSkeleton } from '@/components/prediction/SmartDealAnalystSkeleton'
import { PredictionLoader } from '@/components/prediction/PredictionLoader'
import { LoadingAnimation } from '@/components/prediction/LoadingAnimation'
import { SmartTips } from '@/components/prediction/SmartTips'

const PredictionResult = dynamic(
  () => import('@/components/prediction/PredictionResult').then((m) => ({ default: m.PredictionResult })),
  { loading: () => <PredictionResultSkeleton />, ssr: false }
)
import { apiClient, type DailyUsageStatus } from '@/lib/api'
import { getUserFacingApiError } from '@/lib/getUserFacingApiError'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Image as ImageIcon } from 'lucide-react'
import { addRecentSearch } from '@/lib/recent-searches'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { markPredictEngaged } from '@/lib/push/engagement'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { usePredictLoading } from '@/components/PredictLoadingProvider'
import { activityHelpers } from '@/lib/activityLogger'
import { safeText, sanitizeCarFeaturesFromUnknown } from '@/lib/safeDisplay'
import { VoucherApplyModal } from '@/components/vouchers/VoucherApplyModal'
import { CONDITIONS } from '@/lib/constants'

// Image upload constants (kept for image analysis functionality)
const MAX_IMAGES = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

function buildPredictShareQuery(features: CarFeatures, predictedPrice: number) {
  return new URLSearchParams({
    make: features.make,
    model: features.model,
    year: String(features.year),
    mileage: String(features.mileage),
    condition: features.condition,
    price: String(predictedPrice),
  }).toString()
}

function parseSharedResultFromUrl(get: (k: string) => string): { features: CarFeatures; predicted_price: number } | null {
  const make = get('make')
  const model = get('model')
  const yearStr = get('year')
  const mileageStr = get('mileage')
  const conditionRaw = get('condition')
  const priceStr = get('price')
  if (!make || !model || !yearStr || !mileageStr || !conditionRaw || !priceStr) return null
  const predicted_price = parseFloat(priceStr)
  if (!Number.isFinite(predicted_price) || predicted_price <= 0) return null
  const y = parseInt(yearStr, 10)
  const m = parseInt(mileageStr, 10)
  const year = Number.isFinite(y) ? y : new Date().getFullYear()
  const mileage = Number.isFinite(m) ? Math.max(0, m) : 50000
  const condition = CONDITIONS.includes(conditionRaw) ? conditionRaw : 'Good'
  return {
    predicted_price,
    features: {
      make,
      model,
      year,
      mileage,
      trim: '',
      engine_size: 2.0,
      cylinders: 4,
      condition,
      fuel_type: 'Gasoline',
      location: '',
      color: '',
    },
  }
}

function PredictPageContent() {
  // All hooks must be called before any conditional returns
  const [mounted, setMounted] = useState(false)
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [carFeatures, setCarFeatures] = useState<CarFeatures | null>(null)
  // Use loading state from PredictLoadingProvider context
  const { loading, setLoading } = usePredictLoading()
  const [prefillData, setPrefillData] = useState<CarFeatures | null>(null)
  const [formFeatures, setFormFeatures] = useState<Partial<CarFeatures> | null>(null)
  const [predictionId, setPredictionId] = useState<number | undefined>(undefined)
  const resultsRef = useRef<HTMLDivElement>(null)
  // Image upload state
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [dailyUsage, setDailyUsage] = useState<DailyUsageStatus | null>(null)
  const [voucherOpen, setVoucherOpen] = useState(false)
  /** Direct open from a shared /en/predict?...&price=... link — hide the wizard, show result only */
  const [hydratedFromShare, setHydratedFromShare] = useState(false)

  const refreshDailyUsage = useCallback(async () => {
    try {
      setDailyUsage(await apiClient.getDailyUsageStatus())
    } catch {
      setDailyUsage(null)
    }
  }, [])

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hooks must be called unconditionally
  const t = useTranslations('predict')
  const tCommon = useTranslations('common')
  const tProfile = useTranslations('profile')
  const tUsage = useTranslations('usageLimits')
  const tRoot = useTranslations()
  const toastHook = useToast()
  const toast = toastHook || { toast: () => { } }

  // Ensure component only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    void refreshDailyUsage()
  }, [mounted, refreshDailyUsage])

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname() || '/predict'

  // Restore result from share URL, prefill from URL, or sessionStorage
  useEffect(() => {
    const raw = (k: string) => {
      const v = searchParams?.get(k)
      if (v == null || v === '') return ''
      try {
        return decodeURIComponent(v.trim())
      } catch {
        return v.trim()
      }
    }
    if (loading) return

    // Shared result link: all params + price — show result without API
    if (!prediction) {
      const shared = parseSharedResultFromUrl(raw)
      if (shared) {
        setCarFeatures(shared.features)
        setFormFeatures(shared.features)
        setPrediction({ predicted_price: shared.predicted_price })
        setPredictionId(undefined)
        setHydratedFromShare(true)
        return
      }
    }

    if (prediction) return

    const make = raw('make')
    const model = raw('model')
    const yearStr = raw('year')
    const mileageStr = raw('mileage')

    if (make && model) {
      const y = yearStr ? parseInt(yearStr, 10) : Number.NaN
      const yearNum = Number.isFinite(y) ? y : new Date().getFullYear()
      const m = mileageStr ? parseInt(mileageStr, 10) : Number.NaN
      const mileageNum = Number.isFinite(m) ? Math.max(0, m) : 50000
      setPrefillData({
        make,
        model,
        year: yearNum,
        mileage: mileageNum,
        trim: '',
        engine_size: 2.0,
        cylinders: 4,
        condition: 'Good',
        fuel_type: 'Gasoline',
        location: '',
        color: '',
      })
      return
    }

    if (typeof window === 'undefined' || !window.sessionStorage) return
    try {
      const prefill = sessionStorage.getItem('prefillCar')
      if (prefill) {
        try {
          const data = JSON.parse(prefill)
          const cleaned = sanitizeCarFeaturesFromUnknown(data)
          if (cleaned) {
            setPrefillData(cleaned)
            sessionStorage.removeItem('prefillCar')
            if (toast?.toast) {
              toast.toast({
                title: tCommon?.('success') || 'Success',
                description: `Car details loaded: ${cleaned.make} ${cleaned.model} (${cleaned.year})`,
              })
            }
          }
        } catch (e) {
          console.error('Failed to parse prefill data:', e)
          sessionStorage.removeItem('prefillCar')
        }
      }
    } catch (error) {
      console.error('SessionStorage access error:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-running sessionStorage; prediction/loading drive share restore
  }, [searchParams, prediction, loading])

  // Clear images when form is cleared (formFeatures becomes null/empty)
  useEffect(() => {
    if (!formFeatures || (!formFeatures.make && !formFeatures.model)) {
      // Form was cleared, reset images
      if (images.length > 0 || imagePreviews.length > 0) {
        setImages([])
        setImagePreviews([])
        setImageAnalysis(null)
        setSelectedImageIndex(0)
      }
    }
  }, [formFeatures, images.length, imagePreviews.length])

  // Image upload handlers
  const handleImageUpload = (files: FileList | null) => {
    if (!files) return

    const newFiles: File[] = []
    const previewPromises: Promise<string>[] = []

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        if (toast?.toast) {
          toast.toast({
            title: 'Invalid file type',
            description: `${file.name} must be jpg, png, or webp`,
            variant: 'destructive',
          })
        }
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        if (toast?.toast) {
          toast.toast({
            title: 'File too large',
            description: `${file.name} exceeds 5MB limit`,
            variant: 'destructive',
          })
        }
        return
      }

      // Validate total count
      if (images.length + newFiles.length >= MAX_IMAGES) {
        if (toast?.toast) {
          toast.toast({
            title: 'Too many images',
            description: `Maximum ${MAX_IMAGES} images allowed`,
            variant: 'destructive',
          })
        }
        return
      }

      newFiles.push(file)
      const previewPromise = new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(e.target.result as string)
          }
        }
        reader.readAsDataURL(file)
      })
      previewPromises.push(previewPromise)
    })

    if (newFiles.length > 0) {
      setImages((prev) => [...prev, ...newFiles])
      Promise.all(previewPromises).then((previews) => {
        setImagePreviews((prev) => [...prev, ...previews])
      })
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
    if (selectedImageIndex >= images.length - 1 && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1)
    }
    if (images.length === 1) {
      setImageAnalysis(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleImageUpload(e.dataTransfer.files)
  }

  const handlePredict = async (features: CarFeatures | null) => {
    // Validate input
    if (!features) {
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: 'Invalid car features provided',
          variant: 'destructive',
        })
      }
      return
    }

    // Validate fuel_type before API call (extra safeguard)
    const validFuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Plug-In Hybrid', 'Other']
    if (!features.fuel_type || !validFuelTypes.includes(features.fuel_type)) {
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: `Invalid fuel type: ${features.fuel_type || 'undefined'}. Must be one of: ${validFuelTypes.join(', ')}`,
          variant: 'destructive',
        })
      }
      return
    }

    // IMMEDIATE STATE CHANGE: Set loading and clear previous results instantly
    setLoading(true)
    setPrediction(null)
    setCarFeatures(features)
    setFormFeatures(features)
    setPredictionId(undefined) // Reset prediction ID when starting new prediction

    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Predict request:', {
        make: features.make,
        model: features.model,
        year: features.year,
        trim: features.trim || 'N/A',
      })
    }

    // Yield to browser to allow UI to update before starting heavy work
    await new Promise(resolve => setTimeout(resolve, 0))

    try {
      // If images exist, analyze them first to get image_features
      let imageFeatures: number[] | undefined = undefined
      if (images.length > 0) {
        try {
          const analysisResult = await apiClient.analyzeImages(images)
          if (analysisResult.success && analysisResult.data?.image_features) {
            imageFeatures = analysisResult.data.image_features
            setImageAnalysis(analysisResult.data)
          }
        } catch (imageError) {
          console.error('Image analysis failed:', imageError)
          // Continue with prediction without images
          if (toast?.toast) {
            toast.toast({
              title: 'Image analysis failed',
              description: 'Continuing with prediction without image features',
              variant: 'default',
            })
          }
        }
      }

      const result = await apiClient.predictPrice(features, imageFeatures)

      // Validate result
      if (!result || typeof result !== 'object' || typeof result.predicted_price !== 'number') {
        throw new Error('Invalid response from server')
      }

      setPrediction(result)
      markPredictEngaged()

      try {
        router.replace(`${pathname}?${buildPredictShareQuery(features, result.predicted_price)}`, { scroll: false })
      } catch (e) {
        console.error('Failed to update share URL:', e)
      }

      // Log prediction activity (for Activity History)
      activityHelpers.logPrediction({
        make: features.make,
        model: features.model,
        year: features.year,
        predictedPrice: result.predicted_price,
      })

      // Save prediction to database for feedback tracking
      // Only save if we have valid data
      if (features && result && typeof result.predicted_price === 'number' && result.predicted_price > 0) {
        try {
          const saveResult = await apiClient.savePrediction({
            car_features: features,
            predicted_price: result.predicted_price,
            confidence_interval: result.confidence_interval,
            confidence_level: result.confidence_level,
            image_features: imageFeatures
          })
          if (saveResult && saveResult.prediction_id) {
            setPredictionId(saveResult.prediction_id)
            console.log('Prediction saved with ID:', saveResult.prediction_id)
          }
        } catch (saveError) {
          console.error('Failed to save prediction to database:', saveError)
          // Non-critical error, continue - prediction still works without saving
        }
      } else {
        console.warn('Skipping prediction save: missing required data', {
          hasFeatures: !!features,
          hasResult: !!result,
          hasPrice: result && typeof result.predicted_price === 'number'
        })
      }

      // Save to recent searches (with error handling)
      try {
        if (typeof window !== 'undefined' && features && result) {
          addRecentSearch(features, result)
        }
      } catch (storageError) {
        console.error('Failed to save recent search:', storageError)
        // Non-critical error, continue
      }

      // Smooth scroll to results (only on client)
      if (typeof window !== 'undefined' && resultsRef && resultsRef.current) {
        try {
          setTimeout(() => {
            try {
              if (resultsRef?.current) {
                resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            } catch (scrollError) {
              console.error('Scroll error:', scrollError)
              // Non-critical error, continue
            }
          }, 100)
        } catch (error) {
          console.error('Error setting up scroll:', error)
          // Non-critical error, continue
        }
      }

      // Only show toast if there's an important message
      if (result.message && typeof result.message === 'string' && result.message.toLowerCase().includes('warning')) {
        if (toast?.toast) {
          toast.toast({
            title: 'Note',
            description: result.message,
            variant: 'default',
          })
        }
      }
    } catch (error: unknown) {
      const errorMessage = getUserFacingApiError(error, tRoot)
      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
      void refreshDailyUsage()
    }
  }

  const handleUpdate = (updates: Partial<CarFeatures> | null) => {
    if (!updates || typeof updates !== 'object') {
      return
    }
    if (carFeatures && typeof carFeatures === 'object') {
      try {
        const updated = { ...carFeatures, ...updates }
        setCarFeatures(updated)
        setFormFeatures(updated)
        // Optionally re-predict with updated features
      } catch (error) {
        console.error('Failed to update car features:', error)
      }
    }
  }

  // Clear form handler
  const handleClearForm = () => {
    setPrediction(null)
    setCarFeatures(null)
    setFormFeatures(null)
    setImages([])
    setImagePreviews([])
    setImageAnalysis(null)
    setSelectedImageIndex(0)
    setHydratedFromShare(false)
    setPredictionId(undefined)
    try {
      router.replace(pathname, { scroll: false })
    } catch (e) {
      console.error('Failed to clear URL:', e)
    }
  }


  // Don't render until mounted
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Video Background - preload=metadata to avoid blocking initial render */}
      <div className="fixed inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(4px)' }}
        >
          <source src="/assets/predict-background.mp4" type="video/mp4" />
        </video>
        {/* Dark Overlay (35% opacity) */}
        <div className="absolute inset-0 bg-black/35"></div>
        {/* Additional blur overlay for better readability */}
        <div className="absolute inset-0 backdrop-blur-[2px]"></div>
      </div>

      {/* Two subtle fixed radial glows (indigo/violet at ~10% opacity, blur-3xl) - pulse during loading */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"
          animate={loading ? {
            scale: [1, 1.15, 1],
            opacity: [0.05, 0.09, 0.05]
          } : {}}
          transition={{
            duration: 3,
            repeat: loading ? Infinity : 0,
            ease: "easeInOut"
          }}
        ></motion.div>
        <motion.div
          className="absolute top-1/3 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"
          animate={loading ? {
            scale: [1, 1.15, 1],
            opacity: [0.05, 0.09, 0.05]
          } : {}}
          transition={{
            duration: 3,
            repeat: loading ? Infinity : 0,
            ease: "easeInOut",
            delay: 0.5
          }}
        ></motion.div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 md:py-10 overflow-visible">
        {/* Main Content Grid - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
          {!hydratedFromShare && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5 order-1"
          >
            <div className="sticky top-6 h-fit">
              <div className="backdrop-blur-xl bg-black/40 border border-white/30 rounded-2xl shadow-2xl p-3 sm:p-6 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-white/40">
                <CompactWizardCard
                  onSubmit={handlePredict}
                  loading={loading}
                  prefillData={prefillData}
                  onFormChange={setFormFeatures}
                  usageNearPredict={
                    !dailyUsage
                      ? null
                      : dailyUsage.unlimited_predictions || dailyUsage.unlimited
                        ? (
                          <>{tUsage('unlimitedPredictionsToday')}</>
                        )
                        : dailyUsage.predict_remaining <= 0
                          ? (
                            <>{tUsage('predictExhausted', { limit: dailyUsage.predict_limit })}</>
                          )
                          : (
                            <>
                              {tUsage('predictRemaining', {
                                used: Math.max(
                                  0,
                                  (dailyUsage.predict_limit ?? 0) - (dailyUsage.predict_remaining ?? 0)
                                ),
                                remaining: dailyUsage.predict_remaining,
                                limit: dailyUsage.predict_limit,
                              })}
                            </>
                          )
                  }
                  predictSubmitExtraDisabled={
                    !!dailyUsage &&
                    !(dailyUsage.unlimited_predictions || dailyUsage.unlimited) &&
                    dailyUsage.predict_remaining <= 0
                  }
                />
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVoucherOpen(true)}
                    className="text-xs text-white/75 underline underline-offset-2 hover:text-white"
                  >
                    {tProfile('haveVoucherLink')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          )}

          {/* Right Column: Smart Tips & Results */}
          <div className={`order-2 space-y-6 ${hydratedFromShare ? 'lg:col-span-12' : 'lg:col-span-7'}`}>

            {/* Loading State - System Analysis Overlay */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative z-[10000] max-w-2xl mx-auto mt-32 sm:mt-40 md:mt-48"
                >
                  <PredictionLoader />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content Logic: Prediction OR Default Content (Never Empty) */}
            {prediction && !loading && carFeatures ? (
              /* Has Prediction: Show Results */
              <ErrorBoundary fallback={
                <Card className="border border-red-500/50 bg-red-500/10">
                  <CardContent className="p-3 sm:p-6">
                    <p className="text-sm text-red-400">Failed to display prediction results. Please try again.</p>
                  </CardContent>
                </Card>
              }>
                <motion.div
                  ref={resultsRef}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="space-y-3 sm:space-y-6"
                  id="results-section"
                >
                  {/* Car Preview Card - Always shown at top */}
                  <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <ImageIcon className="w-5 h-5" />
                        {t('result.carPreview')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Car title and badge (preview image removed — was watermarked placeholder) */}
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold text-white">
                          {safeText(carFeatures.year)} {safeText(carFeatures.make)} {safeText(carFeatures.model)}
                          {carFeatures.trim && carFeatures.trim !== '__none__'
                            ? ` ${safeText(carFeatures.trim)}`
                            : ''}
                        </h3>
                        <Badge variant="secondary" className="text-xs">
                          {t('result.basedOnDetails')}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Prediction Result */}
                  <PredictionResult
                    result={prediction}
                    carFeatures={carFeatures}
                    onUpdate={handleUpdate}
                    predictionId={predictionId}
                  />

                  {/* Your Car Photos Card (only if multiple images uploaded) */}
                  {images.length > 1 && imagePreviews.length > 1 && (
                    <Card className="border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <ImageIcon className="w-5 h-5" />
                          Your Car Photos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Main image display */}
                        <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden bg-white/5">
                          <Image
                            src={imagePreviews[selectedImageIndex]}
                            alt={`Car photo ${selectedImageIndex + 1}`}
                            fill
                            className="object-contain"
                            loading="lazy"
                          />
                        </div>

                        {/* Thumbnail grid */}
                        {imagePreviews.length > 1 && (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {imagePreviews.map((preview, index) => (
                              <div
                                key={index}
                                className={`relative aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all ${index === selectedImageIndex
                                  ? 'border-white/60 ring-2 ring-white/40'
                                  : 'border-white/20 hover:border-white/40'
                                  }`}
                                onClick={() => setSelectedImageIndex(index)}
                              >
                                <Image
                                  src={preview}
                                  alt={`Thumbnail ${index + 1}`}
                                  fill
                                  className="object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AI Analysis Bullets */}
                        {imageAnalysis && imageAnalysis.bullets && imageAnalysis.bullets.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-sm text-white/80 mb-2">AI Image Analysis:</p>
                            <ul className="space-y-1">
                              {imageAnalysis.bullets.map((bullet, index) => (
                                <li key={index} className="text-sm text-white/60 flex items-start gap-2">
                                  <span className="text-white/40">•</span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              </ErrorBoundary>
            ) : (
              /* No Prediction: Show Smart Tips Only */
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-3 sm:space-y-6"
              >
                {/* Smart Tips - Always visible when no prediction */}
                <ErrorBoundary fallback={null}>
                  <div className="backdrop-blur-xl bg-black/40 border border-white/30 rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-white/40">
                    <SmartTips />
                  </div>
                </ErrorBoundary>
              </motion.div>
            )}
          </div>
        </div>
      </div>
      <VoucherApplyModal
        open={voucherOpen}
        onOpenChange={setVoucherOpen}
        onApplied={() => void refreshDailyUsage()}
      />
    </main>
  )
}

export default function PredictPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><PredictionResultSkeleton /></div>}>
      <PredictPageContent />
    </Suspense>
  )
}
