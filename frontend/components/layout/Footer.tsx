"use client"

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useLocale } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()

  return (
    <footer className="relative z-10 border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 py-4 sm:py-12 lg:py-16 mt-auto">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-12 mb-3 sm:mb-6">
          {/* Brand */}
          <div className="space-y-1 sm:space-y-3 text-center sm:text-left">
            <h3 className="text-white font-semibold text-sm sm:text-base mb-1 sm:mb-3">{t('brand')}</h3>
            <p className="text-xs leading-snug sm:text-sm sm:leading-normal text-[#94a3b8]">
              {t('description')}
            </p>
          </div>

          {/* Quick Links: horizontal row on mobile, vertical on sm+ */}
          <div className="space-y-1 sm:space-y-3 text-center sm:text-left">
            <h3 className="text-white font-semibold text-sm sm:text-base mb-1 sm:mb-3">{t('quickLinks')}</h3>
            <ul className="flex flex-row flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 sm:flex-col sm:flex-nowrap sm:gap-0 sm:space-y-2 list-none p-0 text-sm">
              <li>
                <Link href={`/${locale}/predict`} className="inline-flex items-center text-xs sm:text-sm border-0 sm:border-0 text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-0.5 sm:py-1.5 block">
                  {t('predict')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/compare`} className="inline-flex items-center text-xs sm:text-sm border-0 text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-0.5 sm:py-1.5 block">
                  {t('compare')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal: horizontal row on mobile */}
          <div className="space-y-1 sm:space-y-3 text-center sm:text-left">
            <h3 className="text-white font-semibold text-sm sm:text-base mb-1 sm:mb-3">{t('legal')}</h3>
            <ul className="flex flex-row flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 sm:flex-col sm:flex-nowrap sm:gap-0 sm:space-y-2 text-sm list-none p-0">
              <li>
                <Link href={`/${locale}/about`} className="text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-0.5 sm:py-1.5 block">
                  {t('aboutUs')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/privacy`} className="text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-0.5 sm:py-1.5 block">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-0.5 sm:py-1.5 block">
                  {t('terms')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-3 mt-3 sm:pt-8 sm:mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
            <p className="text-xs sm:text-sm text-[#94a3b8] text-center sm:text-left">
              © 2026 {t('copyright')}
            </p>
            <p className="text-xs sm:text-sm text-[#94a3b8] text-center sm:text-left">
              {t('poweredBy')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}


