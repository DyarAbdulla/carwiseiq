"use client"

import { useState, useEffect, useCallback } from "react"
import { useLocale } from "next-intl"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { apiClient } from "@/lib/api"
import { listingImageUrl } from "@/lib/utils"
import { SoldBadge } from "@/components/ui/sold-badge"
import { AdminListingControls } from "@/components/admin/AdminListingControls"
import { Search, Car, Loader2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type StatusFilter = "all" | "active" | "sold" | "deleted"

export default function AdminListingsPage() {
  const [listings, setListings] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [acting, setActing] = useState(false)
  const locale = useLocale()
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiClient.getAdminListings({
        page,
        page_size: 20,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search || undefined,
      })
      setListings(data.items || [])
      setTotal(data.total ?? 0)
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load listings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search, toast])

  useEffect(() => {
    load()
  }, [load])

  const onMarkSold = useCallback(
    async (id: number) => {
      await apiClient.adminPatchListing(id, { status: "sold" })
      load()
    },
    [load]
  )

  const onMarkAvailable = useCallback(
    async (id: number) => {
      await apiClient.adminPatchListing(id, { status: "active" })
      load()
    },
    [load]
  )

  const onDelete = useCallback(
    async (id: number) => {
      await apiClient.adminDeleteListing(id)
      load()
    },
    [load]
  )

  const toggleSelect = (id: number) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectAll = () => {
    if (selected.size === listings.length) setSelected(new Set())
    else setSelected(new Set(listings.map((l) => l.id)))
  }

  const bulkMarkSold = async () => {
    if (selected.size === 0) return
    setActing(true)
    try {
      for (const id of Array.from(selected)) {
        await apiClient.adminPatchListing(id, { status: "sold" })
      }
      setSelected(new Set())
      toast({ title: "Marked as sold", description: `${selected.size} listing(s) updated.` })
      load()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Bulk update failed",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  const bulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} listing(s)? This cannot be undone.`)) return
    setActing(true)
    try {
      for (const id of Array.from(selected)) {
        await apiClient.adminDeleteListing(id)
      }
      setSelected(new Set())
      toast({ title: "Deleted", description: `${selected.size} listing(s) removed.`, variant: "destructive" })
      load()
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Bulk delete failed",
        variant: "destructive",
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Listings Management</h1>
        <p className="text-gray-400 mt-2">View and manage all marketplace listings</p>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Filters &amp; actions</CardTitle>
          <CardDescription className="text-gray-400">Filter by status and use bulk actions</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="pl-9 bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-white">All</SelectItem>
              <SelectItem value="active" className="text-white">Active</SelectItem>
              <SelectItem value="sold" className="text-white">Sold</SelectItem>
              <SelectItem value="deleted" className="text-white">Deleted</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={load} variant="outline" className="border-gray-600" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {listings.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === listings.length && listings.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-gray-400">Select all on page</span>
            </div>
          )}
          {selected.size > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={bulkMarkSold}
                disabled={acting}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark as sold"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
                onClick={bulkDelete}
                disabled={acting}
              >
                Delete selected
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : listings.length === 0 ? (
            <div className="py-16 text-center text-gray-400">No listings found</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {listings.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-gray-700/50"
                >
                  <div
                    className="flex items-center gap-3 sm:w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selected.has(l.id)}
                      onCheckedChange={() => toggleSelect(l.id)}
                    />
                  </div>
                  <Link
                    href={`/${locale}/buy-sell/${l.id}`}
                    className="flex flex-1 gap-4 min-w-0"
                  >
                    <div className="relative h-20 w-28 shrink-0 rounded bg-gray-700 overflow-hidden">
                      {(l.cover_thumbnail_url || l.cover_image) ? (
                        <img
                          src={listingImageUrl(l.cover_thumbnail_url || l.cover_image)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Car className="h-8 w-8 text-gray-500" />
                        </div>
                      )}
                      {(l.status === "sold" || l.status === "Sold") && <SoldBadge variant="corner" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">
                        {l.year} {l.make} {l.model}
                      </p>
                      <p className="text-green-400 font-semibold">${l.price?.toLocaleString()}</p>
                      <p className="text-sm text-gray-400">
                        {l.location_city}, {l.location_state} • {l.mileage?.toLocaleString()} {l.mileage_unit}
                      </p>
                    </div>
                  </Link>
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <AdminListingControls
                      listingId={l.id}
                      locale={locale}
                      status={l.status}
                      onMarkSold={() => onMarkSold(l.id)}
                      onMarkAvailable={() => onMarkAvailable(l.id)}
                      onDelete={() => onDelete(l.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            className="border-gray-600"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-gray-400">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            className="border-gray-600"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20) || loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
