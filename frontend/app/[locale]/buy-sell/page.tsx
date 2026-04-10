import { Suspense } from "react"
import { BuySellPageClient } from "./BuySellPageClient"
import { ListingCardSkeleton } from "@/components/common/LoadingSkeleton"

type BuySellSearchParams = { id?: string | string[] }

function pickListingId(sp: BuySellSearchParams | undefined): string | undefined {
  const raw = sp?.id
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === "string" ? v.trim() : undefined
}

/** Static export: searchParams are empty at build time; client reads ?id= on hydrate/navigation. */
export const dynamic = "force-static"

export default function BuySellPage({
  searchParams,
}: {
  searchParams: BuySellSearchParams
}) {
  const serverListingId = pickListingId(searchParams)

  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] overflow-x-hidden bg-transparent px-4 py-10">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <BuySellPageClient serverListingId={serverListingId} />
    </Suspense>
  )
}
