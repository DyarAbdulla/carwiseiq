import type { Metadata, Viewport } from 'next'
import { inter } from '@/lib/fonts'
import './globals.css'
import ClientOnlyProviders from '@/components/ClientOnlyProviders'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://carwiseiq.com'),
  title: 'CarWiseIQ - AI Car Valuation for Kurdistan & Iraq',
  description: 'Get accurate AI-powered car price estimates for Iraq and Kurdistan. Compare vehicles, find market values, and buy or sell smarter.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'CarWiseIQ - AI Car Valuation for Kurdistan & Iraq',
    description: 'Get accurate AI-powered car price estimates for Iraq and Kurdistan.',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://carwiseiq.com',
    siteName: 'CarWiseIQ',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CarWiseIQ - AI Car Valuation for Kurdistan & Iraq',
    description: 'Get accurate AI-powered car price estimates for Iraq and Kurdistan.',
  },
  applicationName: 'CarWiseIQ',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CarWiseIQ',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ku" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=location.pathname;var m=p.match(/^\\/([a-z]{2})(?:\\/|$)/);var c=m&&m[1]&&m[1].toLowerCase();var loc=(c==='en'||c==='ku'||c==='ar')?c:'ku';var rtl=(loc==='ar'||loc==='ku');document.documentElement.setAttribute('lang',loc);document.documentElement.setAttribute('dir',rtl?'rtl':'ltr');})();`,
          }}
        />
        {/* OPTIMIZED: Preconnect to API for faster requests */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'} />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0f1117] dark:text-white transition-colors duration-300`} suppressHydrationWarning>
        {/* OPTIMIZED: Performance monitoring initialization */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize performance monitoring
              if (typeof window !== 'undefined' && window.performance) {
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    if (perfData) {
                      const loadTime = perfData.loadEventEnd - perfData.fetchStart;
                      console.log('[Performance] Page load time:', loadTime + 'ms');

                      // Warn if load time is slow
                      if (loadTime > 3000) {
                        console.warn('[Performance] Page load is slow (>' + loadTime + 'ms)');
                      }
                    }
                  }, 1000);
                });
              }

              // Android PWA meta tag
              if (typeof document !== 'undefined') {
                const existing = document.querySelector('meta[name="mobile-web-app-capable"]');
                if (!existing) {
                  const meta = document.createElement('meta');
                  meta.name = 'mobile-web-app-capable';
                  meta.content = 'yes';
                  document.head.appendChild(meta);
                }
              }
            `,
          }}
        />
        <ClientOnlyProviders />
        {children}
      </body>
    </html>
  )
}
