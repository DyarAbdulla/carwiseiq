"use client"

import { listingImageUrl } from '@/lib/utils'

interface ListingStructuredDataProps {
  listing: {
    id?: number | null
    make?: string | null
    model?: string | null
    year?: number | null
    price?: number | null
    mileage?: number | null
    condition?: string | null
    fuel_type?: string | null
    transmission?: string | null
    location_city?: string | null
    description?: string | null
    images?: Array<{ url?: string | null }> | null
  } | null
}

export function ListingStructuredData({ listing }: ListingStructuredDataProps) {
  if (!listing) return null

  const name = [listing?.year, listing?.make, listing?.model]
    .filter((v) => v != null && v !== '')
    .map((v) => String(v))
    .join(' ')
    .trim() || 'Vehicle'

  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "name": name,
    "offers": {
      "@type": "Offer",
      "price": Number(listing?.price ?? 0),
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "url": typeof window !== 'undefined' ? window.location.href : ''
    },
    "mileageFromOdometer": {
      "@type": "QuantitativeValue",
      "value": Number(listing?.mileage ?? 0),
      "unitCode": "KM"
    }
  }

  if (listing?.id != null) {
    structuredData.identifier = String(listing.id)
  }
  if (listing?.make != null && listing.make !== '') {
    structuredData.brand = { "@type": "Brand", "name": String(listing.make) }
  }
  if (listing?.model != null && listing.model !== '') {
    structuredData.model = String(listing.model)
  }
  if (listing?.year != null) {
    structuredData.productionDate = String(listing.year)
  }
  if (listing?.transmission != null && listing.transmission !== '') {
    structuredData.vehicleConfiguration = String(listing.transmission)
  }
  if (listing?.fuel_type != null && listing.fuel_type !== '') {
    structuredData.fuelType = String(listing.fuel_type)
  }
  if (listing?.condition != null && listing.condition !== '') {
    structuredData.itemCondition = `https://schema.org/${String(listing.condition)}Condition`
  }
  if (listing?.location_city) {
    structuredData.availableAtOrFrom = { "@type": "Place", "name": String(listing.location_city ?? '') }
  }
  if (listing?.description) {
    structuredData.description = String(listing.description ?? '')
  }
  if (listing?.images && listing.images.length > 0) {
    structuredData.image = listing.images
      .map((img) => listingImageUrl(img?.url))
      .filter(Boolean)
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
