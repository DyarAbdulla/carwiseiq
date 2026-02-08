"use client"
import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { MediaUploadStep } from "@/components/sell/MediaUploadStep"
import { useSellWizard } from "@/context/SellWizardContext"
import { useAuthContext } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

const BUCKET = "car-images"
const MIN_IMAGES = 4
const MAX_IMAGES = 10

function getContentType(file: File): string {
  const t = (file.type || "").trim()
  if (/^(image\/|video\/)/.test(t)) return t
  return "application/octet-stream"
}

export default function SellStep2Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const { toast } = useToast()
  const { user } = useAuthContext()
  const { media, addMedia, removeMedia, setCover, reorderMedia, setUploadedMediaUrls, uploadedMediaUrls } = useSellWizard()

  // Enable Continue when 4–10 images inclusive (minimum 4, maximum 10)
  const canContinue = media.length >= MIN_IMAGES && media.length <= MAX_IMAGES
  const [uploading, setUploading] = useState(false)
  const uploadingRef = useRef(false)

  const handleContinue = useCallback(async () => {
    if (!canContinue || !user?.id) {
      if (!user?.id) {
        toast({ 
          title: t("publishUploadError"), 
          description: "Please log in to upload images.", 
          variant: "destructive" 
        })
      }
      return
    }
    if (uploadingRef.current) return

    // Skip re-upload when we already have matching uploaded URLs (e.g. back from step3)
    if (uploadedMediaUrls.length === media.length && uploadedMediaUrls.length >= MIN_IMAGES) {
      router.push(`/${locale}/sell/step3`)
      return
    }

    // Verify Supabase session before upload (REQUIRED for storage access)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (!session || sessionError) {
      console.error("[Step2] ❌ No Supabase session:", sessionError?.message || "Session not found")
      toast({ 
        title: t("publishUploadError"), 
        description: "Session expired. Please log in again.", 
        variant: "destructive" 
      })
      router.push(`/${locale}/login?returnUrl=/${locale}/sell/step2`)
      return
    }

    uploadingRef.current = true
    setUploading(true)
    try {
      const ts = Date.now()
      const basePath = `${user.id}/${ts}`
      const ordered = [...media].sort((a, b) => (a.isCover ? -1 : b.isCover ? 1 : a.order - b.order))

      // Log selected files count before upload (supports 4–10 inclusive)
      console.log("[Step2] Selected files count:", ordered.length)
      console.log("[Step2] ✅ Supabase session valid")
      console.log("[Step2] User ID:", user.id)
      console.log("[Step2] Starting upload to bucket:", BUCKET)

      const uploads = ordered.map((m, i) => {
        const ext = m.file.name.match(/\.(jpe?g|png|webp|mp4|mov|avi)$/i)?.[0]?.toLowerCase() || ".jpg"
        const name = `f${i}${ext}`
        const path = `${basePath}/${name}`
        const contentType = getContentType(m.file)
        console.log(`[Step2] Uploading file ${i + 1}/${ordered.length}: ${name} (${(m.file.size / 1024).toFixed(1)} KB)`)
        return supabase.storage.from(BUCKET).upload(path, m.file, { contentType, upsert: false }).then(({ data, error }) => {
          if (error) {
            console.error(`[Step2] ❌ Upload error for ${name}:`, error)
            return { error } as const
          }
          const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
          console.log(`[Step2] ✅ Uploaded ${name}:`, publicUrl)
          return { publicUrl } as const
        })
      })

      const results = await Promise.all(uploads)
      const firstErr = results.find((r) => "error" in r && r.error)
      if (firstErr && "error" in firstErr && firstErr.error) {
        console.error("[Step2] ❌ Upload failed:", firstErr.error)
        toast({ 
          title: t("publishUploadError"), 
          description: firstErr.error.message || "Failed to upload images. Please check your connection and try again.", 
          variant: "destructive" 
        })
        setUploading(false)
        uploadingRef.current = false
        return
      }
      // Build URLs from all successful uploads (order preserved by Promise.all)
      const urls = results.map((r) => ("publicUrl" in r ? r.publicUrl : "")).filter((url): url is string => Boolean(url))

      console.log("[Step2] ✅ Uploaded URLs count:", urls.length)
      console.log("[Step2] Uploaded URLs:", urls)

      if (urls.length !== ordered.length) {
        console.warn("[Step2] ⚠️ Some uploads may have failed. Expected:", ordered.length, "Got:", urls.length)
        toast({ 
          title: "Warning", 
          description: `Only ${urls.length} of ${ordered.length} files uploaded successfully.`, 
          variant: "default" 
        })
      }

      setUploadedMediaUrls(urls)
      setUploading(false)
      uploadingRef.current = false
      router.push(`/${locale}/sell/step3`)
    } catch (e) {
      console.error("[Step2] ❌ Upload exception:", e)
      const msg = e instanceof Error ? e.message : String(e)
      toast({ 
        title: t("publishUploadError"), 
        description: msg || "Failed to upload images. Please check your connection and try again.", 
        variant: "destructive" 
      })
      setUploading(false)
      uploadingRef.current = false
    } finally {
      setUploading(false)
      uploadingRef.current = false
    }
  }, [canContinue, user?.id, media, uploadedMediaUrls.length, setUploadedMediaUrls, router, locale, toast, t])

  return (
    <div className="relative px-4 py-12 md:py-16">
      {/* Ambient gradient glow - Enhanced for active step */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl opacity-60" />
      </div>
      
      <div className="max-w-4xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">{t("step2Title")}</h1>
          <p className="text-gray-400 text-lg">
            {t("step2Description")}
          </p>
        </div>

        <div className="space-y-6">
            <MediaUploadStep
              media={media}
              onAdd={addMedia}
              onRemove={removeMedia}
              onSetCover={setCover}
              onReorder={reorderMedia}
            />
            <div className="flex justify-between pt-4 gap-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/${locale}/sell/step1`)}
                disabled={uploading}
                className="border-white/10 text-gray-300 hover:bg-white/5 h-12 px-6 text-base"
              >
                {t("back")}
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!canContinue || uploading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 h-12 px-8 text-base font-medium shadow-lg shadow-indigo-500/20"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {uploading ? t("uploading") : t("continue")}
              </Button>
            </div>
        </div>
      </div>
    </div>
  )
}
