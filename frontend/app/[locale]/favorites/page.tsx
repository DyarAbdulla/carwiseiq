"use client"
export const runtime = 'edge';

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Heart, MapPin, Calendar, Filter, Grid, List } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { FavoriteButton } from '@/components/marketplace/FavoriteButton'
import { listingImageUrl } from '@/lib/utils'

export default function FavoritesPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('favorites')
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const { isAuthenticated, loading: authLoading } = useAuth()
  // Use Supabase auth as primary source of truth
  const { user: supabaseUser, session: supabaseSession, loading: supabaseLoading } = useAuthContext()
  const { toast } = useToast()

  // Check Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        console.log('[Favorites] Supabase session exists:', !!data.session)
        console.log('[Favorites] Supabase token exists:', !!data.session?.access_token)
        if (data.session?.access_token) {
          console.log('[Favorites] Supabase token preview:', data.session.access_token.substring(0, 20) + '...')
        }
      } catch (e) {
        console.log('[Favorites] Session check error:', e)
      }
    }
    checkSession()
  }, [])

  const [listings, setListings] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('recently_saved')
  const [filters, setFilters] = useState({
    min_price: '',
    max_price: '',
    makes: [] as string[],
    location: ''
  })

  const loadFavorites = useCallback(async () => {
    console.log('[Favorites] ========== LOADING FAVORITES ==========')
    console.log('[Favorites] Starting to load favorites...')
    
    // Get Supabase session token (source of truth)
    let token: string | null = null
    try {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token || null
      console.log('[Favorites] Supabase token exists:', !!token)
      if (token) {
        console.log('[Favorites] Using Supabase token:', token.substring(0, 20) + '...')
      }
    } catch (e) {
      console.error('[Favorites] Error getting Supabase session:', e)
    }
    
    // Fallback to REST token if no Supabase session
    if (!token) {
      token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      console.log('[Favorites] Fallback to REST token:', !!token)
    }
    
    if (!token) {
      console.error('[Favorites] ❌ No token found! Cannot load favorites.')
      toast({
        title: tCommon('error'),
        description: tAuth('authTokenMissing'),
        variant: 'destructive'
      })
      router.replace(`/${locale}/login?returnUrl=/${locale}/favorites`)
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      console.log('[Favorites] Calling apiClient.getFavorites with token...')
      // Make API call with Supabase token (interceptor will use it)
      const data = await apiClient.getFavorites({
        page,
        page_size: 15,
        sort_by: sortBy
      })
      
      console.log('[Favorites] ✅ Data received:', { 
        items: data.items?.length || 0, 
        total: data.total || 0,
        hasItems: !!data.items,
        itemsArray: Array.isArray(data.items)
      })
      
      let filtered = data.items || []
      
      // Apply filters
      if (filters.min_price) {
        filtered = filtered.filter((l: any) => l.price >= parseFloat(filters.min_price))
      }
      if (filters.max_price) {
        filtered = filtered.filter((l: any) => l.price <= parseFloat(filters.max_price))
      }
      if (filters.makes.length > 0) {
        filtered = filtered.filter((l: any) => filters.makes.includes(l.make))
      }
      if (filters.location) {
        filtered = filtered.filter((l: any) => 
          l.location_city?.toLowerCase().includes(filters.location.toLowerCase()) ||
          l.location_state?.toLowerCase().includes(filters.location.toLowerCase())
        )
      }
      
      setListings(filtered)
      setTotal(data.total || 0)
      console.log('[Favorites] ✅ Favorites loaded successfully:', {
        displayed: filtered.length,
        total: data.total
      })
    } catch (error: any) {
      console.error('[Favorites] ========== ERROR LOADING FAVORITES ==========')
      console.error('[Favorites] Error:', error)
      console.error('[Favorites] Error response:', error.response)
      console.error('[Favorites] Error status:', error.response?.status)
      console.error('[Favorites] Error message:', error.message)
      
      // Handle 401 errors specifically - the interceptor will redirect, but show a message first
      if (error.response?.status === 401) {
        console.log('[Favorites] ❌ 401 Unauthorized - session expired')
        toast({
          title: tCommon('error'),
          description: t('sessionExpired') || 'Session expired. Please login again.',
          variant: 'destructive'
        })
        // The axios interceptor will handle redirect, but ensure we clear state
        setListings([])
        setTotal(0)
        // Redirect to login with return URL
        router.replace(`/${locale}/login?returnUrl=/${locale}/favorites`)
      } else {
        const errorMsg = error.response?.data?.detail || error.message || t('loadError')
        console.error('[Favorites] Error message:', errorMsg)
        toast({
          title: tCommon('error'),
          description: errorMsg,
          variant: 'destructive'
        })
        setListings([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
      console.log('[Favorites] ========== LOAD COMPLETE ==========')
    }
  }, [page, sortBy, filters, toast, t, tCommon, router, locale])

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    const checkAndLoad = async () => {
      console.log('[Favorites] ========== AUTH STATE CHANGED ==========')
      
      // Check Supabase session first (source of truth) - NO localStorage checks
      try {
        const { data } = await supabase.auth.getSession()
        const hasSession = !!data.session?.user
        const hasToken = !!data.session?.access_token
        
        console.log('[Favorites] Supabase session:', hasSession)
        console.log('[Favorites] Supabase token:', hasToken)
        
        // If Supabase session exists with token, allow page to load
        if (hasSession && hasToken && mounted) {
          console.log('[Favorites] ✅ Supabase session found, loading favorites...')
          loadFavorites()
          return
        }
      } catch (e) {
        console.log('[Favorites] Supabase session check failed:', e)
      }
      
      // If Supabase is still loading, wait a bit
      if (supabaseLoading) {
        console.log('[Favorites] Supabase auth still loading, waiting...')
        timeoutId = setTimeout(() => {
          if (!mounted) return
          checkAndLoad()
        }, 1000)
        return
      }
      
      // Fallback: Check REST API auth (for email/password login)
      if (isAuthenticated && !authLoading && mounted) {
        console.log('[Favorites] ✅ REST API authenticated, loading favorites...')
        loadFavorites()
        return
      }
      
      // If REST API is still loading, wait a bit
      if (authLoading) {
        console.log('[Favorites] REST API auth still loading, waiting...')
        timeoutId = setTimeout(() => {
          if (!mounted) return
          checkAndLoad()
        }, 1000)
        return
      }
      
      // No authentication found, redirect to login
      if (mounted) {
        console.log('[Favorites] ❌ Not authenticated, redirecting to login')
        router.replace(`/${locale}/login?returnUrl=/${locale}/favorites`)
      }
    }
    
    checkAndLoad()
    
    return () => {
      mounted = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [supabaseLoading, supabaseUser, supabaseSession, authLoading, isAuthenticated, router, locale, loadFavorites])

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const saved = new Date(date)
    const diffMs = now.getTime() - saved.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffDays === 0) return t('savedToday')
    if (diffDays === 1) return t('savedYesterday')
    if (diffDays < 7) return t('savedDaysAgo', { n: diffDays })
    if (diffDays < 30) return t('savedWeeksAgo', { n: Math.floor(diffDays / 7) })
    return t('savedMonthsAgo', { n: Math.floor(diffDays / 30) })
  }

  if (authLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
        </div>
        <div className="text-gray-400 text-lg">{tCommon('loading')}</div>
      </div>
    )
  }
  
  // Don't render anything if not authenticated - let redirect happen
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
        </div>
        <div className="text-gray-400 text-lg">Redirecting to login...</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen text-gray-100">
      {/* Ambient gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8 pb-12 md:pt-12 md:pb-16">
        {/* Header */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="h-8 w-8 text-red-500 fill-current" />
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{t('title')}</h1>
          </div>
          <p className="text-gray-400 text-lg">{t('subtitle')}</p>
        </div>

        {/* Glass Filter & Sort Bar */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 mb-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Sort & View Controls */}
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="min-w-[180px] h-12 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder={t('sortBy')} />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/98 border-white/10 backdrop-blur-xl">
                  <SelectItem value="recently_saved" className="text-white">{t('recentlySaved')}</SelectItem>
                  <SelectItem value="price_low" className="text-white">{t('priceLow')}</SelectItem>
                  <SelectItem value="price_high" className="text-white">{t('priceHigh')}</SelectItem>
                  <SelectItem value="newest_listings" className="text-white">{t('newestListings')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-xl border border-white/10 p-1 bg-white/5">
                <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('grid')} className={`h-10 w-10 ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`} aria-label={t('gridView')}><Grid className="h-4 w-4" /></Button>
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" onClick={() => setViewMode('list')} className={`h-10 w-10 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`} aria-label={t('listView')}><List className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-white font-semibold text-sm">{t('filters')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300 text-sm mb-2 block font-medium">{t('priceRange')}</Label>
                <div className="flex gap-2">
                  <Input type="number" placeholder={t('min')} value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} className="h-11 bg-white/5 border-white/10 text-base" />
                  <Input type="number" placeholder={t('max')} value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} className="h-11 bg-white/5 border-white/10 text-base" />
                </div>
              </div>
              <div>
                <Label className="text-gray-300 text-sm mb-2 block font-medium">{t('location')}</Label>
                <Input type="text" placeholder={t('cityOrState')} value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} className="h-11 bg-white/5 border-white/10 text-base" />
              </div>
              <div className="flex items-end">
                <Button onClick={() => setFilters({ min_price: '', max_price: '', makes: [], location: '' })} variant="outline" className="h-11 border-white/10 text-gray-300 hover:bg-white/5">
                  {t('clearFilters')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Listings */}
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-lg">{t('loadingFavorites')}</div>
        ) : listings.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 md:p-16 text-center shadow-xl">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
              <Heart className="h-12 w-12 text-gray-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">{t('noFavorites')}</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto text-base">
              {t('noFavoritesDesc')}
            </p>
            <Button onClick={() => router.push(`/${locale}/buy-sell`)} className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-500/20">
              {t('browseListings')}
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-gray-400 text-sm font-medium">
              {t('showingXofY', { count: listings.length, total })}
            </div>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6' : 'space-y-4'}>
              {listings.map((listing) => (
                <Link key={listing.id} href={`/${locale}/buy-sell/${listing.id}`}>
                  <div className="group relative backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 ease-out cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/20 active:scale-[0.98]">
                    <div className={viewMode === 'grid' ? '' : 'flex'}>
                      <div className={`${viewMode === 'grid' ? 'aspect-video' : 'w-64'} bg-gray-900/50 overflow-hidden relative`}>
                        {listing.cover_image ? (
                          <img
                            src={listingImageUrl(listing.cover_image)}
                            alt={`${listing.make} ${listing.model}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/cars/default-car.jpg'
                              ;(e.target as HTMLImageElement).onerror = null
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                            {t('noImage')}
                          </div>
                        )}
                      </div>
                      <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors">
                              {listing.year} {listing.make} {listing.model}
                            </h3>
                            <p className="text-indigo-400 font-bold text-xl">
                              ${listing.price?.toLocaleString()}
                            </p>
                          </div>
                          <FavoriteButton
                            listingId={listing.id}
                            initialFavorite={true}
                            size="md"
                            onToggle={(isFavorite) => {
                              if (!isFavorite) {
                                setListings(listings.filter(l => l.id !== listing.id))
                                setTotal(total - 1)
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1.5 text-sm text-gray-300">
                          <p className="font-medium">{listing.mileage?.toLocaleString()} {listing.mileage_unit}</p>
                          <p className="flex items-center text-gray-400">
                            <MapPin className="h-3.5 w-3.5 mr-1.5" />
                            {listing.location_city}, {listing.location_state}
                          </p>
                          <p className="flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatTimeAgo(listing.saved_at || listing.created_at)}
                          </p>
                        </div>
                        <div className="mt-3">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            listing.condition === 'Excellent' ? 'bg-emerald-500/20 text-emerald-400' :
                            listing.condition === 'Good' ? 'bg-indigo-500/20 text-indigo-400' :
                            listing.condition === 'Fair' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {listing.condition}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {/* Pagination */}
            {total > 15 && (
              <div className="flex justify-center items-center gap-3 mt-10">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 text-gray-300 hover:bg-white/5 h-11 px-6 disabled:opacity-50"
                >
                  {t('previous')}
                </Button>
                <span className="px-4 py-2 text-gray-300 text-sm font-medium">
                  {t('pageOf', { page, total: Math.ceil(total / 15) })}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 15 >= total}
                  className="border-white/10 text-gray-300 hover:bg-white/5 h-11 px-6 disabled:opacity-50"
                >
                  {t('next')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
