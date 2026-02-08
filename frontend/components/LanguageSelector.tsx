"use client"

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { locales } from '@/i18n'
import { Globe, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const LOCALE_STORAGE_KEY = 'NEXT_LOCALE'
const LOCALE_COOKIE = 'NEXT_LOCALE'
const COOKIE_MAX_AGE = 31536000 // 1 year

const localeCodes: Record<string, string> = {
  en: 'EN',
  ku: 'KU',
  ar: 'AR',
}

export type LanguageSelectorVariant = 'dropdown' | 'inline'

function getPathWithoutLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`
  if (pathname === prefix || pathname === `${prefix}/`) return '/'
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return pathname || '/'
}

interface LanguageSelectorProps {
  variant?: LanguageSelectorVariant
}

export function LanguageSelector({ variant = 'dropdown' }: LanguageSelectorProps) {
  const locale = useLocale()
  const t = useTranslations('languages')
  const router = useRouter()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()

  // Persist to localStorage and cookie; apply stored locale if cookie was cleared
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (stored && locales.includes(stored as any) && stored !== locale) {
        document.cookie = `${LOCALE_COOKIE}=${stored}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
        const base = getPathWithoutLocale(pathname, locale)
        const path = `/${stored}${base}`.replace(/\/+/g, '/')
        router.replace(path + (typeof window !== 'undefined' && window.location.search ? window.location.search : ''))
        router.refresh()
      }
    } catch (_) {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  const switchLocale = (newLocale: string) => {
    try {
      document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
    } catch (_) {}
    const pathWithoutLocale = getPathWithoutLocale(pathname, locale)
    const newPath = `/${newLocale}${pathWithoutLocale}`.replace(/\/+/g, '/')
    const queryString = searchParams?.toString?.()
    router.push(queryString ? `${newPath}?${queryString}` : newPath)
    router.refresh()
  }

  const currentLabel = (() => { try { return t(locale) } catch { return locale } })()
  const currentCode = localeCodes[locale] || locale

  // isRTL: ar and ku use RTL; LTR → EN|KU|AR, RTL → AR|KU|EN
  const isRTL = locale === 'ar' || locale === 'ku'
  const orderedLocales = isRTL ? [...locales].reverse() : locales

  // Inline: LTR → EN | KU | AR; RTL → AR | KU | EN (glassmorphism)
  if (variant === 'inline') {
    return (
      <div
        className="flex items-center gap-0.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md px-1 py-1"
        role="group"
        aria-label="Language"
      >
        {orderedLocales.map((loc, i) => {
          const code = localeCodes[loc] || loc
          const isSelected = locale === loc
          return (
            <span key={loc} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-slate-500/60 dark:text-slate-400/60 text-xs" aria-hidden>|</span>}
              <button
                type="button"
                onClick={() => switchLocale(loc)}
                className={cn(
                  "min-h-[44px] min-w-[44px] px-3 rounded-full text-xs font-medium transition-colors",
                  "hover:bg-white/10 hover:border-white/10",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-2 focus:ring-offset-transparent",
                  isSelected
                    ? "bg-white/10 text-white dark:text-slate-100"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-200 dark:hover:text-slate-300"
                )}
                aria-label={`${code} - ${(() => { try { return t(loc) } catch { return loc } })()}`}
                aria-pressed={isSelected}
              >
                {code}
              </button>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-center h-11 min-h-[44px] w-11 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-slate-100 transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-2 focus:ring-offset-transparent"
          )}
          aria-label={`Language: ${currentLabel}`}
        >
          <Globe className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        sideOffset={6} 
        className="w-56 rounded-xl border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-xl p-2"
      >
        {locales.map((loc) => {
          let label: string
          try { label = t(loc) } catch { label = loc }
          const code = localeCodes[loc] || loc
          const isSelected = locale === loc
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => switchLocale(loc)}
              className={cn(
                "cursor-pointer rounded-lg py-2.5 px-3 text-slate-200 focus:bg-white/10 focus:text-white transition-colors",
                isSelected && "bg-indigo-500/15 text-indigo-300"
              )}
            >
              <span className="flex items-center gap-3 w-full">
                <span className="text-[10px] text-slate-500 font-medium w-7 uppercase tracking-wider">{code}</span>
                <span className={cn("flex-1 text-sm", isSelected && "font-medium")}>{label}</span>
                {isSelected && <Check className="h-4 w-4 text-indigo-400 shrink-0" />}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
