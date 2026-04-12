import type { PushPrefs } from './types'
import type { ListingBrief } from './server-messages'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** Returns true if this subscriber should receive the new-listing notification. */
export function subscriptionMatchesListing(
  sellerUserId: string,
  subscriberUserId: string,
  prefs: PushPrefs,
  listing: ListingBrief
): boolean {
  if (subscriberUserId === sellerUserId) return false
  if (prefs.newListing === false) return false

  const price = listing.price
  if (prefs.priceMin != null && price < prefs.priceMin) return false
  if (prefs.priceMax != null && price > prefs.priceMax) return false

  const makes = prefs.watchMakes || []
  const models = prefs.watchModels || []
  if (makes.length === 0 && models.length === 0) return true

  const makeOk = makes.length === 0 || makes.some((m) => norm(m) === norm(listing.make))
  const modelOk = models.length === 0 || models.some((m) => norm(m) === norm(listing.model))
  return makeOk && modelOk
}
