export const runtime = 'edge';
import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { generateListingMetadata } from '@/app/metadata'

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  // Return default metadata if ID is invalid
  if (!id || typeof id !== 'string') {
    return {
      title: 'Car Listing - Car Price Predictor',
      description: 'View car listing details on Car Price Predictor marketplace',
    }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
    
    // Use fetch with timeout and error handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    const response = await fetch(`${baseUrl}/api/marketplace/listings/${id}`, {
      signal: controller.signal,
      next: { revalidate: 0 }, // No caching for dynamic content
      headers: {
        'Accept': 'application/json',
      },
    }).finally(() => {
      clearTimeout(timeoutId)
    })

    if (response.ok) {
      const listing = await response.json()
      if (listing && listing.make && listing.model) {
        return generateListingMetadata({
          make: listing.make,
          model: listing.model,
          year: listing.year,
          price: listing.price,
          description: listing.description,
          images: listing.images,
        })
      }
    }
  } catch (error: any) {
    // Silently handle errors - don't fail build
    if (error.name !== 'AbortError') {
      console.error('Error generating metadata:', error.message || error)
    }
  }

  // Return default metadata on any error
  return {
    title: 'Car Listing - Car Price Predictor',
    description: 'View car listing details on Car Price Predictor marketplace',
  }
}

export default function ListingDetailLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
