"use client"
export const runtime = 'edge';

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Search, MapPin, Calendar, Filter, X, Sparkles, Gauge } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { CarListing } from '@/lib/database.types'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'
import { listingImageUrl, isVideoUrl } from '@/lib/utils'
import { ListingCardSkeleton } from '@/components/common/LoadingSkeleton'

function firstImageUrl(images: unknown): string | null {
  if (!images || !Array.isArray(images)) return null
  const first = images[0]
  if (typeof first === 'string') return first
  if (first && typeof (first as { url?: string }).url === 'string') return (first as { url: string }).url
  return null
}

function conditionLabel(c: string): string {
  if (!c) return ''
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}

export default function BuySellPage() {
  const [listings, setListings] = useState<CarListing[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showSoldCars, setShowSoldCars] = useState(true)
  const [priceSearchMode, setPriceSearchMode] = useState<'range' | 'smart'>('range')
  const [budget, setBudget] = useState<number | null>(null)
  const [filters, setFilters] = useState({
    min_price: '',
    max_price: '',
    min_year: '',
    max_year: '',
    max_mileage: '',
  })
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('marketplace')
  const { toast } = useToast()

  // Quick budget chips
  const budgetChips = [
    { label: 'Under $5k', value: 5000 },
    { label: '$5k-$10k', min: 5000, max: 10000 },
    { label: '$10k-$20k', min: 10000, max: 20000 },
    { label: '$20k-$30k', min: 20000, max: 30000 },
    { label: '$30k-$50k', min: 30000, max: 50000 },
    { label: '$50k+', min: 50000, max: 200000 },
  ]

  const handleBudgetChipClick = (chip: typeof budgetChips[0]) => {
    if ('value' in chip) {
      // Single value chip (Under $5k)
      setBudget(chip.value)
      setPriceSearchMode('smart')
      const calculatedMin = chip.value * 0.85
      const calculatedMax = chip.value * 1.15
      setFilters({ ...filters, min_price: calculatedMin.toString(), max_price: calculatedMax.toString() })
    } else {
      // Range chip
      setBudget(null)
      setPriceSearchMode('range')
      setFilters({ ...filters, min_price: chip.min.toString(), max_price: chip.max.toString() })
    }
    loadListings()
  }

  const handleBudgetChange = (value: string) => {
    const numValue = value ? parseFloat(value) : null
    setBudget(numValue)
    if (numValue && numValue > 0) {
      const calculatedMin = numValue * 0.85
      const calculatedMax = numValue * 1.15
      setFilters({ ...filters, min_price: calculatedMin.toString(), max_price: calculatedMax.toString() })
    }
  }

  const handleApplyFilters = () => {
    // CRITICAL FIX: If in Smart Budget mode, ensure we use the calculated values
    if (priceSearchMode === 'smart' && budget && budget > 0) {
      const budgetValue = budget
      const calculatedMin = Math.floor(budgetValue * 0.85) // -15%
      const calculatedMax = Math.ceil(budgetValue * 1.15)  // +15%

      // Update filters state with calculated values for consistency
      setFilters(prev => ({
        ...prev,
        min_price: calculatedMin.toString(),
        max_price: calculatedMax.toString(),
      }))
    }

    // Trigger loadListings - it will use the correct values
    loadListings()

    // Optional: Close modal if mobile
    setFiltersOpen(false)
  }

  const loadListings = useCallback(async () => {
    console.log('🔄 Fetching listings...')
    setLoading(true)
    setLoadError(null)

    // CRITICAL FIX: Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('⏰ Timeout after 10s - listings fetch too slow')
      setLoadError('Request timeout - please refresh')
      setLoading(false)
    }, 10000)

    try {
      let q = supabase
        .from('car_listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      // CRITICAL FIX: If in Smart Budget mode, use calculated range from budget
      let minP: number | undefined
      let maxP: number | undefined

      if (priceSearchMode === 'smart' && budget && budget > 0) {
        // Smart Budget mode: calculate ±15% range
        minP = Math.floor(budget * 0.85) // -15%
        maxP = Math.ceil(budget * 1.15)  // +15%
        // Also update filters state for display consistency
        setFilters(prev => ({
          ...prev,
          min_price: minP!.toString(),
          max_price: maxP!.toString(),
        }))
      } else {
        // Range mode: use manual min/max inputs
        minP = filters.min_price ? parseFloat(filters.min_price) : undefined
        maxP = filters.max_price ? parseFloat(filters.max_price) : undefined
      }

      const minY = filters.min_year ? parseInt(filters.min_year, 10) : undefined
      const maxY = filters.max_year ? parseInt(filters.max_year, 10) : undefined
      const maxM = filters.max_mileage ? parseInt(filters.max_mileage, 10) : undefined

      if (minP != null && !isNaN(minP)) q = q.gte('price', minP)
      if (maxP != null && !isNaN(maxP)) q = q.lte('price', maxP)
      if (minY != null && !isNaN(minY)) q = q.gte('year', minY)
      if (maxY != null && !isNaN(maxY)) q = q.lte('year', maxY)
      if (maxM != null && !isNaN(maxM)) q = q.lte('mileage', maxM)

      const { data, error } = await q

      // Clear timeout on successful response
      clearTimeout(timeoutId)

      if (error) throw error

      const listings = (data as CarListing[]) ?? []
      console.log('✅ Got', listings.length, 'listings')
      setListings(listings)

      // Show success message if no listings found
      if (listings.length === 0) {
        console.log('ℹ️ No listings match current filters')
      }
    } catch (e) {
      clearTimeout(timeoutId)
      console.error('❌ Error loading listings:', e)
      setListings([])
      const msg = e instanceof Error ? e.message : 'Failed to load listings'
      setLoadError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [filters, priceSearchMode, budget, toast])

  useEffect(() => {
    loadListings()
  }, [loadListings])

  const filtered = useMemo(() => {
    let out = listings
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      out = out.filter(
        (l) =>
          l.title?.toLowerCase().includes(s) ||
          l.make?.toLowerCase().includes(s) ||
          l.model?.toLowerCase().includes(s)
      )
    }
    if (!showSoldCars) out = out.filter((l) => !l.is_sold)
    return out
  }, [listings, search, showSoldCars])

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const posted = new Date(date)
    const diffMs = now.getTime() - posted.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return t('postedMinutesAgo', { n: diffMins })
    if (diffHours < 24) return t('postedHoursAgo', { n: diffHours })
    if (diffDays < 30) return t('postedDaysAgo', { n: diffDays })
    return t('postedMonthsAgo', { n: Math.floor(diffDays / 30) })
  }

  return (
    <div className="relative min-h-screen text-gray-100">
      {/* Gradient orb background ambience */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-12 md:pt-12 md:pb-16">
        {/* Floating Glass Header with Search & Filters */}
        <div className="mb-8 md:mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">{t('title')}</h1>

          {/* Glass Search & Filter Bar */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 md:p-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-gray-400 pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadListings()}
                  placeholder={t('searchPlaceholder')}
                  className="pl-11 pr-4 h-12 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 focus-visible:border-indigo-500/50"
                />
              </div>

              {/* Filter Button */}
              <Button
                onClick={() => setFiltersOpen(!filtersOpen)}
                variant="outline"
                className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 h-12 px-6 text-base font-medium"
              >
                <Filter className="h-5 w-5 mr-2" />
                {t('filters')}
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Panel - Desktop: Inline, Mobile: Bottom Sheet */}
        <AnimatePresence>
          {filtersOpen && (
            <>
              {/* Mobile: Bottom Sheet Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="md:hidden fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
                onClick={() => setFiltersOpen(false)}
              />

              {/* Filters Content */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="md:backdrop-blur-xl md:bg-white/80 dark:md:bg-white/5 md:border md:border-slate-200 dark:md:border-white/10 md:rounded-2xl md:p-5 md:p-6 md:mb-6 md:shadow-xl fixed md:static bottom-0 left-0 right-0 z-[101] md:z-auto bg-white dark:bg-gray-900 border-t border-slate-200 dark:border-white/10 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto md:max-h-none md:overflow-visible shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-900 dark:text-white font-semibold text-lg">{t('filters')}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)} className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white p-2 h-8 w-8">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-700 dark:text-gray-300 font-medium text-sm mb-2 block">{t('priceRange')}</Label>

                    {/* Search Mode Toggle */}
                    <Tabs value={priceSearchMode} onValueChange={(v) => {
                      const newMode = v as 'range' | 'smart'
                      setPriceSearchMode(newMode)
                      if (newMode === 'range') {
                        setBudget(null)
                        // Keep the current min/max values if they exist
                      } else {
                        // When switching to smart mode, clear manual price inputs if no budget is set
                        if (!budget) {
                          setFilters({ ...filters, min_price: '', max_price: '' })
                        }
                      }
                    }} className="mb-3">
                      <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <TabsTrigger
                          value="range"
                          className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-700 dark:text-gray-300"
                        >
                          Range
                        </TabsTrigger>
                        <TabsTrigger
                          value="smart"
                          className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-700 dark:text-gray-300 flex items-center gap-1.5"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Smart Budget
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Range Mode */}
                    {priceSearchMode === 'range' && (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder={t('min')}
                          value={filters.min_price}
                          onChange={(e) => {
                            setFilters({ ...filters, min_price: e.target.value })
                            setBudget(null) // Clear budget when manually editing range
                          }}
                          className="h-11 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                        />
                        <Input
                          type="number"
                          placeholder={t('max')}
                          value={filters.max_price}
                          onChange={(e) => {
                            setFilters({ ...filters, max_price: e.target.value })
                            setBudget(null) // Clear budget when manually editing range
                          }}
                          className="h-11 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                        />
                      </div>
                    )}

                    {/* Smart Budget Mode */}
                    {priceSearchMode === 'smart' && (
                      <div className="space-y-3">
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="Your Target Budget ($)"
                            value={budget || ''}
                            onChange={(e) => handleBudgetChange(e.target.value)}
                            className="h-11 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 pr-20"
                          />
                          {budget && budget > 0 && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-gray-400">
                              ±15%
                            </div>
                          )}
                        </div>
                        {budget && budget > 0 && (
                          <p className="text-xs text-slate-500 dark:text-gray-400">
                            Searching: ${Math.round(budget * 0.85).toLocaleString()} - ${Math.round(budget * 1.15).toLocaleString()}
                          </p>
                        )}

                        {/* Quick Chips */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {budgetChips.map((chip) => (
                            <button
                              key={chip.label}
                              onClick={() => handleBudgetChipClick(chip)}
                              className="min-h-[44px] min-w-[44px] px-4 py-2.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors touch-manipulation"
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-slate-700 dark:text-gray-300 font-medium text-sm mb-2 block">{t('yearRange')}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={t('min')}
                        value={filters.min_year}
                        onChange={(e) => setFilters({ ...filters, min_year: e.target.value })}
                        className="h-11 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                      />
                      <Input
                        type="number"
                        placeholder={t('max')}
                        value={filters.max_year}
                        onChange={(e) => setFilters({ ...filters, max_year: e.target.value })}
                        className="h-11 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-700 dark:text-gray-300 font-medium text-sm mb-2 block">{t('maxMileage')}</Label>
                    <Input
                      type="number"
                      placeholder={t('maxMileagePlaceholder')}
                      value={filters.max_mileage}
                      onChange={(e) => setFilters({ ...filters, max_mileage: e.target.value })}
                      className="h-11 text-base bg-white dark:bg-white/5 border-slate-200 dark:border-white/10"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <Button
                    onClick={() => {
                      setFilters({ min_price: '', max_price: '', min_year: '', max_year: '', max_mileage: '' })
                      setBudget(null)
                      setPriceSearchMode('range')
                    }}
                    variant="outline"
                    className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5 h-11 px-6"
                  >
                    {t('clearAll')}
                  </Button>
                  <Button
                    onClick={handleApplyFilters}
                    className="bg-indigo-600 hover:bg-indigo-500 h-11 px-6 font-medium shadow-lg shadow-indigo-500/20"
                  >
                    {t('applyFilters')}
                  </Button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Show sold cars toggle - touch-friendly */}
        <div className="flex items-center gap-3 mb-6 min-h-[44px] py-2">
          <Checkbox
            id="show-sold"
            checked={showSoldCars}
            onCheckedChange={(c) => setShowSoldCars(!!c)}
            className="h-6 w-6 min-h-[24px] min-w-[24px] border-slate-300 dark:border-white/20 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
          />
          <Label htmlFor="show-sold" className="text-slate-700 dark:text-gray-300 text-base cursor-pointer font-medium touch-manipulation flex-1">{t('showSoldCars')}</Label>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-16 md:py-20 px-4">
            <p className="text-slate-600 dark:text-gray-400 mb-4 text-lg">{loadError}</p>
            <Button onClick={loadListings} className="bg-indigo-600 hover:bg-indigo-500 h-11 px-6 font-medium shadow-lg shadow-indigo-500/20">
              {t('retry')}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 md:py-20 px-4">
            <p className="text-slate-600 dark:text-gray-400 mb-4 text-lg">{t('noListings')}</p>
            <Button onClick={() => router.push(`/${locale}/sell`)} className="bg-indigo-600 hover:bg-indigo-500 h-11 px-6 font-medium shadow-lg shadow-indigo-500/20">
              {t('postFirst')}
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-slate-600 dark:text-gray-400 text-sm font-medium">
              {t('showingRange', { from: 1, to: filtered.length, total: filtered.length })}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 md:gap-4 md:gap-6">
              {filtered.map((listing) => {
                const src = firstImageUrl(listing.images)
                const coverUrl = src ? listingImageUrl(src) : null
                const sold = !!listing.is_sold

                const href = `/${locale}/buy-sell/${listing.id}`

                const card = (
                  <div
                    className={`
                      group relative backdrop-blur-sm bg-white/80 dark:bg-white/5 border-0 md:border border-slate-200 dark:border-white/10 rounded-none md:rounded-2xl overflow-hidden shadow-sm
                      transition-all duration-300 ease-out
                      ${sold
                        ? 'opacity-75 grayscale cursor-pointer hover:border-white/20'
                        : 'cursor-pointer md:hover:-translate-y-1 md:hover:scale-[1.02] md:hover:shadow-xl md:hover:shadow-indigo-500/10 md:hover:border-white/20 active:scale-[0.98]'
                      }
                    `}
                  >
                    {/* Image Container - Edge-to-edge on mobile */}
                    <div className="aspect-[4/3] relative overflow-hidden">
                      {coverUrl ? (
                        isVideoUrl(coverUrl) ? (
                          <video src={coverUrl} muted playsInline loop className="w-full h-full object-cover" />
                        ) : (
                          <img
                            src={listingImageUrl(coverUrl)}
                            alt={listing.title || `${listing.make} ${listing.model}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/cars/default-car.svg'
                                ; (e.target as HTMLImageElement).onerror = null
                            }}
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200/30 dark:from-gray-800/30 to-slate-300/30 dark:to-gray-900/30 backdrop-blur-sm text-slate-500 dark:text-gray-400 text-sm">{t('noImage')}</div>
                      )}

                      {/* Condition Badge - Top Left with Glass Style */}
                      <span
                        className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg pointer-events-none ${listing.condition === 'excellent'
                          ? 'bg-emerald-500/80 text-white'
                          : listing.condition === 'good'
                            ? 'bg-indigo-500/80 text-white'
                            : listing.condition === 'fair'
                              ? 'bg-amber-500/80 text-white'
                              : 'bg-gray-700/80 text-gray-200'
                          }`}
                      >
                        {conditionLabel(listing.condition)}
                      </span>

                      {sold && (
                        <>
                          {/* FIX: Add pointer-events-none to overlay so clicks pass through */}
                          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none" aria-hidden />
                          <span className="absolute top-3 right-3 rounded-lg px-2.5 py-1 bg-red-600/90 backdrop-blur-md border border-white/20 text-white font-bold text-xs shadow-lg pointer-events-none">SOLD</span>
                        </>
                      )}
                    </div>

                    {/* Card Content - Compact on mobile */}
                    <div className="p-4 md:p-5">
                      {/* Title & Price - Stacked tightly on mobile */}
                      <div className="mb-2">
                        <h3 className="text-slate-900 dark:text-white font-bold text-base md:text-lg truncate mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                          {listing.year} {listing.make} {listing.model}
                        </h3>
                        <p className="text-indigo-400 font-bold text-xl md:text-2xl">${Number(listing.price).toLocaleString()}</p>
                      </div>

                      {/* Details with Icons - Compact on mobile */}
                      <div className="flex flex-col gap-1.5 md:gap-2 mb-2 md:mb-3">
                        {/* Mileage */}
                        <div className="flex items-center gap-2 text-slate-600 dark:text-gray-300 text-xs md:text-sm">
                          <Gauge className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500 dark:text-gray-400 shrink-0" />
                          <span className="font-medium">{Number(listing.mileage).toLocaleString()} km</span>
                        </div>

                        {/* Location */}
                        {listing.location && (
                          <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400 text-xs md:text-sm truncate">
                            <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-500 dark:text-gray-500 shrink-0" />
                            <span className="truncate">{String(listing.location).split(',')[0]}</span>
                          </div>
                        )}
                      </div>

                      {/* Posted Time - Smaller on mobile */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-500 pt-1.5 md:pt-2 border-t border-slate-200 dark:border-white/5">
                        <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0" />
                        <span>{formatTimeAgo(listing.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )

                return (
                  <Link
                    key={listing.id}
                    href={href}
                    prefetch={true}
                    className="block"
                    onClick={() => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('[BuySell] Link clicked, navigating to:', href, 'listing.id:', listing.id)
                      }
                    }}
                  >
                    {card}
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
