"use client"

import { useLocale } from 'next-intl'
import { useEffect } from 'react'

const RTL_LOCALES = ['ar', 'ku']

/**
 * Applies the correct body font class based on locale:
 * Inter for LTR (en), Vazirmatn for RTL (ar, ku).
 */
export function BodyFontSwitcher({
  interClass,
  vazirmatnClass,
}: {
  interClass: string
  vazirmatnClass: string
}) {
  const locale = useLocale() || 'en'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const isRtl = RTL_LOCALES.includes(locale)
    document.body.classList.remove(interClass, vazirmatnClass)
    document.body.classList.add(isRtl ? vazirmatnClass : interClass)
  }, [locale, interClass, vazirmatnClass])

  return null
}
