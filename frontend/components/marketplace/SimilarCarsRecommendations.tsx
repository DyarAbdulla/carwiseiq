"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api'
import { formatCurrency, listingImageUrl } from '@/lib/utils'
import { Car, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'

interface SimilarCar {
  id: number
  listing_id: number
  make: string
  model: string
  year: number
  price: number
  mileage: number
  condition: string
  image_url?: string
  location_city?: string
}

interface SimilarCarsRecommendationsProps {
  listingId: number
  make: string
  model: string
  year: number
  price: number
}

export function SimilarCarsRecommendations({
  listingId,
  make,
  model,
  year,
  price,
}: SimilarCarsRecommendationsProps) {
  const router = useRouter()
  const locale = useLocale() || 'en'
  const [similarCars, setSimilarCars] = useState<SimilarCar[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    loadSimilarCars()
  }, [listingId, make, model, year, price])

  const loadSimilarCars = async () => {
    setLoading(true)
    try {
      // Search for similar cars: same make/model, different year, similar price range
      const data = await apiClient.searchListings({
        makes: make,
        models: model,
        min_year: year - 2,
        max_year: year + 2,
        min_price: price * 0.7,
        max_price: price * 1.3,
        page: 1,
        page_size: 6,
      })

      // Filter out current listing and get first 6
      const similar = (data.items || [])
        .filter((car: any) => car.id !== listingId)
        .slice(0, 6)
        .map((car: any) => ({
          id: car.id,
          listing_id: car.id,
          make: car.make,
          model: car.model,
          year: car.year,
          price: car.price,
          mileage: car.mileage,
          condition: car.condition,
          image_url: car.images?.[0]?.url,
          location_city: car.location_city,
        }))

      setSimilarCars(similar)
    } catch (error) {
      console.error('Error loading similar cars:', error)
    } finally {
      setLoading(false)
    }
  }

  const visibleCars = similarCars.slice(currentIndex, currentIndex + 4)
  const canScrollLeft = currentIndex > 0
  const canScrollRight = currentIndex + 4 < similarCars.length

  if (loading) {
    return (
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5B7FFF] mx-auto"></div>
        </CardContent>
      </Card>
    )
  }

  if (similarCars.length === 0) {
    return null
  }

  return (
    <Card className="border-[#2a2d3a] bg-[#1a1d29]">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Similar Cars</h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={!canScrollLeft}
              className="text-white hover:bg-[#2a2d3a]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentIndex(Math.min(similarCars.length - 4, currentIndex + 1))}
              disabled={!canScrollRight}
              className="text-white hover:bg-[#2a2d3a]"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleCars.map((car, index) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className="border-[#2a2d3a] bg-[#1a1d29] hover:border-[#5B7FFF]/50 transition-all cursor-pointer"
                onClick={() => router.push(`/${locale}/buy-sell/${car.listing_id}`)}
              >
                <div className="relative h-32 bg-gradient-to-br from-[#5B7FFF]/20 to-[#8B5CF6]/20">
                  {car.image_url ? (
                    <Image
                      src={listingImageUrl(car.image_url)}
                      alt={`${car.make} ${car.model} ${car.year}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" aria-label={`${car.make} ${car.model}`}>
                      <Car className="h-12 w-12 text-white/50" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h4 className="text-sm font-semibold text-white truncate">
                    {car.make} {car.model}
                  </h4>
                  <p className="text-xs text-[#94a3b8] mb-2">
                    {car.year} • {car.mileage.toLocaleString()} km
                  </p>
                  <p className="text-lg font-bold text-[#5B7FFF]">
                    {formatCurrency(car.price)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
