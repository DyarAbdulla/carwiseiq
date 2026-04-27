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
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="relative flex shrink-0 justify-end p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        {images.length > 1 && (
          <div
            className="pointer-events-none absolute right-14 top-3 text-sm text-white tabular-nums rtl:left-14 rtl:right-auto"
            aria-live="polite"
          >
            {activeIndex + 1} / {images.length}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Close gallery"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-12"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
      >
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              className="absolute left-2 top-1/2 z-10 flex -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 touch-manipulation rtl:left-auto rtl:right-2"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 touch-manipulation rtl:right-auto rtl:left-2"
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6 rtl:rotate-180" />
            </button>
          </>
        )}

        <div
          className="flex max-h-full max-w-full items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {imageUrl ? (
            isVideo ? (
              <video
                src={imageUrl}
                controls
                playsInline
                className="max-h-full max-w-full object-contain"
              />
            ) : imageError === activeIndex ? (
              <div className="flex max-h-full flex-col items-center justify-center gap-4 p-6 text-center">
                <ImageIcon className="h-16 w-16 text-gray-500" />
                <p className="text-gray-400">Image failed to load</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/cars/default-car.jpg"
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
                onError={() => setImageError(activeIndex)}
              />
            )
          ) : (
            <div className="text-gray-400">No image</div>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div
          className="flex shrink-0 justify-center gap-2 overflow-x-auto bg-black/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => {
            const thumbUrl = img?.url ? getImageUrl(img.url) : ""
            const isV = img?.url ? isVideoUrl(img.url) : false
            const active = idx === activeIndex
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveIndex(idx)
                  onNavigate?.(idx)
                }}
                className={`h-12 w-16 shrink-0 cursor-pointer overflow-hidden rounded object-cover transition-opacity ${
                  active
                    ? "opacity-100 ring-2 ring-purple-500"
                    : "opacity-50 hover:opacity-100"
                }`}
                aria-label={`Image ${idx + 1}`}
              >
                {thumbUrl ? (
                  isV ? (
                    <video
                      src={thumbUrl}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                    —
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
