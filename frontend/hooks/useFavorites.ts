'use client'

import { useState, useEffect } from 'react'

const FAVORITES_KEY = 'car-price-predictor-favorites'

export interface FavoriteCar {
  id: string
  make: string
  model: string
  year: number
  predictedPrice: number
  timestamp: number
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteCar[]>([])

  useEffect(() => {
    // Load favorites from localStorage
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        setFavorites(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load favorites:', error)
    }
  }, [])

  const saveFavorites = (newFavorites: FavoriteCar[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites))
      setFavorites(newFavorites)
    } catch (error) {
      console.error('Failed to save favorites:', error)
    }
  }

  const addFavorite = (car: FavoriteCar) => {
    const newFavorites = [...favorites, car]
    saveFavorites(newFavorites)
  }

  const removeFavorite = (id: string) => {
    const newFavorites = favorites.filter((f) => f.id !== id)
    saveFavorites(newFavorites)
  }

  const isFavorite = (id: string) => {
    return favorites.some((f) => f.id === id)
  }

  const toggleFavorite = (car: FavoriteCar) => {
    if (isFavorite(car.id)) {
      removeFavorite(car.id)
    } else {
      addFavorite(car)
    }
  }

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  }
}
