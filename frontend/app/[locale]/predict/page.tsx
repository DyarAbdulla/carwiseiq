"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CompactWizardCard } from '@/components/prediction/CompactWizardCard'
import { PredictionResultSkeleton } from '@/components/prediction/PredictionResultSkeleton'
import { SmartDealAnalystSkeleton } from '@/components/prediction/SmartDealAnalystSkeleton'
import { PredictionLoader } from '@/components/prediction/PredictionLoader'
import { LoadingAnimation } from '@/components/prediction/LoadingAnimation'
import { CarImagePreview } from '@/components/prediction/CarImagePreview'
import { SmartTips } from '@/components/prediction/SmartTips'

const PredictionResult = dynamic(
  () => import('@/components/prediction/PredictionResult').then((m) => ({ default: m.PredictionResult })),
  { loading: () => <PredictionResultSkeleton />, ssr: false }
)
import { apiClient } from '@/lib/api'
import type { CarFeatures, PredictionResponse } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Image as ImageIcon, Car } from 'lucide-react'
import { addRecentSearch } from '@/lib/recent-searches'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { getCarPreviewImage } from '@/lib/carImageMap'
import { Badge } from '@/components/ui/badge'
import { useImageCache } from '@/hooks/use-image-cache'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { removeCarBackgroundLazy } from '@/lib/backgroundRemovalLazy'
import { usePredictLoading } from '@/components/PredictLoadingProvider'
import { activityHelpers } from '@/lib/activityLogger'

// Image upload constants (kept for image analysis functionality)
const MAX_IMAGES = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/**
 * Car Preview Image Component
 * Always renders a real car image (JPG) - never shows empty placeholder or SVG
 */
