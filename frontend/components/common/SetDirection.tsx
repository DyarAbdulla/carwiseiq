"use client"

import { useLocale } from 'next-intl'
import { useEffect } from 'react'

/** ar (Arabic) and ku (Kurdish Sorani) are RTL. en and ku-Latn (Kurdish Latin, if added) stay LTR. */
const RTL_LOCALES = ['ar', 'ku']

/**
 * Sets document.documentElement.dir (rtl for ar/ku, ltr for en) and lang to the current locale.
 */
export function SetDirection() {
  const locale = useLocale() || 'en'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
    root.setAttribute('dir', dir)
    root.setAttribute('lang', locale)
  }, [locale])

  return null
}
