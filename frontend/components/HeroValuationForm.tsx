"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api"
import { Car } from "lucide-react"
import { SellCarCTA } from "@/components/SellCarCTA"

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 15 }, (_, i) => currentYear - i)

export function HeroValuationForm() {
  const router = useRouter()
  const locale = useLocale() || "en"
  const t = useTranslations("home.heroForm")
  const tHome = useTranslations("home")
  const tCommon = useTranslations("common")

  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState<string>(String(currentYear))
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
    if (year) params.set("year", year)
    if (mileage) params.set("mileage", mileage)
    router.push(`/${locale}/predict?${params.toString()}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto mt-6 sm:mt-8 p-4 sm:p-6 pb-24 sm:pb-6 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl"
      dir="ltr"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="space-y-2">
          <label htmlFor="hero-make" className="text-sm font-medium text-slate-200 sr-only">
            {t("make")}
          </label>
          <Select value={make} onValueChange={setMake} disabled={loadingMakes}>
            <SelectTrigger
              id="hero-make"
              className="min-h-[44px] sm:min-h-[48px] text-base bg-white/90 dark:bg-white/10 border-white/20 text-slate-900 dark:text-white"
            >
              <SelectValue placeholder={t("makePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {makes.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label htmlFor="hero-model" className="text-sm font-medium text-slate-200 sr-only">
            {t("model")}
          </label>
          <Select value={model} onValueChange={setModel} disabled={!make}>
            <SelectTrigger
              id="hero-model"
              className="min-h-[44px] sm:min-h-[48px] text-base bg-white/90 dark:bg-white/10 border-white/20 text-slate-900 dark:text-white"
            >
              <SelectValue placeholder={t("modelPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
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
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger
              id="hero-year"
              className="min-h-[44px] sm:min-h-[48px] text-base bg-white/90 dark:bg-white/10 border-white/20 text-slate-900 dark:text-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
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
            className="min-h-[44px] sm:min-h-[48px] text-base bg-white/90 dark:bg-white/10 border-white/20 text-slate-900 dark:text-white placeholder:text-slate-500"
            min={0}
          />
        </div>
      </div>
      <div className="flex flex-row gap-3 mt-4 sm:mt-5">
        <Button
          type="submit"
          size="lg"
          className="flex-1 min-h-[48px] sm:min-h-[52px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-base sm:text-lg font-semibold shadow-lg touch-manipulation"
        >
          <Car className="h-5 w-5 mr-2 rtl:mr-0 rtl:ml-2" aria-hidden />
          {t("cta")}
        </Button>
        <SellCarCTA
          variant="outline"
          size="lg"
          showIcon={false}
          className="flex-1 min-h-[48px] sm:min-h-[52px] border-2 border-slate-300 dark:border-white/30 bg-white/80 dark:bg-white/5 backdrop-blur-md hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-400 dark:hover:border-white/40 text-slate-900 dark:text-white text-base sm:text-lg font-semibold rounded-xl touch-manipulation"
        >
          {tHome("nav.sellCar") || "Sell Car"}
        </SellCarCTA>
      </div>
    </form>
  )
}
