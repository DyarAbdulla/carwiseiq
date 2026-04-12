"use client"

import { useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"

export function AiAssistantClient() {
  const t = useTranslations("nav")

  const openChat = useCallback(() => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("open-chatbot"))
  }, [])

  useEffect(() => {
    openChat()
  }, [openChat])

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {t("aiAssistant")}
      </h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        {t("aiAssistantPageHint")}
      </p>
      <Button
        type="button"
        onClick={openChat}
        className="h-12 gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform duration-200 hover:from-indigo-500 hover:to-purple-500 active:scale-[0.98]"
      >
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        {t("openAssistant")}
      </Button>
    </div>
  )
}
