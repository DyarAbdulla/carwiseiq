"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "sell_wizard_draft"

// ─── Types
export interface WizardLocation {
  city: string
  neighborhood: string
}

export interface WizardMediaItem {
  id: string
  file: File
  previewUrl: string
  isVideo: boolean
  isCover: boolean
  order: number
}

export interface WizardCarDetails {
  make: string
  model: string
  year: string
  price: string
  mileage: string
  transmission: string
  fuel_type: string
  condition: string
  body_type: string
  color: string
  previous_owners: string
  accident_history: string
  features: string[]
}

export interface WizardContact {
  phone: string
  whatsapp: string
  whatsappSameAsPhone: boolean
  preferredContact: string
  bestTimeToCall: string[]
  description: string
}

export interface SellWizardState {
  location: WizardLocation | null
  media: WizardMediaItem[]
  /** URLs from Supabase after upload in Media step (step2). Publish uses these only. */
  uploadedMediaUrls: string[]
  carDetails: WizardCarDetails | null
  contact: WizardContact | null
  editListingId: string | null
  publishedListingId: string | null
}

const defaultLocation: WizardLocation = { city: "", neighborhood: "" }

const defaultCarDetails: WizardCarDetails = {
  make: "", model: "", year: "", price: "", mileage: "",
  transmission: "", fuel_type: "", condition: "", body_type: "", color: "",
  previous_owners: "", accident_history: "", features: [],
}

const defaultContact: WizardContact = {
  phone: "", whatsapp: "", whatsappSameAsPhone: true,
  preferredContact: "", bestTimeToCall: [], description: "",
}

const defaultState: SellWizardState = {
  location: null,
  media: [],
  uploadedMediaUrls: [],
  carDetails: null,
  contact: null,
  editListingId: null,
  publishedListingId: null,
}

function loadFromStorage(): Partial<SellWizardState> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      location: parsed.location as WizardLocation | null ?? null,
      media: [], // never restore File from storage
      uploadedMediaUrls: [], // never restore; re-upload in Media step
      carDetails: (parsed.carDetails as WizardCarDetails) ?? null,
      contact: (parsed.contact as WizardContact) ?? null,
      editListingId: (parsed.editListingId as string) ?? null,
      publishedListingId: (parsed.publishedListingId as string) ?? null,
    }
  } catch {
    return {}
  }
}

