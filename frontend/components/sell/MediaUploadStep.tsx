"use client"

import { useCallback, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { defaultLocale } from "@/i18n"
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
import { Camera, Video, X, Star, Play, UploadCloud, Sparkles } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { WizardMediaItem } from "@/context/SellWizardContext"
import { cn } from "@/lib/utils"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024   // 5MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024  // 50MB
const MIN_FILES = 4
const MAX_FILES = 10

const ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/x-msvideo"
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type ValidateError = { key: string; params?: Record<string, string> }

function validateFile(file: File): ValidateError | null {
  const isVideo = VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|avi)$/i.test(file.name)
  const isImage =
    IMAGE_TYPES.includes(file.type) ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
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
  setCoverTooltip,
  removeLabel,
  dragLabel,
}: {
  item: WizardMediaItem
  onRemove: (id: string) => void
  onSetCover: (id: string) => void
  coverLabel: string
  setCoverLabel: string
  setCoverTooltip: string
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
      className={`relative aspect-square rounded-2xl overflow-hidden bg-gray-800/90 border border-white/10 shadow-lg ${
        isDragging ? "z-10 opacity-95 ring-2 ring-violet-500 scale-[1.02]" : ""
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
        <span className="absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center gap-1 shadow-lg border border-white/20">
          <Star className="h-3.5 w-3.5 fill-amber-200 text-amber-100" />
          {coverLabel}
        </span>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black via-black/85 to-transparent">
        <p className="text-white text-xs font-medium truncate drop-shadow-md" title={item.file.name}>{item.file.name}</p>
        <p className="text-violet-200/90 text-xs font-semibold">{formatSize(item.file.size)}</p>
      </div>

      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {!item.isCover && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSetCover(item.id)}
                className="p-2 rounded-full bg-black/70 hover:bg-violet-600 text-white transition-colors border border-white/10 shadow-md"
                aria-label={setCoverLabel}
              >
                <Star className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{setCoverTooltip}</TooltipContent>
          </Tooltip>
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
        className="absolute bottom-2 left-2 p-2 rounded-lg bg-black/70 text-white cursor-grab active:cursor-grabbing border border-white/10"
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
  const locale = useLocale() || defaultLocale
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
  const totalFiles = media.length
  // Minimum applies to photos only (copy: "Minimum N images"); videos are optional extras.
  const imageCount = media.reduce((n, m) => n + (m.isVideo ? 0 : 1), 0)
  // 4–10 inclusive: 4 images is valid (>= MIN_FILES), 10 total files max (<= MAX_FILES)
  const isValid = imageCount >= MIN_FILES && totalFiles <= MAX_FILES

  const photoMinPct = Math.min(100, Math.round((imageCount / MIN_FILES) * 100))

  return (
    <TooltipProvider delayDuration={200}>
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
        className={cn(
          "group relative min-h-[220px] sell-glass !border-2 !border-dashed flex flex-col items-center justify-center gap-3 transition-all duration-300 cursor-pointer overflow-hidden",
          dragging
            ? "!border-violet-400/70 bg-violet-500/15 shadow-xl shadow-violet-500/25 scale-[1.01]"
            : "!border-white/25 hover:!border-violet-400/50 hover:shadow-lg hover:shadow-violet-500/10",
          !canAdd && "pointer-events-none opacity-60"
        )}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.12),transparent_70%)]" />
        <div className="relative flex items-center justify-center gap-5 text-violet-300/90">
          <UploadCloud className={`h-12 w-12 transition-transform duration-300 ${dragging ? "scale-110" : "group-hover:scale-105"}`} />
          <div className="hidden sm:flex gap-2">
            <Camera className="h-9 w-9 opacity-80" />
            <Video className="h-9 w-9 opacity-80" />
          </div>
        </div>
        <div className="relative text-center space-y-1 px-4">
          <p className="text-white font-semibold text-lg flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-300/90" />
            {canAdd ? t("mediaDropTitle") : t("mediaMaxFiles", { max: String(MAX_FILES) })}
          </p>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            {canAdd ? t("mediaDropSubtitle") : t("mediaMaxFiles", { max: String(MAX_FILES) })}
          </p>
          <p className="text-xs text-gray-500">{t("mediaFormats")}</p>
        </div>
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

      {/* Photo minimum progress */}
      <div className="sell-glass p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={imageCount >= MIN_FILES ? "text-emerald-400 font-medium" : "text-amber-300 font-medium"}>
            {t("mediaPhotoProgress", { current: String(imageCount), min: String(MIN_FILES) })}
            {imageCount >= MIN_FILES ? ` ${t("mediaCountOk")}` : ""}
          </span>
          <span className="text-gray-500 text-xs">
            {t("mediaFileCount", { current: String(totalFiles), max: String(MAX_FILES) })}
          </span>
        </div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              imageCount >= MIN_FILES ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-violet-600 to-indigo-500"
            )}
            style={{ width: `${photoMinPct}%` }}
          />
        </div>
        {imageCount >= MIN_FILES ? (
          <p className="text-xs text-emerald-400/90">{t("mediaPhotoProgressMet", { max: String(MAX_FILES) })}</p>
        ) : null}
      </div>

      {/* Preview grid with reorder */}
      {media.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={media.map((m) => m.id)}>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
              {media.map((item) => (
                <SortablePreview
                  key={item.id}
                  item={item}
                  onRemove={onRemove}
                  onSetCover={onSetCover}
                  coverLabel={t("cover")}
                  setCoverLabel={t("mediaSetCover")}
                  setCoverTooltip={t("mediaTooltipSetCover")}
                  removeLabel={t("mediaRemove")}
                  dragLabel={t("mediaDragReorder")}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Export for parent */}
      <span
        className="sr-only"
        data-min={MIN_FILES}
        data-max={MAX_FILES}
        data-count={totalFiles}
        data-image-count={imageCount}
        data-valid={String(isValid)}
      />
    </div>
    </TooltipProvider>
  )
}

export const MEDIA_MIN = MIN_FILES
export const MEDIA_MAX = MAX_FILES
