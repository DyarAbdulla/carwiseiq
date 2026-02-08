'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react'
import type { BatchPredictionResult } from '@/lib/types'

interface ExtendedResult extends BatchPredictionResult {
  confidence_percent?: number
  deal_rating?: 'Good' | 'Fair' | 'Poor'
}

interface FilterPanelProps {
  results: ExtendedResult[]
  onFilterChange: (filteredResults: ExtendedResult[]) => void
}

export function FilterPanel({ results, onFilterChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMakes, setSelectedMakes] = useState<string[]>([])
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000])
  const [yearRange, setYearRange] = useState<[number, number]>([1900, 2025])

  // Extract unique values from results
  const availableMakes = useMemo(() => {
    return Array.from(new Set(results.map((r) => r.car.make).filter(Boolean))).sort()
  }, [results])

  const availableModels = useMemo(() => {
    if (selectedMakes.length === 0) {
      return Array.from(new Set(results.map((r) => r.car.model).filter(Boolean))).sort()
    }
    return Array.from(
      new Set(
        results
          .filter((r) => selectedMakes.includes(r.car.make))
          .map((r) => r.car.model)
          .filter(Boolean)
      )
    ).sort()
  }, [results, selectedMakes])

  const availableConditions = useMemo(() => {
    return Array.from(new Set(results.map((r) => r.car.condition).filter(Boolean))).sort()
  }, [results])

  // Calculate min/max for sliders
  const priceBounds = useMemo(() => {
    const prices = results.map((r) => r.predicted_price).filter((p) => p > 0)
    return {
      min: Math.min(...prices, 0),
      max: Math.max(...prices, 100000),
    }
  }, [results])

  const yearBounds = useMemo(() => {
    const years = results.map((r) => r.car.year).filter((y) => y > 0)
    return {
      min: Math.min(...years, 1900),
      max: Math.max(...years, 2025),
    }
  }, [results])

  // Initialize ranges
  useEffect(() => {
    setPriceRange([priceBounds.min, priceBounds.max])
    setYearRange([yearBounds.min, yearBounds.max])
  }, [priceBounds, yearBounds])

  // Apply filters
  useEffect(() => {
    const filtered = results.filter((result) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchText = `${result.car.make} ${result.car.model} ${result.car.location}`.toLowerCase()
        if (!searchText.includes(query)) return false
      }

      // Make filter
      if (selectedMakes.length > 0 && !selectedMakes.includes(result.car.make)) {
        return false
      }

      // Model filter
      if (selectedModels.length > 0 && !selectedModels.includes(result.car.model)) {
        return false
      }

      // Condition filter
      if (selectedConditions.length > 0 && !selectedConditions.includes(result.car.condition)) {
        return false
      }

      // Price range filter
      if (
        result.predicted_price < priceRange[0] ||
        result.predicted_price > priceRange[1]
      ) {
        return false
      }

      // Year range filter
      if (result.car.year < yearRange[0] || result.car.year > yearRange[1]) {
        return false
      }

      return true
    })

    onFilterChange(filtered)
  }, [
    results,
    searchQuery,
    selectedMakes,
    selectedModels,
    selectedConditions,
    priceRange,
    yearRange,
    onFilterChange,
  ])

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedMakes([])
    setSelectedModels([])
    setSelectedConditions([])
    setPriceRange([priceBounds.min, priceBounds.max])
    setYearRange([yearBounds.min, yearBounds.max])
  }

  const hasActiveFilters =
    searchQuery ||
    selectedMakes.length > 0 ||
    selectedModels.length > 0 ||
    selectedConditions.length > 0 ||
    priceRange[0] !== priceBounds.min ||
    priceRange[1] !== priceBounds.max ||
    yearRange[0] !== yearBounds.min ||
    yearRange[1] !== yearBounds.max

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between border-slate-200 dark:border-[#2a2d3a] bg-white dark:bg-[#1a1d29] hover:bg-slate-100 dark:hover:bg-[#2a2d3a]"
        >
          <span>Filters & Search</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Filter & Search Results</CardTitle>
                <CardDescription>
                  Filter results by multiple criteria
                </CardDescription>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="text-slate-600 dark:text-[#94a3b8] hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-[#94a3b8]">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-[#94a3b8]" />
                <Input
                  placeholder="Search by make, model, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Make Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-[#94a3b8]">Make</label>
              <Select
                value={selectedMakes.length > 0 ? selectedMakes[0] : ''}
                onValueChange={(value) => {
                  if (value && !selectedMakes.includes(value)) {
                    setSelectedMakes([...selectedMakes, value])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select make" />
                </SelectTrigger>
                <SelectContent>
                  {availableMakes.map((make) => (
                    <SelectItem key={make} value={make}>
                      {make}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMakes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedMakes.map((make) => (
                    <Button
                      key={make}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMakes(selectedMakes.filter((m) => m !== make))}
                      className="border-slate-200 dark:border-[#2a2d3a] bg-white dark:bg-[#1a1d29] hover:bg-slate-100 dark:hover:bg-[#2a2d3a]"
                    >
                      {make}
                      <X className="h-3 w-3 ml-2" />
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Model Filter */}
            {selectedMakes.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#94a3b8]">Model</label>
                <Select
                  value={selectedModels.length > 0 ? selectedModels[0] : ''}
                  onValueChange={(value) => {
                    if (value && !selectedModels.includes(value)) {
                      setSelectedModels([...selectedModels, value])
                    }
                  }}
                >
                  <SelectTrigger className="border-[#2a2d3a] bg-[#0f1117]">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedModels.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedModels.map((model) => (
                      <Button
                        key={model}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedModels(selectedModels.filter((m) => m !== model))}
                        className="border-slate-200 dark:border-[#2a2d3a] bg-white dark:bg-[#1a1d29] hover:bg-slate-100 dark:hover:bg-[#2a2d3a]"
                      >
                        {model}
                        <X className="h-3 w-3 ml-2" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Condition Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#94a3b8]">Condition</label>
              <div className="flex flex-wrap gap-2">
                {availableConditions.map((condition) => (
                  <Button
                    key={condition}
                    variant={selectedConditions.includes(condition) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      if (selectedConditions.includes(condition)) {
                        setSelectedConditions(selectedConditions.filter((c) => c !== condition))
                      } else {
                        setSelectedConditions([...selectedConditions, condition])
                      }
                    }}
                    className={
                      selectedConditions.includes(condition)
                        ? 'bg-[#5B7FFF] hover:bg-[#5B7FFF]/90'
                        : 'border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a]'
                    }
                  >
                    {condition}
                  </Button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#94a3b8]">
                Price Range: ${priceRange[0].toLocaleString()} - ${priceRange[1].toLocaleString()}
              </label>
              <Slider
                value={priceRange}
                onValueChange={(value) => setPriceRange(value as [number, number])}
                min={priceBounds.min}
                max={priceBounds.max}
                step={1000}
                className="w-full"
              />
            </div>

            {/* Year Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#94a3b8]">
                Year Range: {yearRange[0]} - {yearRange[1]}
              </label>
              <Slider
                value={yearRange}
                onValueChange={(value) => setYearRange(value as [number, number])}
                min={yearBounds.min}
                max={yearBounds.max}
                step={1}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  )
}
