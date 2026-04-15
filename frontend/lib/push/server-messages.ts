import type { PushPrefs } from './types'
import { defaultLocale, locales } from '@/i18n'

export type ListingBrief = {
  id: string
  make: string
  model: string
  year: number
  price: number
  location: string
  imageUrl?: string | null
}

const localeSet = new Set<string>(locales as unknown as string[])

function loc(prefs: PushPrefs): string {
  const l = (prefs.locale || defaultLocale).toLowerCase()
  return localeSet.has(l) ? l : defaultLocale
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function newListingCopy(prefs: PushPrefs, listing: ListingBrief): { title: string; body: string } {
  const l = loc(prefs)
  const price = formatUsd(listing.price)
  const city = listing.location?.trim() || (l === 'ar' ? 'العراق' : l === 'ku' ? 'عێراق' : 'Iraq')

  if (l === 'ar') {
    return {
      title: 'سيارة جديدة في السوق',
      body: `تم إدراج ${listing.make} ${listing.model} ${listing.year} بسعر ${price} في ${city}`,
    }
  }
  if (l === 'ku') {
    return {
      title: 'ئۆتۆمبێلی نوێ لە بازاڕدا',
      body: `${listing.make} ${listing.model} ${listing.year} بە نرخی ${price} لە ${city} لیستکرا`,
    }
  }
  return {
    title: 'New car on the market',
    body: `New ${listing.make} ${listing.model} ${listing.year} listed for ${price} in ${city}`,
  }
}

export function priceDropCopy(
  prefs: PushPrefs,
  listing: Pick<ListingBrief, 'make' | 'model'>,
  newPrice: number
): { title: string; body: string } {
  const l = loc(prefs)
  const price = formatUsd(newPrice)
  if (l === 'ar') {
    return {
      title: 'انخفاض السعر',
      body: `انخفض سعر ${listing.make} ${listing.model} الذي عرضته — الآن ${price}`,
    }
  }
  if (l === 'ku') {
    return {
      title: 'نرخ کەمبووەوە',
      body: `نرخی ${listing.make} ${listing.model} کە بینیت کەمبووەوە — ئێستا ${price}`,
    }
  }
  return {
    title: 'Price drop',
    body: `Price dropped on ${listing.make} ${listing.model} you viewed — now ${price}`,
  }
}

export function marketTrendCopy(prefs: PushPrefs, make: string, count: number, region: string): { title: string; body: string } {
  const l = loc(prefs)
  if (l === 'ar') {
    return {
      title: 'ملخص السوق',
      body: `${count} إدراجات جديدة لـ ${make} هذا الأسبوع في ${region}`,
    }
  }
  if (l === 'ku') {
    return {
      title: 'پوختەی بازاڕ',
      body: `ئەم هەفتەیە ${count} لیستی نوێی ${make} لە ${region}`,
    }
  }
  return {
    title: 'Market digest',
    body: `${count} new ${make} listings this week in ${region}`,
  }
}
