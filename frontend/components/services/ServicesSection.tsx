"use client"

import { useState, useEffect, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { apiClient } from '@/lib/api'
import { motion } from 'framer-motion'
import {
  Fuel, Droplet, Wrench, Truck, ShieldCheck, Circle, Battery,
  MapPin
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ServiceDetailModal } from './ServiceDetailModal'

const ICON_MAP: Record<string, any> = {
  'fuel-pump': Fuel,
  'droplet': Droplet,
  'wrench': Wrench,
  'truck': Truck,
  'handshake': ShieldCheck, // Using ShieldCheck as alternative to Handshake
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

export function ServicesSection() {
  const t = useTranslations('home')
  const locale = useLocale()
  const [services, setServices] = useState<Service[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Removed location-based reload - we filter on frontend instead
  // This ensures all services are loaded once and filtered client-side

  const loadData = async () => {
    setLoading(true)
    try {
      console.log('🔵 [ServicesSection] Fetching services and locations...')
      const [servicesRes, locationsRes] = await Promise.all([
        apiClient.getServices({ status: 'active' }),
        apiClient.getLocations(true)
      ])
      console.log('✅ [ServicesSection] Services response:', servicesRes)
      console.log('✅ [ServicesSection] Locations response:', locationsRes)

      if (servicesRes && servicesRes.services && Array.isArray(servicesRes.services)) {
        setServices(servicesRes.services)
        console.log('✅ [ServicesSection] Set services:', servicesRes.services.length, 'items')
      } else {
        console.warn('⚠️ [ServicesSection] No services in response or invalid format:', servicesRes)
        setServices([])
      }

      if (locationsRes && locationsRes.locations) {
        setLocations(locationsRes.locations)
        console.log('✅ [ServicesSection] Set locations:', locationsRes.locations.length, 'items')
      } else {
        console.warn('⚠️ [ServicesSection] No locations in response')
        setLocations([])
      }
    } catch (error: any) {
      console.error('❌ [ServicesSection] Error loading services:', error)
      console.error('❌ [ServicesSection] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      setServices([])
      setLocations([])
    } finally {
      setLoading(false)
    }
  }

  const getServiceName = (service: Service) => {
    if (locale === 'ar' && service.name_ar) return service.name_ar
    if (locale === 'ku' && service.name_ku) return service.name_ku
    return service.name_en
  }

  const getServiceDescription = (service: Service) => {
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

  const filteredServices = useMemo(() => {
    if (selectedLocation === 'all') {
      return services
    }
    return services.filter(service =>
      service.is_all_iraq === true ||
      (service.locations && Array.isArray(service.locations) && service.locations.includes(selectedLocation))
    )
  }, [services, selectedLocation])

  console.log('🔍 [ServicesSection] Filter Debug:', {
    totalServices: services.length,
    filteredServices: filteredServices.length,
    selectedLocation
  })

  if (loading) {
    return (
      <section className="py-20 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-400">Loading services...</div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-black/50 backdrop-blur-sm relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('services.title') || 'Services Across Iraq & Kurdistan'}
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            {t('services.subtitle') || 'Professional automotive services at your location'}
          </p>
        </motion.div>


        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-400 text-lg">
              {t('services.empty') || 'No services available in this location'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service, index) => {
              const IconComponent = service.icon && ICON_MAP[service.icon]
                ? ICON_MAP[service.icon]
                : Wrench

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card
                    className="bg-[#1a1a2e] border-[#2a2a3e] hover:border-[#8b5cf6] transition-all duration-300 hover:shadow-lg hover:shadow-[#8b5cf6]/20 hover:-translate-y-2 cursor-pointer h-full group"
                    onClick={() => {
                      apiClient.trackServiceClick(service.id).catch(() => { })
                      setSelectedService(service)
                      setModalOpen(true)
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col h-full">
                        <div className="w-16 h-16 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center mb-4">
                          <IconComponent className="h-8 w-8 text-[#8b5cf6]" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                          {getServiceName(service)}
                        </h3>

                        <p className="text-gray-400 text-sm mb-4 flex-grow">
                          {getServiceDescription(service)}
                        </p>

                        <div className="text-xs text-[#8b5cf6] opacity-0 group-hover:opacity-100 transition-opacity">
                          Click for details →
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {service.is_all_iraq ? (
                            <span className="px-3 py-1 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-full text-xs text-[#a78bfa]">
                              <MapPin className="h-3 w-3 inline mr-1" />
                              {locale === 'ar' ? 'كل العراق' : locale === 'ku' ? 'هەموو عێراق' : 'All Iraq'}
                            </span>
                          ) : (
                            service.locations?.slice(0, 3).map((locId) => (
                              <span
                                key={locId}
                                className="px-3 py-1 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-full text-xs text-[#a78bfa]"
                              >
                                {getLocationName(locId)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* View All Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <Link href={`/${locale}/services`}>
            <Button className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white">
              {t('services.viewAll') || 'View All Services'}
            </Button>
          </Link>
        </motion.div>

        {/* Service Detail Modal */}
        <ServiceDetailModal
          service={selectedService}
          open={modalOpen}
          onOpenChange={setModalOpen}
          onView={() => {
            if (selectedService) {
              apiClient.trackServiceView(selectedService.id).catch(() => { })
            }
          }}
        />
      </div>
    </section>
  )
}
