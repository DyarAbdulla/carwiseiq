/**
 * Listing detail is on /buy-sell with ?id= only (static export has no /buy-sell/[id]).
 * Never use path-style /buy-sell/<id> — that 404s on export.
 */
export function buySellListingHref(
  locale: string,
  listingId: string | number
): string {
  const id = String(listingId ?? "").trim()
  if (!id) return `/${locale}/buy-sell`
  const q = new URLSearchParams()
  q.set("id", id)
  return `/${locale}/buy-sell?${q.toString()}`
}
