"use client"

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Upload, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DamagePhoto {
  file: File
  preview: string
  label: string
}

interface DamagePhotoUploadProps {
  photos: DamagePhoto[]
  onChange: (photos: DamagePhoto[]) => void
  minRequired?: number
}

export function DamagePhotoUpload({ photos, onChange, minRequired = 2 }: DamagePhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<string[]>([])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 5 * 1024 * 1024
    })

    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newPhoto: DamagePhoto = {
          file,
          preview: e.target?.result as string,
          label: `Damage ${photos.length + 1}: `
        }
        onChange([...photos, newPhoto])
        setErrors([])
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    onChange(newPhotos)
  }

  const updateLabel = (index: number, label: string) => {
    const newPhotos = [...photos]
    newPhotos[index].label = label
    onChange(newPhotos)
  }

  const isValid = photos.length >= minRequired
  if (!isValid && photos.length > 0) {
    setErrors([`Minimum ${minRequired} damage photos required`])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Camera className="h-5 w-5 text-yellow-500" />
        <Label className="text-white">
          📸 Upload Damage Photos (Required)
        </Label>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors[0]}</AlertDescription>
        </Alert>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-yellow-500/50 rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-yellow-500 bg-yellow-500/5"
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-yellow-500" />
        <p className="text-white mb-1">Click to upload damage photos</p>
        <p className="text-sm text-[#94a3b8]">Minimum {minRequired} photos required</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileUpload}
        className="hidden"
      />

      <AnimatePresence>
        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {photos.map((photo, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-2"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt={`Damage ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-[#2a2d3a]"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={photo.label}
                  onChange={(e) => updateLabel(index, e.target.value)}
                  placeholder={`Damage ${index + 1}: Location (e.g., Rear bumper)`}
                  className="bg-[#0f1117] border-[#2a2d3a] text-white text-sm"
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {photos.length < minRequired && (
        <p className="text-yellow-400 text-sm">
          {minRequired - photos.length} more photo(s) required
        </p>
      )}
    </div>
  )
}