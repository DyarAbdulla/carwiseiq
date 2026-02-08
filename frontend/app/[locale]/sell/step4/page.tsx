"use client"
export const runtime = 'edge';

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Phone, FileText } from "lucide-react"
import { useSellWizard } from "@/context/SellWizardContext"
import type { WizardContact } from "@/context/SellWizardContext"

const BEST_TIME = [
  { id: "morning", key: "bestTimeMorning" },
  { id: "afternoon", key: "bestTimeAfternoon" },
  { id: "evening", key: "bestTimeEvening" },
  { id: "anytime", key: "bestTimeAnytime" },
] as const

function isValidIraqiPhone(val: string): boolean {
  const digits = val.replace(/\D/g, "")
  if (digits.length < 10) return false
  const rest = digits.startsWith("964") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits
  return rest.length >= 10
}

export default function SellStep4Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const { contact, setContact } = useSellWizard()

  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [whatsapp, setWhatsapp] = useState(contact?.whatsapp ?? "")
  const [whatsappSame, setWhatsappSame] = useState(contact?.whatsappSameAsPhone ?? true)
  const [preferred, setPreferred] = useState(contact?.preferredContact ?? "")
  const [bestTime, setBestTime] = useState<string[]>(contact?.bestTimeToCall ?? [])
  const [description, setDescription] = useState(contact?.description ?? "")
  const [phoneError, setPhoneError] = useState("")

  useEffect(() => {
    if (contact?.whatsappSameAsPhone && contact?.phone) setWhatsapp(contact.phone)
  }, [contact?.whatsappSameAsPhone, contact?.phone])

  useEffect(() => {
    if (whatsappSame) setWhatsapp(phone)
  }, [whatsappSame, phone])

  useEffect(() => {
    setContact({
      phone,
      whatsapp: whatsappSame ? phone : whatsapp,
      whatsappSameAsPhone: whatsappSame,
      preferredContact: preferred,
      bestTimeToCall: bestTime,
      description: description.slice(0, 1000),
    })
  }, [phone, whatsapp, whatsappSame, preferred, bestTime, description, setContact])

  const toggleBestTime = (id: string) => {
    setBestTime((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleContinue = () => {
    if (!phone.trim()) {
      setPhoneError(t("phoneRequired"))
      return
    }
    if (!isValidIraqiPhone(phone)) {
      setPhoneError(t("validPhone"))
      return
    }
    setPhoneError("")
    setContact({
      phone: phone.trim(),
      whatsapp: whatsappSame ? phone.trim() : whatsapp.trim(),
      whatsappSameAsPhone: whatsappSame,
      preferredContact: preferred,
      bestTimeToCall: bestTime,
      description: description.slice(0, 1000),
    })
    router.push(`/${locale}/sell/step5`)
  }

  return (
    <div className="relative px-4 py-12 md:py-16">
      {/* Ambient gradient glow - Enhanced for active step */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl opacity-60" />
      </div>
      
      <div className="max-w-4xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">{t("step4Title")}</h1>
          <p className="text-gray-400 text-lg">
            {t("step4Description")}
          </p>
        </div>

        <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-300 font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" /> {t("phone")} *
              </Label>
              <div className="flex gap-3">
                <span className="inline-flex items-center px-4 rounded-lg bg-white/5 border border-white/10 text-gray-300 h-12">
                  +964
                </span>
                <Input
                  value={phone ?? ""}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError("") }}
                  placeholder={t("phonePlaceholder")}
                  className={`flex-1 h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10 ${phoneError ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                />
              </div>
              {phoneError && <p className="text-red-400 text-sm mt-1">{phoneError}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 font-medium">{t("whatsappLabel")}</Label>
              <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                <Checkbox checked={whatsappSame} onCheckedChange={(c) => setWhatsappSame(!!c)} />
                <span className="text-sm">{t("whatsappSame")}</span>
              </label>
              {!whatsappSame && (
                <Input
                  value={whatsapp ?? ""}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+964 750 123 4567"
                  className="h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10"
                />
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-gray-300 font-medium">{t("preferredContact")}</Label>
              <RadioGroup value={preferred ?? ""} onValueChange={setPreferred} className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                  <RadioGroupItem value="Phone Call" />
                  <span>{t("contactPhone")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                  <RadioGroupItem value="WhatsApp" />
                  <span>{t("contactWhatsApp")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                  <RadioGroupItem value="Both" />
                  <span>{t("contactBoth")}</span>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-300 font-medium">{t("bestTimeToCall")}</Label>
              <div className="flex flex-wrap gap-3">
                {BEST_TIME.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                    <Checkbox
                      checked={bestTime.includes(opt.id)}
                      onCheckedChange={() => toggleBestTime(opt.id)}
                    />
                    <span className="text-sm">{t(opt.key)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300 font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> {t("descriptionLabel")}
              </Label>
              <Textarea
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                placeholder={t("descriptionPlaceholder")}
                rows={6}
                className="bg-white/5 backdrop-blur-sm border-white/10 rounded-xl text-white resize-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10"
              />
              <p className="text-sm text-gray-400">{description.length}/1000</p>
              <p className="text-xs text-gray-500">{t("descriptionHint")}</p>
            </div>

            {/* Pro tips */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-medium text-gray-300 mb-3">{t("proTips")}</p>
              <ul className="text-sm text-gray-400 space-y-1.5 list-disc list-inside">
                <li>{t("proTip1")}</li>
                <li>{t("proTip2")}</li>
                <li>{t("proTip3")}</li>
                <li>{t("proTip4")}</li>
                <li>{t("proTip5")}</li>
              </ul>
            </div>

            <div className="flex justify-between pt-4 gap-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/${locale}/sell/step3`)}
                className="border-white/10 text-gray-300 hover:bg-white/5 h-12 px-6 text-base"
              >
                {t("back")}
              </Button>
              <Button
                onClick={handleContinue}
                className="bg-indigo-600 hover:bg-indigo-500 h-12 px-8 text-base font-medium shadow-lg shadow-indigo-500/20"
              >
                {t("continueToReview")}
              </Button>
            </div>
        </div>
      </div>
    </div>
  )
}
