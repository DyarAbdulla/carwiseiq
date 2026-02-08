'use client'
export const runtime = 'edge';

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { CarListingInsert } from '@/lib/database.types'
import type { Transmission, FuelType, CarCondition } from '@/lib/database.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload, X } from 'lucide-react'

const BUCKET = 'car-images'
const MAX_IMAGES = 6
const MIN_IMAGES = 1
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i

const TRANSMISSIONS: Transmission[] = ['automatic', 'manual']
const FUEL_TYPES: FuelType[] = ['petrol', 'diesel', 'electric', 'hybrid']
const CONDITIONS: CarCondition[] = ['excellent', 'good', 'fair']

function validateFile(file: File): string | null {
  const lower = file.name.toLowerCase()
  if (!ALLOWED_EXT.test(lower) && !ALLOWED_TYPES.includes(file.type)) {
    return `Invalid type: ${file.name}. Use jpg, jpeg, png, or webp.`
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File too large: ${file.name}. Max 5MB each.`
  }
  return null
}

function SellCarForm() {
  const locale = useLocale() || 'en'
  const router = useRouter()
  const { user } = useAuthContext()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
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
  })
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const removePreview = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index] ?? '')
      return next.filter((_, i) => i !== index)
    })
  }, [])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    const valid: File[] = []
    const invalid: string[] = []
    for (const f of selected) {
      const err = validateFile(f)
      if (err) invalid.push(err)
      else valid.push(f)
    }
    if (invalid.length) {
      toast({ title: 'Invalid files', description: invalid[0], variant: 'destructive' })
    }
    const combined = [...files, ...valid].slice(0, MAX_IMAGES)
    setFiles(combined)
    const newPreviews = combined.map((f) => URL.createObjectURL(f))
    setPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u))
      return newPreviews
    })
    e.target.value = ''
  }, [files, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    const err: Record<string, string> = {}
    if (!form.make.trim()) err.make = 'Make is required'
    if (!form.model.trim()) err.model = 'Model is required'
    const y = parseInt(form.year, 10)
    if (!form.year || isNaN(y) || y < 1900 || y > 2100) err.year = 'Valid year (1900–2100) required'
    const p = parseFloat(form.price)
    if (!form.price || isNaN(p) || p < 0) err.price = 'Valid price required'
    const m = parseInt(form.mileage, 10)
    if (!form.mileage || isNaN(m) || m < 0) err.mileage = 'Valid mileage required'
    if (!form.transmission) err.transmission = 'Select transmission'
    if (!form.fuel_type) err.fuel_type = 'Select fuel type'
    if (!form.condition) err.condition = 'Select condition'
    if (!form.location.trim()) err.location = 'Location is required'
    if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
      err.images = `Add ${MIN_IMAGES}–${MAX_IMAGES} images (jpg, jpeg, png, webp, max 5MB each).`
    }
    setErrors(err)
    if (Object.keys(err).length) {
      toast({ title: 'Validation error', description: 'Please fix the fields above.', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    setUploadProgress({ current: 0, total: files.length })
    toast({ title: 'Uploading images...', duration: 4000 })

    try {
      const basePath = `${user.id}`
      const urls: string[] = []

      for (let i = 0; i < files.length; i++) {
        setUploadProgress({ current: i + 1, total: files.length })
        const file = files[i]!
        const ext = (file.name.match(/\.(jpe?g|png|webp)$/i)?.[0] ?? '.jpg').toLowerCase().replace(/^\./, '')
        const name = `${Date.now()}-${i}.${ext}`
        const path = `${basePath}/${name}`

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (upErr) throw upErr

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        urls.push(data.publicUrl)
      }

      setUploadProgress(null)

      const title = `${form.make.trim()} ${form.model.trim()} ${form.year}`.trim()
      const insert: CarListingInsert = {
        user_id: user.id,
        title,
        make: form.make.trim(),
        model: form.model.trim(),
        year: y,
        price: p,
        mileage: m,
        transmission: form.transmission as Transmission,
        fuel_type: form.fuel_type as FuelType,
        condition: form.condition as CarCondition,
        location: form.location.trim(),
        description: form.description.trim() || null,
        images: urls,
        is_sold: false,
        status: 'active',
      }

      const { error: insertErr } = await supabase.from('car_listings').insert(insert)
      if (insertErr) throw insertErr

      toast({ title: 'Success', description: 'Car listed successfully!' })
      router.push(`/${locale}/my-listings?success=listing-created`)
    } catch (e: unknown) {
      setUploadProgress(null)
      const msg = e instanceof Error ? e.message : 'Failed to create listing'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      <div className="mx-auto max-w-2xl">
        <Card className="border-[#2a2d3a] bg-[#1a1d29]">
          <CardHeader>
            <CardTitle className="text-white">Sell your car</CardTitle>
            <CardDescription className="text-[#94a3b8]">
              Add your listing. All fields are required except description.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="make" className="text-white">Make</Label>
                  <Input
                    id="make"
                    value={form.make}
                    onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                    placeholder="e.g. Toyota"
                    disabled={submitting}
                  />
                  {errors.make && <p className="text-sm text-red-400">{errors.make}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-white">Model</Label>
                  <Input
                    id="model"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                    placeholder="e.g. Camry"
                    disabled={submitting}
                  />
                  {errors.model && <p className="text-sm text-red-400">{errors.model}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="year" className="text-white">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    min={1900}
                    max={2100}
                    value={form.year}
                    onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                    placeholder="2020"
                    disabled={submitting}
                  />
                  {errors.year && <p className="text-sm text-red-400">{errors.year}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-white">Price (USD)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                    placeholder="25000"
                    disabled={submitting}
                  />
                  {errors.price && <p className="text-sm text-red-400">{errors.price}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mileage" className="text-white">Mileage (km)</Label>
                  <Input
                    id="mileage"
                    type="number"
                    min={0}
                    value={form.mileage}
                    onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value }))}
                    className="border-[#2a2d3a] bg-[#0f1117] text-white"
                    placeholder="50000"
                    disabled={submitting}
                  />
                  {errors.mileage && <p className="text-sm text-red-400">{errors.mileage}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Transmission</Label>
                  <Select
                    value={form.transmission || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, transmission: v as Transmission }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="border-[#2a2d3a] bg-[#0f1117] text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                      {TRANSMISSIONS.map((t) => (
                        <SelectItem key={t} value={t} className="text-white focus:bg-[#2a2d3a]">
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.transmission && <p className="text-sm text-red-400">{errors.transmission}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-white">Fuel type</Label>
                  <Select
                    value={form.fuel_type || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, fuel_type: v as FuelType }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="border-[#2a2d3a] bg-[#0f1117] text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                      {FUEL_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-white focus:bg-[#2a2d3a]">
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.fuel_type && <p className="text-sm text-red-400">{errors.fuel_type}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Condition</Label>
                  <Select
                    value={form.condition || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, condition: v as CarCondition }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="border-[#2a2d3a] bg-[#0f1117] text-white">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1d29] border-[#2a2d3a]">
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-white focus:bg-[#2a2d3a]">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.condition && <p className="text-sm text-red-400">{errors.condition}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-white">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="border-[#2a2d3a] bg-[#0f1117] text-white"
                  placeholder="City, Country"
                  disabled={submitting}
                />
                {errors.location && <p className="text-sm text-red-400">{errors.location}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">Description (optional)</Label>
                <textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="flex w-full rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2 text-sm text-white placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#5B7FFF]"
                  placeholder="Additional details..."
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Images ({MIN_IMAGES}–{MAX_IMAGES})</Label>
                <p className="text-sm text-[#94a3b8]">JPG, JPEG, PNG, or WEBP. Max 5MB each.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={onFileChange}
                />
                <div className="flex flex-wrap gap-2">
                  {previews.map((url, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-[#2a2d3a] bg-[#2a2d3a]">
                      <img src={url} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                      {!submitting && (
                        <button
                          type="button"
                          onClick={() => removePreview(i)}
                          className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {files.length < MAX_IMAGES && !submitting && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-[#2a2d3a] flex items-center justify-center text-[#94a3b8] hover:border-[#5B7FFF] hover:text-[#5B7FFF]"
                    >
                      <Upload className="h-6 w-6" />
                    </button>
                  )}
                </div>
                {errors.images && <p className="text-sm text-red-400">{errors.images}</p>}
              </div>

              {uploadProgress && (
                <div className="space-y-2">
                  <p className="text-sm text-[#94a3b8]">
                    Uploading image {uploadProgress.current} of {uploadProgress.total}…
                  </p>
                  <div className="h-2 rounded-full bg-[#2a2d3a] overflow-hidden">
                    <div
                      className="h-full bg-[#5B7FFF] transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#2a2d3a] text-white"
                  onClick={() => router.push(`/${locale}/my-listings`)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90 text-white"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadProgress ? 'Uploading…' : 'Creating…'}
                    </>
                  ) : (
                    'Create listing'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SellCarPage() {
  return (
    <ProtectedRoute redirectTo="register">
      <SellCarForm />
    </ProtectedRoute>
  )
}
