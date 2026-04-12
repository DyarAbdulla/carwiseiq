"use client"
import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useSellWizard } from "@/context/SellWizardContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { MEDIA_MAX, MEDIA_MIN } from "@/components/sell/MediaUploadStep"
import { maskIraqiMobileDisplay, normalizeIraqiNationalDigits } from "@/lib/iraqPhone"
import {
  Edit,
  MapPin,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
} from "lucide-react"
import type { Transmission, FuelType, CarCondition } from "@/lib/database.types"
import { notifyNewListingPublished } from "@/lib/push/push-client"
import { computeListingCompletenessScore } from "@/lib/sellListingScore"
import { cn } from "@/lib/utils"

function mapTransmission(v: string): Transmission {
  if (v === "Manual") return "manual"
  return "automatic"
}

function mapFuelType(v: string): FuelType {
  if (v === "Diesel") return "diesel"
  if (v === "Electric (EV)") return "electric"
  if (v === "Hybrid" || v === "Plug-in Hybrid (PHEV)") return "hybrid"
  if (v === "CNG (Compressed Natural Gas)" || v === "Petrol/Gasoline") return "petrol"
  return "petrol"
}

function mapCondition(v: string): CarCondition {
  if (v === "Good") return "good"
  if (v === "Fair" || v === "Needs Work") return "fair"
  return "excellent"
}

function countWizardImages(media: { isVideo: boolean }[]): number {
  return media.reduce((n, m) => n + (m.isVideo ? 0 : 1), 0)
}

function urlsMatchMedia(mediaLength: number, uploadedMediaUrls: string[]): boolean {
  if (uploadedMediaUrls.length !== mediaLength) return false
  return uploadedMediaUrls.every((u) => typeof u === "string" && u.trim().length > 0)
}

const IQD_PER_USD = 1320

const BEST_TIME_IDS: Record<
  string,
  "bestTimeMorning" | "bestTimeAfternoon" | "bestTimeEvening" | "bestTimeAnytime"
> = {
  morning: "bestTimeMorning",
  afternoon: "bestTimeAfternoon",
  evening: "bestTimeEvening",
  anytime: "bestTimeAnytime",
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,38%)_1fr] gap-1 sm:gap-4 py-3.5 border-b border-white/10 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="text-[15px] text-gray-100 leading-snug">{children}</dd>
    </div>
  )
}

