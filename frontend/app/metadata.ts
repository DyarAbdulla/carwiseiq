import { Metadata } from 'next'

export const defaultMetadata: Metadata = {
  title: 'CarWiseIQ | AI-Powered Car Valuations',
  description: 'Get accurate car price predictions using AI. Buy and sell cars with confidence. Compare prices, find deals, and make informed decisions.',
  keywords: 'car price prediction, car valuation, buy cars, sell cars, car marketplace, AI car pricing',
  authors: [{ name: 'CarWiseIQ' }],
  creator: 'CarWiseIQ',
  publisher: 'CarWiseIQ',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  alternates: {
    canonical: '/',
    languages: {
      'en': '/en',
      'ar': '/ar',
      'ku': '/ku',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'CarWiseIQ',
    title: 'CarWiseIQ | AI-Powered Car Valuations',
    description: 'Get accurate car price predictions using AI. Buy and sell cars with confidence.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CarWiseIQ',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CarWiseIQ | AI-Powered Car Valuations',
    description: 'Get accurate car price predictions using AI. Buy and sell cars with confidence.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export function generateListingMetadata(listing: {
  make: string
  model: string
  year: number
  price: number
  description?: string
  images?: Array<{ url: string }>
}): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const title = `${listing.year} ${listing.make} ${listing.model}`
  const description = listing.description
    ? listing.description.substring(0, 150)
    : `Check out this ${listing.year} ${listing.make} ${listing.model} for $${listing.price.toLocaleString()}. View details, compare prices, and contact the seller.`

  // Get the car image URL (first image or empty)
  const carImageUrl = listing.images?.[0]?.url || ''

  // Build the OG image URL with query parameters
  const ogImageParams = new URLSearchParams({
    title: title,
    price: listing.price.toLocaleString(),
    image: carImageUrl,
  })
  const ogImageUrl = `${baseUrl}/api/og?${ogImageParams.toString()}`

  return {
    title: `${title} - $${listing.price.toLocaleString()}`,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}
