"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import {
  Phone, MapPin, Calendar, ChevronLeft, ChevronRight, Flag, MessageCircle, Pencil, CheckCircle2, XCircle,
  Gauge, Fuel, Settings, Palette, Award, ShieldCheck
} from 'lucide-react'
import { FavoriteButton } from '@/components/marketplace/FavoriteButton'
import { SimilarCarsRecommendations } from '@/components/marketplace/SimilarCarsRecommendations'
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

type ListingDetailClientProps = {
  /** When provided (e.g. from URL ?id=), use this instead of route params (for buy-sell page modal) */
  listingIdOverride?: string
}

export default function ListingDetailPage(props: ListingDetailClientProps = {}) {
  const { listingIdOverride } = props
  const params = useParams()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('listing')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const { user, isAuthenticated } = useAuth()
  const { user: currentUser } = useAuthContext()
  // Normalize id: strip any .txt or other extension that redirects might have added
  const rawId = (listingIdOverride ?? params?.id) as string
  const listingId = typeof rawId === 'string' ? rawId.replace(/\.(txt|html?)$/i, '').trim() : rawId

  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [priceHistory, setPriceHistory] = useState<any[]>([])
  const [markSoldOpen, setMarkSoldOpen] = useState(false)
  const [markAvailableOpen, setMarkAvailableOpen] = useState(false)
  const [togglingSold, setTogglingSold] = useState(false)
  const [heroImageError, setHeroImageError] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const loadListing = useCallback(async () => {
    if (!listingId || !String(listingId).trim()) {
      setLoading(false)
      setLoadError(t('invalidId'))
      toast({ title: tCommon('error'), description: t('invalidId'), variant: 'destructive' })
      return
    }

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
        setListing({ ...data, fromSupabase: false })
        setIsSaved((data as { is_saved?: boolean }).is_saved || false)

        // Log listing view activity
        const listingTitle = data.title || `${data.year} ${data.make} ${data.model}`
        activityHelpers.logViewListing(idNum, listingTitle)

        // Fetch price history (non-blocking)
        try {
          const history = await apiClient.getPriceHistory(idNum, 30)
          if (!abortController.signal.aborted) {
            setPriceHistory((history as { history?: unknown[] }).history || [])
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
        setListing({ ...normalized, fromSupabase: true })
        setPriceHistory([])

        // Log listing view activity
        const listingTitle = normalized.title || `${normalized.year} ${normalized.make} ${normalized.model}`
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



  if (loading) {
    return (
      <div className="relative min-h-screen text-gray-100">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-12 md:pt-12 md:pb-16">
          <ListingDetailSkeleton />
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
        </div>
        <div className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 sm:p-6 lg:p-8 max-w-md text-center shadow-2xl">
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

  // Normalize images: handle both {url} objects and string URLs (API vs Supabase)
  const rawImages = listing.images || []
  const images = rawImages.map((img: unknown) =>
    typeof img === 'string' ? { url: img } : { url: (img as { url?: string })?.url ?? '' }
  ).filter((img: { url: string }) => img.url)
  const safeIndex = Math.min(selectedImageIndex, Math.max(0, images.length - 1))
  const currentImage = images[safeIndex] || images[0] || null
  const heroUrl = currentImage?.url || listing.cover_image || (typeof rawImages[0] === 'string' ? rawImages[0] : (rawImages[0] as { url?: string })?.url)
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
      const { error } = await supabase.from('car_listings').update({ is_sold: true }).eq('id', listing.id).eq('user_id', currentUser.id)
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
      const { error } = await supabase.from('car_listings').update({ is_sold: false }).eq('id', listing.id).eq('user_id', currentUser.id)
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

  const contactSellerCard = (
    <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 mb-6">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 md:mb-5">{t('contactSeller')}</h3>
      <div className="space-y-4 mb-5">
        <div className="text-sm text-slate-700 dark:text-gray-300 space-y-2.5">
          <p className="flex items-center gap-2 text-sm md:text-base">
            <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
            <span>{new Date(listing.created_at).toLocaleDateString()}</span>
          </p>
          <p className="flex items-center gap-2 text-sm md:text-base">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
            <span>{[listing.location_city, listing.location_state, listing.location_country].filter(Boolean).join(', ') || listing.location || '—'}</span>
          </p>
        </div>
        {hasContact ? (
          <div className="space-y-3 md:space-y-4">
            {contactPhone && (
              <div>
                <p className="text-gray-400 dark:text-gray-500 text-xs mb-2 font-medium uppercase tracking-wide">{t('phone')}</p>
                <a href={telLink} className="flex items-center gap-2 text-white dark:text-white font-semibold text-base md:text-lg hover:text-indigo-400 focus:outline-none focus:underline transition-colors">
                  <Phone className="h-5 w-5 shrink-0 text-emerald-400" />
                  {formatPhoneDisplay(contactPhone)}
                </a>
              </div>
            )}
            {contactWhatsApp && (
              <div>
                <p className="text-slate-600 dark:text-gray-400 text-xs mb-2 font-medium uppercase tracking-wide">WhatsApp</p>
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-base md:text-lg hover:text-emerald-600 dark:hover:text-emerald-400 focus:outline-none focus:underline transition-colors">
                  <MessageCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                  {formatPhoneDisplay(contactWhatsApp)}
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm py-3">{t('contactNotAvailable')}</p>
        )}
      </div>
      <div className="pt-4 border-t border-white/10 space-y-3">
        <p className="text-amber-400/90 text-xs flex items-start gap-2 leading-relaxed" style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>
          <span className="text-base">⚠</span>
          <span>{t('safetyTip')}</span>
        </p>
        <Button variant="outline" className="w-full border-white/10 text-gray-300 hover:bg-white/5 h-10 md:h-11 min-h-[44px] touch-manipulation">
          <Flag className="h-4 w-4 mr-2" />{t('reportListing')}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <ListingStructuredData listing={listing} />
      <div className="relative min-h-screen text-gray-100">
        {/* Ambient gradient glow */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
        </div>

        {/* Back to Marketplace Button */}
        <Link
          href={`/${locale}/buy-sell`}
          className="!fixed md:!absolute top-20 left-4 md:top-6 md:left-6 !z-[100] group"
        >
          <button className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md hover:bg-slate-900/90 border border-white/30 hover:border-white/40 rounded-full px-4 py-2.5 shadow-xl hover:shadow-2xl transition-all duration-300 active:scale-95 min-w-[44px] min-h-[44px] touch-manipulation">
            <ChevronLeft className="w-5 h-5 text-white flex-shrink-0" />
            <span className="hidden sm:inline text-white font-medium text-sm whitespace-nowrap">
              {t('backToMarketplace') || 'Back to Marketplace'}
            </span>
          </button>
        </Link>

        <div className={`max-w-7xl mx-auto px-3 sm:px-6 md:px-8 pt-0 ${hasContact ? 'pb-28 md:pb-16' : 'pb-12 md:pb-16'} md:pt-0 scroll-smooth`} style={hasContact ? { paddingBottom: '112px' } : undefined}>
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

          {/* Hero Image Section with Glassmorphism Overlay */}
          <div className="relative w-full mb-6 md:mb-10">
            <div
              className="relative aspect-video overflow-hidden rounded-2xl cursor-pointer group border border-white/10 shadow-2xl"
              onClick={() => {
                if (images.length > 0) {
                  setIsLightboxOpen(true)
                }
              }}
            >
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
                        quality={90}
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

              {/* Glassmorphism Info Overlay Card - Enhanced for mobile */}
              <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-10 backdrop-blur-xl bg-gradient-to-t from-black/60 to-black/40 border border-white/20 rounded-xl p-3 md:p-4 shadow-2xl space-y-2">
                {/* Top Row: Car Name & Favorite Button */}
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

                {/* Bottom Row: Price & Share Button */}
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
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail Strip - Enhanced with better spacing and shadows - Horizontal scrollable on mobile */}
            {images.length > 1 && (
              <div className="w-full mt-4 py-4 flex gap-3 overflow-x-auto overflow-y-hidden bg-black/20 backdrop-blur-md rounded-2xl [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20 scroll-smooth snap-x snap-mandatory touch-pan-x">
                <div className="px-4 md:px-6 flex gap-3 min-w-max">
                  {images.map((img: { url?: string }, idx: number) => {
                    const u = img?.url
                    const src = u ? listingImageUrl(u) : ''
                    const isV = isVideoUrl(u)
                    const isActive = idx === selectedImageIndex
                    return (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedImageIndex(idx)
                          setIsLightboxOpen(true)
                        }}
                        className={`flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden transition-all duration-200 min-h-[80px] min-w-[80px] ${isActive
                          ? 'border-[3px] border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/50 scale-105'
                          : 'border-2 border-white/20 hover:border-white/40 active:scale-95 md:hover:scale-105 shadow-md'
                          }`}
                        aria-label={t('viewImage', { current: idx + 1, total: images.length })}
                      >
                        {src ? (
                          isV ? (
                            <video src={src} muted playsInline className="w-full h-full object-cover" />
                          ) : (
                            <img
                              src={src}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/images/cars/default-car.jpg'
                                  ; (e.target as HTMLImageElement).onerror = null
                              }}
                            />
                          )
                        ) : (
                          <div className="w-full h-full bg-gray-700/50 flex items-center justify-center text-gray-400 text-xs">—</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-3 sm:gap-6 md:gap-8">
            {/* Left Column: Key facts, Features, Description, VIN, Price history, Similar */}
            <div className="space-y-6">
              {/* Contact Seller - Mobile Only (shown before car details on mobile) */}
              <div key="contact-seller-mobile" className="lg:hidden mb-6">{contactSellerCard}</div>

              {/* Key facts - Enhanced Glass Tiles Grid */}
              <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 md:p-6 shadow-sm mb-6 lg:mb-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5">{t('carDetails') || 'Car Details'}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                  <div className="backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-300 group shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Calendar className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('year')}</p>
                    <p className="text-slate-900 dark:text-white font-bold text-lg md:text-xl">{listing.year}</p>
                  </div>
                  <div className="backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-300 group shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Gauge className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('mileage')}</p>
                    <p className="text-slate-900 dark:text-white font-bold text-base md:text-xl leading-tight">{listing.mileage?.toLocaleString()} {listing.mileage_unit || 'km'}</p>
                  </div>
                  <div className="backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-300 group shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Fuel className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('fuelType')}</p>
                    <p className="text-slate-900 dark:text-white font-bold text-base md:text-xl">{listing.fuel_type || '—'}</p>
                  </div>
                  <div className="backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-300 group shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Settings className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('transmission')}</p>
                    <p className="text-slate-900 dark:text-white font-bold text-base md:text-xl">{listing.transmission || '—'}</p>
                  </div>
                  <div className="backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-300 group shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                        <Award className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('condition')}</p>
                    <span className={`inline-block text-xs md:text-sm font-bold px-2.5 md:px-3 py-1.5 rounded-lg mt-1 ${listing.condition === 'Excellent' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      listing.condition === 'Good' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                        listing.condition === 'Fair' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>{listing.condition}</span>
                  </div>
                  {listing.color && (
                    <div className="backdrop-blur-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-300 group shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:bg-indigo-500/30 transition-colors">
                          <Palette className="h-4 w-4 md:h-5 md:w-5 text-indigo-400" />
                        </div>
                      </div>
                      <p className="text-slate-600 dark:text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">{t('color')}</p>
                      <p className="text-slate-900 dark:text-white font-bold text-base md:text-xl">{listing.color}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Features, Description, VIN, Price history */}
              <div className="space-y-6">

                {/* Features - chips */}
                {listing.features?.length > 0 && (
                  <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 md:p-6 shadow-sm mb-6">
                    <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-4">{t('features')}</h3>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {listing.features.map((f: string, i: number) => (
                        <span key={i} className="rounded-xl px-3 py-2 text-sm md:text-base backdrop-blur-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" style={{ fontSize: 'clamp(14px, 4vw, 16px)' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description - stripped, no contact */}
                {displayDescription && (
                  <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 md:p-6 shadow-sm mb-6">
                    <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-4">{t('description')}</h3>
                    <p className="text-slate-700 dark:text-gray-300 text-sm md:text-base whitespace-pre-wrap leading-relaxed" style={{ fontSize: 'clamp(14px, 4vw, 16px)' }}>{displayDescription}</p>
                  </div>
                )}

                {listing.vin && (
                  <div className="backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-3 sm:p-5 md:p-6 shadow-sm">
                    <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-3">{t('vin')}</h3>
                    <p className="text-slate-700 dark:text-gray-300 font-mono text-sm md:text-base backdrop-blur-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 inline-block break-all">{listing.vin}</p>
                  </div>
                )}

                {priceHistory.length > 0 && (
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-5 md:p-6">
                    <h3 className="text-white font-semibold text-lg mb-4">{t('priceHistory')}</h3>
                    <div className="space-y-3">
                      {priceHistory.slice(-5).reverse().map((entry: { price: number; timestamp: string }, i: number) => {
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

              {!listing.fromSupabase && (
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

        {/* Sticky Action Bar - Mobile Only - Fixed at bottom with proper styling */}
        {hasContact && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-gradient-to-t from-gray-900/98 via-gray-900/95 to-gray-900/95 border-t border-white/20 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] safe-area-inset-bottom">
            <div className="max-w-7xl mx-auto flex gap-3">
              {contactPhone && (
                <Button asChild className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 min-h-[52px] h-[52px] text-base font-semibold shadow-lg shadow-emerald-500/30 touch-manipulation rounded-xl">
                  <a href={telLink} className="flex items-center justify-center"><Phone className="h-5 w-5 mr-2" />{t('callNow')}</a>
                </Button>
              )}
              {contactWhatsApp && (
                <Button asChild variant="outline" className="flex-1 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 active:scale-95 min-h-[52px] h-[52px] text-base font-semibold touch-manipulation rounded-xl">
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center"><MessageCircle className="h-5 w-5 mr-2" />WhatsApp</a>
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
