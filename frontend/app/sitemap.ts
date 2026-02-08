import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const locales = ['en', 'ar', 'ku']
  
  const routes = [
    '',
    '/predict',
    '/compare',
    '/batch',
    '/login',
    '/register',
    '/my-listings',
    '/buy-sell',
  ]

  const sitemapEntries: MetadataRoute.Sitemap = []

  // Add all routes for each locale
  locales.forEach(locale => {
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