function persist(state: SellWizardState) {
  if (typeof window === "undefined") return
  try {
    const toSave = {
      location: state.location,
      media: [], // omit files
      uploadedMediaUrls: [], // omit; re-upload in Media step
      carDetails: state.carDetails,
      contact: state.contact,
      editListingId: state.editListingId,
      publishedListingId: state.publishedListingId,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.warn("SellWizard persist failed:", e)
  }
}

type SellWizardContextValue = SellWizardState & {
  setLocation: (v: WizardLocation | null) => void
  setMedia: (v: WizardMediaItem[]) => void
  setUploadedMediaUrls: (v: string[]) => void
  addMedia: (files: File[]) => void
  removeMedia: (id: string) => void
  setCover: (id: string) => void
  reorderMedia: (fromIndex: number, toIndex: number) => void
  setCarDetails: (v: Partial<WizardCarDetails> | null) => void
  setContact: (v: Partial<WizardContact> | null) => void
  setEditListingId: (id: string | null) => void
  setPublishedListingId: (id: string | null) => void
  clearDraft: () => void
  loadForEdit: (data: {
    location?: { city?: string; neighborhood?: string } | null
    carDetails?: Partial<WizardCarDetails> | null
    contact?: Partial<WizardContact> | null
    images?: string[]
  }) => void
}

const SellWizardContext = createContext<SellWizardContextValue | null>(null)

export function SellWizardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SellWizardState>(() => ({
    ...defaultState,
    ...loadFromStorage(),
  }))

  useEffect(() => {
    persist(state)
  }, [state])

  const setLocation = useCallback((v: WizardLocation | null) => {
    setState((s) => ({ ...s, location: v }))
  }, [])

  const setMedia = useCallback((v: WizardMediaItem[]) => {
    setState((s) => ({ ...s, media: v, uploadedMediaUrls: [] }))
  }, [])

  const setUploadedMediaUrls = useCallback((v: string[]) => {
    setState((s) => ({ ...s, uploadedMediaUrls: v }))
  }, [])

  const addMedia = useCallback((files: File[]) => {
    const videoTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"]
    const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    setState((s) => {
      const next: WizardMediaItem[] = [...s.media]
      let order = next.length
      for (const f of files) {
        if (next.length >= 10) break
        const isVideo = videoTypes.includes(f.type) || /\.(mp4|mov|avi)$/i.test(f.name)
        const isImage = imageTypes.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name)
        if (!isVideo && !isImage) continue
        const previewUrl = URL.createObjectURL(f)
        next.push({
          id: crypto.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file: f,
          previewUrl,
          isVideo,
          isCover: next.length === 0,
          order: order++,
        })
      }
      // ensure exactly one cover
      const hasCover = next.some((x) => x.isCover)
      if (next.length && !hasCover) next[0]!.isCover = true
      return { ...s, media: next, uploadedMediaUrls: [] }
    })
  }, [])

  const removeMedia = useCallback((id: string) => {
    setState((s) => {
      const next = s.media.filter((x) => x.id !== id)
      const wasCover = s.media.find((x) => x.id === id)?.isCover
      if (wasCover && next.length) next[0]!.isCover = true
      return { ...s, media: next, uploadedMediaUrls: [] }
    })
  }, [])

  const setCover = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      media: s.media.map((m) => ({ ...m, isCover: m.id === id })),
      uploadedMediaUrls: [],
    }))
  }, [])

  const reorderMedia = useCallback((fromIndex: number, toIndex: number) => {
    setState((s) => {
      const arr = [...s.media]
      const [removed] = arr.splice(fromIndex, 1)
      if (!removed) return s
      arr.splice(toIndex, 0, removed)
      return { ...s, media: arr.map((m, i) => ({ ...m, order: i })), uploadedMediaUrls: [] }
    })
  }, [])

  const setCarDetails = useCallback((v: Partial<WizardCarDetails> | null) => {
    setState((s) => ({
      ...s,
      carDetails: v === null ? null : { ...defaultCarDetails, ...s.carDetails, ...v },
    }))
  }, [])

  const setContact = useCallback((v: Partial<WizardContact> | null) => {
    setState((s) => ({
      ...s,
      contact: v === null ? null : { ...defaultContact, ...s.contact, ...v },
    }))
  }, [])

  const setEditListingId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, editListingId: id }))
  }, [])

  const setPublishedListingId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, publishedListingId: id }))
  }, [])

  const clearDraft = useCallback(() => {
    setState({ ...defaultState })
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY)
  }, [])

  const loadForEdit = useCallback((data: {
    location?: { city?: string; neighborhood?: string } | null
    carDetails?: Partial<WizardCarDetails> | null
    contact?: Partial<WizardContact> | null
    images?: string[]
  }) => {
    setState((s) => ({
      ...s,
      location: data.location
        ? { city: data.location.city ?? "", neighborhood: data.location.neighborhood ?? "" }
        : s.location,
      carDetails: data.carDetails ? { ...defaultCarDetails, ...data.carDetails } : s.carDetails,
      contact: data.contact ? { ...defaultContact, ...data.contact } : s.contact,
      // images: we cannot restore File from URLs; edit flow would need to re-upload or keep existing
      // For edit, we keep media as-is; the edit step can show existing images from listing
    }))
  }, [])

  const value = useMemo<SellWizardContextValue>(
    () => ({
      ...state,
      setLocation,
      setMedia,
      setUploadedMediaUrls,
      addMedia,
      removeMedia,
      setCover,
      reorderMedia,
      setCarDetails,
      setContact,
      setEditListingId,
      setPublishedListingId,
      clearDraft,
      loadForEdit,
    }),
    [
      state,
      setLocation,
      setMedia,
      setUploadedMediaUrls,
      addMedia,
      removeMedia,
      setCover,
      reorderMedia,
      setCarDetails,
      setContact,
      setEditListingId,
      setPublishedListingId,
      clearDraft,
      loadForEdit,
    ]
  )

  return (
    <SellWizardContext.Provider value={value}>
      {children}
    </SellWizardContext.Provider>
  )
}

export function useSellWizard() {
  const ctx = useContext(SellWizardContext)
  if (!ctx) throw new Error("useSellWizard must be used within SellWizardProvider")
  return ctx
}
