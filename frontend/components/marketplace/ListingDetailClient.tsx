"use client"

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  Phone, MapPin, CalendarDays, ChevronLeft, ChevronRight, Flag, MessageCircle,
  Gauge, Fuel, Cog, Palette, Award
} from 'lucide-react'
import { FavoriteButton } from '@/components/marketplace/FavoriteButton'
import dynamic from 'next/dynamic'

const SimilarCarsRecommendations = dynamic(
  () => import('@/components/marketplace/SimilarCarsRecommendations').then((m) => ({ default: m.SimilarCarsRecommendations })),
  {
    loading: () => (
      <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-6" role="status" aria-label="Loading similar cars">
        <div className="skeleton-shimmer h-6 w-40 rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer h-48 rounded-xl" />
          ))}
        </div>
      </div>
    ),
    ssr: false,
  }
)
import { SocialShareButtons } from '@/components/marketplace/SocialShareButtons'
import { ListingDetailSkeleton } from '@/components/common/LoadingSkeleton'
import { ListingStructuredData } from '@/components/common/StructuredData'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useAuthContext } from '@/context/AuthContext'
import { listingImageUrl, isVideoUrl } from '@/lib/utils'
import { ImageGalleryLightbox } from '@/components/ui/ImageGalleryLightbox'
import { ManageListingActions } from '@/components/marketplace/ManageListingActions'
import { activityHelpers } from '@/lib/activityLogger'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { LtrEmbed, LtrA } from '@/components/ui/LtrEmbed'

/** Tiny gray blur placeholder for lazy images */
const BLUR_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZTZlNmU2Ii8+PC9zdmc+'

function isNumericId(id: string): boolean {
  return /^\d+$/.test(String(id || '').trim())
}

/** Remove contact lines and phone-like patterns from description. */
function stripContactFromDescription(desc: string | null | undefined): string {
  if (!desc || typeof desc !== 'string') return ''
  let s = desc
  s = s.replace(/(Contact|WhatsApp|Tel|Phone|Call me|Reach me):\s*[^\n]+/gi, '')
  s = s.replace(/\+\d[\d\s\-]{8,}/g, '')
  return s.replace(/\n{3,}/g, '\n\n').trim()
}

/** Normalize digits to tel: link (e.g. +9647501234567). */
function toTelLink(phone: string | null | undefined): string {
  if (!phone) return ''
  const d = String(phone).replace(/\D/g, '')
  if (d.length < 10) return ''
  const with964 = d.startsWith('964') ? d : '964' + d.slice(-10)
  return `tel:+${with964}`
}

/** Normalize digits to wa.me link. */
function toWaLink(phone: string | null | undefined): string {
  if (!phone) return ''
  const d = String(phone).replace(/\D/g, '')
  if (d.length < 10) return ''
  const with964 = d.startsWith('964') ? d : '964' + d.slice(-10)
  return `https://wa.me/${with964}`
}

/** Format for display: +964 770 123 4588 */
function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const d = String(phone).replace(/\D/g, '')
  if (d.length < 10) return ''
  const ten = d.replace(/^964/, '').slice(-10)
  if (ten.length < 10) return ''
  return `+964 ${ten.slice(0, 3)} ${ten.slice(3, 6)} ${ten.slice(6)}`
}

/** Extract first phone-like string for tel: link. Fallback when listing.phone is missing. */
function extractPhoneFromText(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const m = text.match(/\+?[\d][\d\s\-]{9,}/)
  if (!m) return null
  const digits = m[0].replace(/\D/g, '')
  if (digits.length < 10) return null
  const n = digits.replace(/^964/, '')
  return `+964${n.slice(-10)}`
}

