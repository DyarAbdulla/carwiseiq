"use client"
export const runtime = 'edge';

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useSellWizard } from "@/context/SellWizardContext"
import { useAuthContext } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  Edit,
  MapPin,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { Transmission, FuelType, CarCondition } from "@/lib/database.types"

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

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, "")
  if (d.length < 4) return p
  return `+964 XXX XXX **${d.slice(-2)}`
}

export default function SellStep5Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const tFooter = useTranslations("footer")
  const { toast } = useToast()
  const { user } = useAuthContext()
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

  const canPublish =
    agreeTerms &&
    agreeSeller &&
    !!location?.city &&
    !!carDetails?.make &&
    !!carDetails?.model &&
    !!carDetails?.year &&
    !!contact?.phone &&
    uploadedMediaUrls.length > 0

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

    if (!canPublish || !location || !carDetails || !contact) {
      console.error("=== PUBLISH FAILED ===", "canPublish or required data missing", { canPublish, hasLocation: !!location, hasCarDetails: !!carDetails, hasContact: !!contact })
      return
    }
    if (publishSubmitted.current) {
      console.log("[Publish] Blocked: already submitted (double-click)")
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

      const phoneDigits = contact.phone.replace(/\D/g, "").replace(/^964/, "").slice(-10)
      const phoneFull = `+964${phoneDigits}`
      const whatsappFull = contact.whatsappSameAsPhone
        ? phoneFull
        : (contact.whatsapp || "").replace(/\D/g, "").length >= 10
          ? `+964${contact.whatsapp.replace(/\D/g, "").replace(/^964/, "").slice(-10)}`
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

      // Log create listing activity
      const { activityHelpers } = await import('@/lib/activityLogger')
      activityHelpers.logCreateListing(id, title, Number(price))

      setPublishedListingId(id)
      clearDraft()
      setPublishing(false)
      toast({ title: "Listing published", description: "Your car is now live on CarWiseIQ." })
      router.push(`/${locale}/sell/success?id=${id}`)
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
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }, [canPublish, location, media.length, uploadedMediaUrls, carDetails, contact, setPublishedListingId, clearDraft, router, locale, toast, t])

  if (!location || !carDetails || !contact) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 min-h-[70vh]">
        <p className="text-gray-400">{t("missingData")}</p>
        <Button variant="outline" onClick={() => router.push(`/${locale}/sell/step1`)} className="border-gray-600 text-gray-300">
          {t("startOver")}
        </Button>
      </div>
    )
  }

  return (
    <div className="relative px-4 py-12 md:py-16">
      {/* Ambient gradient glow - Enhanced for active step */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl opacity-60" />
      </div>
      
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">{t("reviewTitle")}</h1>
          <p className="text-gray-400 text-lg">{t("reviewDescription")}</p>
        </div>

        {/* 1. Media */}
        <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{t("photosVideos")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/10 text-gray-300 hover:bg-white/5">
              <Link href={`/${locale}/sell/step2`}>
                <Edit className="h-4 w-4 mr-1" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <div>
            {media.length > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {media.slice(0, 8).map((m) => (
                    <div key={m.id} className="aspect-square rounded-lg overflow-hidden bg-gray-700 relative">
                      {m.isVideo ? (
                        <video src={m.previewUrl} muted className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      {m.isCover && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs bg-indigo-600 text-white">{t("cover")}</span>
                      )}
                    </div>
                  ))}
                </div>
                {uploadedMediaUrls.length === 0 && (
                  <p className="mt-2 text-amber-400 text-sm">
                    <Link href={`/${locale}/sell/step2`} className="underline">Go to Media</Link> and click Continue to upload.
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-400">{t("noMedia")}</p>
            )}
          </div>
        </div>

        {/* 2. Car Details */}
        <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{t("carDetails")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/10 text-gray-300 hover:bg-white/5">
              <Link href={`/${locale}/sell/step3`}>
                <Edit className="h-4 w-4 mr-2" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <div className="space-y-2 text-gray-300">
            <p className="text-white font-semibold">{carDetails.year} {carDetails.make} {carDetails.model}</p>
            <p className="text-xl font-bold text-indigo-400">${carDetails.price ? parseFloat(carDetails.price).toLocaleString() : "0"}</p>
            <p>Mileage: {carDetails.mileage ? parseInt(carDetails.mileage, 10).toLocaleString() : "0"} km</p>
            <p>Transmission: {carDetails.transmission || "—"}</p>
            <p>Fuel: {carDetails.fuel_type || "—"}</p>
            <p>Condition: {carDetails.condition || "—"}</p>
            <p>Color: {carDetails.color || "—"}</p>
            {carDetails.features?.length ? <p>Features: {carDetails.features.join(", ")}</p> : null}
          </div>
        </div>

        {/* 3. Location */}
        <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><MapPin className="h-4 w-4" /> {t("location")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/10 text-gray-300 hover:bg-white/5">
              <Link href={`/${locale}/sell/step1`}>
                <Edit className="h-4 w-4 mr-2" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <div className="text-gray-300">
            {location.city}{location.neighborhood ? `, ${location.neighborhood}` : ""}, Iraq
          </div>
        </div>

        {/* 4. Contact */}
        <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-row items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{t("contact")}</h3>
            <Button variant="outline" size="sm" asChild className="border-white/10 text-gray-300 hover:bg-white/5">
              <Link href={`/${locale}/sell/step4`}>
                <Edit className="h-4 w-4 mr-2" /> {t("edit")}
              </Link>
            </Button>
          </div>
          <div className="space-y-1 text-gray-300">
            <p>Phone: {maskPhone(contact.phone)}</p>
            {!contact.whatsappSameAsPhone && contact.whatsapp && <p>WhatsApp: {maskPhone(contact.whatsapp)}</p>}
            {contact.preferredContact && <p>Preferred: {contact.preferredContact}</p>}
            {contact.bestTimeToCall?.length ? <p>Best time: {contact.bestTimeToCall.join(", ")}</p> : null}
            {contact.description && <p className="mt-2 text-sm">{contact.description.slice(0, 120)}…</p>}
          </div>
        </div>

        {/* Terms */}
        <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-white mb-4">{t("agreements")}</h3>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={agreeTerms} onCheckedChange={(c) => setAgreeTerms(!!c)} />
              <span className="text-gray-300 text-sm">
                {t("agreeTermsBefore")}
                <Link href={`/${locale}/privacy`} className="text-indigo-400 hover:underline">{tFooter("privacy")}</Link>
                {t("agreeTermsMid")}
                <Link href={`/${locale}/terms`} className="text-indigo-400 hover:underline">{tFooter("terms")}</Link>
                {t("agreeTermsAfter")}
              </span>
            </label>

            <div>
              <button
                type="button"
                onClick={() => setPrivacyOpen((o) => !o)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300"
              >
                {privacyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {t("privacySummary")}
              </button>
              {privacyOpen && (
                <ul className="mt-2 text-sm text-gray-500 list-disc list-inside space-y-1">
                  <li>{t("privacy1")}</li>
                  <li>{t("privacy2")}</li>
                  <li>{t("privacy3")}</li>
                  <li>{t("privacy4")}</li>
                </ul>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={agreeSeller} onCheckedChange={(c) => setAgreeSeller(!!c)} />
              <span className="text-gray-300 text-sm">
                {t("agreeSeller")}
              </span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/${locale}/sell/step4`)}
            className="border-white/10 text-gray-300 hover:bg-white/5 h-12 px-6 text-base"
          >
            {t("backToEdit")}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={!canPublish || publishing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 h-12 px-8 text-base font-medium shadow-lg shadow-indigo-500/20"
          >
            {publishing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
            {publishing ? t("publishing") : t("publishListing")}
          </Button>
        </div>
      </div>
    </div>
  )
}