export default function SellStep5Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const tFooter = useTranslations("footer")
  const { toast } = useToast()
  const {
    location,
    media,
    uploadedMediaUrls,
    carDetails,
    contact,
    setPublishedListingId,
    clearDraft,
  } = useSellWizard()

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeSeller, setAgreeSeller] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const publishSubmitted = useRef(false)

  useEffect(() => {
    publishSubmitted.current = false
  }, [])

  const imageCount = useMemo(() => countWizardImages(media), [media])

  const mediaReady = useMemo(() => {
    if (!media.length) return false
    if (imageCount < MEDIA_MIN || media.length > MEDIA_MAX) return false
    return urlsMatchMedia(media.length, uploadedMediaUrls)
  }, [media.length, imageCount, uploadedMediaUrls])

  const coreFieldsOk =
    !!location?.city &&
    !!carDetails?.make &&
    !!carDetails?.model &&
    !!carDetails?.year &&
    !!contact?.phone

  const canPublish = agreeTerms && agreeSeller && coreFieldsOk && mediaReady

  const completeness = useMemo(
    () =>
      computeListingCompletenessScore({
        location: location ?? null,
        imageCount,
        totalMedia: media.length,
        uploadedCount: uploadedMediaUrls.length,
        carDetails: carDetails ?? null,
        contact: contact ?? null,
      }),
    [location, imageCount, media.length, uploadedMediaUrls.length, carDetails, contact]
  )

  const scoreLabel = useMemo(() => {
    if (completeness >= 85) return t("listingScoreExcellent")
    if (completeness >= 65) return t("listingScoreGood")
    return t("listingScoreFair")
  }, [completeness, t])

  const priceNum = parseFloat(String(carDetails?.price ?? ""))
  const iqdApprox =
    Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * IQD_PER_USD) : null

  const orderedMedia = useMemo(
    () => [...media].sort((a, b) => (a.isCover ? -1 : b.isCover ? 1 : a.order - b.order)),
    [media]
  )

  const heroMedia = orderedMedia[0]
  const thumbMedia = orderedMedia.slice(1, 10)

  const bestTimeDisplay = useMemo(() => {
    const ids = contact?.bestTimeToCall ?? []
    return ids
      .map((id) => {
        const k = BEST_TIME_IDS[id]
        return k ? t(k) : id
      })
      .join(", ")
  }, [contact?.bestTimeToCall, t])

  const handlePublish = useCallback(async () => {
    console.log("=== STARTING PUBLISH ===")

    // CRITICAL: Fetch fresh session to ensure auth.uid() matches user_id
    // RLS policy requires: auth.uid() = user_id
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session?.user?.id) {
      console.error("=== PUBLISH FAILED ===", "No active Supabase session", sessionError)
      toast({ title: t("publishSessionError"), description: sessionError?.message || "Please sign in again", variant: "destructive" })
      return
    }

    const currentUserId = sessionData.session.user.id
    console.log("Current Supabase user ID:", currentUserId)

    if (!location || !carDetails || !contact) {
      toast({
        title: t("publishBlockedTitle"),
        description: t("publishBlockedFields"),
        variant: "destructive",
      })
      return
    }

    const imgCount = countWizardImages(media)
    const urlsOk = urlsMatchMedia(media.length, uploadedMediaUrls)
    const mediaOk =
      media.length > 0 &&
      imgCount >= MEDIA_MIN &&
      media.length <= MEDIA_MAX &&
      urlsOk

    const fieldsOk =
      !!location.city &&
      !!carDetails.make &&
      !!carDetails.model &&
      !!carDetails.year &&
      !!contact.phone

    if (!fieldsOk) {
      toast({
        title: t("publishBlockedTitle"),
        description: t("publishBlockedFields"),
        variant: "destructive",
      })
      return
    }

    if (!agreeTerms || !agreeSeller) {
      toast({
        title: t("publishBlockedTitle"),
        description: t("publishBlockedAgreements"),
        variant: "destructive",
      })
      return
    }

    if (!mediaOk) {
      let description = t("publishBlockedMediaPhotos", { min: String(MEDIA_MIN) })
      if (!media.length) description = t("publishBlockedMediaSync")
      else if (media.length > MEDIA_MAX) description = t("publishBlockedMediaMax", { max: String(MEDIA_MAX) })
      else if (imgCount < MEDIA_MIN) description = t("publishBlockedMediaPhotos", { min: String(MEDIA_MIN) })
      else if (!uploadedMediaUrls.length) description = t("publishBlockedMediaSync")
      else if (!urlsOk) description = t("publishBlockedMediaMismatch")

      toast({
        title: t("publishBlockedTitle"),
        description,
        variant: "destructive",
      })
      return
    }

    if (publishSubmitted.current) {
      toast({ title: t("publishWait"), duration: 2500 })
      return
    }

    publishSubmitted.current = true
    setPublishing(true)

    console.log("Form data:", {
      location: { city: location.city, neighborhood: location.neighborhood },
      media: { count: media.length, uploadedUrlsCount: uploadedMediaUrls.length },
      carDetails: { make: carDetails.make, model: carDetails.model, year: carDetails.year, price: carDetails.price, mileage: carDetails.mileage },
      contact: { phone: contact.phone ? "***" + contact.phone.slice(-4) : null, preferredContact: contact.preferredContact },
    })

    // RLS requires auth.uid() = user_id; using fresh session user ID
    console.log("Using Supabase session user_id:", currentUserId)

    try {
      const year = parseInt(String(carDetails.year), 10)
      const price = parseFloat(String(carDetails.price))
      const mileage = parseInt(String(carDetails.mileage), 10)

      if (!Number.isFinite(year) || !Number.isFinite(price) || !Number.isFinite(mileage)) {
        console.error("=== PUBLISH FAILED ===", "Validation: invalid year/price/mileage", { year, price, mileage })
        toast({ title: t("publishValidationError"), description: "", variant: "destructive" })
        publishSubmitted.current = false
        setPublishing(false)
        return
      }

      const locStr = `${location.city}${location.neighborhood ? `, ${location.neighborhood}` : ""}, Iraq`
      const extra: string[] = []
      if (carDetails.color) extra.push(`Color: ${carDetails.color}`)
      if (carDetails.previous_owners) extra.push(`Previous owners: ${carDetails.previous_owners}`)
      if (carDetails.accident_history) extra.push(`Accident: ${carDetails.accident_history}`)
      if (carDetails.features?.length) extra.push(`Features: ${carDetails.features.join(", ")}`)
      const fullDesc = [contact.description, extra.length ? extra.join(". ") : null].filter(Boolean).join("\n\n") || null
      const title = `${carDetails.year} ${carDetails.make} ${carDetails.model}`.trim()

      const phoneDigits = normalizeIraqiNationalDigits(contact.phone)
      const phoneFull = phoneDigits.length === 10 ? `+964${phoneDigits}` : null
      const waDigits = normalizeIraqiNationalDigits(contact.whatsapp || "")
      const whatsappFull = contact.whatsappSameAsPhone
        ? phoneFull
        : waDigits.length === 10
          ? `+964${waDigits}`
          : phoneFull

      // Payload must match car_listings schema exactly. Columns: user_id, title, make, model, year, price, mileage, transmission, fuel_type, condition, location, description, images, is_sold, status, phone, whatsapp. Omit: id, sold_at, created_at, updated_at (defaults).
      // CRITICAL: Use currentUserId from fresh session to match auth.uid() for RLS
      const payload = {
        user_id: currentUserId,
        title,
        make: String(carDetails.make ?? "").trim(),
        model: String(carDetails.model ?? "").trim(),
        year: Number(year),
        price: Number(price),
        mileage: Number(mileage),
        transmission: mapTransmission(carDetails.transmission),
        fuel_type: mapFuelType(carDetails.fuel_type),
        condition: mapCondition(carDetails.condition),
        location: locStr,
        description: fullDesc,
        images: Array.isArray(uploadedMediaUrls) ? uploadedMediaUrls : [],
        is_sold: false,
        status: "active" as const,
        phone: phoneFull || null,
        whatsapp: whatsappFull || null,
      }

      console.log("Inserting to database...")
      console.log("Payload:", JSON.stringify(payload, null, 2))
      console.log("Session access_token present:", !!sessionData.session.access_token)
      console.log("User ID type:", typeof currentUserId, "Value:", currentUserId)

      // Insert with timeout handling
      const INSERT_TIMEOUT_MS = 20000 // 20 seconds timeout
      
      const insertPromise = supabase
        .from("car_listings")
        .insert(payload)
        .select("id")
        .single()

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Insert timeout after 20 seconds. This usually indicates an RLS policy issue. Please check Supabase RLS policies for car_listings table."))
        }, INSERT_TIMEOUT_MS)
      })

      let insertResult: { data: { id?: string } | null; error: any } | null = null
      let timeoutOccurred = false

      try {
        insertResult = await Promise.race([
          insertPromise.then(result => ({ data: result.data, error: result.error })),
          timeoutPromise
        ]) as { data: { id?: string } | null; error: any }
      } catch (raceError) {
        // Check if it's a timeout or actual error
        if (raceError instanceof Error && raceError.message.includes("timeout")) {
          timeoutOccurred = true
          console.error("=== PUBLISH FAILED - Timeout ===")
          console.error("The insert operation timed out. This usually means:")
          console.error("1. RLS policy is blocking the insert (check: auth.uid() = user_id)")
          console.error("2. Database trigger is hanging")
          console.error("3. Network issue")
          
          publishSubmitted.current = false
          setPublishing(false)
          toast({ 
            title: "Request Timeout", 
            description: "The request took too long. Please check Supabase RLS policies for car_listings table. Ensure INSERT policy exists: WITH CHECK (auth.uid() = user_id)", 
            variant: "destructive" 
          })
          return
        }
        // Re-throw other errors
        throw raceError
      }

      if (insertResult?.error) {
        const error = insertResult.error
        console.error("=== PUBLISH FAILED - Supabase Error ===")
        console.error("Error code:", error.code)
        console.error("Error message:", error.message)
        console.error("Error details:", error.details)
        console.error("Error hint:", error.hint)
        console.error("Full error object:", JSON.stringify(error, null, 2))
        
        // Provide user-friendly error messages
        let errorMessage = error.message || "Failed to publish listing"
        if (error.code === "PGRST301" || error.message?.includes("permission") || error.message?.includes("policy") || error.message?.includes("RLS")) {
          errorMessage = "Permission denied. The RLS policy may be blocking this insert. Please ensure: 1) You're signed in, 2) RLS INSERT policy exists with: WITH CHECK (auth.uid() = user_id)"
        } else if (error.message?.includes("timeout")) {
          errorMessage = "Request timed out. Please check your connection and RLS policies."
        } else if (error.message?.includes("row-level") || error.message?.includes("RLS")) {
          errorMessage = "Database security policy error. Please check Supabase RLS policies."
        } else if (error.code === "23505") {
          errorMessage = "Duplicate entry. This listing may already exist."
        } else if (error.code === "23503") {
          errorMessage = "Foreign key constraint failed. User ID may be invalid."
        }

        publishSubmitted.current = false
        setPublishing(false)
        toast({ 
          title: t("publishDbError") || "Publish Failed", 
          description: errorMessage, 
          variant: "destructive" 
        })
        return
      }

      if (!insertResult?.data?.id) {
        console.error("=== PUBLISH FAILED ===", "Insert returned no id", insertResult?.data)
        publishSubmitted.current = false
        setPublishing(false)
        toast({ title: t("publishDbError") || "Publish Failed", description: "No listing id returned from database", variant: "destructive" })
        return
      }

      const id = insertResult.data.id
      console.log("=== PUBLISH SUCCESS ===", id)

      const token = sessionData.session.access_token
      if (token) {
        void notifyNewListingPublished(id, token)
      }

      // Log create listing activity
      const { activityHelpers } = await import('@/lib/activityLogger')
      activityHelpers.logCreateListing(id, title, Number(price))

      setPublishedListingId(id)
      clearDraft()
      toast({ title: t("publishSuccessTitle"), description: t("publishSuccessDescription") })
      router.replace(`/${locale}/sell/success?id=${encodeURIComponent(id)}`)
    } catch (e: unknown) {
      console.error("=== PUBLISH FAILED - Exception ===", e)
      
      if (e instanceof Error) {
        console.error("Error name:", e.name)
        console.error("Error message:", e.message)
        console.error("Error stack:", e.stack)
      }
      
      console.error("Full error:", e instanceof Error ? { message: e.message, name: e.name, stack: e.stack } : e)
      publishSubmitted.current = false
      setPublishing(false)
      const msg = e instanceof Error ? e.message : String(e)
      toast({
        title: t("publishDbError"),
        description: msg || t("uploadFailedGeneric"),
        variant: "destructive",
      })
    }
  }, [
    agreeTerms,
    agreeSeller,
    location,
    media,
    uploadedMediaUrls,
    carDetails,
    contact,
    setPublishedListingId,
    clearDraft,
    router,
    locale,
    toast,
    t,
  ])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.push(`/${locale}/sell/step4`)
        return
      }
      if (e.key !== "Enter" || e.shiftKey) return
      const el = e.target as HTMLElement
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable) return
      if (canPublish && !publishing) {
        e.preventDefault()
        void handlePublish()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, locale, canPublish, publishing, handlePublish])

  if (!location || !carDetails || !contact) {
    return (
      <div className="relative z-10 flex flex-col items-center justify-center gap-4 py-12 min-h-[70vh]">
        <p className="text-gray-400">{t("missingData")}</p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/sell/step1`)} className="border-gray-600 text-gray-300">
          {t("startOver")}
        </Button>
      </div>
    )
  }

  return (
    <div className="relative px-4 py-8 md:py-14 animate-in fade-in duration-500 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center space-y-4 mb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{t("reviewTitle")}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t("reviewDescription")}</p>

          <div className="sell-glass ring-1 ring-violet-500/25 p-5 text-left max-w-xl mx-auto shadow-lg shadow-violet-900/20">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-300" />
                <span className="text-sm font-semibold text-white">{t("listingScoreTitle")}</span>
              </div>
              <span className="text-2xl font-bold tabular-nums bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                {completeness}
                <span className="text-base font-medium text-gray-500">/100</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-700 ease-out"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="text-sm text-violet-200/90">{scoreLabel}</p>
            <p className="text-xs text-gray-500 mt-1">{t("listingScoreHint")}</p>
          </div>
        </header>

        {/* Media — hero + thumbnails */}
        <div className="sell-glass p-5 md:p-6 shadow-xl shadow-black/25">
          <div className="flex flex-row items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-white">{t("photosVideos")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/12 bg-white/[0.03] text-gray-200 hover:bg-white/10">
              <Link href={`/${locale}/sell/step2`}>
                <Edit className="h-4 w-4 mr-1.5" /> {t("edit")}
              </Link>
            </Button>
          </div>
          {media.length > 0 && heroMedia ? (
            <>
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-black/50 border border-white/10 shadow-inner">
                {heroMedia.isVideo ? (
                  <video src={heroMedia.previewUrl} muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={heroMedia.previewUrl} alt="" className="w-full h-full object-cover" />
                )}
                {heroMedia.isCover && (
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg border border-white/20">
                    {t("cover")}
                  </span>
                )}
              </div>
              {thumbMedia.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {thumbMedia.map((m) => (
                    <div
                      key={m.id}
                      className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/10 bg-gray-800"
                    >
                      {m.isVideo ? (
                        <video src={m.previewUrl} muted className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {uploadedMediaUrls.length === 0 && (
                <p className="mt-4 text-amber-300/95 text-sm rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                  <Link href={`/${locale}/sell/step2`} className="text-amber-200 underline underline-offset-2 font-medium">
                    {t("stepMedia")}
                  </Link>
                  {" — "}
                  {t("mediaNotSynced")}
                </p>
              )}
            </>
          ) : (
            <p className="text-gray-400">{t("noMedia")}</p>
          )}
        </div>

        {/* Car details — spec table */}
        <div className="sell-glass p-5 md:p-6 shadow-xl shadow-black/25">
          <div className="flex flex-row items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">{t("reviewSpecsTitle")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/12 bg-white/[0.03] text-gray-200 hover:bg-white/10">
              <Link href={`/${locale}/sell/step3`}>
                <Edit className="h-4 w-4 mr-1.5" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <p className="text-xl font-bold text-white mb-4">
            {carDetails.year} {carDetails.make} {carDetails.model}
          </p>
          <dl>
            <SpecRow label={t("price")}>
              <span className="text-violet-300 font-semibold">
                ${carDetails.price ? parseFloat(carDetails.price).toLocaleString() : "0"}
              </span>
              {iqdApprox != null && (
                <span className="block text-sm text-gray-400 font-normal mt-1">
                  {t("iqdApprox", { amount: iqdApprox.toLocaleString() })}
                </span>
              )}
            </SpecRow>
            <SpecRow label={t("mileage")}>
              {carDetails.mileage ? parseInt(carDetails.mileage, 10).toLocaleString() : "0"}
            </SpecRow>
            <SpecRow label={t("transmission")}>{carDetails.transmission || "—"}</SpecRow>
            <SpecRow label={t("fuelType")}>{carDetails.fuel_type || "—"}</SpecRow>
            <SpecRow label={t("condition")}>{carDetails.condition || "—"}</SpecRow>
            <SpecRow label={t("color")}>{carDetails.color || "—"}</SpecRow>
            {carDetails.previous_owners ? (
              <SpecRow label={t("previousOwners")}>{carDetails.previous_owners}</SpecRow>
            ) : null}
            {carDetails.accident_history ? (
              <SpecRow label={t("accidentHistory")}>{carDetails.accident_history}</SpecRow>
            ) : null}
            {carDetails.features?.length ? (
              <SpecRow label={t("additionalFeatures")}>{carDetails.features.join(", ")}</SpecRow>
            ) : null}
          </dl>
        </div>

        {/* Location card */}
        <div className="sell-glass p-5 md:p-6 shadow-xl shadow-black/25">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MapPin className="h-5 w-5 text-violet-400" /> {t("location")}
            </h3>
            <Button variant="outline" size="sm" asChild className="border-white/12 bg-white/[0.03] text-gray-200 hover:bg-white/10">
              <Link href={`/${locale}/sell/step1`}>
                <Edit className="h-4 w-4 mr-1.5" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <div className="grid md:grid-cols-5 gap-4 items-stretch">
            <div className="sell-glass md:col-span-2 relative min-h-[140px] overflow-hidden">
              <div
                className="absolute inset-0 opacity-35 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
              <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                <MapPin
                  className={cn("h-12 w-12 text-violet-400 mb-2 motion-safe:animate-sell-pin")}
                  strokeWidth={1.5}
                />
                <p className="text-xs text-gray-500">{t("reviewLocationCard")}</p>
              </div>
            </div>
            <div className="sell-glass md:col-span-3 px-5 py-4 flex flex-col justify-center">
              <p className="text-lg font-semibold text-white leading-snug">
                {location.city}
                {location.neighborhood ? `, ${location.neighborhood}` : ""}
              </p>
              <p className="text-sm text-gray-400 mt-1">{t("reviewCountryLine")}</p>
            </div>
          </div>
        </div>

        {/* Contact card */}
        <div className="sell-glass p-5 md:p-6 shadow-xl shadow-black/25">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{t("reviewContactCard")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/12 bg-white/[0.03] text-gray-200 hover:bg-white/10">
              <Link href={`/${locale}/sell/step4`}>
                <Edit className="h-4 w-4 mr-1.5" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur-md divide-y divide-white/10 overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <Phone className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("phone")}</p>
                <p className="text-white font-medium">{maskIraqiMobileDisplay(contact.phone)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4">
              <MessageCircle className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("whatsappLabel")}</p>
                <p className="text-white font-medium">
                  {contact.whatsappSameAsPhone
                    ? maskIraqiMobileDisplay(contact.phone)
                    : maskIraqiMobileDisplay(contact.whatsapp ?? contact.phone)}
                </p>
                {contact.whatsappSameAsPhone && (
                  <p className="text-xs text-gray-500 mt-1">{t("whatsappSame")}</p>
                )}
              </div>
            </div>
            {contact.preferredContact ? (
              <div className="flex items-start gap-3 p-4">
                <Sparkles className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("preferredContact")}</p>
                  <p className="text-white font-medium">{contact.preferredContact}</p>
                </div>
              </div>
            ) : null}
            {bestTimeDisplay ? (
              <div className="flex items-start gap-3 p-4">
                <Clock className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t("bestTimeToCall")}</p>
                  <p className="text-white font-medium">{bestTimeDisplay}</p>
                </div>
              </div>
            ) : null}
            {contact.description ? (
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{t("descriptionLabel")}</p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {contact.description.length > 200 ? `${contact.description.slice(0, 200)}…` : contact.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Agreements */}
        <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-violet-500/35 via-indigo-500/15 to-transparent">
          <div className="sell-glass p-5 md:p-6">
            <h3 className="text-lg font-semibold text-white mb-1">{t("reviewAgreementsTitle")}</h3>
            <p className="text-xs text-gray-500 mb-5">{t("agreements")}</p>
            <div className="space-y-5">
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
                <Checkbox checked={agreeTerms} onCheckedChange={(c) => setAgreeTerms(!!c)} className="mt-0.5" />
                <span className="text-gray-300 text-sm leading-relaxed">
                  {t("agreeTermsBefore")}
                  <Link href={`/${locale}/privacy`} className="text-violet-400 hover:underline mx-0.5">
                    {tFooter("privacy")}
                  </Link>
                  {t("agreeTermsMid")}
                  <Link href={`/${locale}/terms`} className="text-violet-400 hover:underline mx-0.5">
                    {tFooter("terms")}
                  </Link>
                  {t("agreeTermsAfter")}
                </span>
              </label>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setPrivacyOpen((o) => !o)}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 w-full"
                >
                  {privacyOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  {t("privacySummary")}
                </button>
                {privacyOpen && (
                  <ul className="mt-3 text-sm text-gray-500 space-y-2 pl-1">
                    <li className="flex gap-2"><span className="text-violet-500">•</span>{t("privacy1")}</li>
                    <li className="flex gap-2"><span className="text-violet-500">•</span>{t("privacy2")}</li>
                    <li className="flex gap-2"><span className="text-violet-500">•</span>{t("privacy3")}</li>
                    <li className="flex gap-2"><span className="text-violet-500">•</span>{t("privacy4")}</li>
                  </ul>
                )}
              </div>

              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors">
                <Checkbox checked={agreeSeller} onCheckedChange={(c) => setAgreeSeller(!!c)} className="mt-0.5" />
                <span className="text-gray-300 text-sm leading-relaxed">{t("agreeSeller")}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/sell/step4`)}
            className="h-12 px-6 text-base border-white/15 bg-white/[0.03] text-gray-200 hover:bg-white/10 hover:text-white"
          >
            {t("backToEdit")}
          </Button>
          <Button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!canPublish || publishing}
            aria-busy={publishing}
            className={cn(
              "h-14 px-10 text-base sm:text-lg font-semibold rounded-xl border-0 transition-all duration-300",
              "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500",
              "text-white shadow-xl shadow-indigo-500/30 disabled:opacity-45 disabled:shadow-none",
              canPublish && !publishing && "motion-safe:animate-publish-glow ring-2 ring-violet-400/35"
            )}
          >
            {publishing ? (
              <Loader2 className="h-6 w-6 animate-spin mr-2 inline" aria-hidden />
            ) : (
              <CheckCircle className="h-6 w-6 mr-2 inline" aria-hidden />
            )}
            {publishing ? t("publishing") : t("publishListing")}
          </Button>
        </div>
      </div>
    </div>
  )
}
