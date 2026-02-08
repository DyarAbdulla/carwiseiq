"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  AIDetectionResult,
  SellDraftImage,
  SellDraftLocation,
  SellDraftState,
  SellDraftUploadedImage,
} from '@/lib/types'

const STORAGE_KEY = 'sell_draft'

const defaultState: SellDraftState = {
  draftId: null,
  listingId: null,
  images: [],
  uploadedImages: [],
  aiDetection: null,
  location: null,
  phone: '',
  carDetails: null,
}

function loadFromStorage(): Partial<SellDraftState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<SellDraftState>
    // Don't restore images (have File); only persisted fields
    return {
      draftId: parsed.draftId ?? null,
      listingId: parsed.listingId ?? null,
      uploadedImages: Array.isArray(parsed.uploadedImages) ? parsed.uploadedImages : [],
      aiDetection: parsed.aiDetection ?? null,
      location: parsed.location ?? null,
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      carDetails: parsed.carDetails ?? null,
    }
  } catch {
    return {}
  }
}

function persist(state: SellDraftState) {
  if (typeof window === 'undefined') return
  try {
    const toSave = {
      draftId: state.draftId,
      listingId: state.listingId,
      uploadedImages: state.uploadedImages,
      aiDetection: state.aiDetection,
      location: state.location,
      phone: state.phone,
      carDetails: state.carDetails,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.warn('SellDraft persist failed:', e)
  }
}

type SellDraftContextValue = SellDraftState & {
  setListingId: (id: number | null) => void
  setImages: (imgs: SellDraftImage[]) => void
  addImage: (img: SellDraftImage) => void
  removeImage: (id: string) => void
  removeUploadedImage: (id: number) => void
  setUploadedImages: (imgs: SellDraftUploadedImage[]) => void
  setAiDetection: (d: AIDetectionResult | null) => void
  setLocation: (loc: SellDraftLocation | null) => void
  setPhone: (p: string) => void
  setCarDetails: (d: Record<string, unknown> | null) => void
  initDraftId: () => string
  clearDraft: () => void
  ensureDraftId: () => string
}

const SellDraftContext = createContext<SellDraftContextValue | null>(null)

export function SellDraftProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SellDraftState>(() => {
    const loaded = loadFromStorage()
    return {
      ...defaultState,
      ...loaded,
      images: [], // never restore from storage
    }
  })

  useEffect(() => {
    persist(state)
  }, [state])

  const setListingId = useCallback((listingId: number | null) => {
    setState((s) => ({ ...s, listingId }))
  }, [])

  const setImages = useCallback((images: SellDraftImage[]) => {
    setState((s) => ({ ...s, images }))
  }, [])

  const addImage = useCallback((img: SellDraftImage) => {
    setState((s) => {
      if (s.images.length >= 6) return s
      if (s.images.some((i) => i.id === img.id)) return s
      return { ...s, images: [...s.images, img] }
    })
  }, [])

  const removeImage = useCallback((id: string) => {
    setState((s) => ({ ...s, images: s.images.filter((i) => i.id !== id) }))
  }, [])

  const removeUploadedImage = useCallback((id: number) => {
    setState((s) => ({ ...s, uploadedImages: s.uploadedImages.filter((i) => i.id !== id) }))
  }, [])

  const setUploadedImages = useCallback((uploadedImages: SellDraftUploadedImage[]) => {
    setState((s) => ({ ...s, uploadedImages, images: [] }))
  }, [])

  const setAiDetection = useCallback((aiDetection: AIDetectionResult | null) => {
    setState((s) => ({ ...s, aiDetection }))
  }, [])

  const setLocation = useCallback((location: SellDraftLocation | null) => {
    setState((s) => ({ ...s, location }))
  }, [])

  const setPhone = useCallback((phone: string) => {
    setState((s) => ({ ...s, phone }))
  }, [])

  const setCarDetails = useCallback((carDetails: Record<string, unknown> | null) => {
    setState((s) => ({ ...s, carDetails }))
  }, [])

  const initDraftId = useCallback(() => {
    const id = 'draft-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `d-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`)
    setState((s) => ({ ...s, draftId: id }))
    return id
  }, [])

  const ensureDraftId = useCallback(() => {
    const existing = state.draftId
    if (existing) return existing
    return initDraftId()
  }, [state.draftId, initDraftId])

  const clearDraft = useCallback(() => {
    setState({ ...defaultState, draftId: state.draftId })
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  }, [state.draftId])

  const value = useMemo<SellDraftContextValue>(
    () => ({
      ...state,
      setListingId,
      setImages,
      addImage,
      removeImage,
      removeUploadedImage,
      setUploadedImages,
      setAiDetection,
      setLocation,
      setPhone,
      setCarDetails,
      initDraftId,
      clearDraft,
      ensureDraftId,
    }),
    [
      state,
      setListingId,
      setImages,
      addImage,
      removeImage,
      removeUploadedImage,
      setUploadedImages,
      setAiDetection,
      setLocation,
      setPhone,
      setCarDetails,
      initDraftId,
      clearDraft,
      ensureDraftId,
    ]
  )

  return <SellDraftContext.Provider value={value}>{children}</SellDraftContext.Provider>
}

export function useSellDraft() {
  const ctx = useContext(SellDraftContext)
  if (!ctx) throw new Error('useSellDraft must be used within SellDraftProvider')
  return ctx
}
