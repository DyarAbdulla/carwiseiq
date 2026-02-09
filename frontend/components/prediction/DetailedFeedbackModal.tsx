"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api'
import { CAR_MAKES } from '@/lib/constants'

interface DetailedFeedbackModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (details: {
    feedback_reasons: string[]
    correct_make?: string
    correct_model?: string
    correct_year?: number
    correct_price?: number
    other_details?: string
  }) => void
  carFeatures: {
    make: string
    model: string
    year: number
  }
  predictedPrice: number
}

const FEEDBACK_REASONS = [
  'wrong_make',
  'wrong_model',
  'wrong_year',
  'price_too_high',
  'price_too_low',
  'missing_features',
  'other'
] as const

export function DetailedFeedbackModal({
  open,
  onClose,
  onSubmit,
  carFeatures,
  predictedPrice
}: DetailedFeedbackModalProps) {
  const t = useTranslations('feedback.detailed')
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [otherDetails, setOtherDetails] = useState('')
  const [correctMake, setCorrectMake] = useState('')
  const [correctModel, setCorrectModel] = useState('')
  const [correctYear, setCorrectYear] = useState<number | undefined>()
  const [correctPrice, setCorrectPrice] = useState<number | undefined>()
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load makes and models for dropdowns
  const [makes, setMakes] = useState<string[]>([])
  const [modelsByMake, setModelsByMake] = useState<Record<string, string[]>>({})
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingMakes, setLoadingMakes] = useState(false)

  // Load makes and models on mount
  useEffect(() => {
    if (open) {
      loadMakesAndModels()
    }
  }, [open])

  const loadMakesAndModels = async () => {
    setLoadingMakes(true)
    try {
      const makesList = await apiClient.getMakes()
      const sorted = Array.isArray(makesList) && makesList.length > 0
        ? [...makesList].sort((a, b) => a.localeCompare(b))
        : [...CAR_MAKES].sort((a, b) => a.localeCompare(b))
      setMakes(sorted)

      // Load models for all makes in parallel
      const modelsPromises = sorted.map(async (make) => {
        try {
          const modelsList = await apiClient.getModels(make)
          return { make, models: modelsList }
        } catch (error) {
          return { make, models: [] }
        }
      })

      const modelsResults = await Promise.all(modelsPromises)
      const modelsCache: Record<string, string[]> = {}
      modelsResults.forEach(({ make, models }) => {
        modelsCache[make] = models
      })

      setModelsByMake(modelsCache)
    } catch (error) {
      console.error('Error loading makes and models:', error)
    } finally {
      setLoadingMakes(false)
    }
  }

  // Update available models when make changes
  useEffect(() => {
    if (correctMake && modelsByMake[correctMake]) {
      setAvailableModels(modelsByMake[correctMake])
      // Clear model selection when make changes
      if (correctModel && !modelsByMake[correctMake].includes(correctModel)) {
        setCorrectModel('')
      }
    } else {
      setAvailableModels([])
    }
  }, [correctMake, modelsByMake, correctModel])

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    )
    // Clear error when user selects a reason
    if (errors.reasons) {
      setErrors(prev => ({ ...prev, reasons: '' }))
    }
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}

    // Validate at least one reason is selected
    if (selectedReasons.length === 0) {
      newErrors.reasons = t('errors.selectReason')
    }

    // Validate "Other" details if "Other" is selected
    if (selectedReasons.includes('other')) {
      if (!otherDetails || otherDetails.length < 50) {
        newErrors.otherDetails = t('errors.otherDetailsMin')
      } else if (otherDetails.length > 500) {
        newErrors.otherDetails = t('errors.otherDetailsMax')
      }
    }

    // Validate "What should it have been?" - required when any reason is selected
    if (selectedReasons.length > 0) {
      if (!correctMake.trim()) {
        newErrors.correctMake = t('errors.correctMakeRequired')
      }
      if (!correctModel.trim()) {
        newErrors.correctModel = t('errors.correctModelRequired')
      }
    }

    // Additional validation for specific reasons
    if (selectedReasons.includes('wrong_make') && !correctMake.trim()) {
      newErrors.correctMake = t('errors.correctMakeRequired')
    }
    if (selectedReasons.includes('wrong_model') && !correctModel.trim()) {
      newErrors.correctModel = t('errors.correctModelRequired')
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit({
      feedback_reasons: selectedReasons,
      correct_make: correctMake.trim() || undefined,
      correct_model: correctModel.trim() || undefined,
      correct_year: correctYear,
      correct_price: correctPrice,
      other_details: otherDetails.trim() || undefined
    })

    // Reset form
    setSelectedReasons([])
    setOtherDetails('')
    setCorrectMake('')
    setCorrectModel('')
    setCorrectYear(undefined)
    setCorrectPrice(undefined)
    setErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1a1d29] border-[#2a2d3a] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('title')}</DialogTitle>
          <DialogDescription className="text-[#94a3b8]">
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Feedback Reasons */}
          <div className="space-y-3">
            <Label className="text-base font-medium">{t('whatWasWrong')}</Label>
            <div className="space-y-3">
              {FEEDBACK_REASONS.map((reason) => (
                <div key={reason} className="flex items-start space-x-3">
                  <Checkbox
                    id={reason}
                    checked={selectedReasons.includes(reason)}
                    onCheckedChange={() => handleReasonToggle(reason)}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={reason}
                    className="flex-1 cursor-pointer text-sm leading-relaxed"
                  >
                    {t(`reasons.${reason}`)}
                  </Label>
                </div>
              ))}
            </div>
            {errors.reasons && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {errors.reasons}
              </p>
            )}
          </div>

          {/* What should it have been? - Always shown when any reason is selected */}
          {selectedReasons.length > 0 && (
            <div className="space-y-4 p-4 bg-[#2a2d3a] rounded-lg border border-[#3a3d4a]">
              <Label className="text-base font-medium text-white">
                {t('whatShouldItHaveBeen')} <span className="text-red-500">*</span>
              </Label>
              <p className="text-sm text-[#94a3b8] mb-4">
                {t('whatShouldItHaveBeenDesc')}
              </p>

              {/* Correct Make - Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="correct_make" className="text-sm font-medium">
                  {t('correctMake')} <span className="text-red-500">*</span>
                </Label>
                {loadingMakes ? (
                  <div className="text-sm text-[#94a3b8]">Loading makes...</div>
                ) : (
                  <Select
                    value={correctMake || undefined}
                    onValueChange={(value) => {
                      setCorrectMake(value)
                      setCorrectModel('') // Clear model when make changes
                      if (errors.correctMake) {
                        setErrors(prev => ({ ...prev, correctMake: '' }))
                      }
                    }}
                  >
                    <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]">
                      <SelectValue placeholder={`Select make (current: ${carFeatures.make})`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[60vh] overflow-y-auto bg-[#1a1d29] border-[#2a2d3a] z-[1200]">
                      {makes.length > 0 ? (
                        (makes || []).map((make) => (
                          <SelectItem
                            key={make}
                            value={make}
                            className="text-white hover:bg-[#2a2d3a] focus:bg-[#8B5CF6]/20 focus:text-white"
                          >
                            {make}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-[#94a3b8] text-sm">No makes available</div>
                      )}
                    </SelectContent>
                  </Select>
                )}
                {errors.correctMake && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.correctMake}
                  </p>
                )}
              </div>

              {/* Correct Model - Dropdown (only shown when make is selected) */}
              {correctMake && (
                <div className="space-y-2">
                  <Label htmlFor="correct_model" className="text-sm font-medium">
                    {t('correctModel')} <span className="text-red-500">*</span>
                  </Label>
                  {availableModels.length > 0 ? (
                    <Select
                      value={correctModel || undefined}
                      onValueChange={(value) => {
                        setCorrectModel(value)
                        if (errors.correctModel) {
                          setErrors(prev => ({ ...prev, correctModel: '' }))
                        }
                      }}
                    >
                      <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white focus:ring-2 focus:ring-[#8B5CF6]/50 focus:border-[#8B5CF6]">
                        <SelectValue placeholder={`Select model (current: ${carFeatures.model})`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[60vh] overflow-y-auto bg-[#1a1d29] border-[#2a2d3a] z-[1200]">
                        {availableModels.map((model) => (
                          <SelectItem
                            key={model}
                            value={model}
                            className="text-white hover:bg-[#2a2d3a] focus:bg-[#8B5CF6]/20 focus:text-white"
                          >
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="correct_model"
                      value={correctModel}
                      onChange={(e) => {
                        setCorrectModel(e.target.value)
                        if (errors.correctModel) {
                          setErrors(prev => ({ ...prev, correctModel: '' }))
                        }
                      }}
                      placeholder={`Enter model (current: ${carFeatures.model})`}
                      className="bg-[#1a1d29] border-[#2a2d3a] text-white"
                    />
                  )}
                  {errors.correctModel && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.correctModel}
                    </p>
                  )}
                </div>
              )}

              {/* Optional: Correct Year */}
              {selectedReasons.includes('wrong_year') && (
                <div className="space-y-2">
                  <Label htmlFor="correct_year" className="text-sm font-medium">
                    {t('correctYear')} <span className="text-[#94a3b8] text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="correct_year"
                    type="number"
                    value={correctYear || ''}
                    onChange={(e) => setCorrectYear(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder={`Enter year (current: ${carFeatures.year})`}
                    min="1900"
                    max="2025"
                    className="bg-[#1a1d29] border-[#2a2d3a] text-white"
                  />
                </div>
              )}

              {/* Optional: Correct Price */}
              {(selectedReasons.includes('price_too_high') ||
                selectedReasons.includes('price_too_low')) && (
                  <div className="space-y-2">
                    <Label htmlFor="correct_price" className="text-sm font-medium">
                      {t('correctPrice')} <span className="text-[#94a3b8] text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="correct_price"
                      type="number"
                      value={correctPrice || ''}
                      onChange={(e) => setCorrectPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder={`Enter price (predicted: ${predictedPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})`}
                      min="0"
                      step="100"
                      className="bg-[#1a1d29] border-[#2a2d3a] text-white"
                    />
                  </div>
                )}
            </div>
          )}

          {/* Other Details */}
          {selectedReasons.includes('other') && (
            <div className="space-y-2">
              <Label htmlFor="other_details" className="text-sm font-medium">
                {t('otherDetails')} <span className="text-red-500">*</span>
                <span className="text-[#94a3b8] text-xs font-normal ml-2">
                  ({t('otherDetailsHint')})
                </span>
              </Label>
              <Textarea
                id="other_details"
                value={otherDetails}
                onChange={(e) => {
                  setOtherDetails(e.target.value)
                  if (errors.otherDetails) {
                    setErrors(prev => ({ ...prev, otherDetails: '' }))
                  }
                }}
                placeholder={t('otherDetailsPlaceholder')}
                rows={4}
                className="bg-[#1a1d29] border-[#2a2d3a] resize-none"
                maxLength={500}
              />
              <div className="flex justify-between text-xs text-[#94a3b8]">
                <span>{otherDetails.length}/500 {t('characters')}</span>
                {errors.otherDetails && (
                  <span className="text-red-500">{errors.otherDetails}</span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-[#2a2d3a] hover:bg-[#2a2d3a]"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-[#5B7FFF] hover:bg-[#4a6fef]"
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
