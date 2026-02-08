"use client"
import { useState, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fuel, Droplet, Wrench, Truck, ShieldCheck, Circle, Battery,
  MapPin, Search, Phone, Building2, Star, ChevronRight, X,
  Rocket, Mail, Home, Sparkles
} from 'lucide-react'

const ICON_MAP: Record<string, any> = {
  'fuel-pump': Fuel,
  'droplet': Droplet,
  'wrench': Wrench,
  'truck': Truck,
  'handshake': ShieldCheck,
  'circle': Circle,
  'battery': Battery,
}

interface Service {
  id: string
  name_en: string
  name_ar?: string
  name_ku?: string
  description_en: string
  description_ar?: string
  description_ku?: string
  icon?: string
  locations?: string[]
  is_all_iraq?: boolean
}

interface Provider {
  id: string
  service_id: string
  provider_name: string
  provider_logo?: string
  provider_phone?: string
  provider_email?: string
  provider_address?: string
  provider_whatsapp?: string
  map_latitude?: number
  map_longitude?: number
  working_hours?: string
  price_range?: string
  rating?: number
  review_count?: number
  is_all_iraq?: boolean
  locations?: string[]
}

export default function ServicesPage() {
  const t = useTranslations('home')
  const tCommon = useTranslations('common')
  const tListing = useTranslations('listing')
  const locale = useLocale()
  const { toast } = useToast()
  const [showComingSoon, setShowComingSoon] = useState(true)
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<string>('all')

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      loadProviders(selectedCategory)
    } else {
      setProviders([])
    }
  }, [selectedCategory])

  const loadData = async () => {
    setLoading(true)
    try {
      const [servicesRes, locationsRes] = await Promise.all([
        apiClient.getServices({ status: 'active' }),
        apiClient.getLocations(true)
      ])

      if (servicesRes && servicesRes.services && Array.isArray(servicesRes.services)) {
        setServices(servicesRes.services)
        // Auto-select first category
        if (servicesRes.services.length > 0) {
          setSelectedCategory(servicesRes.services[0].id)
        }
      } else {
        setServices([])
      }

      if (locationsRes && locationsRes.locations) {
        setLocations(locationsRes.locations)
      } else {
        setLocations([])
      }
    } catch (error: any) {
      console.error('❌ [ServicesPage] Error loading services:', error)
      toast({
        title: tCommon('error'),
        description: error.message || t('services.failedLoadServices'),
        variant: 'destructive',
      })
      setServices([])
      setLocations([])
    } finally {
      setLoading(false)
    }
  }

  const loadProviders = async (serviceId: string) => {
    setLoadingProviders(true)
    try {
      const res = await apiClient.getServiceProviders(serviceId, { status: 'active' })
      if (res && res.providers && Array.isArray(res.providers)) {
        setProviders(res.providers)
      } else {
        setProviders([])
      }
    } catch (error: any) {
      console.error('❌ [ServicesPage] Error loading providers:', error)
      setProviders([])
    } finally {
      setLoadingProviders(false)
    }
  }

  const getServiceName = (service: Service) => {
    if (locale === 'ar' && service.name_ar) return service.name_ar
    if (locale === 'ku' && service.name_ku) return service.name_ku
    return service.name_en
  }

  const getLocationName = (locId: string) => {
    const loc = locations.find(l => l.id === locId)
    if (!loc) return locId
    if (locale === 'ar' && loc.name_ar) return loc.name_ar
    if (locale === 'ku' && loc.name_ku) return loc.name_ku
    return loc.name_en
  }

  const filteredProviders = useMemo(() => {
    let filtered = providers

    // Location filter
    if (selectedLocation !== 'all') {
      filtered = filtered.filter(provider => {
        return provider.is_all_iraq === true ||
          (provider.locations && Array.isArray(provider.locations) && provider.locations.includes(selectedLocation))
      })
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(provider => {
        return provider.provider_name?.toLowerCase().includes(query) ||
          provider.provider_address?.toLowerCase().includes(query)
      })
    }

    return filtered
  }, [providers, searchQuery, selectedLocation])

  const handleCall = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone.replace(/\s+/g, '')}`
    }
  }

  const handleGetDirections = (provider: Provider) => {
    if (provider.map_latitude && provider.map_longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${provider.map_latitude},${provider.map_longitude}`,
        '_blank'
      )
    } else if (provider.provider_address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(provider.provider_address)}`,
        '_blank'
      )
    }
  }

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

    return (
      <div className="flex items-center gap-1">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        ))}
        {hasHalfStar && (
          <div className="relative h-4 w-4">
            <Star className="h-4 w-4 fill-gray-600 text-gray-600" />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-gray-600 text-gray-600" />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black/50 backdrop-blur-sm py-20">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">{t('services.loadingServices')}</div>
        </div>
      </div>
    )
  }

  const selectedService = services.find(s => s.id === selectedCategory)

  const handleNotifyMe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast({
        title: tCommon('emailRequired'),
        description: tCommon('emailRequiredDesc'),
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    // Simulate API call - replace with actual backend integration
    setTimeout(() => {
      toast({
        title: tCommon('notifySuccess'),
        description: tCommon('notifySuccessDesc'),
      })
      setEmail('')
      setIsSubmitting(false)
    }, 1000)
  }

  // Show Coming Soon message by default
  if (showComingSoon) {
    return (
      <div className="relative min-h-screen overflow-hidden py-8 md:py-12 flex items-center justify-center">
        {/* Layer 1: Base dark gradient */}
        <div
          className="fixed inset-0 -z-20"
          style={{
            background: 'linear-gradient(160deg, #0f172a 0%, #1E293B 35%, #1E293B 70%, #0f172a 100%)',
          }}
        />
        {/* Layer 2: Animated gradient blobs (purple/blue) */}
        <div
          className="coming-soon-bg-animate fixed -z-10 inset-0 opacity-70"
          style={{
            animation: 'coming-soon-gradient-shift 18s ease-in-out infinite',
          }}
          aria-hidden
        >
          <div
            className="coming-soon-blob absolute w-[80vmax] h-[80vmax] rounded-full blur-[120px] -top-[30vmax] -left-[20vmax]"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, transparent 60%)',
              animation: 'coming-soon-blob-float 12s ease-in-out infinite',
            }}
          />
          <div
            className="coming-soon-blob absolute w-[70vmax] h-[70vmax] rounded-full blur-[100px] -bottom-[25vmax] -right-[15vmax]"
            style={{
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 60%)',
              animation: 'coming-soon-blob-float 14s ease-in-out infinite 1s',
            }}
          />
          <div
            className="coming-soon-blob absolute w-[50vmax] h-[50vmax] rounded-full blur-[80px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
              animation: 'coming-soon-blob-float 16s ease-in-out infinite 0.5s',
            }}
          />
        </div>
        {/* Layer 3: Subtle dot pattern overlay */}
        <div
          className="fixed inset-0 -z-[5] opacity-40"
          style={{
            backgroundImage: 'radial-gradient(rgba(139, 92, 246, 0.2) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />
        {/* Layer 4: Soft vignette for depth */}
        <div
          className="fixed inset-0 -z-[5] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(15, 23, 42, 0.5) 100%)',
          }}
          aria-hidden
        />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl flex items-center justify-center relative z-10">
          {/* Glass Card Container with Glow */}
          <div className="relative">
            {/* Card glow - purple accent */}
            <div
              className="absolute -inset-8 rounded-full opacity-60 blur-3xl -z-10"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
              }}
            />

            {/* Glass Card - Premium Container */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="backdrop-blur-2xl bg-slate-900/80 border border-white/10 rounded-3xl p-12 shadow-2xl relative overflow-hidden max-w-lg w-full"
            >
              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Large Icon with Float Animation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mb-8"
                >
                  <motion.div
                    animate={{
                      y: [0, -12, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="flex items-center justify-center"
                  >
                    <Sparkles className="w-20 h-20 text-[#8B5CF6]" />
                  </motion.div>
                </motion.div>

                {/* Main Title - Large Gradient Text (Kurdish) */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] via-indigo-400 to-[#3B82F6] mb-4"
                >
                  {tCommon('comingSoonTitle')}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-slate-400 text-center mb-8 text-base leading-relaxed"
                >
                  {t('services.comingSoonSubtitle')}
                </motion.p>

                {/* Email Input + Notify Button - Pill-shaped Container */}
                <motion.form
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  onSubmit={handleNotifyMe}
                  className="w-full"
                >
                  <div className="rounded-full bg-white/5 border border-white/10 p-1 flex flex-col sm:flex-row items-center gap-2">
                    {/* Email Input */}
                    <div className="relative flex-1 w-full sm:w-auto">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-500 z-10" />
                      <Input
                        type="email"
                        placeholder={tCommon('notifyMePlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 pl-12 pr-4 bg-transparent border-none focus:ring-0 text-white placeholder:text-slate-500 rounded-full w-full"
                        disabled={isSubmitting}
                      />
                    </div>
                    {/* Notify Button */}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full px-6 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] hover:from-[#9d6cf7] hover:to-[#4d92f7] text-white font-semibold h-11 whitespace-nowrap transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? tCommon('submitting') : tCommon('notifyMe')}
                    </Button>
                  </div>
                </motion.form>

                {/* Return Home Link */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="mt-6"
                >
                  <Link
                    href={`/${locale}`}
                    className="text-sm text-slate-500 hover:text-white transition-colors duration-300"
                  >
                    {tCommon('returnHome')}
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent py-8 md:py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl bg-transparent">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 md:mb-12 relative"
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-full max-w-2xl h-32 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-full opacity-50" />
          </div>
          <div className="flex items-center justify-center gap-4 mb-4 relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white">
              {t('services.title') || t('services.servicesDirectory')}
            </h1>
            <Button
              onClick={() => setShowComingSoon(true)}
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label={tCommon('comingSoonTitle')}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-lg text-slate-600 dark:text-gray-300 max-w-2xl mx-auto relative z-10">
            {t('services.subtitle') || t('services.findProviders')}
          </p>
        </motion.div>

        {/* Filter Bar - Search + Location */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 md:mb-8"
        >
          <div className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-gray-400 z-10 rtl:left-auto rtl:right-5" />
              <Input
                placeholder={t('services.searchCompanies')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 pr-4 rounded-full backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-gray-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-start rtl:pl-4 rtl:pr-12"
              />
            </div>

            {/* Location Filter */}
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="h-12 w-full sm:w-64 rounded-full backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                <MapPin className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder={t('services.allLocations')} />
              </SelectTrigger>
              <SelectContent className="backdrop-blur-xl bg-white/98 dark:bg-black/80 border border-slate-200 dark:border-white/10">
                <SelectItem value="all">
                  {t('services.allIraq')}
                </SelectItem>
                {locations.filter(l => l.id !== 'all').map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {getLocationName(loc.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Split View Layout - Transparent Container */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 bg-transparent">
          {/* Desktop: Left Sidebar | Mobile: Horizontal Scrollable Tabs */}
          <div className="lg:w-1/4">
            {/* Mobile: Horizontal Scrollable Tabs - Instagram Stories Style - Sticky */}
            <div className="lg:hidden sticky top-0 z-10 bg-black/30 backdrop-blur-md pb-2 -mx-4 px-4 mb-4 pt-2">
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-3 min-w-max">
                  {services.map((service) => {
                    const IconComponent = service.icon && ICON_MAP[service.icon]
                      ? ICON_MAP[service.icon]
                      : Wrench
                    const isActive = selectedCategory === service.id

                    return (
                      <button
                        key={service.id}
                        onClick={() => setSelectedCategory(service.id)}
                        className={`
                        flex items-center gap-2 px-5 py-3 rounded-full backdrop-blur-xl border transition-all whitespace-nowrap
                        ${isActive
                            ? 'bg-indigo-100 dark:bg-indigo-600/20 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 shadow-lg shadow-indigo-500/10'
                            : 'bg-white/80 dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/20'
                          }
                      `}
                      >
                        <IconComponent className="h-4 w-4" />
                        <span className="font-medium text-sm">{getServiceName(service)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Desktop: Vertical Glass Menu - Transparent Container */}
            <div className="hidden lg:block space-y-3">
              {services.map((service) => {
                const IconComponent = service.icon && ICON_MAP[service.icon]
                  ? ICON_MAP[service.icon]
                  : Wrench
                const isActive = selectedCategory === service.id

                return (
                  <motion.button
                    key={service.id}
                    onClick={() => setSelectedCategory(service.id)}
                    whileHover={{ x: 4 }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-4 rounded-full backdrop-blur-xl border transition-all text-start
                      ${isActive
                        ? 'bg-indigo-100 dark:bg-indigo-600/20 border-indigo-300 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 shadow-lg shadow-indigo-500/10'
                        : 'bg-white/80 dark:bg-transparent border-slate-200 dark:border-transparent text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/10'
                      }
                    `}
                  >
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0
                      ${isActive
                        ? 'bg-indigo-200 dark:bg-indigo-500/20 border border-indigo-300 dark:border-indigo-500/30'
                        : 'bg-slate-100 dark:bg-transparent border border-slate-200 dark:border-white/10'
                      }
                    `}>
                      <IconComponent className={`h-5 w-5 ${isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{getServiceName(service)}</div>
                      {isActive && (
                        <div className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">
                          {loadingProviders ? tCommon('loading') : `${providers.length} ${providers.length === 1 ? t('services.company') : t('services.companies')}`}
                        </div>
                      )}
                    </div>
                    {isActive && <ChevronRight className="h-5 w-5 text-indigo-600 dark:text-indigo-300 shrink-0 rtl:rotate-180" />}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Right Column: Company Cards Grid - Transparent Container */}
          <div className="lg:w-3/4 bg-transparent">
            {loadingProviders ? (
              <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                {t('services.loadingCompanies')}
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 text-slate-400 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {(searchQuery || selectedLocation !== 'all') ? t('services.noCompaniesFound') : t('services.noCompaniesAvailable')}
                </h3>
                <p className="text-gray-400">
                  {searchQuery || selectedLocation !== 'all'
                    ? `${t('services.noCompaniesMatchFilters')}${searchQuery ? ` "${searchQuery}"` : ''}${selectedLocation !== 'all' ? ` ${getLocationName(selectedLocation)}` : ''}`
                    : selectedService
                      ? t('services.noCompaniesForService', { service: getServiceName(selectedService) })
                      : t('services.selectCategory')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-transparent">
                <AnimatePresence mode="wait">
                  {filteredProviders.map((provider, index) => (
                    <motion.div
                      key={provider.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl hover:border-indigo-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/20 hover:-translate-y-1 h-full">
                        <CardContent className="p-6">
                          <div className="flex flex-col h-full">
                            {/* Header: Logo + Name */}
                            <div className="flex items-start gap-4 mb-4">
                              {provider.provider_logo ? (
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border border-indigo-500/30 flex items-center justify-center overflow-hidden shrink-0">
                                  <img
                                    src={provider.provider_logo}
                                    alt={provider.provider_name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border border-indigo-500/30 flex items-center justify-center shrink-0">
                                  <Building2 className="h-8 w-8 text-indigo-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-white mb-1 truncate">
                                  {provider.provider_name}
                                </h3>
                                {provider.rating && (
                                  <div className="flex items-center gap-2">
                                    {renderStars(provider.rating)}
                                    {provider.review_count && (
                                      <span className="text-xs text-gray-400">
                                        ({provider.review_count})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Body: Badge, Location, Phone */}
                            <div className="space-y-3 mb-4 flex-grow">
                              {/* Authorized Dealer Badge */}
                              <div className="flex flex-wrap gap-2">
                                <span className="px-3 py-1 backdrop-blur-sm bg-indigo-500/10 border border-indigo-500/30 rounded-full text-xs text-indigo-300 font-medium">
                                  {t('services.authorizedDealer')}
                                </span>
                                {provider.is_all_iraq ? (
                                  <span className="px-3 py-1 backdrop-blur-sm bg-purple-500/10 border border-purple-500/30 rounded-full text-xs text-purple-300">
                                    <MapPin className="h-3 w-3 inline mr-1" />
                                    {t('services.allIraq')}
                                  </span>
                                ) : provider.locations && provider.locations.length > 0 ? (
                                  provider.locations.slice(0, 2).map((locId) => (
                                    <span
                                      key={locId}
                                      className="px-3 py-1 backdrop-blur-sm bg-purple-500/10 border border-purple-500/30 rounded-full text-xs text-purple-300"
                                    >
                                      <MapPin className="h-3 w-3 inline mr-1" />
                                      {getLocationName(locId)}
                                    </span>
                                  ))
                                ) : null}
                              </div>

                              {/* Location */}
                              {provider.provider_address && (
                                <div className="flex items-start gap-2 text-sm text-gray-300">
                                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-indigo-400" />
                                  <span className="line-clamp-2">{provider.provider_address}</span>
                                </div>
                              )}

                              {/* Phone */}
                              {provider.provider_phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-300">
                                  <Phone className="h-4 w-4 shrink-0 text-indigo-400" />
                                  <span>{provider.provider_phone}</span>
                                </div>
                              )}

                              {/* Working Hours */}
                              {provider.working_hours && (
                                <div className="text-xs text-gray-400">
                                  ⏰ {provider.working_hours}
                                </div>
                              )}
                            </div>

                            {/* Footer: Action Buttons */}
                            <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                              {provider.provider_phone && (
                                <Button
                                  onClick={() => handleCall(provider.provider_phone!)}
                                  className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/30"
                                >
                                  <Phone className="h-4 w-4 mr-2" />
                                  {tListing('callNow')}
                                </Button>
                              )}
                              <Button
                                onClick={() => handleGetDirections(provider)}
                                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30"
                              >
                                <MapPin className="h-4 w-4 mr-2" />
                                {tListing('getLocation')}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
