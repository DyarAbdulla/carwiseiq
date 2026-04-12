import type { Json } from '@/lib/database.types'

export type PushPrefs = {
  newListing?: boolean
  priceDrop?: boolean
  marketTrend?: boolean
  watchMakes?: string[]
  watchModels?: string[]
  priceMin?: number | null
  priceMax?: number | null
  locale?: string
}

export const defaultPushPrefs: Required<
  Pick<PushPrefs, 'newListing' | 'priceDrop' | 'marketTrend' | 'watchMakes' | 'watchModels'>
> &
  Pick<PushPrefs, 'priceMin' | 'priceMax' | 'locale'> = {
  newListing: true,
  priceDrop: true,
  marketTrend: true,
  watchMakes: [],
  watchModels: [],
  priceMin: null,
  priceMax: null,
  locale: 'en',
}

export function mergePushPrefs(raw: Json | null | undefined): PushPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    newListing: typeof o.newListing === 'boolean' ? o.newListing : defaultPushPrefs.newListing,
    priceDrop: typeof o.priceDrop === 'boolean' ? o.priceDrop : defaultPushPrefs.priceDrop,
    marketTrend: typeof o.marketTrend === 'boolean' ? o.marketTrend : defaultPushPrefs.marketTrend,
    watchMakes: Array.isArray(o.watchMakes)
      ? o.watchMakes.filter((x): x is string => typeof x === 'string')
      : [],
    watchModels: Array.isArray(o.watchModels)
      ? o.watchModels.filter((x): x is string => typeof x === 'string')
      : [],
    priceMin: typeof o.priceMin === 'number' ? o.priceMin : o.priceMin === null ? null : undefined,
    priceMax: typeof o.priceMax === 'number' ? o.priceMax : o.priceMax === null ? null : undefined,
    locale: typeof o.locale === 'string' ? o.locale : 'en',
  }
}