function CarPreviewImage({
  imagePreviews,
  carFeatures,
  carImagePath,
  previewImage,
  imageMatchType,
  imageMatchInfo
}: {
  imagePreviews: string[]
  carFeatures: CarFeatures
  carImagePath?: string
  previewImage?: string
  imageMatchType?: 'exact' | 'same_model_different_year' | 'same_make' | 'fallback'
  imageMatchInfo?: string
}) {
  const imageCache = useImageCache()

  // Compute preview image source BEFORE render - ALWAYS resolve to a valid JPG path
  const previewImageSrc = useMemo(() => {
    // Priority 1: Use uploaded image if available
    if (imagePreviews.length > 0 && imagePreviews[0]) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[CarPreview] Using uploaded image:', imagePreviews[0].substring(0, 50) + '...')
      }
      return imagePreviews[0]
    }

    // Priority 2: Use preview_image URL from prediction result (real dataset image)
    if (previewImage && previewImage.trim()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[CarPreview] Using preview_image URL from dataset:', previewImage)
      }
      return previewImage.trim()
    }

    // Priority 3: Use car image from prediction result (car_images folder)
    if (carImagePath) {
      // Check cache first to prevent 429 errors
      const cachedUrl = imageCache.getCachedUrl(carImagePath)
      if (cachedUrl) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CarPreview] Using cached image URL:', cachedUrl)
        }
        return cachedUrl
      }

      // carImagePath is like "car_000000.jpg" - serve from backend API
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
      const backendImageUrl = `${apiBaseUrl}/api/car-images/${carImagePath}`

      // Cache the URL before returning (prevents duplicate requests)
      imageCache.setCachedUrl(carImagePath, backendImageUrl)

      if (process.env.NODE_ENV === 'development') {
        console.log('[CarPreview] Using car image from dataset:', backendImageUrl)
      }
      return backendImageUrl
    }

    // Priority 4: Use carImageMap lookup with car details (includes trim)
    const mappedImage = getCarPreviewImage({
      make: carFeatures.make || '',
      model: carFeatures.model || '',
      year: carFeatures.year,
      trim: carFeatures.trim,
    })

    // CRITICAL: Ensure we NEVER use SVG - force JPG fallback
    let finalPath = mappedImage || '/images/cars/default-car.jpg'

    // Replace any .svg with .jpg (safety check)
    if (finalPath.endsWith('.svg')) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CarPreview] SVG detected, replacing with JPG:', finalPath)
      }
      finalPath = finalPath.replace(/\.svg$/, '.jpg')
      // If still no match, use default
      if (finalPath === mappedImage) {
        finalPath = '/images/cars/default-car.jpg'
      }
    }

    // Cache static image paths to prevent unnecessary requests
    if (finalPath.startsWith('/images/')) {
      const cachedUrl = imageCache.getCachedUrl(finalPath)
      if (cachedUrl) {
        return cachedUrl
      }
      imageCache.setCachedUrl(finalPath, finalPath)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[CarPreview] Final image path:', finalPath)
    }

    return finalPath
  }, [imagePreviews, carFeatures.make, carFeatures.model, carFeatures.year, carFeatures.trim, carImagePath, previewImage, imageCache])

  // Initialize all state at the top (React hooks must be declared before use)
  const [currentSrc, setCurrentSrc] = useState<string>(previewImageSrc || '/images/cars/default-car.jpg')
  const [processedSrc, setProcessedSrc] = useState<string | null>(null)
  const [isProcessingBg, setIsProcessingBg] = useState(false)
  const [bgRemovalProgress, setBgRemovalProgress] = useState<string>('')
  const [hasError, setHasError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const bgRemovalAbortRef = useRef<boolean>(false)

  useEffect(() => {
    // Set currentSrc when previewImageSrc changes
    const newSrc = previewImageSrc || '/images/cars/default-car.jpg'
    if (newSrc !== currentSrc) {
      setCurrentSrc(newSrc)
      setProcessedSrc(null) // Reset processed image
      // Reset loading states
      setHasError(false)
      setImageLoaded(false)
      console.log('[CarPreviewImage] previewImageSrc updated:', newSrc)
    }
  }, [previewImageSrc, currentSrc])

  // Background removal with 20-second timeout
  useEffect(() => {
    if (!currentSrc || currentSrc === '/images/cars/default-car.jpg') {
      return
    }

    // Don't process blob URLs or data URLs that are already processed
    if (processedSrc && processedSrc.startsWith('blob:')) {
      return
    }

    bgRemovalAbortRef.current = false
    setIsProcessingBg(true)
    setBgRemovalProgress('Starting background removal...')

    const processImage = async () => {
      try {
        console.log('[CarPreview] Starting background removal for:', currentSrc.substring(0, 50))

        // Set 20-second timeout
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Background removal timeout (20s)'))
          }, 20000)
        })

        const removalPromise = removeCarBackgroundLazy(currentSrc, (key, current, total) => {
          if (bgRemovalAbortRef.current) return
          const progress = Math.round((current / total) * 100)
          setBgRemovalProgress(`Processing: ${progress}%`)
        })

        const result = await Promise.race([removalPromise, timeoutPromise])

        if (bgRemovalAbortRef.current) {
          console.log('[CarPreview] Background removal aborted')
          return
        }

        if (result) {
          console.log('[CarPreview] Background removal complete')
          setProcessedSrc(result)
        }
      } catch (error) {
        console.warn('[CarPreview] Background removal failed, using original:', error)
        // Keep using original image
      } finally {
        if (!bgRemovalAbortRef.current) {
          setIsProcessingBg(false)
          setBgRemovalProgress('')
        }
      }
    }

    processImage()

    return () => {
      bgRemovalAbortRef.current = true
      setIsProcessingBg(false)
    }
  }, [currentSrc])

  if (hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/70">
        <Car className="h-12 w-12 text-white/60" />
      </div>
    )
  }

  // Use processed image if available, otherwise use original
  const displaySrc = processedSrc || currentSrc

  // 3D tilt state
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle mouse movement for 3D tilt effect
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateY = ((x - centerX) / centerX) * 8
    const rotateX = ((centerY - y) / centerY) * 5
    setMousePosition({ x: rotateX, y: rotateY })
  }

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 })
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{
        minHeight: '300px',
        perspective: '1200px',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Clean Dark Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />

      {/* Ambient Light Effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(100, 150, 255, 0.08) 0%, transparent 60%)',
        }}
      />

      {/* Floor Reflection / Showroom Floor */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3"
        style={{
          background: 'linear-gradient(to top, rgba(100, 100, 120, 0.2) 0%, transparent 100%)',
        }}
      />

      {/* Background Removal Processing Indicator */}
      {isProcessingBg && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/80 rounded-xl">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
              <Car className="absolute inset-0 m-auto w-10 h-10 text-purple-400" />
            </div>
            <p className="text-white text-base font-semibold">Removing Background...</p>
            <p className="text-purple-300 text-sm mt-2">{bgRemovalProgress || 'Processing...'}</p>
            <p className="text-gray-400 text-xs mt-1">This takes about 10-20 seconds</p>
          </div>
        </div>
      )}

      {/* 3D Car Image Container */}
      {displaySrc && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotateX: 0, rotateY: 0 }}
          animate={{
            opacity: imageLoaded ? 1 : 0,
            scale: imageLoaded ? 1 : 0.9,
            rotateX: mousePosition.x,
            rotateY: mousePosition.y,
          }}
          transition={{
            opacity: { duration: 0.6 },
            scale: { duration: 0.6 },
            rotateX: { duration: 0.3, ease: "easeOut" },
            rotateY: { duration: 0.3, ease: "easeOut" },
          }}
          className="absolute inset-0 flex items-center justify-center p-6"
          style={{
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Floating Animation Wrapper */}
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative w-full h-full"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Rim Light Glow Behind Car */}
            <div
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(100, 150, 255, 0.2) 0%, transparent 60%)',
                filter: 'blur(30px)',
                transform: 'translateZ(-50px)',
              }}
            />

            {/* Car Image */}
            <div className="relative w-full h-full" style={{ transform: 'translateZ(30px)' }}>
              {!hasError ? (
                <Image
                  key={displaySrc}
                  src={displaySrc}
                  alt={`${carFeatures.year} ${carFeatures.make} ${carFeatures.model}`}
                  fill
                  className="object-contain"
                  loading="eager"
                  onLoad={() => {
                    setImageLoaded(true)
                    setHasError(false)
                  }}
                  onError={() => {
                    console.error('[CarPreviewImage] Image load error, falling back to default')
                    setHasError(true)
                    setImageLoaded(false)
                  }}
                  priority={true}
                  quality={95}
                  unoptimized={displaySrc.startsWith('blob:') || displaySrc.startsWith('data:')}
                  style={{
                    objectPosition: 'center',
                    filter: 'drop-shadow(0 30px 60px rgba(0, 0, 0, 0.6)) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.4))',
                  }}
                />
              ) : (
                <Image
                  src="/images/cars/default-car.jpg"
                  alt="Default car"
                  fill
                  className="object-contain"
                  priority={false}
                  quality={85}
                />
              )}
            </div>

            {/* Ground Shadow - Moves with 3D */}
            {imageLoaded && (
              <motion.div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-2/3 h-6 rounded-full"
                style={{
                  background: 'radial-gradient(ellipse, rgba(0, 0, 0, 0.5) 0%, transparent 70%)',
                  filter: 'blur(20px)',
                  transform: 'translateZ(-60px) rotateX(90deg)',
                }}
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.5, 0.4, 0.5],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Empty State */}
      {!displaySrc && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Car className="w-16 h-16 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Select a car to preview</p>
          </div>
        </div>
      )}

      {/* Show disclaimer if image is not exact match */}
      {imageMatchType && imageMatchType !== 'exact' && imageMatchInfo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-3 left-3 right-3 bg-amber-500/90 rounded-lg px-3 py-2 z-[30]"
        >
          <p className="text-xs text-white font-medium text-center">
            {imageMatchInfo}
          </p>
        </motion.div>
      )}

      {/* Processing Status Badge */}
      {processedSrc && !isProcessingBg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-3 right-3 bg-green-500/90 rounded-full px-3 py-1 z-[30]"
        >
          <p className="text-xs text-white font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            Background Removed
          </p>
        </motion.div>
      )}
    </div>
  )
}

