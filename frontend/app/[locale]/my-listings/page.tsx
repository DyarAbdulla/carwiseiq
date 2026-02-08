'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { apiClient } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useAuthSession } from '@/lib/useAuthSession'
import { activityHelpers } from '@/lib/activityLogger'
import type { CarListing, CarListingUpdate } from '@/lib/database.types'
import type { Transmission, FuelType, CarCondition } from '@/lib/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { formatCurrency, listingImageUrl, isVideoUrl } from '@/lib/utils'
import {
  Plus,
  Pencil,
  CheckCircle2,
  Car,
  Loader2,
  Calendar,
  MapPin,
  DollarSign,
  Eye,
  Trash2,
  XCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'

function firstImageUrl(images: unknown): string | null {
  if (!images || !Array.isArray(images)) return null
  const first = images[0]
  if (typeof first === 'string') return first
  if (first && typeof (first as { url?: string }).url === 'string') return (first as { url: string }).url
  return null
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const TRANSMISSIONS: Transmission[] = ['automatic', 'manual']
const FUEL_TYPES: FuelType[] = ['petrol', 'diesel', 'electric', 'hybrid']
const CONDITIONS: CarCondition[] = ['excellent', 'good', 'fair']

function isNumericId(id: string): boolean {
  return /^\d+$/.test(String(id || '').trim())
}

function normalizeSupabaseListing(row: Record<string, unknown>): Record<string, unknown> {
  const rawImages = (row.images as unknown[]) || []
  const images = rawImages.map((u: unknown) =>
    typeof u === 'string' ? { url: u } : { url: (u as { url?: string })?.url ?? u }
  )
  const firstUrl = rawImages[0]
  const cover_image = typeof firstUrl === 'string' ? firstUrl : (firstUrl as { url?: string })?.url

  const parts = (String(row.location || ''))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const location_country = parts[parts.length - 1] || ''
  const location_state = parts.length > 2 ? parts[1] : ''
  const location_city = parts[0] || ''

  const cond = String(row.condition || '')
  const condition = cond ? cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase() : ''

  return {
    ...row,
    images,
    cover_image,
    location_city,
    location_state,
    location_country,
    location: row.location,
    mileage_unit: 'km',
    color: row.color || '',
    features: Array.isArray(row.features) ? row.features : [],
    phone: row.phone || undefined,
    phone_country_code: row.phone_country_code || undefined,
    whatsapp: row.whatsapp || undefined,
    vin: row.vin || undefined,
    trim: row.trim || '',
    condition,
  }
}

function MyListingsContent() {
  const locale = useLocale() || 'en'
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Use deterministic auth session hook
  const { user: currentUser, sessionLoaded } = useAuthSession()
  const [listings, setListings] = useState<CarListing[]>([])
  const didOpenEditRef = useRef<string | null>(null)
  const fetchAbortControllerRef = useRef<AbortController | null>(null)

  // Delete state (must be at top level, before any early returns)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams?.get('success') === 'listing-created') {
      router.replace(`/${locale}/my-listings`, { scroll: false })
    }
  }, [searchParams, locale, router])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CarListing | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [togglingSoldId, setTogglingSoldId] = useState<string | null>(null)
  const [confirmToggleSold, setConfirmToggleSold] = useState<CarListing | null>(null)

  const [form, setForm] = useState({
    title: '',
    make: '',
    model: '',
    year: '',
    price: '',
    mileage: '',
    transmission: '' as Transmission | '',
    fuel_type: '' as FuelType | '',
    condition: '' as CarCondition | '',
    location: '',
    description: '',
    imagesText: '',
    is_sold: false,
  })

  const fetchListings = useCallback(async () => {
    // Always reset loading state when starting fetch
    setLoading(true)
    setError(null)

    if (!currentUser) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [FETCH_LISTINGS] No user, skipping fetch')
      }
      setLoading(false)
      return
    }

    // Cancel previous request if any
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    fetchAbortControllerRef.current = abortController

    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [FETCH_LISTINGS] Starting fetch, user:', currentUser.id)
    }

    try {
      const response = await apiClient.getMyListings()

      // Check if request was aborted
      if (abortController.signal.aborted) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_LISTINGS] Request aborted')
        }
        return
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [FETCH_LISTINGS] Response received, count:', response?.listings?.length || 0)
      }

      const listingsData = response?.listings || []
      setListings(listingsData as CarListing[])
      setError(null)
    } catch (e: any) {
      // Ignore abort errors
      if (e.name === 'AbortError' || abortController.signal.aborted) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_LISTINGS] Request aborted (ignoring error)')
        }
        return
      }

      if (process.env.NODE_ENV === 'development') {
        console.error('[MyListings] [FETCH_LISTINGS] Error:', e.response?.status, e.message)
      }

      const errorMsg = e.response?.data?.detail || e.message || 'Failed to load listings'
      setError(errorMsg)
      setListings([])

      // Handle 401 errors
      if (e.response?.status === 401) {
        toast({
          title: 'Session Expired',
          description: 'Your session has expired. Please login again.',
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive'
        })
      }
    } finally {
      // CRITICAL: Always set loading to false, even if aborted
      if (!abortController.signal.aborted) {
        setLoading(false)
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_LISTINGS] Fetch completed, loading = false')
        }
      } else {
        setLoading(false)
      }
    }
  }, [currentUser, toast])

  // STEP 2: After session loads, fetch listings if user exists
  useEffect(() => {
    // Reset loading state when session or user changes
    if (!sessionLoaded) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [FETCH_LISTINGS] Waiting for session to load...')
      }
      setLoading(true)
      return
    }

    // CRITICAL: Always resolve loading state when sessionLoaded is true
    if (!currentUser) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [FETCH_LISTINGS] No user, redirecting to login')
      }
      setLoading(false)
      router.replace(`/${locale}/login`)
      return
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [FETCH_LISTINGS] Session loaded, user exists, fetching listings...')
    }
    fetchListings()

    // Cleanup: abort request on unmount or when dependencies change
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort()
      }
    }
  }, [sessionLoaded, currentUser, router, locale, fetchListings])

  const openEdit = useCallback((listing: CarListing) => {
    if (!currentUser?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MyListings] [OPEN_EDIT] No user, cannot open edit')
      }
      return
    }

    const listingUserId = String(listing.user_id || '')
    const currentUserId = String(currentUser?.id || '')

    if (listingUserId !== currentUserId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MyListings] [OPEN_EDIT] User does not own listing')
      }
      return
    }

    // Prevent duplicate opens
    if (didOpenEditRef.current === String(listing.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [OPEN_EDIT] Already opening this listing, skipping')
      }
      return
    }

    didOpenEditRef.current = String(listing.id)

    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [OPEN_EDIT] Opening edit modal for listing:', listing.id)
    }

    setEditing(listing)
    const imgs = listing.images as string[] | null | undefined
    const arr = Array.isArray(imgs) ? imgs : []
    setForm({
      title: listing.title,
      make: listing.make,
      model: listing.model,
      year: String(listing.year),
      price: String(listing.price),
      mileage: String(listing.mileage),
      transmission: listing.transmission,
      fuel_type: listing.fuel_type,
      condition: listing.condition,
      location: listing.location,
      description: listing.description ?? '',
      imagesText: arr.filter((x) => typeof x === 'string').join('\n'),
      is_sold: listing.is_sold,
    })
    setEditOpen(true)

    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [OPEN_EDIT] Modal opened, editOpen = true')
    }
  }, [currentUser?.id])

  const closeEdit = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [CLOSE_EDIT] Closing edit modal')
    }

    setEditOpen(false)
    setEditing(null)
    didOpenEditRef.current = null

    // Clean URL param - remove ?edit= if present
    const pathname = `/${locale}/my-listings`
    router.replace(pathname, { scroll: false })

    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [CLOSE_EDIT] Modal closed, URL cleaned')
    }
  }, [router, locale])

  // Fetch a single listing by ID (handles both numeric IDs and UUIDs)
  const fetchListingById = useCallback(async (editId: string): Promise<CarListing | null> => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [FETCH_BY_ID] START - editId:', editId)
    }

    try {
      const numeric = isNumericId(editId)
      if (numeric) {
        // Fetch from REST API
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_BY_ID] Fetching from REST API (numeric ID)')
        }
        const idNum = parseInt(editId, 10)
        const data = await apiClient.getListing(idNum)

        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_BY_ID] REST API result:', !!data, 'id:', data?.id)
        }

        if (!data) return null
        return { ...data, fromSupabase: false } as CarListing
      } else {
        // Fetch from Supabase
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_BY_ID] Fetching from Supabase (UUID)')
        }
        const { data, error } = await supabase
          .from('car_listings')
          .select('*')
          .eq('id', String(editId).trim())
          .single()

        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_BY_ID] Supabase result:', !!data, 'error:', error?.message)
        }

        if (error || !data) return null

        const normalized = normalizeSupabaseListing(data as Record<string, unknown>)
        const result = { ...normalized, fromSupabase: true } as CarListing

        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [FETCH_BY_ID] END - Success, listing id:', result.id)
        }

        return result
      }
    } catch (e: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MyListings] [FETCH_BY_ID] END - Error:', e.message)
      }
      return null
    }
  }, [])

  // STEP 3: Handle ?edit= parameter - DETERMINISTIC (no timeouts, no races)
  useEffect(() => {
    const editId = searchParams?.get('edit')

    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [EDIT_PARAM] editId:', editId, 'sessionLoaded:', sessionLoaded, 'currentUser:', !!currentUser)
    }

    // No edit ID, nothing to do
    if (!editId) {
      didOpenEditRef.current = null
      return
    }

    // Prevent opening same edit twice
    if (didOpenEditRef.current === editId) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [EDIT_PARAM] Already opened this edit, skipping')
      }
      return
    }

    // Wait for session to load
    if (!sessionLoaded) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [EDIT_PARAM] Waiting for session to load...')
      }
      return
    }

    // User must be authenticated
    if (!currentUser?.id) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [EDIT_PARAM] No user, cannot open edit')
      }
      router.replace(`/${locale}/my-listings`, { scroll: false })
      return
    }

    // Mark as processing to prevent duplicate opens
    didOpenEditRef.current = editId

    const userId = String(currentUser.id)

    // Fast path: Check if listing is already in array
    const existingListing = listings.find((l) => String(l.id) === String(editId))
    if (existingListing) {
      const listingUserId = String(existingListing.user_id || '')
      if (listingUserId === userId) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [EDIT_PARAM] Found in array, opening edit:', existingListing.id)
        }
        openEdit(existingListing)
        router.replace(`/${locale}/my-listings`, { scroll: false })
        return
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[MyListings] [EDIT_PARAM] User does not own listing')
        }
        toast({
          title: 'Error',
          description: 'You can only edit your own listings.',
          variant: 'destructive'
        })
        router.replace(`/${locale}/my-listings`, { scroll: false })
        didOpenEditRef.current = null
        return
      }
    }

    // Listing not in array - fetch it directly by ID
    if (process.env.NODE_ENV === 'development') {
      console.log('[MyListings] [EDIT_PARAM] Not in array, fetching by ID:', editId)
    }

    const fetchAndOpen = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[MyListings] [EDIT_PARAM] Starting fetchAndOpen for editId:', editId)
      }

      try {
        const fetchedListing = await fetchListingById(editId)

        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [EDIT_PARAM] Fetch completed, result:', !!fetchedListing, 'id:', fetchedListing?.id)
        }

        if (!fetchedListing) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MyListings] [EDIT_PARAM] Listing not found')
          }
          toast({
            title: 'Error',
            description: 'Listing not found.',
            variant: 'destructive'
          })
          router.replace(`/${locale}/my-listings`, { scroll: false })
          didOpenEditRef.current = null
          return
        }

        // Verify ownership
        const listingUserId = String(fetchedListing.user_id || '')
        if (listingUserId !== userId) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[MyListings] [EDIT_PARAM] Ownership mismatch:', listingUserId, 'vs', userId)
          }
          toast({
            title: 'Error',
            description: 'You can only edit your own listings.',
            variant: 'destructive'
          })
          router.replace(`/${locale}/my-listings`, { scroll: false })
          didOpenEditRef.current = null
          return
        }

        // Open edit modal
        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [EDIT_PARAM] Opening edit modal for listing:', fetchedListing.id)
        }
        openEdit(fetchedListing)

        // Clean URL param after opening
        router.replace(`/${locale}/my-listings`, { scroll: false })

        if (process.env.NODE_ENV === 'development') {
          console.log('[MyListings] [EDIT_PARAM] Modal opened successfully')
        }
      } catch (e: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[MyListings] [EDIT_PARAM] Error in fetchAndOpen:', e)
        }
        toast({
          title: 'Error',
          description: e.message || 'Failed to load listing.',
          variant: 'destructive'
        })
        router.replace(`/${locale}/my-listings`, { scroll: false })
        didOpenEditRef.current = null
      }
    }

    fetchAndOpen()
  }, [sessionLoaded, currentUser, listings, searchParams, locale, router, openEdit, toast, fetchListingById])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !currentUser || String(editing.user_id) !== String(currentUser.id)) return
    setSaving(true)
    try {
      const imagesText = form.imagesText.trim()
      const images = imagesText
        ? imagesText.split(/\n/).map((s) => s.trim()).filter(Boolean)
        : []

      const payload: CarListingUpdate = {
        title: form.title.trim() || editing.title,
        make: form.make.trim() || editing.make,
        model: form.model.trim() || editing.model,
        year: form.year ? parseInt(form.year, 10) : editing.year,
        price: form.price ? parseFloat(form.price) : editing.price,
        mileage: form.mileage ? parseInt(form.mileage, 10) : editing.mileage,
        transmission: (form.transmission || editing.transmission) as Transmission,
        fuel_type: (form.fuel_type || editing.fuel_type) as FuelType,
        condition: (form.condition || editing.condition) as CarCondition,
        location: form.location.trim() || editing.location,
        description: form.description.trim() || null,
        images: images,
        is_sold: form.is_sold,
      }

      console.log('[MyListings] Updating listing:', editing.id, payload)
      await apiClient.updateDraftListing(Number(editing.id), payload)

      // Log activity
      const title = payload.title || `${payload.make} ${payload.model} ${payload.year}`
      activityHelpers.logListingEdited(String(editing.id), title)

      toast({ title: 'Success', description: 'Listing updated!' })
      closeEdit()
      await fetchListings()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update listing'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleToggleSold = async (listing: CarListing) => {
    if (!currentUser || String(listing.user_id) !== String(currentUser.id)) {
      toast({ title: 'Error', description: 'You can only manage your own listings.', variant: 'destructive' })
      return
    }
    setTogglingSoldId(listing.id)
    try {
      console.log('[MyListings] Toggling sold status for listing:', listing.id, 'New status:', !listing.is_sold)
      await apiClient.updateDraftListing(Number(listing.id), { is_sold: !listing.is_sold })

      // Log activity
      const title = listing.title || `${listing.year} ${listing.make} ${listing.model}`
      if (!listing.is_sold) {
        activityHelpers.logMarkSold(String(listing.id), title)
      } else {
        activityHelpers.logEditListing(String(listing.id), title)
      }

      setConfirmToggleSold(null)
      await fetchListings()
      toast({
        title: 'Success',
        description: listing.is_sold ? 'Listing marked as active' : 'Car marked as sold!',
      })
    } catch (e: unknown) {
      console.error('[MyListings] Error toggling sold status:', e)
      const msg = e instanceof Error ? e.message : 'Failed to update'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setTogglingSoldId(null)
    }
  }

  // Show loading state while session is loading
  if (!sessionLoaded) {
    return (
      <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-center min-h-[280px] gap-4">
          <LoadingSpinner size="lg" className="text-[#5B7FFF]" />
          <p className="text-[#94a3b8]">Checking authentication…</p>
        </div>
      </div>
    )
  }

  // Redirect if not authenticated (after session loaded)
  if (!currentUser) {
    return (
      <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-center min-h-[280px] gap-4">
          <p className="text-[#94a3b8]">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  // Show loading while fetching listings
  if (loading) {
    return (
      <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-center min-h-[280px] gap-4">
          <LoadingSpinner size="lg" className="text-[#5B7FFF]" />
          <p className="text-[#94a3b8]">Loading your listings…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="mx-auto max-w-7xl">
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="py-8 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button
                variant="outline"
                className="border-[#2a2d3a] text-white"
                onClick={() => fetchListings()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleDelete = async (listingId: string) => {
    setDeletingId(listingId)
    try {
      await apiClient.deleteListing(Number(listingId))
      toast({
        title: 'Success',
        description: 'Listing deleted successfully',
      })
      await fetchListings()
      setDeleteConfirmOpen(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete listing'
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Calculate stats dynamically
  const activeCount = listings.filter((l) => !l.is_sold).length
  const soldCount = listings.filter((l) => l.is_sold).length
  const totalViews = listings.reduce((sum, item) => sum + ((item as any).views || 0), 0)

  return (
    <div className="relative min-h-screen">
      {/* Ambient gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">My Listings</h1>
            <p className="text-sm text-slate-600 dark:text-gray-400">Manage your car listings and track performance</p>
          </div>
          <Button
            onClick={() => router.push(`/${locale}/sell/step1`)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 h-11 px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Listing
          </Button>
        </div>

        {/* Glass Stats Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {/* Total Listings */}
          <div className="backdrop-blur-md bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <Car className="h-5 w-5 text-slate-700 dark:text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{listings.length}</p>
            <p className="text-sm text-slate-600 dark:text-gray-400">Total Listings</p>
          </div>

          {/* Active */}
          <div className="backdrop-blur-md bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{activeCount}</p>
            <p className="text-sm text-slate-600 dark:text-gray-400">Active</p>
          </div>

          {/* Sold */}
          <div className="backdrop-blur-md bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <DollarSign className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{soldCount}</p>
            <p className="text-sm text-slate-600 dark:text-gray-400">Sold</p>
          </div>

          {/* Views */}
          <div className="backdrop-blur-md bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                <Eye className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{totalViews.toLocaleString()}</p>
            <p className="text-sm text-slate-600 dark:text-gray-400">Total Views</p>
          </div>
        </div>

        {/* Empty State */}
        {listings.length === 0 ? (
          <div className="backdrop-blur-md bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-12 md:p-16 text-center shadow-sm">
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-slate-200 dark:border-white/10 flex items-center justify-center mb-6">
              <Car className="h-12 w-12 text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">You don&apos;t have any listings yet</h2>
            <p className="text-slate-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Start selling your car by creating your first listing. It only takes a few minutes!
            </p>
            <Button
              onClick={() => router.push(`/${locale}/sell/step1`)}
              className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/30 h-12 px-8 text-base font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Listing
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <div className="group relative backdrop-blur-sm bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm">
                  {/* Image */}
                  <div className="relative h-48 bg-gray-900/50 overflow-hidden">
                    {(() => {
                      const src = firstImageUrl(listing.images)
                      const url = src ? listingImageUrl(src) : null
                      if (!url) {
                        return (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-800 to-gray-900">
                            <Car className="h-12 w-12 opacity-50" />
                          </div>
                        )
                      }
                      return isVideoUrl(src) ? (
                        <video
                          src={url}
                          muted
                          playsInline
                          loop
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <img
                          src={url}
                          alt={listing.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/cars/default-car.jpg'
                              ; (e.target as HTMLImageElement).onerror = null
                          }}
                        />
                      )
                    })()}
                    {/* Status Badge */}
                    <div className="absolute top-3 right-3">
                      {listing.is_sold ? (
                        <Badge className="bg-blue-500/80 backdrop-blur-md text-white border-blue-400/50 shadow-lg">
                          SOLD
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/80 backdrop-blur-md text-white border-emerald-400/50 shadow-lg">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">
                      {listing.title || `${listing.make} ${listing.model} ${listing.year}`}
                    </h3>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                      {formatCurrency(listing.price)}
                    </p>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4" />
                        {formatDate(listing.created_at)}
                      </div>
                      {listing.location && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{listing.location}</span>
                        </div>
                      )}
                      {listing.is_sold && listing.sold_at && (
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                          <CheckCircle2 className="h-4 w-4" />
                          Sold on {formatDate(listing.sold_at)}
                        </div>
                      )}
                    </div>

                    {/* Owner Action Bar */}
                    <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white backdrop-blur-sm"
                          onClick={() => {
                            if (process.env.NODE_ENV === 'development') {
                              console.log('[MyListings] [CLICK_EDIT] Button clicked, listing:', listing.id)
                            }
                            openEdit(listing)
                            router.push(`/${locale}/my-listings?edit=${listing.id}`, { scroll: false })
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`flex-1 backdrop-blur-sm ${listing.is_sold
                            ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                            : 'border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400'
                            }`}
                          onClick={() => setConfirmToggleSold(listing)}
                          disabled={!!togglingSoldId}
                        >
                          {togglingSoldId === listing.id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : listing.is_sold ? (
                            <XCircle className="h-4 w-4 mr-1.5" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                          )}
                          {listing.is_sold ? 'Available' : 'Sold'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 backdrop-blur-sm"
                          onClick={() => setDeleteConfirmOpen(String(listing.id))}
                          disabled={!!deletingId}
                        >
                          {deletingId === String(listing.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Link
                        href={`/${locale}/buy-sell/${listing.id}`}
                        className="block w-full text-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View listing →
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen !== null} onOpenChange={(open) => !open && setDeleteConfirmOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(null)}
              className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmOpen && handleDelete(deleteConfirmOpen)}
              disabled={!!deletingId}
              className="bg-red-600 hover:bg-red-500"
            >
              {deletingId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal - Redesigned with glassmorphism */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] flex flex-col p-0">
          {/* Sticky Header */}
          <DialogHeader className="sticky top-0 z-10 px-6 pt-6 pb-4 border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0f1117]/95 backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-semibold mb-1">Edit Listing</DialogTitle>
                <DialogDescription className="text-sm">
                  Update your listing details. Make, model, and year are read-only.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <form id="edit-form" onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto px-6 py-6 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
            <div className="space-y-8">
              {/* Row 1: Title + Price */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-title" className="text-sm font-medium">Title</Label>
                  <Input
                    id="edit-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="h-11 rounded-xl"
                    placeholder="e.g. Toyota Camry 2020"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price" className="text-sm font-medium">Price (USD) *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              {/* Row 2: Make/Model/Year (read-only) */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-make" className="text-sm font-medium">Make</Label>
                  <Input
                    id="edit-make"
                    value={form.make}
                    disabled
                    className="h-11 rounded-xl cursor-not-allowed"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-model" className="text-sm font-medium">Model</Label>
                  <Input
                    id="edit-model"
                    value={form.model}
                    disabled
                    className="h-11 rounded-xl cursor-not-allowed"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-year" className="text-sm font-medium">Year</Label>
                  <Input
                    id="edit-year"
                    type="number"
                    value={form.year}
                    disabled
                    className="h-11 rounded-xl cursor-not-allowed"
                    readOnly
                  />
                </div>
              </div>

              {/* Row 3: Mileage + Transmission */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-mileage" className="text-sm font-medium">Mileage (km) *</Label>
                  <Input
                    id="edit-mileage"
                    type="number"
                    min={0}
                    value={form.mileage}
                    onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Transmission *</Label>
                  <Select
                    value={form.transmission || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, transmission: v as Transmission }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select transmission" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSMISSIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 4: Fuel Type + Condition */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fuel Type *</Label>
                  <Select
                    value={form.fuel_type || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, fuel_type: v as FuelType }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Condition *</Label>
                  <Select
                    value={form.condition || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, condition: v as CarCondition }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d29] border-white/10">
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-white focus:bg-white/10">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Location - Full Width */}
              <div className="space-y-2">
                <Label htmlFor="edit-location" className="text-sm font-medium text-gray-300">Location</Label>
                <Input
                  id="edit-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                  placeholder="City, Country"
                />
              </div>

              {/* Description - Full Width */}
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-medium text-gray-300">Description</Label>
                <textarea
                  id="edit-description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                  placeholder="Describe your car, its condition, features, maintenance history, etc."
                />
              </div>

              {/* Images - Full Width */}
              <div className="space-y-2">
                <Label htmlFor="edit-images" className="text-sm font-medium text-gray-300">Image URLs</Label>
                <p className="text-xs text-gray-500">Enter one URL per line</p>
                <textarea
                  id="edit-images"
                  rows={4}
                  value={form.imagesText}
                  onChange={(e) => setForm((f) => ({ ...f, imagesText: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-mono text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                  placeholder="https://example.com/image1.jpg"
                />
              </div>

              {/* Status - Full Width */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Status</Label>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
                  <Checkbox
                    id="edit-is_sold"
                    checked={form.is_sold}
                    onCheckedChange={(c) => setForm((f) => ({ ...f, is_sold: !!c }))}
                    className="border-white/20 data-[state=checked]:bg-indigo-600"
                  />
                  <Label htmlFor="edit-is_sold" className="cursor-pointer text-sm text-gray-300 font-normal">
                    Mark this listing as sold
                  </Label>
                </div>
              </div>
            </div>
          </form>

          {/* Sticky Footer */}
          <DialogFooter className="sticky bottom-0 z-10 px-6 py-4 border-t border-white/10 bg-[#0f1117]/95 backdrop-blur-sm">
            <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none border-white/10 text-gray-300 hover:bg-white/5 hover:text-white h-11 px-6"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-form"
                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white h-11 px-6 font-medium shadow-lg shadow-indigo-500/20"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Sold / Mark as Available confirmation */}
      <Dialog open={!!confirmToggleSold} onOpenChange={(o) => !o && setConfirmToggleSold(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmToggleSold?.is_sold ? 'Mark as Available' : 'Mark as Sold'}
            </DialogTitle>
            <DialogDescription>
              {confirmToggleSold?.is_sold
                ? 'Mark YOUR car as available again? The sold badge will be removed.'
                : 'Mark YOUR car as sold? The listing will remain visible but shown as sold to all users.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="border-[#2a2d3a] text-white"
              onClick={() => setConfirmToggleSold(null)}
              disabled={!!togglingSoldId}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={confirmToggleSold?.is_sold ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}
              onClick={() => confirmToggleSold && handleToggleSold(confirmToggleSold)}
              disabled={!!togglingSoldId}
            >
              {togglingSoldId && confirmToggleSold ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating…
                </>
              ) : confirmToggleSold?.is_sold ? (
                'Mark as Available'
              ) : (
                'Mark as Sold'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MyListingsPage() {
  // Wrapper just renders content - auth is handled deterministically inside MyListingsContent
  return <MyListingsContent />
}
