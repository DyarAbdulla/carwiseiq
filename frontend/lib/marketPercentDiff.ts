/**
 * Client-side market comparison: how far the estimated price is from market average.
 * Same formula as product spec: ((yourCar - marketAverage) / marketAverage) * 100
 */
export function computeMarketPercentDiff(yourCar: number, marketAverage: number): number {
  if (!Number.isFinite(yourCar) || !Number.isFinite(marketAverage) || marketAverage <= 0) {
    return 0
  }
  return ((yourCar - marketAverage) / marketAverage) * 100
}
