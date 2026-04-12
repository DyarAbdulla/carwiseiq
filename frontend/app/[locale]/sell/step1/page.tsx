"use client"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { MapPin, Search } from "lucide-react"
import { useSellWizard } from "@/context/SellWizardContext"
import { apiClient } from "@/lib/api"
import { groupCitiesByRegion, SELL_REGION_ORDER, type SellRegionId, neighborhoodExampleLocaleKey } from "@/lib/iraqSellRegions"
import { SellWizardFooter } from "@/components/sell/SellWizardFooter"
import { cn } from "@/lib/utils"

function regionLabelKey(r: SellRegionId): string {
  const map: Record<SellRegionId, string> = {
    kurdistan: "regionKurdistan",
    baghdad: "regionBaghdad",
    basra_south: "regionBasra_south",
    mosul_north: "regionMosul_north",
    central: "regionCentral",
    other: "regionOther",
  }
  return map[r]
}

export default function SellStep1Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const { location, setLocation } = useSellWizard()

  const [city, setCity] = useState(location?.city ?? "")
  const [neighborhood, setNeighborhood] = useState(location?.neighborhood ?? "")
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [locationsList, setLocationsList] = useState<string[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocation({ city, neighborhood })
  }, [city, neighborhood, setLocation])

  useEffect(() => {
    apiClient
      .getLocations()
      .then((data) => setLocationsList(Array.isArray(data) ? data : []))
      .catch(() => setLocationsList([]))
  }, [])

  const grouped = useMemo(() => groupCitiesByRegion(locationsList), [locationsList])

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: { region: SellRegionId; cities: string[] }[] = []
    for (const region of SELL_REGION_ORDER) {
      const cities = grouped.get(region) ?? []
      const list = !q ? cities : cities.filter((c) => c.toLowerCase().includes(q))
      if (list.length) out.push({ region, cities: list })
    }
    return out
  }, [grouped, search])

  const neighborhoodPlaceholder = useMemo(() => {
    const raw = t.raw("neighborhoodExamples") as Record<string, string> | undefined
    if (!raw || typeof raw !== "object") return t("neighborhoodPlaceholder")
    const key = neighborhoodExampleLocaleKey(city || "")
    return raw[key] ?? raw.default ?? t("neighborhoodPlaceholder")
  }, [city, t])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleContinue = useCallback(() => {
    if (!city.trim()) return
    setLocation({ city: city.trim(), neighborhood: neighborhood.trim() })
    router.push(`/${locale}/sell/step2`)
  }, [city, neighborhood, locale, router, setLocation])

  const displayValue = open ? search : city || search

  return (
    <div className="relative px-4 py-8 md:py-14 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="max-w-4xl mx-auto relative space-y-8 z-10">
        <header className="space-y-2">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-600/20 border border-white/10 shadow-lg shadow-indigo-500/10">
              <MapPin className="h-7 w-7 text-violet-300" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">{t("step1Title")}</h1>
              <p className="text-gray-400 text-lg mt-1 max-w-2xl">{t("step1Description")}</p>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 space-y-6">
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault()
                handleContinue()
              }}
            >
            <div className="sell-glass p-5 md:p-6 shadow-xl shadow-black/20 space-y-5">
              <div ref={rootRef} className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-violet-200/90">{t("city")} *</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-violet-400/80 pointer-events-none" />
                  <input
                    aria-label={t("citySearchAria")}
                    aria-expanded={open}
                    aria-controls="city-listbox"
                    role="combobox"
                    value={displayValue}
                    onChange={(e) => {
                      const v = e.target.value
                      setSearch(v)
                      setOpen(true)
                      if (!v) setCity("")
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={t("cityPlaceholder")}
                    className="w-full h-14 pl-11 pr-4 rounded-xl bg-black/30 border border-white/15 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 text-base"
                  />
                  {open && (
                    <div
                      id="city-listbox"
                      role="listbox"
                      className="sell-glass absolute z-30 top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto shadow-2xl shadow-black/40"
                    >
                      {filteredGroups.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-gray-400 text-center">{t("noCitiesMatch")}</p>
                      ) : (
                        filteredGroups.map(({ region, cities }) => (
                          <div key={region}>
                            <div className="sticky top-0 z-10 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-violet-300/90 bg-gradient-to-r from-violet-950/95 to-transparent border-b border-white/5">
                              {t(regionLabelKey(region) as "regionKurdistan")}
                            </div>
                            {cities.map((c) => (
                              <button
                                key={`${region}-${c}`}
                                type="button"
                                role="option"
                                aria-selected={city === c}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setCity(c)
                                  setSearch("")
                                  setOpen(false)
                                }}
                                className={cn(
                                  "w-full px-4 py-3 text-left text-sm transition-colors border-b border-white/5 last:border-0",
                                  city === c ? "bg-violet-600/25 text-white" : "text-gray-200 hover:bg-white/10"
                                )}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {city ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-200/80">{t("selected")}</p>
                    <p className="text-base font-semibold text-white">{city}</p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("neighborhood")}</label>
                <input
                  value={neighborhood ?? ""}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder={neighborhoodPlaceholder}
                  className="w-full h-12 px-4 rounded-xl bg-black/25 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>
            </div>

            <SellWizardFooter
              showBack={false}
              backLabel={t("back")}
              continueLabel={t("continue")}
              onContinue={handleContinue}
              continueDisabled={!city.trim()}
              continueType="submit"
            />
            </form>
          </div>

          <aside className="lg:col-span-2">
            <div
              className={cn(
                "sell-glass relative overflow-hidden min-h-[200px] transition-all duration-500",
                city ? "ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/10" : "opacity-90"
              )}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.12'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
              <div className="relative p-5 flex flex-col items-center justify-center min-h-[200px] text-center">
                <div
                  className={cn(
                    "mb-2 transition-transform duration-500",
                    city ? "scale-110 drop-shadow-[0_0_18px_rgba(167,139,250,0.55)]" : "scale-100"
                  )}
                >
                  <MapPin
                    className={cn(
                      "h-14 w-14 text-violet-400 mx-auto",
                      city && "motion-safe:animate-sell-pin"
                    )}
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-sm font-medium text-white/90">{t("locationPreviewTitle")}</p>
                <p className="text-xs text-gray-400 mt-1 px-4">
                  {city || t("selectLocation")}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
