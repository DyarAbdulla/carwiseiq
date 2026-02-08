"use client"

import { motion } from 'framer-motion'
import { Car } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ClientOnlyIcon } from '@/components/ui/ClientOnlyIcon'
import Image from 'next/image'
import { getCarPreviewImage, getCarPreviewImageAsync } from '@/lib/carImageMap'
import { apiClient } from '@/lib/api'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface CarImagePreviewProps {
  make?: string
  model?: string
  year?: number
  trim?: string
  className?: string
}

export function CarImagePreview({ make, model, year, trim, className = '' }: CarImagePreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!make || !model) {
      setImageUrl(null)
      setImageError(false)
      setLoading(false)
      return
    }

    // Load image asynchronously from API
    const loadImage = async () => {
      setLoading(true)
      setImageError(false)

      try {
        // Try API first for better matching
        const imagePath = await getCarPreviewImageAsync({ make, model, year, trim })
        setImageUrl(imagePath)
      } catch (error) {
        console.error('Error loading car image:', error)
        // Fallback to synchronous method
        const fallbackPath = getCarPreviewImage({ make, model, year, trim })
        setImageUrl(fallbackPath)
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [make, model, year, trim])

  if (!make || !model) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-lg ${className}`}
    >
      {loading ? (
        <div className="relative h-48 flex flex-col items-center justify-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <ClientOnlyIcon>
              <Car className="w-12 h-12 text-[#5B7FFF]" />
            </ClientOnlyIcon>
          </motion.div>
          <p className="text-sm text-[#94a3b8]">Loading image...</p>
        </div>
      ) : imageUrl && !imageError ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-full aspect-video cursor-pointer group"
          onClick={() => setLightboxOpen(true)}
        >
          <Image
            src={imageUrl}
            alt={`${year ? `${year} ` : ''}${make} ${model}${trim ? ` ${trim}` : ''}`}
            fill
            className="object-cover rounded-lg transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            quality={95}
            priority={false}
            loading="lazy"
            onError={(e) => {
              // Fallback to default-car.jpg if image fails
              const target = e.target as HTMLImageElement
              const failedSrc = target.src

              if (!failedSrc.includes('default-car.jpg')) {
                // Try default image
                setImageUrl('/images/cars/default-car.jpg')
              } else {
                // If default also fails, show icon fallback
                setImageError(true)
              }
            }}
            unoptimized={imageUrl.startsWith('/car_images/') || imageUrl.startsWith('/uploads/') || imageUrl.startsWith('http://') || imageUrl.startsWith('https://')}
          />
        </motion.div>
      ) : (
        <div className="relative h-48 flex flex-col items-center justify-center space-y-4">
          {/* Animated Car Icon - Loading state or error fallback */}
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <ClientOnlyIcon>
              <Car className="w-24 h-24 text-[#5B7FFF]" />
            </ClientOnlyIcon>
          </motion.div>
          {/* Car Info */}
          <div className="text-center">
            <p className="text-lg font-semibold text-white">
              {year && `${year} `}
              {make} {model}
            </p>
          </div>
        </div>
      )}
      
      {/* Image Lightbox */}
      <ImageLightbox
        imageUrl={imageUrl ? (() => {
          // Convert relative paths to full URLs for lightbox
          if (imageUrl.startsWith('/api/car-images/') || imageUrl.startsWith('/car_images/')) {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
            if (imageUrl.startsWith('/api/car-images/')) {
              return `${apiBaseUrl}${imageUrl}`
            } else {
              return `${apiBaseUrl}/api/car-images/${imageUrl.replace('/car_images/', '')}`
            }
          }
          return imageUrl
        })() : null}
        alt={`${year ? `${year} ` : ''}${make} ${model}${trim ? ` ${trim}` : ''}`}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </motion.div>
  )
}

