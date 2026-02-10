"use client"

import { useCallback, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Camera, Video, X, Star, Play } from "lucide-react"
import type { WizardMediaItem } from "@/context/SellWizardContext"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024   // 5MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024  // 50MB
const MIN_FILES = 4
const MAX_FILES = 10

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime,video/x-msvideo"
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type ValidateError = { key: string; params?: Record<string, string> }

function validateFile(file: File): ValidateError | null {
  const isVideo = VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|avi)$/i.test(file.name)
  const isImage = IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name)
  if (!isVideo && !isImage) return { key: "mediaInvalidType", params: { name: file.name } }
  const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  if (file.size > max) return { key: "mediaMaxSize", params: { name: file.name, max: isVideo ? "50MB" : "5MB" } }
  return null
}

// ─── Sortable preview card
function SortablePreview({
  item,
  onRemove,
  onSetCover,
  coverLabel,
  setCoverLabel,
  removeLabel,
  dragLabel,
}: {
  item: WizardMediaItem
  onRemove: (id: string) => void
  onSetCover: (id: string) => void
  coverLabel: string
  setCoverLabel: string
  removeLabel: string
  dragLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative aspect-square rounded-lg overflow-hidden bg-gray-700/80 border border-gray-600 ${
        isDragging ? "z-10 opacity-90 ring-2 ring-indigo-500" : ""
      }`}
    >
      {item.isVideo ? (
        <div className="w-full h-full relative">
          <video
            src={item.previewUrl}
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className="h-10 w-10 text-white drop-shadow" />
          </div>
        </div>
      ) : (
        <img
          src={item.previewUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      )}

      {item.isCover && (
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium bg-indigo-600 text-white flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          {coverLabel}
        </span>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white text-xs truncate" title={item.file.name}>{item.file.name}</p>
        <p className="text-gray-300 text-xs">{formatSize(item.file.size)}</p>
      </div>

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {!item.isCover && (
          <button
            type="button"
            onClick={() => onSetCover(item.id)}
            className="p-1.5 rounded-full bg-black/60 hover:bg-indigo-600 text-white transition-colors"
            title={setCoverLabel}
            aria-label={setCoverLabel}
          >
            <Star className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors"
          aria-label={removeLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-2 left-2 p-1.5 rounded bg-black/60 text-white cursor-grab active:cursor-grabbing"
        aria-label={dragLabel}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm5-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z"/></svg>
      </div>
    </div>
  )
}

export interface MediaUploadStepProps {
  media: WizardMediaItem[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  onSetCover: (id: string) => void
  onReorder: (from: number, to: number) => void
  errors?: string[]
}

const RTL_LOCALES = ['ar', 'ku']

export function MediaUploadStep({
  media,
  onAdd,
  onRemove,
  onSetCover,
  onReorder,
  errors = [],
}: MediaUploadStepProps) {
  const locale = useLocale() || 'en'
  const t = useTranslations("sell")
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [dropError, setDropError] = useState<ValidateError | null>(null)
  const isRTL = RTL_LOCALES.includes(locale)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const from = media.findIndex((m) => m.id === active.id)
      const to = media.findIndex((m) => m.id === over.id)
      if (from >= 0 && to >= 0) onReorder(from, to)
    },
    [media, onReorder]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      const toAdd: File[] = []
      const errs: ValidateError[] = []
      for (const f of Array.from(files)) {
        if (media.length + toAdd.length >= MAX_FILES) break
        const err = validateFile(f)
        if (err) errs.push(err)
        else toAdd.push(f)
      }
      if (errs.length) setDropError(errs[0] ?? null)
      else setDropError(null)
      if (toAdd.length) onAdd(toAdd)
      e.target.value = ""
    },
    [media.length, onAdd]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const files = e.dataTransfer.files
      if (!files?.length) return
      const toAdd: File[] = []
      const errs: ValidateError[] = []
      for (const f of Array.from(files)) {
        if (media.length + toAdd.length >= MAX_FILES) break
        const err = validateFile(f)
        if (err) errs.push(err)
        else toAdd.push(f)
      }
      if (errs.length) setDropError(errs[0] ?? null)
      else setDropError(null)
      if (toAdd.length) onAdd(toAdd)
    },
    [media.length, onAdd]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const canAdd = media.length < MAX_FILES
  const count = media.length
  // 4–10 inclusive: 4 is valid (>= MIN_FILES), 10 is valid (<= MAX_FILES)
  const isValid = count >= MIN_FILES && count <= MAX_FILES

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Drag-and-drop zone - Premium Glass Surface. Use dir="ltr" in RTL so file input click works reliably. */}
      <div
        dir={isRTL ? "ltr" : undefined}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => canAdd && inputRef.current?.click()}
        className={`
          min-h-[180px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2
          transition-all cursor-pointer backdrop-blur-sm
          ${dragging 
            ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/20" 
            : "border-white/20 hover:border-white/30 bg-white/5 hover:bg-white/10"
          }
          ${!canAdd ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <div className="flex gap-4 text-gray-400">
          <Camera className="h-10 w-10" />
          <Video className="h-10 w-10" />
        </div>
        <p className="text-white font-medium">
          {canAdd ? t("mediaDropOrClick") : t("mediaMaxFiles", { max: String(MAX_FILES) })}
        </p>
        <p className="text-sm text-gray-400">
          {t("mediaFormats")}
        </p>
      </div>

      {/* Requirements */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-gray-400">📸 {t("mediaMinImages", { min: String(MIN_FILES) })}</span>
        <span className="text-gray-400">🎥 {t("mediaVideosOptional")}</span>
        <span className="text-gray-400">📏 {t("mediaMaxFiles", { max: String(MAX_FILES) })}</span>
        <span className="text-gray-400">✨ {t("mediaIncludeTypes")}</span>
      </div>

      {dropError && (
        <p className="text-red-400 text-sm">{t(dropError.key as "mediaInvalidType" | "mediaMaxSize", dropError.params ?? {})}</p>
      )}

      {errors.map((e, i) => (
        <p key={i} className="text-red-400 text-sm">{e}</p>
      ))}

      {/* Count */}
      <p className={`text-sm font-medium ${isValid ? "text-emerald-400" : "text-amber-400"}`}>
        {count}/{MAX_FILES} files · {count >= MIN_FILES ? t("mediaCountOk") : t("mediaAddMore", { min: String(MIN_FILES) })}
      </p>

      {/* Preview grid with reorder */}
      {media.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={media.map((m) => m.id)}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((item) => (
                <SortablePreview
                  key={item.id}
                  item={item}
                  onRemove={onRemove}
                  onSetCover={onSetCover}
                  coverLabel={t("cover")}
                  setCoverLabel={t("mediaSetCover")}
                  removeLabel={t("mediaRemove")}
                  dragLabel={t("mediaDragReorder")}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Export for parent */}
      <span className="sr-only" data-min={MIN_FILES} data-max={MAX_FILES} data-count={count} data-valid={String(isValid)} />
    </div>
  )
}

export const MEDIA_MIN = MIN_FILES
export const MEDIA_MAX = MAX_FILES
