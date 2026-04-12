"use client"

import { useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthContext } from "@/context/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import {
  shouldOfferPushPrompt,
  snoozePushPromptDays,
  markPushDenied,
} from "@/lib/push/engagement"
import { subscribeWithApi } from "@/lib/push/push-client"
import { cn } from "@/lib/utils"

export function PushNotificationPrompt() {
  const locale = useLocale()
  const isRTL = locale === "ar" || locale === "ku"
  const t = useTranslations("pushPrompt")
  const router = useRouter()
  const { user } = useAuthContext()
  const { toast } = useToast()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const run = () => {
      try {
        setVisible(shouldOfferPushPrompt())
      } catch {
        setVisible(false)
      }
    }
    run()
    const id = window.setInterval(run, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const onNotNow = () => {
    snoozePushPromptDays(7)
    setVisible(false)
  }

  const onEnable = async () => {
    if (!user) {
      toast({ title: t("loginRequired"), variant: "destructive" })
      router.push(`/${locale}/login?returnUrl=${encodeURIComponent(`/${locale}`)}`)
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast({ title: t("loginRequired"), variant: "destructive" })
        setBusy(false)
        return
      }
      const ok = await subscribeWithApi(token, locale)
      if (!ok) {
        if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          markPushDenied()
          toast({ title: t("denied"), variant: "destructive" })
        } else {
          toast({ title: t("failed"), variant: "destructive" })
        }
        setVisible(false)
        setBusy(false)
        return
      }
      toast({ title: t("enabled") })
      setVisible(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label={t("title")}
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          dir={isRTL ? "rtl" : "ltr"}
          className={cn(
            "fixed inset-x-0 z-[98] max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:left-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2",
            "pointer-events-none px-3 md:px-0"
          )}
        >
          <div
            className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-white/12 bg-[rgba(15,15,30,0.92)] p-4 shadow-2xl backdrop-blur-xl"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.35)" }}
          >
            <p className="text-center text-[15px] font-medium leading-snug text-white">{t("title")}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onEnable}
                className="min-h-[44px] rounded-xl bg-[#6C5CE7] px-5 text-sm font-semibold text-white shadow-lg shadow-[#6C5CE7]/25 transition hover:bg-[#5b4cdb] disabled:opacity-60"
              >
                {busy ? "…" : t("enable")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onNotNow}
                className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-white/55 transition hover:text-white/80"
              >
                {t("notNow")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
