"use client"
import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin } from "lucide-react"
import { useSellWizard } from "@/context/SellWizardContext"
import { IRAQ_CITIES } from "@/lib/iraq-locations"

export default function SellStep1Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const { location, setLocation } = useSellWizard()

  const [city, setCity] = useState(location?.city ?? "")
  const [neighborhood, setNeighborhood] = useState(location?.neighborhood ?? "")
  const [search, setSearch] = useState("")
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    setLocation({ city, neighborhood })
  }, [city, neighborhood, setLocation])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return [...IRAQ_CITIES]
    return IRAQ_CITIES.filter((c) => c.toLowerCase().includes(q))
  }, [search])

  const handleContinue = () => {
    if (!city.trim()) return
    setLocation({ city: city.trim(), neighborhood: neighborhood.trim() })
    router.push(`/${locale}/sell/step2`)
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
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-indigo-500/20">
              <MapPin className="h-6 w-6 text-indigo-400" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{t("step1Title")}</h1>
          </div>
          <p className="text-gray-400 text-lg ml-12">
            {t("step1Description")}
          </p>
        </div>

        <div className="space-y-8">
            {/* City with search */}
            <div className="space-y-3">
              <Label className="text-gray-300 font-medium text-sm uppercase tracking-wide">{t("city")} *</Label>
              <div className="relative">
                <div className="relative">
                  <Input
                    value={search || city || ""}
                    onChange={(e) => {
                      const v = e.target.value
                      setSearch(v)
                      if (!v) setCity("")
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setFocused(false), 200)
                      if (filtered.length === 1) {
                        setCity(filtered[0]!)
                        setSearch("")
                      }
                      if (city && !IRAQ_CITIES.includes(city)) setSearch(city)
                    }}
                    placeholder={t("cityPlaceholder")}
                    className="h-12 pl-11 pr-4 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10"
                  />
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                {(focused || search.length > 0) && filtered.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl z-20"
                    onMouseDownCapture={(e) => e.preventDefault()}
                  >
                    {filtered.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCity(c)
                          setSearch("")
                          setFocused(false)
                        }}
                        className="w-full px-4 py-3 text-left text-white hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {city && (
                <p className="text-sm text-emerald-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {t("selected")}: {city}
                </p>
              )}
            </div>

            {/* Neighborhood (optional) */}
            <div className="space-y-3">
              <Label className="text-gray-300 font-medium text-sm uppercase tracking-wide">{t("neighborhood")}</Label>
              <Input
                value={neighborhood ?? ""}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder={t("neighborhoodPlaceholder")}
                className="h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10"
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleContinue}
                disabled={!city.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none h-12 px-8 text-base font-medium shadow-lg shadow-indigo-500/20"
              >
                {t("continue")}
              </Button>
            </div>
        </div>
      </div>
    </div>
  )
}
