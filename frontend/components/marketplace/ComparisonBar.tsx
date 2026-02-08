"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X, GitCompare, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import Image from 'next/image'

interface ComparisonCar {
  id: number
  listing_id?: number
  make: string
  model: string
  year: number
  price: number
  mileage: number
  image_url?: string
  condition?: string
  fuel_type?: string
}

interface ComparisonBarProps {
  selectedCars: ComparisonCar[]
  onRemove: (id: number) => void
  onClear: () => void
}

export function ComparisonBar({ selectedCars, onRemove, onClear }: ComparisonBarProps) {
  const router = useRouter()
  const locale = useLocale() || 'en'
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(selectedCars.length > 0)
  }, [selectedCars.length])

  if (!isVisible || selectedCars.length === 0) return null

  const handleCompare = () => {
    const ids = selectedCars
      .map(car => car.listing_id || car.id)
      .filter(id => id !== undefined && id !== null)
      .join(',')
    
    if (ids && selectedCars.length >= 2) {
      router.push(`/${locale}/compare?ids=${ids}`)
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-[#1a1d29] via-[#2a2d3a] to-[#1a1d29] border-t border-[#5B7FFF]/30 shadow-2xl"
        >
          <div className="container mx-auto max-w-7xl">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Selected Cars Mini Cards */}
              <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {selectedCars.slice(0, 3).map((car) => (
                  <Card
                    key={car.id}
                    className="flex-shrink-0 w-32 sm:w-40 bg-[#1a1d29] border-[#2a2d3a] hover:border-[#5B7FFF]/50 transition-all"
                  >
                    <div className="relative">
                      <div className="relative h-20 bg-gradient-to-br from-[#5B7FFF]/20 to-[#8B5CF6]/20">
                        {car.image_url ? (
                          <Image
                            src={car.image_url}
                            alt={`${car.make} ${car.model} ${car.year}`}
                            fill
                            className="object-cover"
                            sizes="160px"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/50 text-xs" aria-label={`${car.make} ${car.model}`}>
                            {car.make}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-8 w-8 bg-black/50 hover:bg-red-500/50 text-white"
                          onClick={() => onRemove(car.id)}
                          aria-label={`Remove ${car.make} ${car.model} from comparison`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-semibold text-white truncate">
                          {car.make} {car.model}
                        </div>
                        <div className="text-xs text-[#5B7FFF] font-bold">
                          {formatCurrency(car.price)}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                {selectedCars.length > 3 && (
                  <div className="flex-shrink-0 w-32 sm:w-40 flex items-center justify-center text-white/50 text-sm">
                    +{selectedCars.length - 3} more
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCompare}
                  disabled={selectedCars.length < 2}
                  className="bg-gradient-to-r from-[#5B7FFF] to-[#8B5CF6] hover:from-[#5B7FFF]/90 hover:to-[#8B5CF6]/90 text-white min-h-[44px]"
                  aria-label={`Compare ${selectedCars.length} cars`}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare ({selectedCars.length})
                </Button>
                <Button
                  onClick={onClear}
                  variant="outline"
                  className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-white min-h-[44px]"
                  aria-label="Clear all selected cars"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
