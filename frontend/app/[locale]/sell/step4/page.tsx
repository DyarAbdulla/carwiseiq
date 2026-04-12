"use client"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Phone,
  FileText,
  MessageCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Wrench,
  Tag,
  History,
} from "lucide-react"
import { useSellWizard } from "@/context/SellWizardContext"
import {
  isValidIraqiMobileNational,
  normalizeIraqiNationalDigits,
} from "@/lib/iraqPhone"
import { SellWizardFooter } from "@/components/sell/SellWizardFooter"
import { cn } from "@/lib/utils"

const BEST_TIME = [
  { id: "morning", key: "bestTimeMorning" },
  { id: "afternoon", key: "bestTimeAfternoon" },
  { id: "evening", key: "bestTimeEvening" },
  { id: "anytime", key: "bestTimeAnytime" },
] as const

const PRO_TIP_ICONS = [ShieldCheck, Wrench, Sparkles, Tag, History] as const
const PRO_TIP_KEYS = ["proTip1", "proTip2", "proTip3", "proTip4", "proTip5"] as const

function SurfaceCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("sell-glass p-5 md:p-6 shadow-xl shadow-black/25", className)}>
      {children}
    </div>
  )
}

export default function SellStep4Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const { contact, setContact } = useSellWizard()

  const [phone, setPhone] = useState(() => normalizeIraqiNationalDigits(contact?.phone ?? ""))
  const [whatsapp, setWhatsapp] = useState(() => normalizeIraqiNationalDigits(contact?.whatsapp ?? ""))
  const [whatsappSame, setWhatsappSame] = useState(contact?.whatsappSameAsPhone ?? true)
  const [preferred, setPreferred] = useState(contact?.preferredContact ?? "")
  const [bestTime, setBestTime] = useState<string[]>(contact?.bestTimeToCall ?? [])
  const [description, setDescription] = useState(contact?.description ?? "")
  const [phoneError, setPhoneError] = useState("")
  const [whatsappError, setWhatsappError] = useState("")

  useEffect(() => {
    if (contact?.whatsappSameAsPhone && contact?.phone) {
      setWhatsapp(normalizeIraqiNationalDigits(contact.phone))
    }
  }, [contact?.whatsappSameAsPhone, contact?.phone])

  useEffect(() => {
    if (whatsappSame) setWhatsapp(phone)
  }, [whatsappSame, phone])

  useEffect(() => {
    setContact({
      phone: normalizeIraqiNationalDigits(phone),
      whatsapp: whatsappSame ? normalizeIraqiNationalDigits(phone) : normalizeIraqiNationalDigits(whatsapp),
      whatsappSameAsPhone: whatsappSame,
      preferredContact: preferred,
      bestTimeToCall: bestTime,
      description: description.slice(0, 1000),
    })
  }, [phone, whatsapp, whatsappSame, preferred, bestTime, description, setContact])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(`/${locale}/sell/step3`)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, locale])

  const toggleBestTime = (id: string) => {
    setBestTime((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleContinue = useCallback(() => {
    const phoneNorm = normalizeIraqiNationalDigits(phone)
    if (!phoneNorm) {
      setPhoneError(t("phoneRequired"))
      return
    }
    if (!isValidIraqiMobileNational(phoneNorm)) {
      setPhoneError(t("validPhone"))
      return
    }
    setPhoneError("")

    if (!whatsappSame) {
      const waNorm = normalizeIraqiNationalDigits(whatsapp)
      if (!waNorm || !isValidIraqiMobileNational(waNorm)) {
        setWhatsappError(t("whatsappInvalid"))
        return
      }
    }
    setWhatsappError("")

    const waNorm = whatsappSame ? phoneNorm : normalizeIraqiNationalDigits(whatsapp)
    setContact({
      phone: phoneNorm,
      whatsapp: waNorm,
      whatsappSameAsPhone: whatsappSame,
      preferredContact: preferred,
      bestTimeToCall: bestTime,
      description: description.slice(0, 1000),
    })
    router.push(`/${locale}/sell/step5`)
  }, [phone, whatsapp, whatsappSame, preferred, bestTime, description, setContact, router, locale, t])

  const inputCls =
    "h-12 text-base bg-black/25 border-white/12 rounded-xl focus-visible:ring-2 focus-visible:ring-violet-500/45 text-white placeholder:text-gray-500"

  return (
    <div className="relative px-4 py-8 md:py-14 animate-in fade-in duration-500 z-10">
      <div className="max-w-4xl mx-auto relative space-y-8">
        <header className="space-y-2">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-600/20 border border-white/10 shadow-lg shadow-indigo-500/10">
              <MessageCircle className="h-7 w-7 text-violet-300" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{t("step4Title")}</h1>
              <p className="text-gray-400 text-lg mt-1 max-w-2xl">{t("step4Description")}</p>
            </div>
          </div>
        </header>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            handleContinue()
          }}
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <SurfaceCard className="space-y-6 lg:col-span-2">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Phone className="h-5 w-5 text-violet-400" />
                <h2 className="text-base font-semibold text-white">{t("phone")} *</h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <span className="inline-flex items-center justify-center px-4 rounded-xl bg-white/[0.06] border border-white/12 text-gray-200 h-12 shrink-0 font-medium">
                  +964
                </span>
                <Input
                  value={phone ?? ""}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  onChange={(e) => {
                    setPhone(normalizeIraqiNationalDigits(e.target.value))
                    setPhoneError("")
                  }}
                  placeholder={t("phonePlaceholder")}
                  aria-describedby="sell-phone-hint"
                  className={cn(inputCls, "flex-1", phoneError && "border-red-500/70 focus-visible:ring-red-500/30")}
                />
              </div>
              {phoneError && <p className="text-red-400 text-sm">{phoneError}</p>}
              <p id="sell-phone-hint" className="text-xs text-gray-500">
                {t("phoneHintLocal")}
              </p>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <Label className="text-gray-200 font-medium">{t("whatsappLabel")}</Label>
                <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-200 hover:bg-white/[0.04] transition-colors">
                  <Checkbox checked={whatsappSame} onCheckedChange={(c) => setWhatsappSame(!!c)} />
                  <span className="text-sm">{t("whatsappSame")}</span>
                </label>
                {!whatsappSame && (
                  <div className="space-y-2">
                    <Input
                      value={whatsapp ?? ""}
                      inputMode="numeric"
                      autoComplete="tel-national"
                      onChange={(e) => {
                        setWhatsapp(normalizeIraqiNationalDigits(e.target.value))
                        setWhatsappError("")
                      }}
                      placeholder={t("phonePlaceholder")}
                      className={cn(inputCls, whatsappError && "border-red-500/70")}
                    />
                    {whatsappError && <p className="text-red-400 text-sm">{whatsappError}</p>}
                  </div>
                )}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Sparkles className="h-5 w-5 text-violet-400" />
                <h2 className="text-base font-semibold text-white">{t("preferredContact")}</h2>
              </div>
              <RadioGroup value={preferred ?? ""} onValueChange={setPreferred} className="grid gap-2">
                {(
                  [
                    { value: "Phone Call", label: "contactPhone" },
                    { value: "WhatsApp", label: "contactWhatsApp" },
                    { value: "Both", label: "contactBoth" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-3 cursor-pointer rounded-xl border px-4 py-3 transition-all",
                      preferred === opt.value
                        ? "border-violet-500/50 bg-violet-500/15 text-white shadow-md shadow-violet-500/10"
                        : "border-white/10 bg-black/15 text-gray-300 hover:border-violet-400/35 hover:bg-white/[0.04]"
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="border-violet-400/60" />
                    <span className="text-sm font-medium">{t(opt.label)}</span>
                  </label>
                ))}
              </RadioGroup>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Clock className="h-5 w-5 text-violet-400" />
                <h2 className="text-base font-semibold text-white">{t("bestTimeToCall")}</h2>
              </div>
              <p className="text-xs text-gray-500">{t("bestTimeHint")}</p>
              <div className="flex flex-wrap gap-2">
                {BEST_TIME.map((opt) => {
                  const on = bestTime.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleBestTime(opt.id)}
                      className={cn(
                        "rounded-full px-4 py-2.5 text-sm font-medium border transition-all",
                        on
                          ? "border-violet-400/60 bg-gradient-to-r from-violet-600/35 to-indigo-600/30 text-white shadow-md shadow-violet-500/15"
                          : "border-white/12 bg-white/[0.04] text-gray-300 hover:border-violet-400/40 hover:bg-white/[0.07]"
                      )}
                    >
                      {t(opt.key)}
                    </button>
                  )
                })}
              </div>
            </SurfaceCard>
          </div>

          <SurfaceCard className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <FileText className="h-5 w-5 text-violet-400" />
              <h2 className="text-base font-semibold text-white">{t("descriptionLabel")}</h2>
            </div>
            <Textarea
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              placeholder={t("descriptionPlaceholder")}
              rows={6}
              className="bg-black/25 border-white/12 rounded-xl text-white resize-none focus-visible:ring-2 focus-visible:ring-violet-500/45 min-h-[140px]"
            />
            <div className="flex flex-wrap justify-between gap-2 text-sm text-gray-400">
              <span>{t("descriptionHint")}</span>
              <span className="tabular-nums text-gray-500">{description.length}/1000</span>
            </div>
          </SurfaceCard>

          <div className="relative rounded-2xl p-[1px] overflow-hidden bg-gradient-to-br from-violet-500/50 via-indigo-500/25 to-fuchsia-500/20 shadow-lg shadow-violet-900/20">
            <div className="sell-glass p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-violet-300" />
                <p className="text-sm font-semibold text-white">{t("proTips")}</p>
              </div>
              <ul className="space-y-3">
                {PRO_TIP_ICONS.map((Icon, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-300">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25">
                      <Icon className="h-4 w-4 text-violet-300" />
                    </span>
                    <span className="leading-relaxed pt-1">{t(PRO_TIP_KEYS[i])}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <SellWizardFooter
            backLabel={t("back")}
            onBack={() => router.push(`/${locale}/sell/step3`)}
            continueLabel={t("continueToReview")}
            onContinue={handleContinue}
            continueType="submit"
          />
        </form>
      </div>
    </div>
  )
}
