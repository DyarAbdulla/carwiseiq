"use client"

import { useRef } from 'react'
import { Camera, X } from 'lucide-react'
import type { SellDraftImage, SellDraftUploadedImage } from '@/lib/types'

const MAX = 10
const MIN = 4

type UploadGridProps = {
  /** Local files (before upload) */
  images: SellDraftImage[]
  /** Already uploaded (from server) – when set, we show these and allow remove only */
  uploadedImages: SellDraftUploadedImage[]
  onAdd: (files: File[]) => void
  onRemove: (localId: string) => void
  onRemoveUploaded: (id: number) => void
  /** API base for relative image URLs */
  imageBase?: string
}

export function UploadGrid({
  images,
  uploadedImages,
  onAdd,
  onRemove,
  onRemoveUploaded,
  imageBase = '',
}: UploadGridProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const hasUploaded = uploadedImages.length > 0
  const list = hasUploaded
    ? uploadedImages.map((u) => ({ type: 'uploaded' as const, id: String(u.id), url: u.url, backendId: u.id }))
    : images.map((i) => ({ type: 'local' as const, id: i.id, url: i.previewUrl, backendId: null as number | null }))

  const total = list.length
  const canAdd = total < MAX
  const slots = canAdd ? list.length + 1 : list.length

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const toAdd = Math.min(MAX - total, files.length)
    const arr = Array.from(files).slice(0, toAdd)
    onAdd(arr)
    e.target.value = ''
  }

  const pick = () => inputRef.current?.click()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      {list.map((item) => (
        <div
          key={item.id}
          className="relative aspect-square rounded-xl overflow-hidden bg-gray-700/80 border border-gray-600"
        >
          <img
            src={
              item.url.startsWith('http') || item.url.startsWith('data:')
                ? item.url
                : imageBase
                  ? imageBase + (item.url.startsWith('/') ? item.url : '/' + item.url)
                  : item.url
            }
            alt=""
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => (item.type === 'uploaded' && item.backendId != null ? onRemoveUploaded(item.backendId) : onRemove(item.id))}
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600/90 text-white transition-colors"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={pick}
          className="aspect-square rounded-xl border-2 border-dashed border-gray-500 hover:border-gray-400 flex items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
          aria-label="Add photo"
        >
          <Camera className="h-8 w-8" />
        </button>
      )}
    </div>
  )
}

export { MIN as UPLOAD_MIN, MAX as UPLOAD_MAX }
