"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { ExternalLink, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import type { SimilarCar } from '@/lib/types'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { SimilarCarsDialog } from './SimilarCarsDialog'

interface SimilarCarsPreviewProps {
  cars: SimilarCar[]
}

export function SimilarCarsPreview({ cars }: SimilarCarsPreviewProps) {
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const validCars = cars.filter(car => car.price > 0)
  const previewCars = validCars.slice(0, 3)
  const remainingCount = validCars.length - 3

  const generateCarLink = (car: SimilarCar, index: number): string => {
    const make = car.make || 'car'
    const model = car.model || 'model'
    const year = car.year || 2024
    const cleanMake = make.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const cleanModel = model.toLowerCase().replace(/[^a-z0-9]/g, '-')
    return `https://example-carmarket.com/listing/${year}-${cleanMake}-${cleanModel}-${index}`
  }

  const getFullImageUrl = (url: string): string => {
    if (url.startsWith('/api/car-images/') || url.startsWith('/car_images/')) {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
      return url.startsWith('/api/car-images/')
        ? `${apiBaseUrl}${url}`
        : `${apiBaseUrl}/api/car-images/${url.replace('/car_images/', '')}`
    }
    return url
  }

  if (validCars.length === 0) {
    return (
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardContent className="p-6">
          <p className="text-center text-[#94a3b8]">No similar cars found in the dataset</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="border-[#2a2d3a]">
                <TableHead className="text-[#94a3b8]">Image</TableHead>
                <TableHead className="text-[#94a3b8]">Year</TableHead>
                <TableHead className="text-[#94a3b8]">Mileage (km)</TableHead>
                <TableHead className="text-[#94a3b8]">Condition</TableHead>
                <TableHead className="text-[#94a3b8]">Price ($)</TableHead>
                <TableHead className="text-[#94a3b8]">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewCars.map((car, index) => {
                let imageSrc: string | null = null

                if (car.image_url) {
                  imageSrc = car.image_url
                } else if (car.image_id) {
                  imageSrc = `/api/car-images/${car.image_id}`
                }

                if (imageSrc) {
                  const fullImageUrl = getFullImageUrl(imageSrc)

                  return (
                    <TableRow key={index} className="border-[#2a2d3a]">
                      <TableCell className="whitespace-nowrap">
                        <div
                          className="relative w-[120px] h-[90px] sm:w-[160px] sm:h-[120px] rounded overflow-hidden bg-white/5 border border-white/10 cursor-pointer group transition-transform duration-200 hover:scale-105"
                          onClick={() => setLightboxImage({ url: fullImageUrl, alt: `${car.year} ${car.make} ${car.model}` })}
                        >
                          <Image
                            src={fullImageUrl}
                            alt={`${car.year} ${car.make} ${car.model}`}
                            width={160}
                            height={120}
                            className="object-cover w-full h-full"
                            quality={100}
                            priority={false}
                            loading="lazy"
                            unoptimized={true}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-xs font-medium bg-black/60 px-2 py-1 rounded">
                              Click to zoom
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-white">{car.year}</TableCell>
                      <TableCell className="whitespace-nowrap text-white">{formatNumber(car.mileage)}</TableCell>
                      <TableCell className="whitespace-nowrap text-white">{car.condition}</TableCell>
                      <TableCell className="font-semibold text-[#5B7FFF] whitespace-nowrap">
                        {formatCurrency(car.price)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {car.link ? (
                          <a
                            href={car.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200 text-sm"
                          >
                            View Listing
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <a
                            href={generateCarLink(car, index)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200 text-sm"
                          >
                            View Listing
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                } else {
                  return (
                    <TableRow key={index} className="border-[#2a2d3a]">
                      <TableCell className="whitespace-nowrap">
                        <div className="w-[120px] h-[90px] sm:w-[160px] sm:h-[120px] rounded bg-white/5 flex items-center justify-center text-[#94a3b8] text-xs border border-white/10">
                          No Image
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-white">{car.year}</TableCell>
                      <TableCell className="whitespace-nowrap text-white">{formatNumber(car.mileage)}</TableCell>
                      <TableCell className="whitespace-nowrap text-white">{car.condition}</TableCell>
                      <TableCell className="font-semibold text-[#5B7FFF] whitespace-nowrap">
                        {formatCurrency(car.price)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {car.link ? (
                          <a
                            href={car.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200 text-sm"
                          >
                            View Listing
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <a
                            href={generateCarLink(car, index)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1 transition-colors duration-200 text-sm"
                          >
                            View Listing
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                }
              })}
            </TableBody>
          </Table>
        </div>

        {remainingCount > 0 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]"
            >
              View all {validCars.length} similar cars
              <ChevronRight className="ml-2 h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        )}
      </div>

      <ImageLightbox
        imageUrl={lightboxImage?.url || null}
        alt={lightboxImage?.alt || ''}
        isOpen={lightboxImage !== null}
        onClose={() => setLightboxImage(null)}
      />

      <SimilarCarsDialog
        cars={validCars}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  )
}
