import type { WizardCarDetails, WizardContact, WizardLocation } from "@/context/SellWizardContext"
import { MEDIA_MIN } from "@/components/sell/MediaUploadStep"

export interface ListingScoreInput {
  location: WizardLocation | null
  imageCount: number
  totalMedia: number
  uploadedCount: number
  carDetails: WizardCarDetails | null
  contact: WizardContact | null
}

/**0–100 completeness score for review step. */
export function computeListingCompletenessScore(i: ListingScoreInput): number {
  let pts = 0
  const max = 100

  if (i.location?.city) pts += 10
  if (i.location?.neighborhood?.trim()) pts += 5

  if (i.imageCount >= MEDIA_MIN) pts += 25
  else pts += Math.round((i.imageCount / MEDIA_MIN) * 25)
  if (i.totalMedia >= 6) pts += 5
  if (i.uploadedCount === i.totalMedia && i.uploadedCount > 0) pts += 5

  const c = i.carDetails
  if (c) {
    if (c.make?.trim()) pts += 5
    if (c.model?.trim()) pts += 5
    if (c.year) pts += 5
    if (c.color?.trim()) pts += 3
    if (c.price && parseFloat(c.price) > 0) pts += 7
    if (c.mileage && parseInt(c.mileage, 10) >= 0) pts += 5
    if (c.transmission) pts += 3
    if (c.fuel_type) pts += 3
    if (c.condition) pts += 3
    if (c.previous_owners) pts += 2
    if (c.accident_history) pts += 2
    const nf = c.features?.length ?? 0
    pts += Math.min(8, nf * 2)
  }

  const ct = i.contact
  if (ct?.phone?.trim()) pts += 5
  if (ct?.description && ct.description.trim().length > 40) pts += 6
  if (ct?.description && ct.description.trim().length > 120) pts += 4
  if (ct?.preferredContact) pts += 2

  return Math.min(max, Math.round(pts))
}
