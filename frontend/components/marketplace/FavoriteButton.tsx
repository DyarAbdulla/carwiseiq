"use client"

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { activityHelpers } from '@/lib/activityLogger'

interface FavoriteButtonProps {
  listingId: number | string  // Supports both numeric IDs (REST API) and UUID strings (Supabase)
  initialFavorite?: boolean
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  onToggle?: (isFavorite: boolean) => void
}

export function FavoriteButton({
  listingId,
  initialFavorite = false,
  size = 'md',
  showText = false,
  onToggle
}: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const locale = useLocale()
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const [isToggling, setIsToggling] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isAuthenticated && listingId) {
      checkFavorite()
    } else {
      // Check localStorage for guest users
      const guestFavorites = JSON.parse(localStorage.getItem('guest_favorites') || '[]')
      setIsFavorite(guestFavorites.includes(listingId))
    }
  }, [listingId, isAuthenticated])

  const checkFavorite = async () => {
    try {
      const data = await apiClient.checkFavorite(listingId)
      setIsFavorite(data?.is_favorite ?? false)
    } catch {
      // Ignore errors - keep showing initialFavorite, don't break the page
      setIsFavorite(initialFavorite)
    }
  }

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please login to save favorites',
        variant: 'destructive'
      })
      router.push(`/${locale}/login`)
      return
    }

    setIsToggling(true)
    setAnimate(true)

    try {
      const data = await apiClient.toggleFavorite(listingId)
      setIsFavorite(data.is_favorite)

      // Log activity (fire-and-forget, never blocks or throws)
      try {
        activityHelpers.logFavorite(listingId, data.is_favorite)
      } catch {
        // Ignore activity logging errors
      }

      if (onToggle) {
        onToggle(data.is_favorite)
      }

      toast({
        title: data.is_favorite ? 'Added to favorites' : 'Removed from favorites',
        description: data.is_favorite
          ? 'You can view it in your favorites page'
          : 'Removed from your favorites'
      })

      // Reset animation after a short delay
      setTimeout(() => setAnimate(false), 300)
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string }
      const status = err.response?.status
      const is404 = status === 404
      const is500 = status === 500
      const msg = err.message || 'Failed to update favorite'
      toast({
        title: 'Error',
        description: is404
          ? 'Favorites service is not available. Please try again later.'
          : is500
            ? 'Server error. Please try again later.'
            : msg,
        variant: 'destructive'
      })
      setAnimate(false)
    } finally {
      setIsToggling(false)
    }
  }

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }

  // Glassmorphism button styling
  const buttonClassName = showText
    ? 'flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50'
    : 'p-2 rounded-lg backdrop-blur-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all disabled:opacity-50'

  return (
    <button
      onClick={handleToggle}
      disabled={isToggling}
      className={`relative ${buttonClassName} ${isFavorite ? 'text-red-400 hover:text-red-300 border-red-500/30' : 'text-gray-300 hover:text-white'
        }`}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <motion.div
        animate={animate ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-center"
      >
        <Heart className={`${sizeClasses[size]} ${isFavorite ? 'fill-current' : ''}`} />
      </motion.div>
      {showText && (
        <span className="text-sm font-medium">
          {isFavorite ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  )
}
