"use client"

import { useState, useEffect, useRef } from 'react'
import {
  fetchCarQuerySpecs,
  carQuerySpecsToResult,
  type CarQuerySpecsResult,
} from '@/lib/carquery'

interface CarForSpecs {
  id: string
  features: {
    make?: string
    model?: string
    year?: number
    engine_size?: number
    cylinders?: number
  } | null
}

function carKey(car: CarForSpecs): string | null {
  const f = car.features
  if (!f?.make?.trim() || !f?.model?.trim() || !f?.year) return null
  return `${car.id}|${f.make}|${f.model}|${f.year}|${f.engine_size ?? ''}|${f.cylinders ?? ''}`
}

export function useCarQuerySpecs(cars: CarForSpecs[]) {
  const [specsByCarId, setSpecsByCarId] = useState<Record<string, CarQuerySpecsResult | null>>({})
  const [loadingByCarId, setLoadingByCarId] = useState<Record<string, boolean>>({})
  const fetchedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    cars.forEach((car) => {
      const key = carKey(car)
      if (!key) {
        setSpecsByCarId((prev) => {
          const next = { ...prev }
          delete next[car.id]
          return next
        })
        setLoadingByCarId((prev) => {
          const next = { ...prev }
          delete next[car.id]
          return next
        })
        return
      }

      if (fetchedKeysRef.current.has(key)) return
      fetchedKeysRef.current.add(key)

      setLoadingByCarId((prev) => ({ ...prev, [car.id]: true }))
      const f = car.features!

      fetchCarQuerySpecs(f.make!, f.model!, f.year!, {
        engineSize: f.engine_size,
        cylinders: f.cylinders,
      })
        .then((specs) => carQuerySpecsToResult(specs))
        .then((result) => {
          setSpecsByCarId((prev) => ({ ...prev, [car.id]: result }))
        })
        .catch(() => {
          setSpecsByCarId((prev) => ({ ...prev, [car.id]: null }))
        })
        .finally(() => {
          setLoadingByCarId((prev) => ({ ...prev, [car.id]: false }))
        })
    })
  }, [cars])

  const specMaps = cars.map((c) => specsByCarId[c.id] ?? null)
  const loadingSpecs = cars.some((c) => loadingByCarId[c.id])

  return { specMaps, loadingSpecs, loadingByCarId }
}
