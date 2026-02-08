import { Inter, Vazirmatn } from 'next/font/google'

/** Shared font instances so root layout and locale BodyFontSwitcher use the same class names. */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
})

export const vazirmatn = Vazirmatn({
  subsets: ['arabic'],
  display: 'swap',
})