function normalizeSupabaseListing(row: Record<string, unknown>): Record<string, unknown> {
  const rawImages = (row.images as unknown[]) || []
  const images = rawImages.map((u: unknown) =>
    typeof u === 'string' ? { url: u } : { url: (u as { url?: string })?.url ?? u }
  )
  const firstUrl = rawImages[0]
  const cover_image = typeof firstUrl === 'string' ? firstUrl : (firstUrl as { url?: string })?.url

  const parts = (String(row.location || ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const location_country = parts[parts.length - 1] || ''
  const location_state = parts.length > 2 ? parts[1] : ''
  const location_city = parts[0] || ''

  const cond = String(row.condition || '')
  const condition = cond ? cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase() : ''

  return {
    ...row,
    images,
    cover_image,
    location_city,
    location_state,
    location_country,
    location: row.location,
    mileage_unit: 'km',
    color: row.color || '',
    features: Array.isArray(row.features) ? row.features : [],
    phone: row.phone || undefined,
    phone_country_code: row.phone_country_code || undefined,
    whatsapp: row.whatsapp || undefined,
    vin: row.vin || undefined,
    trim: row.trim || '',
    condition,
  }
}

/** Listing row from API or Supabase (UUID or numeric id) */
export type ListingDetailRecord = {
  id: string | number
  user_id?: string
  title?: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  mileage_unit?: string | null
  transmission?: string | null
  fuel_type?: string | null
  condition?: string | null
  color?: string | null
  location?: string | null
  description?: string | null
  images?: unknown
  phone?: string | null
  whatsapp?: string | null
  is_sold?: boolean
  sold_at?: string | null
  vin?: string | null
  trim?: string | null
  features?: string[] | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
  cover_image?: string | null
  seller_name?: string | null
  seller?: { full_name?: string | null }
  created_at?: string
  fromSupabase?: boolean
}

type PriceHistoryEntry = { price: number; timestamp: string }

type ListingDetailClientProps = {
  /** Listing id from `/buy-sell?id=` (preferred) */
  id?: string
  /** @deprecated use `id` */
  listingIdOverride?: string
}

/** Memoized thumbnail for gallery - lazy loads, reduces re-renders */
const ThumbnailItem = memo(function ThumbnailItem({
  src,
  isVideo,
  isActive,
  onClick,
  ariaLabel,
}: {
  src: string
  isVideo: boolean
  isActive: boolean
  onClick: () => void
  ariaLabel: string
}) {
  if (isVideo) {
    return (
      <button
        onClick={onClick}
        className={`flex-shrink-0 w-14 h-14 md:w-24 md:h-24 rounded-lg md:rounded-xl overflow-hidden transition-all duration-200 min-h-[56px] min-w-[56px] md:min-h-[80px] md:min-w-[80px] ${isActive
          ? 'border-2 md:border-[3px] border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/50 scale-105'
          : 'border border-white/20 hover:border-white/40 active:scale-95 md:hover:scale-105 shadow-md'
        }`}
        style={{ willChange: isActive ? 'transform' : undefined }}
        aria-label={ariaLabel}
      >
        <video src={src} muted playsInline className="w-full h-full object-cover" />
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-14 h-14 md:w-24 md:h-24 rounded-lg md:rounded-xl overflow-hidden transition-all duration-200 min-h-[56px] min-w-[56px] md:min-h-[80px] md:min-w-[80px] ${isActive
        ? 'border-2 md:border-[3px] border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/50 scale-105'
        : 'border border-white/20 hover:border-white/40 active:scale-95 md:hover:scale-105 shadow-md'
      }`}
      style={{ willChange: isActive ? 'transform' : undefined }}
      aria-label={ariaLabel}
    >
      <img
        src={src}
        alt=""
        width={96}
        height={96}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
        onError={(e) => {
          const el = e.target as HTMLImageElement
          if (el?.src && el.src !== '/images/cars/default-car.jpg') {
            el.src = '/images/cars/default-car.jpg'
            el.onerror = null
          }
        }}
      />
    </button>
  )
})

export default function ListingDetailPage(props: ListingDetailClientProps = {}) {
  const { id: idProp, listingIdOverride } = props
  const params = useParams() as { locale?: string; id?: string }
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('listing')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const { user, isAuthenticated } = useAuth()
  const { user: currentUser } = useAuthContext()
  // Normalize id: strip any .txt or other extension that redirects might have added
  const rawId = idProp ?? listingIdOverride ?? params?.id
  const listingId =
    typeof rawId === 'string' ? rawId.replace(/\.(txt|html?)$/i, '').trim() : String(rawId ?? '')

  const [listing, setListing] = useState<ListingDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([])
  const [markSoldOpen, setMarkSoldOpen] = useState(false)
  const [markAvailableOpen, setMarkAvailableOpen] = useState(false)
  const [togglingSold, setTogglingSold] = useState(false)
  const [heroImageError, setHeroImageError] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const loadingForIdRef = useRef<string | null>(null)
  const mobileCarouselRef = useRef<HTMLDivElement | null>(null)
  const wasLightboxOpenRef = useRef(false)

  const loadListing = useCallback(async () => {
    if (!listingId || !String(listingId).trim()) {
      setLoading(false)
      setLoadError(t('invalidId'))
      toast({ title: tCommon('error'), description: t('invalidId'), variant: 'destructive' })
      return
    }

    // Prevent duplicate in-flight requests for same listingId
    if (loadingForIdRef.current === listingId) return
    loadingForIdRef.current = listingId

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setLoadError(null)

    console.log('🔄 Fetching listing details for ID:', listingId)

    // CRITICAL FIX: Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('⏰ Timeout after 10s - listing fetch too slow')
      abortController.abort()
      setLoadError('Request timeout - please refresh')
      setLoading(false)
    }, 10000)

    try {
      const numeric = isNumericId(listingId)
      if (numeric) {
        const idNum = parseInt(listingId, 10)
        const data = await apiClient.getListing(idNum)

        // Clear timeout on successful response
        clearTimeout(timeoutId)

        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log('[ListingDetail] Request aborted')
          return
        }

        if (!data) throw new Error('Listing not found')
        console.log('✅ Got listing:', data.title || data.make + ' ' + data.model)
        setListing({ ...(data as object), fromSupabase: false } as ListingDetailRecord)
        setIsSaved((data as { is_saved?: boolean }).is_saved || false)

        // Log listing view activity
        const listingTitle = data.title || `${data.year} ${data.make} ${data.model}`
        activityHelpers.logViewListing(idNum, listingTitle)

        // Fetch price history (non-blocking)
        try {
          const history = await apiClient.getPriceHistory(idNum, 30)
          if (!abortController.signal.aborted) {
            setPriceHistory((history as { history?: PriceHistoryEntry[] }).history ?? [])
          }
        } catch (_) { }
      } else {
        const { data, error } = await supabase
          .from('car_listings')
          .select('*')
          .eq('id', String(listingId).trim())
          .single()

        // Clear timeout on successful response
        clearTimeout(timeoutId)

        // Check if request was aborted
        if (abortController.signal.aborted) {
          console.log('[ListingDetail] Request aborted')
          return
        }

        if (error || !data) throw new Error('Listing not found')
        const normalized = normalizeSupabaseListing(data as Record<string, unknown>)
        console.log('✅ Got listing from Supabase:', normalized.title || normalized.make + ' ' + normalized.model)
        setListing({ ...normalized, fromSupabase: true } as ListingDetailRecord)
        setPriceHistory([])

        // Log listing view activity
        const listingTitle =
          (typeof normalized.title === 'string' && normalized.title.trim()) ||
          `${String(normalized.year ?? '')} ${String(normalized.make ?? '')} ${String(normalized.model ?? '')}`.trim()
        activityHelpers.logViewListing(String(listingId), listingTitle)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[ListingDetail] [LOAD] Load completed successfully')
      }
    } catch (e: unknown) {
      clearTimeout(timeoutId)

      // Ignore abort errors
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[ListingDetail] Request aborted (ignoring error)')
        return
      }

      const msg = e instanceof Error ? e.message : undefined
      console.error('❌ Error loading listing:', e)

      if (!abortController.signal.aborted) {
        setLoadError(msg || t('loadError'))
        toast({
          title: tCommon('error'),
          description: msg || t('loadError'),
          variant: 'destructive',
        })
        setListing(null)
      }
    } finally {
      clearTimeout(timeoutId)
      loadingForIdRef.current = null
      // CRITICAL: Always set loading to false, even if aborted
      setLoading(false)
      if (process.env.NODE_ENV === 'development') {
        console.log('[ListingDetail] [LOAD] Loading set to false (finally)')
      }
    }
  }, [listingId, toast, t, tCommon])

  // Reset state when listing ID changes (critical for client-side navigation)
  // Prevents stale data/images from previous listing when navigating between listings
  useEffect(() => {
    loadingForIdRef.current = null
    setHeroImageError(false)
    setSelectedImageIndex(0)
    setListing(null)
    setLoading(true)
  }, [listingId])

  useEffect(() => {
    if (listingId) {
      loadListing()
    } else {
      setLoading(false)
      setLoadError(t('invalidId'))
      toast({
        title: tCommon('error'),
        description: t('invalidId'),
        variant: 'destructive',
      })
    }

    // Cleanup: abort request on unmount or id change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [listingId, loadListing, toast, t, tCommon])

  // Normalize images - MUST be before early returns to satisfy Rules of Hooks (same hook count every render)
  const images = useMemo(() => {
    if (!listing) return []
    const raw = listing.images
    const arr: unknown[] = Array.isArray(raw) ? raw : []
    return arr
      .map((img: unknown) =>
        typeof img === 'string' ? { url: img } : { url: (img as { url?: string })?.url ?? '' }
      )
      .filter((img: { url: string }) => img.url)
  }, [listing?.images])

  // After closing lightbox, align mobile carousel with selected index (Rules of Hooks: before early returns)
  useEffect(() => {
    if (wasLightboxOpenRef.current && !isLightboxOpen && images.length > 0) {
      const el = mobileCarouselRef.current
      const idx = Math.min(selectedImageIndex, images.length - 1)
      if (el) {
        const w = el.clientWidth
        if (w > 0) el.scrollTo({ left: idx * w, behavior: 'auto' })
      }
    }
    wasLightboxOpenRef.current = isLightboxOpen
  }, [isLightboxOpen, selectedImageIndex, images.length])

  if (loading) {
    return (
      <div className="relative min-h-[50vh] text-slate-900 dark:text-gray-100">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:pb-16 md:pt-12">
          <ListingDetailSkeleton />
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="relative flex min-h-[50vh] items-center justify-center p-4">
        <div className="glass-card max-w-md rounded-2xl p-4 text-center shadow-2xl sm:p-6 lg:p-8">
          <p className="text-slate-900 dark:text-white text-xl mb-2 font-semibold">{loadError || t('notFound')}</p>
          {loadError && (
            <p className="text-slate-600 dark:text-gray-400 text-sm mb-6">{t('loadError')}</p>
          )}
          <div className="flex gap-3 justify-center">
            {loadError && (
              <Button
                onClick={() => {
                  setLoadError(null)
                  loadListing()
                }}
                className="bg-indigo-600 hover:bg-indigo-500 h-11 px-6 font-medium shadow-lg shadow-indigo-500/20"
              >
                Retry
              </Button>
            )}
            <Button
              onClick={() => router.push(`/${locale}/buy-sell`)}
              variant="outline"
              className="border-white/10 text-gray-300 hover:bg-white/5 h-11 px-6"
            >
              {t('backToMarketplace')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const rawImages: unknown[] = Array.isArray(listing.images) ? listing.images : []
  const safeIndex = Math.min(selectedImageIndex, Math.max(0, images.length - 1))
  const currentImage = images[safeIndex] || images[0] || null
  const firstRaw = rawImages[0]
  const heroUrl =
    currentImage?.url ||
    listing.cover_image ||
    (typeof firstRaw === 'string' ? firstRaw : (firstRaw as { url?: string } | undefined)?.url)
  const heroResolved = heroUrl ? listingImageUrl(heroUrl) : ''
  const isHeroVideo = isVideoUrl(heroUrl)

  const contactPhone = listing.phone || extractPhoneFromText(listing.description)
  const contactWhatsApp = listing.whatsapp || contactPhone
  const displayDescription = stripContactFromDescription(listing.description)
  const hasContact = !!(contactPhone || contactWhatsApp)
  const telLink = toTelLink(contactPhone)
  const waLink = toWaLink(contactWhatsApp)

  const isOwner = !!listing?.fromSupabase && !!currentUser?.id && String(listing.user_id) === String(currentUser.id)
  const isSold = !!listing?.is_sold

  const handleMarkSold = async () => {
    if (!isOwner || !listing?.fromSupabase || !currentUser?.id) {
      toast({ title: t('unauthorizedManage'), variant: 'destructive' })
      return
    }
    setTogglingSold(true)
    try {
      const { error } = await supabase
        .from('car_listings')
        .update({ is_sold: true })
        .eq('id', String(listing.id))
        .eq('user_id', currentUser.id)
      if (error) throw error

      // Log activity
      const title = listing.title || `${listing.year} ${listing.make} ${listing.model}`
      activityHelpers.logMarkSold(String(listing.id), title)

      setMarkSoldOpen(false)
      toast({ title: t('markAsSold'), description: t('confirmMarkSoldSuccess') })
      await loadListing()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      toast({ title: t('unauthorizedManage'), description: msg, variant: 'destructive' })
    } finally {
      setTogglingSold(false)
    }
  }

  const handleMarkAvailable = async () => {
    if (!isOwner || !listing?.fromSupabase || !currentUser?.id) {
      toast({ title: t('unauthorizedManage'), variant: 'destructive' })
      return
    }
    setTogglingSold(true)
    try {
      const { error } = await supabase
        .from('car_listings')
        .update({ is_sold: false })
        .eq('id', String(listing.id))
        .eq('user_id', currentUser.id)
      if (error) throw error
      setMarkAvailableOpen(false)
      toast({ title: t('markAsAvailable'), description: t('confirmMarkAvailableSuccess') })
      await loadListing()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      toast({ title: t('unauthorizedManage'), description: msg, variant: 'destructive' })
    } finally {
      setTogglingSold(false)
    }
  }

  const isSamePhone = contactPhone && contactWhatsApp && String(contactPhone).replace(/\D/g, '') === String(contactWhatsApp).replace(/\D/g, '')
  const sellerName = listing.seller_name || listing.seller?.full_name || (listing.fromSupabase && listing.user_id ? null : null)

  const conditionClass = (raw: string) => {
    const c = (raw || '').toLowerCase()
    if (c === 'excellent') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    if (c === 'good') return 'bg-blue-500/20 text-blue-300 border-blue-500/40'
    if (c === 'fair') return 'bg-amber-500/25 text-amber-200 border-amber-500/40'
    if (c === 'poor') return 'bg-red-500/20 text-red-300 border-red-500/40'
    return 'bg-slate-500/20 text-slate-300 border-white/15'
  }

  const onMobileCarouselScroll = () => {
    const el = mobileCarouselRef.current
    if (!el || images.length < 2) return
    const w = el.clientWidth
    if (w <= 0) return
    const idx = Math.min(images.length - 1, Math.max(0, Math.round(el.scrollLeft / w)))
    if (idx !== selectedImageIndex) setSelectedImageIndex(idx)
  }

  const scrollMobileCarouselTo = (idx: number) => {
    const el = mobileCarouselRef.current
    if (!el) return
    const w = el.clientWidth
    el.scrollTo({ left: idx * w, behavior: 'smooth' })
    setSelectedImageIndex(idx)
  }

  const contactSellerCard = (
    <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-xl backdrop-blur-md md:p-6">
      <h3 className="mb-3 text-lg font-bold text-white md:mb-5 md:text-xl">{t('contactSeller')}</h3>
      {sellerName && (
        <p className="text-slate-700 dark:text-gray-300 text-sm mb-3"><span className="text-slate-500 dark:text-gray-500 font-medium">{t('seller')}:</span> {sellerName}</p>
      )}
      <div className="space-y-3 mb-4">
        <div className="text-sm text-slate-700 dark:text-gray-300 space-y-2">
          <p className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 shrink-0 text-gray-400" />
            <span>
              {listing.created_at
                ? new Date(listing.created_at).toLocaleDateString()
                : '—'}
            </span>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
            <span>{[listing.location_city, listing.location_state, listing.location_country].filter(Boolean).join(', ') || listing.location || '—'}</span>
          </p>
        </div>
        {hasContact ? (
          <div className="space-y-2">
            {isSamePhone ? (
              <div>
                <p className="text-gray-400 dark:text-gray-500 text-xs mb-1 font-medium uppercase tracking-wide">{t('phone')} / WhatsApp</p>
                <p className="text-slate-900 dark:text-white font-semibold text-base">
                  <LtrEmbed className="tabular-nums">{formatPhoneDisplay(contactPhone)}</LtrEmbed>
                </p>
              </div>
            ) : (
              <>
                {contactPhone && (
                  <div>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mb-1 font-medium uppercase tracking-wide">{t('phone')}</p>
                    {/* Desktop: clickable link. Mobile: text only (sticky bar has Call button) */}
                    <LtrA href={telLink} className="hidden lg:flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base hover:text-indigo-400 focus:outline-none focus:underline transition-colors">
                      <Phone className="h-5 w-5 shrink-0 text-emerald-400" />
                      <span className="tabular-nums">{formatPhoneDisplay(contactPhone)}</span>
                    </LtrA>
                    <p className="lg:hidden text-slate-900 dark:text-white font-semibold text-base">
                      <LtrEmbed className="tabular-nums">{formatPhoneDisplay(contactPhone)}</LtrEmbed>
                    </p>
                  </div>
                )}
                {contactWhatsApp && (
                  <div>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mb-1 font-medium uppercase tracking-wide">WhatsApp</p>
                    <LtrA href={waLink} target="_blank" rel="noopener noreferrer" className="hidden lg:flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base hover:text-emerald-600 dark:hover:text-emerald-400 focus:outline-none focus:underline transition-colors">
                      <MessageCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                      <span className="tabular-nums">{formatPhoneDisplay(contactWhatsApp)}</span>
                    </LtrA>
                    <p className="lg:hidden text-slate-900 dark:text-white font-semibold text-base">
                      <LtrEmbed className="tabular-nums">{formatPhoneDisplay(contactWhatsApp)}</LtrEmbed>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm py-2">{t('contactNotAvailable')}</p>
        )}
      </div>
      <div className="pt-3 border-t border-white/10 space-y-2 pb-4 md:pb-0">
        <p className="text-amber-400/90 text-xs flex items-start gap-2 leading-relaxed">
          <span className="text-base">⚠</span>
          <span>{t('safetyTip')}</span>
        </p>
        <button className="text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-300 text-sm font-medium flex items-center gap-1.5 transition-colors">
          <Flag className="h-3.5 w-3.5 shrink-0" />
          {t('reportListing')}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <ListingStructuredData listing={listing} />
      <div className="relative min-h-0 text-slate-900 dark:text-gray-100">
        <div
          className={`max-w-7xl mx-auto px-3 sm:px-6 md:px-8 pt-0 md:pt-0 scroll-smooth overflow-x-hidden bg-transparent ${
            hasContact
              ? 'max-md:pb-[calc(248px+env(safe-area-inset-bottom))] md:pb-16'
              : 'pb-12 md:pb-16'
          }`}
        >
          {/* Owner Management Panel - Mobile Only - At Top */}
          {isOwner && (
            <div className="lg:hidden mb-6 mt-20 md:mt-0">
              <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 shadow-sm">
                <ManageListingActions
                  listingId={listing.id}
                  isSold={isSold}
                  onMarkSold={() => setMarkSoldOpen(true)}
                  onMarkAvailable={() => setMarkAvailableOpen(true)}
                  togglingSold={togglingSold}
                />
              </div>
            </div>
          )}

          {/* Mobile: full-width swipe gallery + dots */}
          <div className="relative mb-4 md:hidden -mx-3 sm:-mx-6">
            <Link
              href={`/${locale}/buy-sell`}
              className="absolute start-3 top-3 z-30 group touch-manipulation"
              scroll={true}
            >
              <span className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md hover:bg-slate-950/95 border border-white/25 rounded-full px-3 py-2.5 shadow-lg active:scale-95 min-w-[44px] min-h-[44px]">
                <ChevronLeft className="w-5 h-5 text-white shrink-0 rtl:rotate-180" />
                <span className="hidden min-[400px]:inline text-white font-medium text-sm whitespace-nowrap">
                  {t('backToMarketplace') || 'Back'}
                </span>
              </span>
            </Link>
            {listing?.id && (
              <div className="absolute end-3 top-3 z-20">
                <div className="[&>button]:bg-black/55 [&>button]:backdrop-blur-md [&>button]:rounded-full [&>button]:p-2.5 [&>button]:min-w-[44px] [&>button]:min-h-[44px]">
                  <FavoriteButton
                    listingId={listing.id}
                    initialFavorite={isSaved}
                    size="md"
                    onToggle={(f) => setIsSaved(f)}
                  />
                </div>
              </div>
            )}
            {images.length > 0 ? (
              <>
                <div
                  ref={mobileCarouselRef}
                  onScroll={onMobileCarouselScroll}
                  className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {images.map((img: { url?: string }, idx: number) => {
                    const u = img?.url
                    const src = u ? listingImageUrl(u) : ''
                    const vid = u ? isVideoUrl(u) : false
                    if (!src) {
                      return (
                        <div key={idx} className="relative aspect-video w-full min-w-full shrink-0 snap-center bg-slate-900" />
                      )
                    }
                    return (
                      <div
                        key={idx}
                        className="relative aspect-video w-full min-w-full shrink-0 snap-center bg-black"
                      >
                        <button
                          type="button"
                          className="absolute inset-0 z-10"
                          aria-label={t('viewImage', { current: idx + 1, total: images.length })}
                          onClick={() => {
                            setSelectedImageIndex(idx)
                            setIsLightboxOpen(true)
                          }}
                        />
                        {vid ? (
                          <video
                            src={src}
                            muted
                            playsInline
                            loop
                            className="pointer-events-none h-full w-full object-cover"
                          />
                        ) : (
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="100vw"
                            priority={idx === 0}
                            unoptimized={src.startsWith('blob:') || src.startsWith('data:')}
                          />
                        )}
                        {isSold && idx === 0 && (
                          <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] bg-red-600/95 py-2 text-center text-sm font-bold text-white">
                            SOLD
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {images.length > 1 && (
                  <div className="flex justify-center gap-2 py-3">
                    {images.map((_img: unknown, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => scrollMobileCarouselTo(idx)}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2"
                        aria-label={`${idx + 1} / ${images.length}`}
                      >
                        <span
                          className={`block rounded-full transition-all ${idx === safeIndex ? 'h-2.5 w-8 bg-violet-400' : 'h-2 w-2 bg-white/40'}`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-900 text-slate-500">
                {t('noImageAvailable')}
              </div>
            )}
            <div className="space-y-2 px-3 pt-2">
              <h1 className="text-[1.35rem] font-bold leading-snug text-white sm:text-2xl">
                {listing.year} {listing.make} {listing.model}{listing.trim ? ` ${listing.trim}` : ''}
              </h1>
              {isSold && listing.sold_at && (
                <p className="text-sm text-red-400">{t('soldOn')}: {new Date(listing.sold_at).toLocaleDateString()}</p>
              )}
              <div className="flex items-start justify-between gap-3">
                <p className="text-3xl font-bold text-emerald-400">
                  ${listing.price?.toLocaleString()}
                </p>
                <div className="[&>button]:min-h-[44px] [&>button]:min-w-[44px]">
                  <SocialShareButtons
                    listing={{ id: listing.id, make: listing.make, model: listing.model, year: listing.year, price: listing.price }}
                    url={typeof window !== 'undefined' ? window.location.href : ''}
                    shareLabel={t('shareListing')}
                    iconOnly
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: Hero + thumbnails */}
          <div className="relative mb-4 hidden w-full md:mb-10 md:block md:mx-0">
            <div
              className="group relative aspect-video cursor-pointer overflow-hidden rounded-xl border border-white/10 shadow-2xl md:rounded-xl"
              style={{ willChange: 'transform' }}
              onClick={() => {
                if (images.length > 0) {
                  setIsLightboxOpen(true)
                }
              }}
            >
              <Link
                href={`/${locale}/buy-sell`}
                className="absolute start-4 top-4 z-30 group touch-manipulation"
                onClick={(e) => e.stopPropagation()}
                scroll={true}
              >
                <span className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md hover:bg-slate-950/95 border border-white/25 rounded-full px-3 py-2 shadow-lg min-h-[44px]">
                  <ChevronLeft className="w-5 h-5 text-white shrink-0 rtl:rotate-180" />
                  <span className="text-white font-medium text-sm whitespace-nowrap">
                    {t('backToMarketplace') || 'Back'}
                  </span>
                </span>
              </Link>
              {isSold && (
                <div className="absolute top-0 left-0 right-0 z-30 py-3 bg-red-600/95 text-white text-center font-bold text-lg shadow-lg backdrop-blur-sm" aria-hidden>
                  SOLD
                </div>
              )}
              {heroResolved ? (
                isHeroVideo ? (
                  <video src={heroResolved} controls playsInline className="w-full h-full object-cover" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <div className="relative w-full h-full">
                    {heroImageError ? (
                      // Fallback image if hero image fails
                      <Image
                        key="fallback"
                        src="/images/cars/default-car.jpg"
                        alt="Default car"
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                        className="object-cover"
                        quality={85}
                      />
                    ) : (
                      <Image
                        key={`${listingId}-${heroResolved}`}
                        src={heroResolved}
                        alt={`${listing.year} ${listing.make} ${listing.model}`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        priority
                        quality={85}
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        unoptimized={heroResolved.startsWith('blob:') || heroResolved.startsWith('data:')}
                        onError={() => {
                          console.error('[ListingDetail] Hero image load error:', heroResolved)
                          setHeroImageError(true)
                        }}
                      />
                    )}
                  </div>
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm bg-gradient-to-br from-gray-900 to-black">{t('noImageAvailable')}</div>
              )}

              {/* Image Navigation Arrows - Outside overlay card - Enhanced for mobile */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length)
                    }}
                    className="absolute left-1 md:left-4 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 active:bg-black/90 backdrop-blur-md text-white p-4 md:p-3 rounded-full touch-manipulation shadow-xl transition-all min-w-[56px] min-h-[56px] md:min-w-[48px] md:min-h-[48px] flex items-center justify-center"
                    aria-label={t('previousImage')}
                  >
                    <ChevronLeft className="h-7 w-7 md:h-6 md:w-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex((prev) => (prev + 1) % images.length)
                    }}
                    className="absolute right-1 md:right-4 top-1/2 -translate-y-1/2 z-20 bg-black/60 hover:bg-black/80 active:bg-black/90 backdrop-blur-md text-white p-4 md:p-3 rounded-full touch-manipulation shadow-xl transition-all min-w-[56px] min-h-[56px] md:min-w-[48px] md:min-h-[48px] flex items-center justify-center"
                    aria-label={t('nextImage')}
                  >
                    <ChevronRight className="h-7 w-7 md:h-6 md:w-6 rtl:rotate-180" />
                  </button>
                </>
              )}

              {/* Image Counter - Top Right - Adjusted for mobile */}
              {images.length > 1 && (
                <div className="absolute top-3 right-3 md:top-4 md:right-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-sm font-medium shadow-lg pointer-events-none">
                  {Math.min(selectedImageIndex, images.length - 1) + 1} / {images.length}
                </div>
              )}

              {/* Desktop overlay: Car name, price, Favorite, Share */}
              <div className="hidden md:block absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-10 backdrop-blur-xl bg-gradient-to-t from-black/60 to-black/40 border border-white/20 rounded-xl p-3 md:p-4 shadow-2xl space-y-2">
                <div className="flex items-start justify-between gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg md:text-2xl font-bold text-white tracking-tight leading-tight">
                      {listing.year} {listing.make} {listing.model}{listing.trim ? ` ${listing.trim}` : ''}
                    </h1>
                    {isSold && listing.sold_at && (
                      <p className="text-red-400 text-xs md:text-sm mt-1">{t('soldOn')}: {new Date(listing.sold_at).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {listing?.id && (
                      <div className="[&>button]:bg-white/20 [&>button]:hover:bg-white/30 [&>button]:active:bg-white/40 [&>button]:backdrop-blur-md [&>button]:rounded-full [&>button]:p-2.5 md:[&>button]:p-3 [&>button]:min-w-[44px] [&>button]:min-h-[44px] [&>button]:border-0">
                        <FavoriteButton
                          listingId={listing.id}
                          initialFavorite={isSaved}
                          size="md"
                          onToggle={(f) => setIsSaved(f)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl md:text-3xl font-bold text-emerald-400 leading-tight" style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.5)' }}>
                      ${listing.price?.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="[&>button]:bg-white/20 [&>button]:hover:bg-white/30 [&>button]:active:bg-white/40 [&>button]:backdrop-blur-md [&>button]:rounded-lg [&>button]:p-2.5 md:[&>button]:p-3 [&>button]:min-w-[44px] [&>button]:min-h-[44px] [&>button]:border-0 [&>button]:text-white">
                      <SocialShareButtons
                        listing={{ id: listing.id, make: listing.make, model: listing.model, year: listing.year, price: listing.price }}
                        url={typeof window !== 'undefined' ? window.location.href : ''}
                        shareLabel={t('shareListing')}
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Thumbnail strip — desktop only; tap swaps main image */}
            {images.length > 1 && (
              <div className="mt-3 hidden w-full overflow-x-auto overflow-y-hidden rounded-xl border border-white/10 bg-black/30 py-3 backdrop-blur-md md:mt-4 md:block [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                <div className="flex min-w-max gap-2 px-3 md:gap-3 md:px-6">
                  {images.map((img: { url?: string }, idx: number) => {
                    const u = img?.url
                    const src = u ? listingImageUrl(u) : ''
                    if (!src) {
                      return (
                        <div key={idx} className="flex-shrink-0 w-14 h-14 md:w-24 md:h-24 rounded-lg md:rounded-xl bg-gray-700/50 flex items-center justify-center text-gray-400 text-xs min-h-[56px] min-w-[56px] md:min-h-[80px] md:min-w-[80px]">—</div>
                      )
                    }
                    return (
                      <ThumbnailItem
                        key={idx}
                        src={src}
                        isVideo={isVideoUrl(u)}
                        isActive={idx === selectedImageIndex}
                        onClick={() => setSelectedImageIndex(idx)}
                        ariaLabel={t('viewImage', { current: idx + 1, total: images.length })}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 sm:gap-6 md:gap-8">
            {/* Left Column: Key facts, Features, Description, VIN, Price history, Similar */}
            <div className="space-y-4 md:space-y-6">
              {/* Key facts */}
              <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-3 shadow-xl backdrop-blur-md sm:p-5 md:p-6 lg:mb-0">
                <h2 className="mb-3 text-lg font-bold text-white md:mb-5 md:text-xl">{t('carDetails') || 'Car Details'}</h2>
                <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
                  <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <CalendarDays className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('year')}</p>
                    <p className="text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white">{listing.year}</p>
                  </div>
                  <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Gauge className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('mileage')}</p>
                    <p className="text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white">{listing.mileage?.toLocaleString()} {listing.mileage_unit || 'km'}</p>
                  </div>
                  <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Fuel className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('fuelType')}</p>
                    <p className="text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white">{listing.fuel_type || '—'}</p>
                  </div>
                  <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Cog className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('transmission')}</p>
                    <p className="text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white">{listing.transmission || '—'}</p>
                  </div>
                  <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Award className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('condition')}</p>
                    <span className={`inline-block rounded-lg border px-2.5 py-1.5 text-base font-semibold md:px-3 ${conditionClass(String(listing.condition || ''))}`}>{listing.condition}</span>
                  </div>
                  {listing.color && (
                    <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                          <Palette className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                        </div>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('color')}</p>
                      <p className="text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white">{listing.color}</p>
                    </div>
                  )}
                  <div className="flex h-full min-h-[132px] flex-col rounded-xl border border-white/10 bg-slate-950/40 p-3 shadow-sm transition-colors hover:border-violet-500/30 md:p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <MapPin className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('location')}</p>
                    <p className="text-base md:text-lg font-semibold leading-snug text-gray-900 dark:text-white">{[listing.location_city, listing.location_state, listing.location_country].filter(Boolean).join(', ') || listing.location || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Features, Description, VIN, Price history */}
              <div className="space-y-6">

                {/* Features - chips */}
                {Array.isArray(listing.features) && listing.features.length > 0 && (
                  <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 md:p-6 shadow-sm mb-6">
                    <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-4">{t('features')}</h3>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {listing.features.map((f: string, i: number) => (
                        <span key={i} className="rounded-xl px-3 py-2 text-sm md:text-base backdrop-blur-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" style={{ fontSize: 'clamp(14px, 4vw, 16px)' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description - stripped, no contact; label indicates original seller text */}
                {displayDescription && (
                  <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-4 shadow-xl backdrop-blur-md sm:p-6">
                    <h3 className="mb-3 text-lg font-semibold text-white">{t('sellerNotesLabel')}</h3>
                    <p dir="auto" className="break-words whitespace-pre-wrap text-base leading-relaxed text-slate-200">
                      {displayDescription}
                    </p>
                  </div>
                )}

                {listing.vin && (
                  <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 md:p-6 shadow-sm">
                    <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-3">{t('vin')}</h3>
                    <p dir="ltr" className="ltr-embed text-slate-700 dark:text-gray-300 font-mono text-sm md:text-base backdrop-blur-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 inline-block break-all">{listing.vin}</p>
                  </div>
                )}

                {priceHistory.length > 0 && (
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-5 md:p-6">
                    <h3 className="text-white font-semibold text-lg mb-4">{t('priceHistory')}</h3>
                    <div className="space-y-3">
                      {priceHistory.slice(-5).reverse().map((entry: PriceHistoryEntry, i: number) => {
                        const prev = i > 0 ? priceHistory[priceHistory.length - i]?.price : listing.price
                        const ch = prev ? entry.price - prev : 0
                        const pct = prev ? ((ch / prev) * 100).toFixed(1) : '0'
                        return (
                          <div key={i} className="flex justify-between items-center py-3 px-4 md:py-4 md:px-5 backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                            <div><span className="text-slate-900 dark:text-white font-semibold">${entry.price.toLocaleString()}</span><span className="text-slate-600 dark:text-gray-400 text-xs ml-3">{new Date(entry.timestamp).toLocaleDateString()}</span></div>
                            {ch !== 0 && <span className={`font-medium ${ch < 0 ? 'text-emerald-400' : 'text-red-400'}`}>{ch > 0 ? '+' : ''}${ch.toLocaleString()} ({pct}%)</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile: full contact card in document flow (above bottom nav + sticky CTAs) */}
              {hasContact && <div className="lg:hidden">{contactSellerCard}</div>}

              {!listing.fromSupabase && isNumericId(listingId) && (
                <SimilarCarsRecommendations listingId={parseInt(listingId, 10)} make={listing.make} model={listing.model} year={listing.year} price={listing.price} />
              )}
            </div>

            {/* Right Column - Floating Contact Card (sticky sidebar) - Desktop only */}
            <div key="right-sidebar-desktop" className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                {/* Owner Management Panel - Desktop Only */}
                {isOwner && (
                  <div key="manage-listing-desktop" className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm">
                    <ManageListingActions
                      listingId={listing.id}
                      isSold={isSold}
                      onMarkSold={() => setMarkSoldOpen(true)}
                      onMarkAvailable={() => setMarkAvailableOpen(true)}
                      togglingSold={togglingSold}
                    />
                  </div>
                )}
                <div key="contact-seller-desktop">{contactSellerCard}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Bar - Mobile Only - Call & WhatsApp same size, side by side */}
        {hasContact && (
          <div
            className="fixed left-0 right-0 z-[92] border-t border-white/15 bg-slate-950/95 px-3 py-3 backdrop-blur-xl lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.45)]"
            style={{ bottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto flex max-w-7xl gap-3">
              {contactPhone && (
                <Button asChild className="h-[52px] min-h-[52px] flex-1 min-w-0 touch-manipulation rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-base font-semibold shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500">
                  <LtrA href={telLink} className="flex w-full items-center justify-center gap-2">
                    <Phone className="h-5 w-5 shrink-0" />
                    {t('callNow')}
                  </LtrA>
                </Button>
              )}
              {contactWhatsApp && (
                <Button asChild className="h-[52px] min-h-[52px] flex-1 min-w-0 touch-manipulation rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-700 to-emerald-600 text-base font-semibold text-white shadow-lg hover:from-emerald-600 hover:to-emerald-500">
                  <LtrA href={waLink} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2">
                    <MessageCircle className="h-5 w-5 shrink-0" />
                    WhatsApp
                  </LtrA>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mark as Sold confirmation */}
      <Dialog open={markSoldOpen} onOpenChange={setMarkSoldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('markAsSold')}</DialogTitle>
            <DialogDescription>{t('confirmMarkSold')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-gray-600 text-gray-300" onClick={() => setMarkSoldOpen(false)} disabled={togglingSold}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-500" onClick={handleMarkSold} disabled={togglingSold}>
              {togglingSold ? t('updating') : t('markAsSold')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Available confirmation */}
      <Dialog open={markAvailableOpen} onOpenChange={setMarkAvailableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('markAsAvailable')}</DialogTitle>
            <DialogDescription>{t('confirmMarkAvailable')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="border-gray-600 text-gray-300" onClick={() => setMarkAvailableOpen(false)} disabled={togglingSold}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={handleMarkAvailable} disabled={togglingSold}>
              {togglingSold ? t('updating') : t('markAsAvailable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Gallery Lightbox */}
      {images.length > 0 && (
        <ImageGalleryLightbox
          images={images}
          currentIndex={selectedImageIndex}
          isOpen={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
          onNavigate={(index) => setSelectedImageIndex(index)}
          getImageUrl={listingImageUrl}
          isVideoUrl={isVideoUrl}
        />
      )}
    </>
  )
}
