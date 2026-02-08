"use client"

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useLocale } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()

  return (
    <footer className="relative z-10 border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 py-6 sm:py-12 lg:py-16 mt-auto">
      <div className="container mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-12 mb-4 sm:mb-6">
          {/* Brand */}
          <div className="space-y-2 sm:space-y-3 text-center sm:text-left">
            <h3 className="text-white font-semibold text-base mb-2 sm:mb-3">{t('brand')}</h3>
            <p className="text-xs leading-snug sm:text-sm sm:leading-normal text-[#94a3b8]">
              {t('description')}
            </p>
          </div>

          {/* Quick Links: chips row on mobile, vertical list on sm+ */}
          <div className="space-y-2 sm:space-y-3 text-center sm:text-left">
            <h3 className="text-white font-semibold text-base mb-2 sm:mb-3">{t('quickLinks')}</h3>
            <ul className="flex flex-wrap gap-2 sm:flex-col sm:flex-nowrap sm:gap-0 sm:space-y-2 list-none p-0 text-sm">
              <li>
                <Link href={`/${locale}/predict`} className="inline-flex items-center rounded-full px-3 py-1.5 text-xs border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-1.5 sm:block">
                  {t('predict')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/compare`} className="inline-flex items-center rounded-full px-3 py-1.5 text-xs border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-1.5 sm:block">
                  {t('compare')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-2 sm:space-y-3 text-center sm:text-left">
            <h3 className="text-white font-semibold text-base mb-2 sm:mb-3">{t('legal')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/privacy`} className="text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-1.5 block">
                  {t('privacy')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/terms`} className="text-[#94a3b8] hover:text-[#5B7FFF] hover:underline transition-all duration-300 py-1.5 block">
                  {t('terms')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-4 mt-4 sm:pt-8 sm:mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs sm:text-sm text-[#94a3b8]">
              © 2026 {t('copyright')}
            </p>
            <p className="text-xs sm:text-sm text-[#94a3b8]">
              {t('poweredBy')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}


