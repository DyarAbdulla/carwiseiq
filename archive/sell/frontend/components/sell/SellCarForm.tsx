"use client"

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { apiClient } from '@/lib/api'
import { YEAR_RANGE } from '@/lib/constants'
import type { SellCarRequest } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Car, AlertTriangle } from 'lucide-react'

const sellCarSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(2000, "Year must be 2000 or later").max(2025, "Year cannot exceed 2025"),
  mileage: z.number().min(0, "Mileage cannot be negative"),
  location: z.string().min(1, "Location is required"),
  condition: z.string().min(1, "Condition is required"),
  trim: z.string().optional(),
  has_accident: z.boolean(),
  damaged_parts_count: z.number().min(0, "Cannot be negative").max(50, "Maximum 50 parts"),
  severity: z.string().optional(),
}).refine((data) => {
  if (data.has_accident && !data.severity) {
    return false
  }
  return true
}, {
  message: "Severity is required when accident history is marked",
  path: ["severity"]
})

type SellCarFormValues = z.infer<typeof sellCarSchema>

interface SellCarFormProps {
  onSubmit: (data: SellCarRequest) => void
  loading?: boolean
}

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor']
const SEVERITIES = [
  { value: 'minor', label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

export function SellCarForm({ onSubmit, loading = false }: SellCarFormProps) {
  const t = useTranslations('sell')
  const { toast } = useToast()
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [selectedMake, setSelectedMake] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)

  const form = useForm<SellCarFormValues>({
    resolver: zodResolver(sellCarSchema),
    defaultValues: {
      make: '',
      model: '',
      year: 2020,
      mileage: 50000,
      location: '',
      condition: 'Good',
      trim: '',
      has_accident: false,
      damaged_parts_count: 0,
      severity: '',
    },
  })

  const hasAccident = form.watch('has_accident')
  const selectedModel = useWatch({ control: form.control, name: 'model' })

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true)
        const [makesData, locationsData] = await Promise.all([
          apiClient.getMakes().catch(() => null),
          apiClient.getLocations().catch(() => null),
        ])

        // Use fallback constants if API fails
        if (makesData && makesData.length > 0) {
          setMakes(makesData)
        } else {
          const { CAR_MAKES } = await import('@/lib/constants')
          setMakes(CAR_MAKES)
        }

        if (locationsData && locationsData.length > 0) {
          setLocations(locationsData)
        } else {
          // Fallback locations
          setLocations(['California', 'New York', 'Texas', 'Florida', 'Illinois'])
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        // Use fallback constants
        import('@/lib/constants').then(({ CAR_MAKES }) => {
          setMakes(CAR_MAKES)
        })
        setLocations(['California', 'New York', 'Texas', 'Florida', 'Illinois'])
        toast({
          title: 'Warning',
          description: 'Using fallback data. Backend may be unavailable.',
          variant: 'default',
        })
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load models when make changes
  useEffect(() => {
    const loadModels = async () => {
      if (!selectedMake) {
        setModels([])
        setTrims([])
        return
      }
      try {
        const modelList = await apiClient.getModels(selectedMake)
        setModels(modelList)
        form.setValue('model', '')
        setTrims([])
      } catch (error) {
        console.error('Failed to load models:', error)
      }
    }
    loadModels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMake])

  // Load trims when model changes
  useEffect(() => {
    const loadTrims = async () => {
      if (!selectedMake || !selectedModel) {
        setTrims([])
        return
      }
      try {
        const trimList = await apiClient.getTrims(selectedMake, selectedModel)
        setTrims(trimList)
      } catch {
        setTrims([])
      }
    }
    loadTrims()
  }, [selectedMake, selectedModel])

  const handleSubmit = (data: SellCarFormValues) => {
    const request: SellCarRequest = {
      make: data.make,
      model: data.model,
      year: data.year,
      mileage: data.mileage,
      location: data.location,
      condition: data.condition,
      trim: data.trim || undefined,
      has_accident: data.has_accident,
      damaged_parts_count: data.has_accident ? data.damaged_parts_count : 0,
      severity: data.has_accident ? data.severity : undefined,
    }
    onSubmit(request)
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B7FFF]" />
        <span className="ml-3 text-[#94a3b8]">Loading form...</span>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
      {/* Basic Information */}
      <Card className="p-6 border-[#2a2d3a] bg-[#0f1117]">
        <div className="flex items-center gap-2 mb-4">
          <Car className="h-5 w-5 text-[#5B7FFF]" />
          <h3 className="text-lg font-semibold text-white">{t('form.basicInfo')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Make */}
          <div className="space-y-2">
            <Label htmlFor="make" className="text-white">{t('form.make')} *</Label>
            <Select
              value={form.watch('make')}
              onValueChange={(value) => {
                form.setValue('make', value)
                setSelectedMake(value)
              }}
            >
              <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white">
                <SelectValue placeholder={t('form.selectMake')} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                {makes.map((make) => (
                  <SelectItem key={make} value={make} className="text-white hover:bg-[#2a2d3a]">
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.make && (
              <p className="text-red-400 text-sm">{form.formState.errors.make.message}</p>
            )}
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model" className="text-white">{t('form.model')} *</Label>
            <Select
              value={form.watch('model')}
              onValueChange={(value) => form.setValue('model', value)}
              disabled={!selectedMake}
            >
              <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white">
                <SelectValue placeholder={selectedMake ? t('form.selectModel') : t('form.selectMakeFirst')} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                {models.map((model) => (
                  <SelectItem key={model} value={model} className="text-white hover:bg-[#2a2d3a]">
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.model && (
              <p className="text-red-400 text-sm">{form.formState.errors.model.message}</p>
            )}
          </div>

          {/* Year */}
          <div className="space-y-2">
            <Label className="text-white">{t('form.year')}: {form.watch('year')}</Label>
            <Slider
              value={[form.watch('year')]}
              onValueChange={([value]) => form.setValue('year', value)}
              min={YEAR_RANGE.min}
              max={YEAR_RANGE.max}
              step={1}
              className="py-4"
            />
            {form.formState.errors.year && (
              <p className="text-red-400 text-sm">{form.formState.errors.year.message}</p>
            )}
          </div>

          {/* Trim (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="trim" className="text-white">{t('form.trim')}</Label>
            <Select
              value={form.watch('trim') || ''}
              onValueChange={(value) => form.setValue('trim', value === '__none__' ? '' : value)}
              disabled={trims.length === 0}
            >
              <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white">
                <SelectValue placeholder={trims.length > 0 ? t('form.selectTrim') : t('form.noTrims')} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                <SelectItem value="__none__" className="text-white hover:bg-[#2a2d3a]">
                  None
                </SelectItem>
                {trims.map((trim) => (
                  <SelectItem key={trim} value={trim} className="text-white hover:bg-[#2a2d3a]">
                    {trim}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mileage */}
          <div className="space-y-2">
            <Label htmlFor="mileage" className="text-white">{t('form.mileage')} *</Label>
            <Input
              type="number"
              id="mileage"
              {...form.register('mileage', { valueAsNumber: true })}
              className="bg-[#1a1d29] border-[#2a2d3a] text-white"
              placeholder="e.g. 50000"
            />
            {form.formState.errors.mileage && (
              <p className="text-red-400 text-sm">{form.formState.errors.mileage.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-white">{t('form.location')} *</Label>
            <Select
              value={form.watch('location')}
              onValueChange={(value) => form.setValue('location', value)}
            >
              <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white">
                <SelectValue placeholder={t('form.selectLocation')} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d29] border-[#2a2d3a] max-h-[200px]">
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc} className="text-white hover:bg-[#2a2d3a]">
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.location && (
              <p className="text-red-400 text-sm">{form.formState.errors.location.message}</p>
            )}
          </div>

          {/* Condition */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="condition" className="text-white">{t('form.condition')} *</Label>
            <Select
              value={form.watch('condition')}
              onValueChange={(value) => form.setValue('condition', value)}
            >
              <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white">
                <SelectValue placeholder={t('form.selectCondition')} />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                {CONDITIONS.map((cond) => (
                  <SelectItem key={cond} value={cond} className="text-white hover:bg-[#2a2d3a]">
                    {cond}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.condition && (
              <p className="text-red-400 text-sm">{form.formState.errors.condition.message}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Accident History */}
      <Card className="p-6 border-[#2a2d3a] bg-[#0f1117]">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-white">{t('form.accidentHistory')}</h3>
        </div>

        <div className="space-y-6">
          {/* Has Accident Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-white">{t('form.hasAccident')}</Label>
              <p className="text-sm text-[#94a3b8]">{t('form.hasAccidentDesc')}</p>
            </div>
            <Switch
              checked={hasAccident}
              onCheckedChange={(checked) => {
                form.setValue('has_accident', checked)
                if (!checked) {
                  form.setValue('damaged_parts_count', 0)
                  form.setValue('severity', '')
                }
              }}
            />
          </div>

          {/* Accident Details (shown only when has_accident is true) */}
          {hasAccident && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#2a2d3a]">
              {/* Severity */}
              <div className="space-y-2">
                <Label htmlFor="severity" className="text-white">{t('form.severity')} *</Label>
                <Select
                  value={form.watch('severity') || ''}
                  onValueChange={(value) => form.setValue('severity', value)}
                >
                  <SelectTrigger className="bg-[#1a1d29] border-[#2a2d3a] text-white">
                    <SelectValue placeholder={t('form.selectSeverity')} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                    {SEVERITIES.map((sev) => (
                      <SelectItem key={sev.value} value={sev.value} className="text-white hover:bg-[#2a2d3a]">
                        {sev.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.severity && (
                  <p className="text-red-400 text-sm">{form.formState.errors.severity.message}</p>
                )}
              </div>

              {/* Damaged Parts Count */}
              <div className="space-y-2">
                <Label htmlFor="damaged_parts_count" className="text-white">{t('form.damagedParts')}</Label>
                <Input
                  type="number"
                  id="damaged_parts_count"
                  {...form.register('damaged_parts_count', { valueAsNumber: true })}
                  className="bg-[#1a1d29] border-[#2a2d3a] text-white"
                  min={0}
                  max={50}
                  placeholder="e.g. 3"
                />
                {form.formState.errors.damaged_parts_count && (
                  <p className="text-red-400 text-sm">{form.formState.errors.damaged_parts_count.message}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-lg font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('form.calculating')}
          </>
        ) : (
          <>
            🎯 {t('form.calculatePrice')}
          </>
        )}
      </Button>
    </form>
  )
}
