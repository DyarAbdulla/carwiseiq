"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
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
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") {
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
    if (dx > 60) goPrev()
    else if (dx < -60) goNext()
  }

  const currentImage = images[activeIndex]
  const imageUrl = currentImage?.url ? getImageUrl(currentImage.url) : ""
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
          className="fixed inset-0 z-[1100] flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Image gallery"
        >
          {/* Top bar — safe area for notched phones */}
          <div
            className="flex shrink-0 items-center justify-end gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25 border border-white/20"
              aria-label="Close gallery"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Main stage — fills remaining viewport */}
          <div
            className="relative flex min-h-0 flex-1 flex-col px-0 sm:px-3"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex min-h-0 flex-1 items-center justify-center">
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      goPrev()
                    }}
                    className="absolute left-1 sm:left-3 top-1/2 z-[1200] -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md border border-white/20 hover:bg-white/25 touch-manipulation"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      goNext()
                    }}
                    className="absolute right-1 sm:right-3 top-1/2 z-[1200] -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md border border-white/20 hover:bg-white/25 touch-manipulation"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-7 w-7 rtl:rotate-180" />
                  </button>
                </>
              )}

              <motion.div
                key={activeIndex}
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="flex h-full max-h-[calc(100dvh-11rem-env(safe-area-inset-bottom))] w-full max-w-[100vw] items-center justify-center px-2 sm:px-4"
              >
                {imageUrl ? (
                  isVideo ? (
                    <video
                      src={imageUrl}
                      controls
                      playsInline
                      className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
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
                        className="max-h-[60vh] max-w-full object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={imageUrl}
                      alt=""
                      className="max-h-[calc(100dvh-12rem)] w-auto max-w-full object-contain sm:rounded-xl shadow-2xl"
                      style={{ maxHeight: "min(85dvh, calc(100dvh - 10rem))" }}
                      onError={() => setImageError(activeIndex)}
                    />
                  )
                ) : (
                  <div className="text-gray-400">No image</div>
                )}
              </motion.div>
            </div>

            {images.length > 1 && (
              <div className="shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center text-sm font-medium text-white/90">
                {activeIndex + 1} / {images.length}
              </div>
            )}

            {images.length > 1 && (
              <div className="max-h-[22vh] shrink-0 overflow-x-auto border-t border-white/10 px-3 py-3">
                <div className="mx-auto flex w-max max-w-full gap-2 pb-1">
                  {images.map((img, idx) => {
                    const thumbUrl = img?.url ? getImageUrl(img.url) : ""
                    const isV = img?.url ? isVideoUrl(img.url) : false
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setActiveIndex(idx)
                          onNavigate?.(idx)
                        }}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-20 sm:w-20 ${
                          idx === activeIndex
                            ? "border-violet-400 ring-2 ring-violet-500/50"
                            : "border-white/20 opacity-80 hover:opacity-100"
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
                            <Image
                              src={thumbUrl}
                              alt=""
                              width={80}
                              height={80}
                              className="h-full w-full object-cover"
                              unoptimized={
                                thumbUrl.startsWith("blob:") ||
                                thumbUrl.startsWith("data:")
                              }
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
              </div>
            )}
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  )
}
