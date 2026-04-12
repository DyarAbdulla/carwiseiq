/**
 * Browser-facing Railway/FastAPI origin. Static export has no Next /api/* routes;
 * push and similar features call the backend directly.
 */
export function getPublicApiOrigin(): string {
  const u = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://localhost:8000'
  ).trim()
  return u.replace(/\/$/, '')
}

/** @param path - Must start with `/`, e.g. `/api/notifications/preferences` */
export function publicApiUrl(path: string): string {
  const base = getPublicApiOrigin()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
