"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { defaultLocale } from "@/i18n"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api"
import { Car } from "lucide-react"
import { SellCarCTA } from "@/components/SellCarCTA"

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 35 }, (_, i) => currentYear - i)

/** Always dark controls — hero sits on a dark image in every theme */
const HERO_SELECT_TRIGGER =
  "min-h-[44px] sm:min-h-[48px] w-full text-[16px] border-white/25 bg-[rgba(30,30,50,0.88)] text-white shadow-inner shadow-black/30 hover:bg-[rgba(30,30,50,0.95)] focus:ring-violet-400/40 [&>svg]:text-white/70"
const HERO_SELECT_CONTENT =
  "max-h-[min(60vh,360px)] border-white/15 bg-[rgba(22,22,38,0.98)] text-white shadow-2xl"
const HERO_SELECT_ITEM =
  "text-[15px] text-slate-100 focus:bg-white/12 focus:text-white dark:focus:bg-white/12 dark:focus:text-white"
const HERO_INPUT =
  "min-h-[44px] sm:min-h-[48px] text-[16px] border-white/25 bg-[rgba(30,30,50,0.88)] text-white placeholder:text-slate-400 shadow-inner shadow-black/30 focus-visible:ring-violet-400/40"

export function HeroValuationForm() {
  const router = useRouter()
  const locale = useLocale() || defaultLocale
  const t = useTranslations("home.heroForm")
  const tHome = useTranslations("home")

  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState<string>("")
  const [mileage, setMileage] = useState("")
  const [loadingMakes, setLoadingMakes] = useState(true)

  useEffect(() => {
    apiClient
      .getMakes()
      .then((data) => setMakes(Array.isArray(data) ? data : []))
      .catch(() => setMakes([]))
      .finally(() => setLoadingMakes(false))
  }, [])

  useEffect(() => {
    if (!make) {
      setModels([])
      setModel("")
      return
    }
    apiClient
      .getModels(make)
      .then((data) => setModels(Array.isArray(data) ? data : []))
      .catch(() => setModels([]))
    setModel("")
  }, [make])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (make) params.set("make", make)
    if (model) params.set("model", model)
    if (year && year.trim() !== "") params.set("year", year.trim())
    if (mileage) params.set("mileage", mileage)
    router.push(`/${locale}/predict?${params.toString()}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto mt-6 sm:mt-8 p-4 sm:p-6 pb-24 sm:pb-6 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl ring-1 ring-black/10"
      dir="ltr"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="space-y-2">
          <label htmlFor="hero-make" className="text-sm font-medium text-slate-200 sr-only">
            {t("make")}
          </label>
          <SearchableSelect
            id="hero-make"
            value={make}
            onValueChange={setMake}
            options={makes}
            placeholder={loadingMakes ? t("loadingMakes") : t("makePlaceholder")}
            disabled={loadingMakes}
            emptyMessage={t("noMakesAvailable")}
            searchPlaceholder={t("makeSearchPlaceholder")}
            className={`${HERO_SELECT_TRIGGER} !text-white placeholder:!text-slate-400 border-white/25 bg-[rgba(30,30,50,0.88)]`}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="hero-model" className="text-sm font-medium text-slate-200 sr-only">
            {t("model")}
          </label>
          <Select value={model} onValueChange={setModel} disabled={!make}>
            <SelectTrigger id="hero-model" className={HERO_SELECT_TRIGGER}>
              <SelectValue placeholder={t("modelPlaceholder")} />
            </SelectTrigger>
            <SelectContent className={HERO_SELECT_CONTENT}>
              {models.map((m) => (
                <SelectItem key={m} value={m} className={HERO_SELECT_ITEM}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="hero-year" className="text-sm font-medium text-slate-200 sr-only">
            {t("year")}
          </label>
          <Select
            value={year || undefined}
            onValueChange={(v) => setYear(v)}
          >
            <SelectTrigger id="hero-year" className={HERO_SELECT_TRIGGER}>
              <SelectValue placeholder={t("yearPlaceholder")} />
            </SelectTrigger>
            <SelectContent className={HERO_SELECT_CONTENT}>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)} className={HERO_SELECT_ITEM}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="hero-mileage" className="text-sm font-medium text-slate-200 sr-only">
            {t("mileage")}
          </label>
          <Input
            id="hero-mileage"
            type="number"
            placeholder={t("mileagePlaceholder")}
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className={HERO_INPUT}
            min={0}
          />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-5 flex-wrap sm:flex-nowrap">
        <Button
          type="submit"
          size="lg"
          className="flex-1 min-w-0 min-h-[48px] sm:min-h-[52px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm sm:text-base sm:text-lg font-semibold shadow-lg touch-manipulation whitespace-normal break-words"
        >
          <Car className="h-5 w-5 shrink-0 mr-2 rtl:mr-0 rtl:ml-2" aria-hidden />
          <span>{t("cta")}</span>
        </Button>
        <SellCarCTA
          variant="outline"
          size="lg"
          showIcon={false}
          className="flex-1 min-w-0 min-h-[48px] sm:min-h-[52px] border-2 border-white/35 bg-white/[0.08] backdrop-blur-md hover:bg-white/[0.14] hover:border-white/45 text-white text-sm sm:text-base sm:text-lg font-semibold rounded-xl touch-manipulation whitespace-normal break-words"
        >
          <span>{tHome("nav.sellCar") || "Sell Car"}</span>
        </SellCarCTA>
      </div>
    </form>
  )
}
