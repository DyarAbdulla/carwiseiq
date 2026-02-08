"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useLocale } from "next-intl"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Eye, Share2, Plus, List, MapPin } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

function firstImage(images: unknown): string | null {
  if (!images || !Array.isArray(images)) return null
  const v = images[0]
  if (typeof v === "string") return v
  if (v && typeof (v as { url?: string }).url === "string") return (v as { url: string }).url
  return null
}

export default function SellSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const { toast } = useToast()
  const listingId = searchParams?.get("id") ?? ""

  const [listing, setListing] = useState<{ title?: string; price?: number; location?: string; make?: string; model?: string; year?: number; images?: unknown } | null>(null)

  useEffect(() => {
    if (!listingId) return
    void (async () => {
      try {
        const { data } = await supabase
          .from("car_listings")
          .select("title, price, location, make, model, year, images")
          .eq("id", listingId)
          .single()
        setListing(data as { title?: string; price?: number; location?: string; make?: string; model?: string; year?: number; images?: unknown } | null)
      } catch {
        setListing(null)
      }
    })()
  }, [listingId])

  const listingUrl = typeof window !== "undefined" ? `${window.location.origin}/${locale}/buy-sell/${listingId}` : ""
  const shareText = listing ? `Check out this car: ${listing.title || "Car"} - $${listing?.price?.toLocaleString()}` : "Check out this car on CarWiseIQ"

  const copyLink = () => {
    if (!listingUrl) return
    navigator.clipboard.writeText(listingUrl).then(
      () => toast({ title: "Link copied" }),
      () => toast({ title: "Could not copy", variant: "destructive" })
    )
  }

  const shareWhatsApp = () => {
    const u = `https://wa.me/?text=${encodeURIComponent(shareText + " " + listingUrl)}`
    window.open(u, "_blank")
  }

  const shareFacebook = () => {
    const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`
    window.open(u, "_blank")
  }

  const addAnother = () => {
    router.push(`/${locale}/sell/step1`)
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 min-h-[70vh]">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex p-4 rounded-full bg-emerald-500/20 mb-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Your Car is Now Listed!</h1>
          <p className="text-gray-400">Your listing is now live on the CarWiseIQ marketplace.</p>
        </div>

        {/* Listing preview card */}
        {listing && (
          <Card className="bg-gray-800 border-gray-700 overflow-hidden">
            <div className="aspect-video bg-gray-700 relative">
              {firstImage(listing.images) ? (
                <img
                  src={firstImage(listing.images)!}
                  alt={listing.title || "Car"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
              )}
            </div>
            <CardContent className="p-4">
              <h3 className="text-lg font-bold text-white">{listing.title || `${listing.year} ${listing.make} ${listing.model}`}</h3>
              <p className="text-xl font-bold text-indigo-400">${listing.price?.toLocaleString() ?? "0"}</p>
              {listing.location && (
                <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" /> {listing.location}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-500 min-h-[48px]">
            <Link href={`/${locale}/buy-sell/${listingId}`}>
              <Eye className="h-5 w-5 mr-2" /> View My Listing
            </Link>
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={shareWhatsApp}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 min-h-[44px]"
            >
              <Share2 className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={shareFacebook}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 min-h-[44px]"
            >
              <Share2 className="h-4 w-4 mr-2" /> Facebook
            </Button>
            <Button
              variant="outline"
              onClick={copyLink}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 min-h-[44px]"
            >
              <Share2 className="h-4 w-4 mr-2" /> Copy link
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={addAnother}
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Another Car
          </Button>

          <Button asChild variant="ghost" className="w-full text-gray-400 hover:text-white">
            <Link href={`/${locale}/my-listings`}>
              <List className="h-4 w-4 mr-2" /> Go to My Listings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
