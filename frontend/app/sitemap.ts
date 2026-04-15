import { MetadataRoute } from 'next'
import { locales } from '@/i18n'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  
  const routes = [
    '',
    '/predict',
    '/compare',
    '/batch',
    '/login',
    '/register',
    '/my-listings',
    '/buy-sell',
    '/ai-assistant',
  ]

  const sitemapEntries: MetadataRoute.Sitemap = []

  // Add all routes for each locale
  ;(locales as readonly string[]).forEach((locale) => {
    routes.forEach(route => {
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      })
    })
  })

  return sitemapEntries
}
