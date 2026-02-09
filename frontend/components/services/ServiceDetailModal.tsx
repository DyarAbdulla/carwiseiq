"use client"

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  X, Phone, Mail, Globe, MapPin, Clock, DollarSign, Star,
  ChevronLeft, ChevronRight, MessageCircle, ExternalLink, Image as ImageIcon,
  Building2, Search
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { apiClient } from '@/lib/api'

interface ServiceDetailModalProps {
  service: any | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onView?: () => void
}

export function ServiceDetailModal({ service, open, onOpenChange, onView }: ServiceDetailModalProps) {
  // ALL HOOKS MUST BE CALLED FIRST, BEFORE ANY CONDITIONAL LOGIC OR RETURNS
  const locale = useLocale()
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const [providers, setProviders] = useState<any[]>([])
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [locations, setLocations] = useState<any[]>([])

  // Filter providers - MUST be at top level, BEFORE any conditional returns
  const filteredProviders = useMemo(() => {
    if (!providers || providers.length === 0) {
      return []
    }

    console.log('🔍 [ServiceDetailModal] Filtering providers:', {
      totalProviders: providers.length,
      selectedLocation,
      searchQuery: searchQuery || '(empty)'
    })

    const filtered = providers.filter(provider => {
      if (!provider) return false

      const matchesLocation = selectedLocation === 'all' ||
        provider.is_all_iraq === true ||
        (provider.locations && Array.isArray(provider.locations) && provider.locations.includes(selectedLocation))

      const searchLower = searchQuery.toLowerCase().trim()
      const matchesSearch = !searchLower ||
        provider.provider_name?.toLowerCase().includes(searchLower) ||
        provider.provider_address?.toLowerCase().includes(searchLower)

      return matchesLocation && matchesSearch
    })

    console.log(`✅ [ServiceDetailModal] Filtered to ${filtered.length} providers`)
    return filtered
  }, [providers, selectedLocation, searchQuery])

  // Track service view
  useEffect(() => {
    if (service && open && onView) {
      onView()
    }
  }, [service, open, onView])

  // Load locations when modal opens
  useEffect(() => {
    if (open) {
      const loadLocations = async () => {
        try {
          const res = await apiClient.getServiceLocations(true)
          if (res && res.locations) {
            setLocations(res.locations)
          }
        } catch (error) {
          console.error('Error loading locations:', error)
        }
      }
      loadLocations()
    }
  }, [open])

  // Reset state and load providers when modal opens or location changes
  useEffect(() => {
    if (open && service?.id) {
      setCurrentImageIndex(0)
      setSelectedProvider(null)
      setSearchQuery('')
      setProviders([])

      const loadProviders = async () => {
        setLoading(true)
        try {
          console.log('🔵 [ServiceDetailModal] Loading providers for service:', service.id)
          const res = await apiClient.getServiceProviders(service.id, {
            location_id: selectedLocation === 'all' ? undefined : selectedLocation,
            status: 'active'
          })
          console.log('✅ [ServiceDetailModal] Providers loaded:', res)

          if (res && res.providers && Array.isArray(res.providers)) {
            setProviders(res.providers)
            console.log(`✅ [ServiceDetailModal] Found ${res.providers.length} providers`)
          } else {
            console.warn('⚠️ [ServiceDetailModal] No providers in response')
            setProviders([])
          }
        } catch (error) {
          console.error('❌ [ServiceDetailModal] Error loading providers:', error)
          setProviders([])
        } finally {
          setLoading(false)
        }
      }
      loadProviders()
    }
  }, [selectedLocation, open, service?.id])

  // Early return AFTER all hooks
  if (!service) return null

  const getServiceName = () => {
    if (locale === 'ar' && service.name_ar) return service.name_ar
    if (locale === 'ku' && service.name_ku) return service.name_ku
    return service.name_en
  }

  const getServiceDescription = () => {
    if (locale === 'ar' && service.description_ar) return service.description_ar
    if (locale === 'ku' && service.description_ku) return service.description_ku
    return service.description_en
  }

  const getLocationName = (locId: string) => {
    const loc = locations.find(l => l.id === locId)
    if (!loc) return locId
    if (locale === 'ar' && loc.name_ar) return loc.name_ar
    if (locale === 'ku' && loc.name_ku) return loc.name_ku
    return loc.name_en
  }

  const handleCall = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone.replace(/\s+/g, '')}`
    }
  }

  const handleWhatsApp = (whatsapp: string, phone?: string) => {
    const number = whatsapp || phone
    if (number) {
      const cleanNumber = number.replace(/\s+/g, '').replace(/\+/g, '')
      window.open(`https://wa.me/${cleanNumber}`, '_blank')
    }
  }

  const handleGetDirections = (provider: any) => {
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

  const handleVisitWebsite = (website: string) => {
    if (website) {
      let url = website
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`
      }
      window.open(url, '_blank')
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
        <span className="ml-1 text-sm text-gray-300">{rating.toFixed(1)}/5</span>
      </div>
    )
  }

  const renderProviderCard = (provider: any, index: number) => {
    return (
      <motion.div
        key={provider.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5 hover:border-indigo-500/50 transition-all cursor-pointer hover:shadow-lg hover:shadow-indigo-500/20 hover:-translate-y-1 shadow-sm"
        onClick={() => setSelectedProvider(provider)}
      >
        <div className="space-y-3">
          {/* Header with logo and name */}
          <div className="flex items-start gap-3">
            {provider.provider_logo ? (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border border-indigo-500/30 flex items-center justify-center overflow-hidden shrink-0">
                <Image
                  src={provider.provider_logo}
                  alt={provider.provider_name}
                  width={56}
                  height={56}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Building2 className="h-7 w-7 text-indigo-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{provider.provider_name}</h4>
              {provider.rating ? (
                <div className="flex items-center gap-2">
                  {renderStars(provider.rating)}
                  {provider.review_count > 0 && (
                    <span className="text-xs text-slate-600 dark:text-gray-400">({provider.review_count} reviews)</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-gray-600 text-gray-600" />
                  ))}
                  <span className="text-xs text-gray-500 ml-1">No ratings yet</span>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {provider.provider_address && (
            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-400">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-[#8b5cf6]" />
              <span>{provider.provider_address}</span>
            </div>
          )}

          {/* Price Range */}
          {provider.price_range && (
            <div className="flex items-center gap-2 text-sm text-[#8b5cf6] font-medium">
              <DollarSign className="h-4 w-4" />
              <span>{provider.price_range}</span>
            </div>
          )}

          {/* Working Hours */}
          {provider.working_hours && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{provider.working_hours}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-[#2a2a3e]">
            {provider.provider_phone && (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCall(provider.provider_phone)
                }}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
              >
                <Phone className="h-3 w-3 mr-1" />
                Call
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedProvider(provider)
              }}
              className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/20 text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              View Details →
            </Button>
          </div>
        </div>
      </motion.div>
    )
  }

  const renderProviderDetails = (provider: any) => {
    const galleryImages = provider.gallery_images && Array.isArray(provider.gallery_images)
      ? provider.gallery_images
      : (typeof provider.gallery_images === 'string'
        ? (() => {
          try {
            return JSON.parse(provider.gallery_images)
          } catch {
            return []
          }
        })()
        : [])

    return (
      <div className="space-y-6">
        {/* Large Colorful Header */}
        <div className="relative -m-6 mb-6 p-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-t-lg">
          <button
            onClick={() => setSelectedProvider(null)}
            className="absolute top-4 left-4 p-2 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors backdrop-blur-sm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-4">
            {provider.provider_logo ? (
              <div className="w-20 h-20 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden border-2 border-white/30">
                <Image
                  src={provider.provider_logo}
                  alt={provider.provider_name}
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                <Building2 className="h-10 w-10 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{provider.provider_name}</h2>
              {provider.rating && (
                <div className="flex items-center gap-2">
                  {renderStars(provider.rating)}
                  {provider.review_count && (
                    <span className="text-sm text-white/80">({provider.review_count} reviews)</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gallery */}
        {galleryImages.length > 0 && (
          <div className="relative h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 backdrop-blur-xl bg-white/80 dark:bg-white/5">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImageIndex}
                src={galleryImages[currentImageIndex]}
                alt={`Gallery ${currentImageIndex + 1}`}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                >
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Desktop: Two Column Layout | Mobile: Stacked */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Contact Info & Hours */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="h-5 w-5 text-indigo-400" />
                <span>Contact Information</span>
              </h3>
              <div className="space-y-2">
                {provider.provider_phone && (
                  <div className="p-4 backdrop-blur-xl bg-white/80 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <Phone className="h-5 w-5 text-indigo-400" />
                      <span className="text-slate-700 dark:text-gray-300 font-medium">{provider.provider_phone}</span>
                    </div>
                  </div>
                )}
                {provider.provider_email && (
                  <div className="p-4 backdrop-blur-xl bg-white/80 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="h-5 w-5 text-indigo-400" />
                      <a href={`mailto:${provider.provider_email}`} className="text-slate-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                        {provider.provider_email}
                      </a>
                    </div>
                  </div>
                )}
                {(provider.provider_whatsapp || provider.provider_phone) && (
                  <div className="p-4 backdrop-blur-xl bg-white/80 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <MessageCircle className="h-5 w-5 text-green-400" />
                      <span className="text-gray-300 font-medium">{provider.provider_whatsapp || provider.provider_phone}</span>
                    </div>
                  </div>
                )}
                {provider.provider_website && (
                  <div className="p-4 backdrop-blur-xl bg-white/80 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                      <Globe className="h-5 w-5 text-indigo-400" />
                      <a href={provider.provider_website} target="_blank" rel="noopener noreferrer" className="text-slate-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                        {provider.provider_website}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Working Hours & Price */}
            {provider.working_hours && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-400" />
                  <span>Working Hours</span>
                </h3>
                <div className="p-4 backdrop-blur-xl bg-white/5 rounded-xl border border-white/10">
                  <p className="text-gray-300">{provider.working_hours}</p>
                </div>
              </div>
            )}
            {provider.price_range && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-indigo-400" />
                  <span>Price Range</span>
                </h3>
                <div className="p-4 backdrop-blur-xl bg-white/5 rounded-xl border border-white/10">
                  <p className="text-gray-300 font-medium">{provider.price_range}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Map */}
          {provider.provider_address && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-400" />
                <span>Location</span>
              </h3>
              <div className="p-4 backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 mb-3">
                <p className="text-gray-300">{provider.provider_address}</p>
              </div>
              {provider.map_latitude && provider.map_longitude && (
                <div className="relative h-64 md:h-full min-h-[300px] rounded-xl overflow-hidden border border-white/10">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${provider.map_latitude},${provider.map_longitude}&z=15&output=embed`}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full-Width Gradient Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/10">
          {provider.provider_phone && (
            <Button
              onClick={() => handleCall(provider.provider_phone)}
              className="flex-1 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30"
            >
              <Phone className="h-5 w-5 mr-2" />
              Call Now
            </Button>
          )}
          {(provider.provider_whatsapp || provider.provider_phone) && (
            <Button
              onClick={() => handleWhatsApp(provider.provider_whatsapp, provider.provider_phone)}
              className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/30"
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              WhatsApp
            </Button>
          )}
          {((provider.map_latitude && provider.map_longitude) || provider.provider_address) && (
            <Button
              onClick={() => handleGetDirections(provider)}
              className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30"
            >
              <MapPin className="h-5 w-5 mr-2" />
              Get Directions
            </Button>
          )}
          {provider.provider_website && (
            <Button
              onClick={() => handleVisitWebsite(provider.provider_website)}
              className="flex-1 h-12 backdrop-blur-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white font-semibold rounded-xl"
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              Visit Website
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Mobile: Use Sheet (Bottom Sheet)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-0 backdrop-blur-xl bg-black/95 border-t border-white/10">
          <SheetHeader className="sr-only">
            <SheetTitle>{service ? getServiceName() : 'Service Details'}</SheetTitle>
            <SheetDescription>{service ? getServiceDescription() : ''}</SheetDescription>
          </SheetHeader>
          <div className="relative">
            {/* Service Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold text-white mb-1">{getServiceName()}</h2>
              <p className="text-white/80 text-sm">{getServiceDescription()}</p>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading providers...</div>
            ) : selectedProvider ? (
              // User clicked "View Details" on a provider - show full details
              <div className="p-6">
                {renderProviderDetails(selectedProvider)}
              </div>
            ) : filteredProviders.length === 0 ? (
              // No providers found
              <div className="p-6 text-center">
                <Building2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Providers Available</h3>
                <p className="text-gray-400">There are no providers available for this service yet.</p>
              </div>
            ) : filteredProviders.length === 1 ? (
              // Only one provider - show details directly (no need to show list)
              <div className="p-6">
                {renderProviderDetails(filteredProviders[0])}
              </div>
            ) : (
              // Multiple providers (2+) - show LIST of providers
              <div className="p-6 space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                    <SelectTrigger className="flex-1 h-12 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 text-white">
                      <MapPin className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="All Locations" />
                    </SelectTrigger>
                    <SelectContent className="backdrop-blur-xl bg-black/80 border border-white/10">
                      <SelectItem value="all">All Locations</SelectItem>
                      {locations.filter(l => l.id !== 'all').map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {getLocationName(loc.id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                    <Input
                      placeholder="Search providers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 pl-10 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div className="text-sm text-gray-400 font-medium">
                  {filteredProviders.length} {filteredProviders.length === 1 ? 'provider' : 'providers'} found
                </div>

                {/* Provider List - Only show when 2+ providers */}
                <div className="space-y-3">
                  {filteredProviders.map((provider, index) => renderProviderCard(provider, index))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Desktop: Use Dialog (Center Modal)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-black/95 border border-white/10 max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{service ? getServiceName() : 'Service Details'}</DialogTitle>
          <DialogDescription>{service ? getServiceDescription() : ''}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          {/* Service Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 rounded-t-lg">
            <h2 className="text-3xl font-bold text-white mb-2">{getServiceName()}</h2>
            <p className="text-white/80 text-base">{getServiceDescription()}</p>
          </div>

          {loading ? (
            <div className="p-6 text-center text-gray-400">Loading providers...</div>
          ) : selectedProvider ? (
            // User clicked "View Details" on a provider - show full details
            <div className="p-6">
              {renderProviderDetails(selectedProvider)}
            </div>
          ) : filteredProviders.length === 0 ? (
            // No providers found
            <div className="p-6 text-center">
              <Building2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Providers Available</h3>
              <p className="text-gray-400">There are no providers available for this service yet.</p>
            </div>
          ) : filteredProviders.length === 1 ? (
            // Only one provider - show details directly (no need to show list)
            <div className="p-6">
              {renderProviderDetails(filteredProviders[0])}
            </div>
          ) : (
            // Multiple providers (2+) - show LIST of providers
            <div className="p-6 space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="flex-1 h-12 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 text-white">
                    <MapPin className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent className="backdrop-blur-xl bg-black/80 border border-white/10">
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.filter(l => l.id !== 'all').map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {getLocationName(loc.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Input
                    placeholder="Search providers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 pl-10 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="text-sm text-gray-400 font-medium">
                {filteredProviders.length} {filteredProviders.length === 1 ? 'provider' : 'providers'} found
              </div>

              {/* Provider List - Only show when 2+ providers */}
              <div className="space-y-3">
                {filteredProviders.map((provider, index) => renderProviderCard(provider, index))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
