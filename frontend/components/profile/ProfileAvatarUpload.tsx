'use client'

import { useId, useState } from 'react'
import { Camera, Loader2, Check, X, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = 'image/jpeg,image/jpg,image/png,image/webp'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
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
  /** One or two characters (initials); falls back to user icon if empty */
  initials: string
  onAvatarChange: (url: string | null) => void
  /** Tailwind size classes for the circle, e.g. h-28 w-28 */
  sizeClassName?: string
}

export function ProfileAvatarUpload({
  userId,
  currentAvatarUrl,
  initials,
  onAvatarChange,
  sizeClassName = 'h-28 w-28',
}: ProfileAvatarUploadProps) {
  const inputId = useId()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)

  const processFile = async (file: File) => {
    const type = file.type?.toLowerCase()
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(type)) {
      toast({ title: 'Invalid format', description: 'Please use JPG, JPEG, PNG, or WebP.', variant: 'destructive' })
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({ title: 'File too large', description: 'Maximum size is 2MB.', variant: 'destructive' })
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
      const objectPath = `${userId}/avatar.jpg`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(objectPath, blobToSave, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (uploadError) {
        throw new Error(uploadError.message || 'Upload failed. Ensure the avatars bucket exists and you are signed in.')
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(objectPath)
      const finalUrl = urlData?.publicUrl
      if (!finalUrl) throw new Error('Could not get public URL for avatar.')

      const { error: rowErr } = await supabase.from('users').update({ avatar_url: finalUrl }).eq('id', userId)
      if (rowErr) throw new Error(rowErr.message || 'Could not save avatar URL.')

      const { error: authErr } = await supabase.auth.updateUser({ data: { avatar_url: finalUrl } })
      if (authErr) console.warn('[ProfileAvatarUpload] auth metadata:', authErr)

      try {
        localStorage.removeItem(`profile_avatar_${userId}`)
      } catch {
        /* ignore */
      }

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

  const displayUrl = currentAvatarUrl

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) processFile(file)
  }

  const safeInitials = initials.trim().slice(0, 2).toUpperCase()

  return (
    <>
      <input
        id={inputId}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={handleFileChange}
      />
      <div
        className="relative mx-auto w-fit"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        onDrop={handleDrop}
      >
        <label
          htmlFor={inputId}
          className={cn(
            'group relative flex cursor-pointer rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-violet-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950',
            sizeClassName
          )}
        >
          <span className="sr-only">Change profile picture</span>
          <div
            className={cn(
              'relative flex h-full w-full items-center justify-center overflow-hidden rounded-full',
              'bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700',
              'shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_40px_-12px_rgba(139,92,246,0.65)]',
              'ring-2 ring-violet-400/35 ring-offset-2 ring-offset-transparent dark:ring-offset-[#0b0d12]'
            )}
          >
            {displayUrl ? (
              <img src={displayUrl} alt="" className="h-full w-full object-cover" />
            ) : safeInitials ? (
              <span className="select-none text-2xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-3xl">
                {safeInitials}
              </span>
            ) : (
              <User className="h-10 w-10 text-white/90 sm:h-12 sm:w-12" strokeWidth={1.5} />
            )}
          </div>
          {/* Hover / focus upload overlay */}
          <div
            className={cn(
              'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full',
              'bg-slate-950/55 opacity-0 backdrop-blur-[2px] transition-all duration-200',
              'group-hover:opacity-100 group-focus-within:opacity-100'
            )}
          >
            <Camera className="h-6 w-6 text-white" strokeWidth={1.75} />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/95">
              Upload
            </span>
          </div>
        </label>
        {/* Soft outer glow */}
        <div
          className="absolute -inset-3 -z-10 rounded-full bg-violet-500/25 blur-2xl dark:bg-violet-600/20"
          aria-hidden
        />
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