export default function PredictPage() {
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
  const toastHook = useToast()
  const toast = toastHook || { toast: () => { } }

  // Ensure component only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check for prefill data from budget finder
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const prefill = sessionStorage.getItem('prefillCar')
        if (prefill) {
          try {
            const data = JSON.parse(prefill)
            // Validate data structure
            if (data && typeof data === 'object' && data.make && data.model && data.year) {
              setPrefillData(data)
              sessionStorage.removeItem('prefillCar')
              // Show toast notification
              if (toast?.toast) {
                toast.toast({
                  title: tCommon?.('success') || 'Success',
                  description: `Car details loaded: ${data.make} ${data.model} (${data.year})`,
                })
              }
            }
          } catch (e) {
            // Invalid JSON, ignore
            console.error('Failed to parse prefill data:', e)
            sessionStorage.removeItem('prefillCar')
          }
        }
      } catch (error) {
        console.error('SessionStorage access error:', error)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const validFuelTypes = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']
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

    // Log car details for testing
    console.log('═══════════════════════════════════════════════════')
    console.log('🎯 TESTING WITH CAR:')
    console.log('   Make:', features.make)
    console.log('   Model:', features.model)
    console.log('   Year:', features.year)
    console.log('   Trim:', features.trim || 'N/A')
    console.log('   Condition:', features.condition)
    console.log('   Location:', features.location)
    console.log('═══════════════════════════════════════════════════')
    console.log('✅ Background removal will work for this car (universal algorithm)')
    console.log('═══════════════════════════════════════════════════')

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
      // Extract error message from API response
      let errorMessage = 'Failed to predict price'

      if (axios.isAxiosError(error)) {
        // Handle Axios errors (API errors)
        const detail = error.response?.data?.detail
        if (Array.isArray(detail)) {
          // Pydantic validation errors
          errorMessage = detail.map((err: any) => {
            const field = err.loc?.join('.') || 'field'
            const msg = err.msg || 'Invalid value'
            return `${field}: ${msg}`
          }).join(', ')
        } else if (typeof detail === 'string') {
          errorMessage = detail
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message
        } else if (error.message) {
          errorMessage = error.message
        }
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      if (toast?.toast) {
        toast.toast({
          title: tCommon?.('error') || 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
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

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 overflow-visible">
        {/* Main Content Grid - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form (Glassmorphism Card) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5 order-1"
          >
            <div className="sticky top-6 h-fit">
              <div className="backdrop-blur-xl bg-black/40 border border-white/30 rounded-2xl shadow-2xl p-6 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:border-white/40">
                <CompactWizardCard
                  onSubmit={handlePredict}
                  loading={loading}
                  prefillData={prefillData}
                  onFormChange={setFormFeatures}
                />
              </div>
            </div>
          </motion.div>

          {/* Right Column: Smart Tips & Results */}
          <div className="lg:col-span-7 order-2 space-y-6">

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
                  <CardContent className="p-6">
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
                  className="space-y-6"
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
                      {/* Premium 3D Car Preview - 16:9 aspect ratio */}
                      <ErrorBoundary fallback={
                        <div
                          className="relative w-full aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center"
                          style={{
                            position: 'relative',
                            backgroundImage: "url('/wall.jpeg')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        >
                          {/* Dark overlay between background and content */}
                          <div className="absolute inset-0 bg-black/40 z-0" />
                          {/* CarWiseIQ logo watermark - behind content */}
                          <div
                            className="absolute inset-0 flex items-center justify-end pr-4 pb-4"
                            style={{
                              backgroundImage: "url('/carwiseiq-logo.jpg')",
                              backgroundSize: 'contain',
                              backgroundPosition: 'bottom right',
                              backgroundRepeat: 'no-repeat',
                              opacity: 0.12,
                              zIndex: 5
                            }}
                          />
                          <Car className="h-12 w-12 text-white/60 relative z-10" />
                        </div>
                      }>
                        <div
                          className="relative w-full aspect-video rounded-lg overflow-visible"
                          style={{
                            position: 'relative',
                            background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%)',
                            minHeight: '400px',
                          }}
                        >
                          {/* CarWiseIQ logo watermark - subtle background */}
                          <div
                            className="absolute inset-0 flex items-center justify-end pr-4 pb-4 pointer-events-none"
                            style={{
                              backgroundImage: "url('/carwiseiq-logo.jpg')",
                              backgroundSize: 'contain',
                              backgroundPosition: 'bottom right',
                              backgroundRepeat: 'no-repeat',
                              opacity: 0.08,
                              zIndex: 1
                            }}
                          />
                          {/* Premium 3D Car Preview Container */}
                          <div className="relative z-10 w-full h-full" style={{ minHeight: '400px' }}>
                            <CarPreviewImage
                              imagePreviews={imagePreviews}
                              carFeatures={carFeatures}
                              carImagePath={prediction?.car_image_path}
                              previewImage={prediction?.preview_image}
                              imageMatchType={prediction?.image_match_type}
                              imageMatchInfo={prediction?.image_match_info}
                            />
                          </div>
                        </div>
                      </ErrorBoundary>

                      {/* Car title and badge */}
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold text-white">
                          {carFeatures.year} {carFeatures.make} {carFeatures.model}
                          {carFeatures.trim && carFeatures.trim !== '__none__' && ` ${carFeatures.trim}`}
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
                className="space-y-6"
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
    </main>
  )
}

