"use client"
import { useCallback, useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { MediaUploadStep, MEDIA_MAX, MEDIA_MIN } from "@/components/sell/MediaUploadStep"
import { SellWizardFooter } from "@/components/sell/SellWizardFooter"
import { useSellWizard } from "@/context/SellWizardContext"
import { useAuthContext } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { ImagePlus } from "lucide-react"

const BUCKET = "car-images"

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

  const imageCount = media.reduce((n, m) => n + (m.isVideo ? 0 : 1), 0)
  const canContinue = imageCount >= MEDIA_MIN && media.length <= MEDIA_MAX
  const [uploading, setUploading] = useState(false)
  const uploadingRef = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(`/${locale}/sell/step1`)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, locale])

  const handleContinue = useCallback(async () => {
    const imgCount = media.reduce((n, m) => n + (m.isVideo ? 0 : 1), 0)
    const mediaOk = imgCount >= MEDIA_MIN && media.length <= MEDIA_MAX
    if (!mediaOk || !user?.id) {
      if (!user?.id) {
        toast({
          title: t("publishUploadError"),
          description: t("loginRequired"),
          variant: "destructive",
        })
      }
      return
    }
    if (uploadingRef.current) return

    if (uploadedMediaUrls.length === media.length && imgCount >= MEDIA_MIN) {
      router.push(`/${locale}/sell/step3`)
      return
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (!session || sessionError) {
      console.error("[Step2] No Supabase session:", sessionError?.message || "Session not found")
      toast({
        title: t("publishUploadError"),
        description: t("sessionExpired"),
        variant: "destructive",
      })
      router.push(`/${locale}/login?returnUrl=${encodeURIComponent(`/${locale}/sell/step2`)}`)
      return
    }

    uploadingRef.current = true
    setUploading(true)
    try {
      const ts = Date.now()
      const basePath = `${user.id}/${ts}`
      const ordered = [...media].sort((a, b) => (a.isCover ? -1 : b.isCover ? 1 : a.order - b.order))

      console.log("[Step2] Selected files count:", ordered.length)
      console.log("[Step2] Supabase session valid")
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
            console.error(`[Step2] Upload error for ${name}:`, error)
            return { error } as const
          }
          const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
          console.log(`[Step2] Uploaded ${name}:`, publicUrl)
          return { publicUrl } as const
        })
      })

      const results = await Promise.all(uploads)
      const firstErr = results.find((r) => "error" in r && r.error)
      if (firstErr && "error" in firstErr && firstErr.error) {
        console.error("[Step2] Upload failed:", firstErr.error)
        toast({
          title: t("publishUploadError"),
          description: firstErr.error.message || t("uploadFailedGeneric"),
          variant: "destructive",
        })
        setUploading(false)
        uploadingRef.current = false
        return
      }
      const urls = results.map((r) => ("publicUrl" in r ? r.publicUrl : "")).filter((url): url is string => Boolean(url))

      console.log("[Step2] Uploaded URLs count:", urls.length)

      if (urls.length !== ordered.length) {
        console.warn("[Step2] Some uploads may have failed. Expected:", ordered.length, "Got:", urls.length)
        toast({
          title: t("warningPartialUploadTitle"),
          description: t("warningPartialUpload", { uploaded: urls.length, total: ordered.length }),
          variant: "default",
        })
      }

      setUploadedMediaUrls(urls)
      setUploading(false)
      uploadingRef.current = false
      router.push(`/${locale}/sell/step3`)
    } catch (e) {
      console.error("[Step2] Upload exception:", e)
      const msg = e instanceof Error ? e.message : String(e)
      toast({
        title: t("publishUploadError"),
        description: msg || t("uploadFailedGeneric"),
        variant: "destructive",
      })
      setUploading(false)
      uploadingRef.current = false
    } finally {
      setUploading(false)
      uploadingRef.current = false
    }
  }, [user?.id, media, uploadedMediaUrls, setUploadedMediaUrls, router, locale, toast, t])

  return (
    <div className="relative px-4 py-8 md:py-14 animate-in fade-in duration-500 z-10">
      <div className="max-w-4xl mx-auto relative space-y-8">
        <header className="space-y-2">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-600/20 border border-white/10 shadow-lg shadow-indigo-500/10">
              <ImagePlus className="h-7 w-7 text-violet-300" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{t("step2Title")}</h1>
              <p className="text-gray-400 text-lg mt-1 max-w-2xl">{t("step2Description")}</p>
            </div>
          </div>
        </header>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            void handleContinue()
          }}
        >
          <MediaUploadStep
            media={media}
            onAdd={addMedia}
            onRemove={removeMedia}
            onSetCover={setCover}
            onReorder={reorderMedia}
          />
          <SellWizardFooter
            backLabel={t("back")}
            onBack={() => router.push(`/${locale}/sell/step1`)}
            continueLabel={t("continue")}
            onContinue={() => void handleContinue()}
            continueDisabled={!canContinue || uploading}
            continueLoading={uploading}
            continueType="submit"
          />
        </form>
      </div>
    </div>
  )
}
