/**
 * Public marketing stats grounded in the training dataset (cleaned_car_data.csv).
 * Update TRAINING_LISTING_COUNT_EXACT if the CSV row count changes; keep DISPLAY in sync for UI.
 */
export const TRAINING_LISTING_COUNT_EXACT = 62_597
export const TRAINING_LISTING_COUNT_DISPLAY = 62_000

/** Distinct `make` values in the training set (rounded for “90+” style copy). */
export const UNIQUE_MAKE_COUNT_EXACT = 91
export const UNIQUE_MAKE_COUNT_DISPLAY = 90

/** R² as percent (rounded) — consistent with About page model accuracy. */
export const MODEL_FIT_R2_PERCENT = 96
export const MODEL_FIT_R2_SCORE = 0.959

export type PopularMarketModel = {
  make: string
  model: string
  /** Typical used-listing band from training data (USD), display-only */
  priceRangeUsd: string
}

/** Bands from ~10th–90th percentile of price (USD), excluding zeros, per make/model in training data. */
export const POPULAR_MARKET_MODELS: PopularMarketModel[] = [
  { make: 'Toyota', model: 'Camry', priceRangeUsd: '$14,500 – $26,500' },
  { make: 'Toyota', model: 'Corolla', priceRangeUsd: '$11,500 – $17,500' },
  { make: 'Hyundai', model: 'Sonata', priceRangeUsd: '$10,500 – $21,000' },
  { make: 'Hyundai', model: 'Elantra', priceRangeUsd: '$10,500 – $17,000' },
  { make: 'Kia', model: 'Optima', priceRangeUsd: '$11,000 – $15,500' },
  { make: 'Kia', model: 'Cerato', priceRangeUsd: '$9,000 – $16,000' },
  { make: 'Chevrolet', model: 'Malibu', priceRangeUsd: '$10,000 – $15,000' },
  { make: 'Nissan', model: 'Altima', priceRangeUsd: '$13,000 – $18,500' },
]

/** Illustrations in /public/images/cars/popular (user assets + stock where noted). */
export function popularMarketModelImagePath(make: string, model: string): string {
  const key = `${make.toLowerCase().trim()}|${model.toLowerCase().trim()}`
  const map: Record<string, string> = {
    'toyota|camry': '/images/cars/popular/toyota_camry.jpg',
    'toyota|corolla': '/images/cars/popular/toyota_corolla.webp',
    'hyundai|sonata': '/images/cars/popular/hyundai_sonata_v2.jpg',
    'hyundai|elantra': '/images/cars/popular/hyundai_elantra.webp',
    'kia|optima': '/images/cars/popular/kia_optima.jpg',
    'kia|cerato': '/images/cars/popular/kia_cerato.jpg',
    'chevrolet|malibu': '/images/cars/popular/chevrolet_malibu.jpg',
    'nissan|altima': '/images/cars/popular/nissan_altima.jpg',
  }
  return map[key] ?? '/images/cars/default-car.svg'
}
