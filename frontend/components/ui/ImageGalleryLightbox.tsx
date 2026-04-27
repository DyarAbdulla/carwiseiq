"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { ImageIcon } from "lucide-react"

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
  getImageUrl = (url) => url || "",
  isVideoUrl = () => false,
}: ImageGalleryLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(currentIndex)
  const [imageError, setImageError] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(currentIndex)
      setImageError(null)
    }
  }, [currentIndex, isOpen])

  const goPrev = useCallback(() => {
    setActiveIndex((i) => {
      const newIndex = (i - 1 + images.length) % images.length
      onNavigate?.(newIndex)
      return newIndex
    })
  }, [images.length, onNavigate])

  const goNext = useCallback(() => {
    setActiveIndex((i) => {
      const newIndex = (i + 1) % images.length
      onNavigate?.(newIndex)
      return newIndex
    })
  }, [images.length, onNavigate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      const prev = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        document.body.style.overflow = prev
      }
    }
  }, [isOpen, onClose, goPrev, goNext])

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null || images.length < 2) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (dx > 50) goPrev()
    else if (dx < -50) goNext()
  }

  const currentImage = images[activeIndex]
  const imageUrl = currentImage?.url ? getImageUrl(currentImage.url) : ""
  const isVideo = currentImage?.url ? isVideoUrl(currentImage.url) : false

  if (!isOpen || !currentImage) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {images.length > 1 && (
        <div
          className="pointer-events-none absolute end-4 top-[max(1rem,env(safe-area-inset-top))] z-[60] text-sm font-medium tabular-nums text-white"
          aria-live="polite"
        >
          {activeIndex + 1} / {images.length}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="absolute start-4 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
        aria-label="Close gallery"
      >
        <X className="h-6 w-6" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goPrev()
            }}
            className="absolute start-0 top-1/2 z-[60] flex h-full max-h-screen w-[18vw] max-w-[120px] min-w-[48px] -translate-y-1/2 items-center justify-center border-0 bg-gradient-to-r from-black/50 to-transparent text-white transition-opacity hover:from-black/65 touch-manipulation"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-10 w-10 shrink-0 opacity-90 drop-shadow-lg rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              goNext()
            }}
            className="absolute end-0 top-1/2 z-[60] flex h-full max-h-screen w-[18vw] max-w-[120px] min-w-[48px] -translate-y-1/2 items-center justify-center border-0 bg-gradient-to-l from-black/50 to-transparent text-white transition-opacity hover:from-black/65 touch-manipulation"
            aria-label="Next image"
          >
            <ChevronRight className="h-10 w-10 shrink-0 opacity-90 drop-shadow-lg rtl:rotate-180" />
          </button>
        </>
      )}

      <div
        className="flex h-full w-full items-center justify-center p-4 pt-14"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl ? (
          isVideo ? (
            <video
              src={imageUrl}
              controls
              playsInline
              className="max-h-screen max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : imageError === activeIndex ? (
            <div className="flex max-h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <ImageIcon className="h-16 w-16 text-gray-500" />
              <p className="text-gray-400">Image failed to load</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/cars/default-car.jpg"
                alt=""
                className="max-h-screen max-w-full object-contain"
              />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt=""
              className="max-h-screen max-w-full object-contain"
              onError={() => setImageError(activeIndex)}
            />
          )
        ) : (
          <div className="text-gray-400">No image</div>
        )}
      </div>
    </div>
  )
}
