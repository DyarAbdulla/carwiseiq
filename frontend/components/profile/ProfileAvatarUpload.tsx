'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

const ACCEPTED_TYPES = 'image/jpeg,image/jpg,image/png,image/webp'
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const AVATAR_SIZE = 200

function resizeImageToSquare(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      const size = Math.min(img.width, img.height)
      const x = (img.width - size) / 2
      const y = (img.height - size) / 2
      ctx.drawImage(img, x, y, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
        'image/jpeg',
        0.9
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

interface ProfileAvatarUploadProps {
  userId: string
  currentAvatarUrl: string | null
  fallbackLetter: string
  onAvatarChange: (url: string | null) => void
}

export function ProfileAvatarUpload({
  userId,
  currentAvatarUrl,
  fallbackLetter,
  onAvatarChange,
}: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)

  const storageKey = `profile_avatar_${userId}`

  const handleCameraClick = () => {
    inputRef.current?.click()
  }

  const processFile = async (file: File) => {
    const type = file.type?.toLowerCase()
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(type)) {
      toast({ title: 'Invalid format', description: 'Please use JPG, JPEG, PNG, or WebP.', variant: 'destructive' })
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' })
      return
    }
    try {
      const blob = await resizeImageToSquare(file)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPendingBlob(blob)
      setPreviewOpen(true)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to process image', variant: 'destructive' })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) processFile(file)
  }

  const handleConfirmUpload = async () => {
    if (!pendingBlob) return
    const blobToSave = pendingBlob
    const previewUrlToRevoke = previewUrl
    setUploading(true)
    try {
      let finalUrl: string | null = null

      // 1) Try Supabase Storage first (only if bucket exists and upload succeeds)
      try {
        if (supabase?.storage) {
          const fileName = `${userId}-${Date.now()}.jpg`
          const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, blobToSave, {
            contentType: 'image/jpeg',
            upsert: true,
          })
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
            finalUrl = urlData?.publicUrl ?? null
          }
        }
      } catch {
        // Bucket missing or upload failed – will use fallback
      }

      // 2) Fallback: convert blob to base64 data URL and store in localStorage
      if (!finalUrl) {
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result
            if (typeof result === 'string') resolve(result)
            else reject(new Error('Failed to read image as data URL'))
          }
          reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
          reader.readAsDataURL(blobToSave)
        })
      }

      // 3) Persist: always save to localStorage; updateUser only for storage URLs (avoid huge base64 in metadata)
      const isBase64 = finalUrl.startsWith('data:')
      if (typeof window !== 'undefined' && finalUrl) {
        try {
          localStorage.setItem(storageKey, finalUrl)
        } catch {
          // localStorage full or disabled
        }
      }
      if (!isBase64 && finalUrl) {
        try {
          await supabase.auth.updateUser({ data: { avatar_url: finalUrl } })
        } catch {
          // Still show success – avatar is in localStorage
        }
      }

      // 4) Update UI and close modal
      onAvatarChange(finalUrl)
      setPreviewOpen(false)
      setPreviewUrl(null)
      setPendingBlob(null)
      if (previewUrlToRevoke && previewUrlToRevoke.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlToRevoke)
      }
      toast({
        title: 'Profile picture updated successfully',
        description: 'Your avatar has been saved.',
      })
    } catch (err) {
      toast({
        title: 'Failed to update profile picture',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleCancelPreview = () => {
    setPreviewOpen(false)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPendingBlob(null)
  }

  const displayUrl =
    currentAvatarUrl ||
    (typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) processFile(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        className="relative group"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        onDrop={handleDrop}
      >
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-500/50 ring-4 ring-indigo-500/20">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            fallbackLetter
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl -z-10 animate-pulse" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleCameraClick() }}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-md border border-slate-200 dark:border-white/20 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
          aria-label="Change profile picture"
        >
          <Camera className="h-4 w-4 text-slate-700 dark:text-white" />
        </button>
      </div>

      <Dialog open={previewOpen} onOpenChange={(open) => !open && handleCancelPreview()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Preview profile picture</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-40 h-40 rounded-full object-cover border-2 border-slate-200 dark:border-white/20"
              />
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-[#94a3b8] text-center">
            Image will be saved as 200×200px. Save or cancel.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelPreview}
              disabled={uploading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmUpload()}
              disabled={uploading}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {uploading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
