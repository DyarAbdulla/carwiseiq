"use client"

import { useSearchParams } from "next/navigation"
import ListingDetailClient from "@/components/marketplace/ListingDetailClient"
import { MarketplaceBrowse } from "@/components/marketplace/MarketplaceBrowse"

export type BuySellPageClientProps = {
  /** From server `searchParams` when available (often empty at static build time). */
  serverListingId?: string
}

function BuySellBackdrop() {
  return (
    <>
      <div className="fixed inset-0 -z-20 overflow-hidden" aria-hidden>
        <img
          src="/logobuysell.jpg"
          alt=""
          decoding="async"
          className="h-full min-h-[100dvh] w-full object-cover object-center [transform:translateZ(0)]"
        />
      </div>
      <div
        aria-hidden
        className="fixed inset-0 -z-10 h-full min-h-[100dvh] w-full bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-[#0a0f1c] backdrop-blur-[2px]"
      />
    </>
  )
}

/**
 * Resolves listing id from the URL query (?id=) on the client.
 * Merges with serverListingId so direct loads and static export both work.
 */
export function BuySellPageClient({ serverListingId }: BuySellPageClientProps) {
  const searchParams = useSearchParams()
  const fromQuery = searchParams?.get("id")?.trim()
  const id = fromQuery || serverListingId?.trim()

  return (
    <div className="relative min-h-[100dvh]">
      <BuySellBackdrop />
      <div className="relative z-10">
        {id ? <ListingDetailClient id={id} /> : <MarketplaceBrowse />}
      </div>
    </div>
  )
}
