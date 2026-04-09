/**
 * Turn backend-relative paths (/api/...) into absolute URLs using NEXT_PUBLIC_API_BASE_URL.
 * Required for static export on Cloudflare Pages — the browser must request the API host, not the Pages host.
 */
export function resolveApiAssetUrl(pathOrUrl: string | undefined | null): string {
  if (pathOrUrl == null || pathOrUrl === '') {
    return '/images/cars/default-car.jpg'
  }
  const s = String(pathOrUrl).trim()
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('blob:')) {
    return s
  }
  const envBase =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL
      ? process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')
      : ''
  const runtimeHost =
    typeof window !== 'undefined' ? window.location.hostname : ''
  const prodFallback =
    runtimeHost === 'carwiseiq.com' ||
    runtimeHost === 'www.carwiseiq.com' ||
    (runtimeHost.length > 0 && runtimeHost.endsWith('.pages.dev'))
      ? 'https://api.carwiseiq.com'
      : ''
  const base = envBase || prodFallback
  if (s.startsWith('/api/') && base) {
    return `${base}${s}`
  }
  if (s.startsWith('/car_images/') && base) {
    const filename = s.replace(/^\/car_images\//, '')
    return `${base}/api/car-images/${filename}`
  }
  return s
}
