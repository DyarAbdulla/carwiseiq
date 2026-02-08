"use client"

import { useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ImageIcon } from 'lucide-react'

interface ImageGalleryLightboxProps {
  images: Array<{ url?: string }>
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate?: (index: number) => void
  getImageUrl?: (url: string | undefined) => string
  isVideoUrl?: (url: string | undefined) => boolean
}

export function ImageGalleryLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  getImageUrl = (url) => url || '',
  isVideoUrl = () => false,
}: ImageGalleryLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(currentIndex)
  const [imageError, setImageError] = useState<number | null>(null)

  // Sync activeIndex with currentIndex prop
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(currentIndex)
      setImageError(null) // Reset error when changing images
    }
  }, [currentIndex, isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, activeIndex, images.length, onClose])

  const handlePrevious = () => {
    const newIndex = (activeIndex - 1 + images.length) % images.length
    setActiveIndex(newIndex)
    onNavigate?.(newIndex)
  }

  const handleNext = () => {
    const newIndex = (activeIndex + 1) % images.length
    setActiveIndex(newIndex)
    onNavigate?.(newIndex)
  }

  const currentImage = images[activeIndex]
  const imageUrl = currentImage?.url ? getImageUrl(currentImage.url) : ''
  const isVideo = currentImage?.url ? isVideoUrl(currentImage.url) : false

  if (!isOpen || !currentImage) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/95 z-[1100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-[1200] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200 backdrop-blur-sm border border-white/10"
            aria-label="Close gallery"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Navigation buttons */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrevious()
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-[1200] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200 backdrop-blur-sm border border-white/10 touch-manipulation"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-[1200] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors duration-200 backdrop-blur-sm border border-white/10 touch-manipulation"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6 rtl:rotate-180" />
              </button>

              {/* Image counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1200] bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-medium border border-white/10">
                {activeIndex + 1} / {images.length}
              </div>
            </>
          )}

          {/* Image/Video container */}
          <motion.div
            key={activeIndex}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {imageUrl ? (
              isVideo ? (
                <video
                  src={imageUrl}
                  controls
                  playsInline
                  className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="relative w-full h-full max-w-[95vw] max-h-[90vh] flex items-center justify-center">
                  {imageError === activeIndex ? (
                    // Fallback if image fails to load
                    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900/50 rounded-lg p-8">
                      <ImageIcon className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-400 text-lg">Image failed to load</p>
                      <Image
                        src="/images/cars/default-car.jpg"
                        alt="Fallback image"
                        width={800}
                        height={600}
                        className="max-w-full max-h-[70vh] object-contain rounded-lg mt-4"
                        quality={85}
                      />
                    </div>
                  ) : (
                    <Image
                      src={imageUrl}
                      alt={`Image ${activeIndex + 1}`}
                      width={1920}
                      height={1080}
                      className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                      quality={90}
                      priority={activeIndex === 0}
                      unoptimized={imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')}
                      onError={() => {
                        console.error('[ImageGalleryLightbox] Image load error:', imageUrl)
                        setImageError(activeIndex)
                      }}
                    />
                  )}
                </div>
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg bg-gray-900/50 rounded-lg p-8">
                No image available
              </div>
            )}
          </motion.div>

          {/* Thumbnail strip (desktop only) */}
          {images.length > 1 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1200] max-w-[90vw] overflow-x-auto py-2">
              <div className="flex gap-2 px-4">
                {images.map((img, idx) => {
                  const thumbUrl = img?.url ? getImageUrl(img.url) : ''
                  const isV = img?.url ? isVideoUrl(img.url) : false
                  return (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveIndex(idx)
                        onNavigate?.(idx)
                      }}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${idx === activeIndex
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-500/30'
                        : 'border-white/20 hover:border-white/40'
                        }`}
                      aria-label={`View image ${idx + 1}`}
                    >
                      {thumbUrl ? (
                        isV ? (
                          <video
                            src={thumbUrl}
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Image
                            src={thumbUrl}
                            alt=""
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            quality={75}
                            unoptimized={thumbUrl.startsWith('blob:') || thumbUrl.startsWith('data:')}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = '/images/cars/default-car.jpg'
                              target.onerror = null
                            }}
                          />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-700/50 flex items-center justify-center text-gray-400 text-xs">
                          —
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
