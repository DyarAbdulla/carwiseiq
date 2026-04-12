"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Calendar,
  DollarSign,
  Gauge,
  Settings,
  Fuel,
  CheckCircle,
  Palette,
  Check,
  Car,
  Snowflake,
  Bluetooth,
  Videotape,
  MapPinned,
  Armchair,
  Sun,
  Radio,
  Flame,
  CircleDot,
  SlidersHorizontal,
  Shield,
  LayoutGrid,
  Lock,
  KeyRound,
  type LucideIcon,
} from "lucide-react"
import { useSellWizard } from "@/context/SellWizardContext"
import type { WizardCarDetails } from "@/context/SellWizardContext"
import { suggestMakes, suggestModels } from "@/lib/carMakeModelHints"
import { SellWizardFooter } from "@/components/sell/SellWizardFooter"
import { cn } from "@/lib/utils"

const IQD_PER_USD = 1320

const TRANSMISSIONS = [
  { value: "Automatic", key: "transmissionAuto" },
  { value: "Manual", key: "transmissionManual" },
  { value: "CVT", key: "transmissionCvt" },
  { value: "Semi-Automatic", key: "transmissionSemiAuto" },
] as const
const FUEL_TYPES = [
  { value: "Petrol/Gasoline", key: "fuelPetrol" },
  { value: "Diesel", key: "fuelDiesel" },
  { value: "Hybrid", key: "fuelHybrid" },
  { value: "Plug-in Hybrid (PHEV)", key: "fuelPhev" },
  { value: "Electric (EV)", key: "fuelEv" },
  { value: "CNG (Compressed Natural Gas)", key: "fuelCng" },
] as const
const CONDITIONS = [
  { value: "New", key: "conditionNew" },
  { value: "Like New", key: "conditionLikeNew" },
  { value: "Excellent", key: "conditionExcellent" },
  { value: "Very Good", key: "conditionVeryGood" },
  { value: "Good", key: "conditionGood" },
  { value: "Fair", key: "conditionFair" },
  { value: "Needs Work", key: "conditionNeedsWork" },
] as const
const OWNERS = [
  { value: "0 (First Owner)", key: "owners0" },
  { value: "1", key: "owners1" },
  { value: "2", key: "owners2" },
  { value: "3", key: "owners3" },
  { value: "4", key: "owners4" },
  { value: "5+", key: "owners5Plus" },
] as const
const ACCIDENT = [
  { value: "No accidents", key: "accidentNone" },
  { value: "Minor accident (repaired)", key: "accidentMinor" },
  { value: "Major accident (repaired)", key: "accidentMajor" },
  { value: "Unknown", key: "accidentUnknown" },
] as const
const FEATURES = [
  { value: "Air Conditioning", key: "featureAc" },
  { value: "Bluetooth", key: "featureBluetooth" },
  { value: "Backup Camera", key: "featureBackupCam" },
  { value: "Navigation System", key: "featureNav" },
  { value: "Leather Seats", key: "featureLeather" },
  { value: "Sunroof/Moonroof", key: "featureSunroof" },
  { value: "Cruise Control", key: "featureCruise" },
  { value: "Parking Sensors", key: "featureParkingSensors" },
  { value: "Heated Seats", key: "featureHeatedSeats" },
  { value: "All-Wheel Drive (AWD)", key: "featureAwd" },
  { value: "ABS Brakes", key: "featureAbs" },
  { value: "Airbags (Multiple)", key: "featureAirbags" },
  { value: "Alloy Wheels", key: "featureAlloyWheels" },
  { value: "Power Windows", key: "featurePowerWindows" },
  { value: "Power Locks", key: "featurePowerLocks" },
  { value: "Keyless Entry", key: "featureKeyless" },
] as const

const FEATURE_ICON: Record<string, LucideIcon> = {
  "Air Conditioning": Snowflake,
  Bluetooth,
  "Backup Camera": Videotape,
  "Navigation System": MapPinned,
  "Leather Seats": Armchair,
  "Sunroof/Moonroof": Sun,
  "Cruise Control": SlidersHorizontal,
  "Parking Sensors": Radio,
  "Heated Seats": Flame,
  "All-Wheel Drive (AWD)": Car,
  "ABS Brakes": CircleDot,
  "Airbags (Multiple)": Shield,
  "Alloy Wheels": LayoutGrid,
  "Power Windows": LayoutGrid,
  "Power Locks": Lock,
  "Keyless Entry": KeyRound,
}

const YEARS = Array.from({ length: 67 }, (_, i) => 2026 - i)

function normalizeCarDetails(d: Partial<WizardCarDetails> | null | undefined): WizardCarDetails {
  if (!d) {
    return {
      make: "", model: "", year: "", price: "", mileage: "",
      transmission: "", fuel_type: "", condition: "", body_type: "", color: "",
      previous_owners: "", accident_history: "", features: [],
    }
  }
  return {
    make: d.make ?? "", model: d.model ?? "", year: d.year ?? "", price: d.price ?? "", mileage: d.mileage ?? "",
    transmission: d.transmission ?? "", fuel_type: d.fuel_type ?? "", condition: d.condition ?? "", body_type: d.body_type ?? "", color: d.color ?? "",
    previous_owners: d.previous_owners ?? "", accident_history: d.accident_history ?? "", features: Array.isArray(d.features) ? d.features : [],
  }
}

function Ok({ show }: { show: boolean }) {
  if (!show) return <span className="inline-flex w-5 h-5 shrink-0" aria-hidden />
  return <Check className="w-5 h-5 text-emerald-400 shrink-0" strokeWidth={2.5} aria-hidden />
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <section className="sell-glass p-5 md:p-6 shadow-xl shadow-black/20 space-y-5">
      <div className="flex items-center gap-3 pb-1 border-b border-white/10">
        <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/20">
          <Icon className="h-5 w-5 text-violet-300" />
        </div>
        <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function SellStep3Page() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("sell")
  const { carDetails, setCarDetails } = useSellWizard()

  const [form, setForm] = useState<WizardCarDetails>(() => normalizeCarDetails(null))
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (carDetails) setForm(normalizeCarDetails(carDetails))
  }, [carDetails])

  const makeHints = useMemo(() => suggestMakes(form.make, 12), [form.make])
  const modelHints = useMemo(() => suggestModels(form.make, form.model, 14), [form.make, form.model])

  const update = (u: Partial<WizardCarDetails>) => {
    setForm((f) => {
      const next = { ...f, ...u }
      setCarDetails(next)
      return next
    })
  }

  const toggleFeature = (name: string) => {
    setForm((f) => {
      const next = {
        ...f,
        features: f.features.includes(name) ? f.features.filter((x) => x !== name) : [...f.features, name],
      }
      setCarDetails(next)
      return next
    })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.make.trim()) e.make = t("makeRequired")
    if (!form.model.trim()) e.model = t("modelRequired")
    if (!form.year) e.year = t("yearRequired")
    const p = parseFloat(form.price)
    if (!form.price || isNaN(p) || p <= 0) e.price = t("validPrice")
    const m = parseInt(form.mileage, 10)
    if (!form.mileage || isNaN(m) || m < 0) e.mileage = t("validMileage")
    if (!form.transmission) e.transmission = t("selectTransmission")
    if (!form.fuel_type) e.fuel_type = t("selectFuelType")
    if (!form.condition) e.condition = t("selectCondition")
    if (!form.color.trim()) e.color = t("colorRequired")
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleContinue = () => {
    if (!validate()) return
    setCarDetails(form)
    router.push(`/${locale}/sell/step4`)
  }

  const priceNum = parseFloat(form.price)
  const mileageNum = parseInt(form.mileage, 10)
  const iqdApprox = !isNaN(priceNum) && priceNum > 0 ? Math.round(priceNum * IQD_PER_USD) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(`/${locale}/sell/step2`)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router, locale])

  const inputClass = (err?: string) =>
    cn(
      "h-12 text-base bg-black/25 border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-violet-500/45",
      err && "border-red-500/70 focus-visible:ring-red-500/30"
    )

  return (
    <div className="relative px-4 py-8 md:py-14 animate-in fade-in duration-500 z-10">
      <div className="max-w-4xl mx-auto relative space-y-8">
        <header>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">{t("step3Title")}</h1>
          <p className="text-gray-400 text-lg">{t("step3Description")}</p>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); handleContinue() }} className="space-y-6">
          <Section title={t("sectionVehicleIdentity")} icon={Car}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200">{t("make")} *</Label>
                  <Ok show={form.make.trim().length >= 2} />
                </div>
                <Input
                  value={form.make ?? ""}
                  onChange={(e) => update({ make: e.target.value })}
                  placeholder={t("makePlaceholder")}
                  list="sell-make-hints"
                  autoComplete="off"
                  className={inputClass(errors.make)}
                />
                <datalist id="sell-make-hints">
                  {makeHints.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {errors.make && <p className="text-red-400 text-sm">{errors.make}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200">{t("model")} *</Label>
                  <Ok show={form.model.trim().length >= 1} />
                </div>
                <Input
                  value={form.model ?? ""}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder={t("modelPlaceholder")}
                  list="sell-model-hints"
                  autoComplete="off"
                  className={inputClass(errors.model)}
                />
                <datalist id="sell-model-hints">
                  {modelHints.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {errors.model && <p className="text-red-400 text-sm">{errors.model}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-violet-400" /> {t("year")} *
                  </Label>
                  <Ok show={!!form.year} />
                </div>
                <Select value={form.year || undefined} onValueChange={(v) => update({ year: v })}>
                  <SelectTrigger className={inputClass(errors.year)}>
                    <SelectValue placeholder={t("selectYear")} />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.year && <p className="text-red-400 text-sm">{errors.year}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-violet-400" /> {t("color")} *
                  </Label>
                  <Ok show={form.color.trim().length >= 2} />
                </div>
                <Input
                  value={form.color ?? ""}
                  onChange={(e) => update({ color: e.target.value })}
                  placeholder={t("colorPlaceholder")}
                  className={inputClass(errors.color)}
                />
                {errors.color && <p className="text-red-400 text-sm">{errors.color}</p>}
              </div>
            </div>
          </Section>

          <Section title={t("sectionSpecifications")} icon={Settings}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-violet-400" /> {t("mileage")} *
                  </Label>
                  <Ok show={!isNaN(mileageNum) && mileageNum >= 0 && form.mileage !== ""} />
                </div>
                <Input
                  type="number"
                  min={0}
                  value={form.mileage ?? ""}
                  onChange={(e) => update({ mileage: e.target.value })}
                  placeholder={t("mileagePlaceholder")}
                  className={inputClass(errors.mileage)}
                />
                {form.mileage && !isNaN(mileageNum) && (
                  <p className="text-sm text-gray-400">{mileageNum.toLocaleString()} km</p>
                )}
                {errors.mileage && <p className="text-red-400 text-sm">{errors.mileage}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200">{t("transmission")} *</Label>
                  <Ok show={!!form.transmission} />
                </div>
                <Select value={form.transmission || undefined} onValueChange={(v) => update({ transmission: v })}>
                  <SelectTrigger className={inputClass(errors.transmission)}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSMISSIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transmission && <p className="text-red-400 text-sm">{errors.transmission}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200 flex items-center gap-2">
                    <Fuel className="h-4 w-4 text-violet-400" /> {t("fuelType")} *
                  </Label>
                  <Ok show={!!form.fuel_type} />
                </div>
                <Select value={form.fuel_type || undefined} onValueChange={(v) => update({ fuel_type: v })}>
                  <SelectTrigger className={inputClass(errors.fuel_type)}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fuel_type && <p className="text-red-400 text-sm">{errors.fuel_type}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-gray-200 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-400" /> {t("condition")} *
                  </Label>
                  <Ok show={!!form.condition} />
                </div>
                <Select value={form.condition || undefined} onValueChange={(v) => update({ condition: v })}>
                  <SelectTrigger className={inputClass(errors.condition)}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.condition && <p className="text-red-400 text-sm">{errors.condition}</p>}
              </div>
            </div>
          </Section>

          <Section title={t("sectionPricing")} icon={DollarSign}>
            <div className="space-y-2 max-w-md">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-gray-200">{t("price")} *</Label>
                <Ok show={!isNaN(priceNum) && priceNum > 0} />
              </div>
              <Input
                type="number"
                min={0}
                value={form.price ?? ""}
                onChange={(e) => update({ price: e.target.value })}
                placeholder={t("pricePlaceholder")}
                className={inputClass(errors.price)}
              />
              {form.price && !isNaN(priceNum) && priceNum > 0 && (
                <div className="sell-glass px-4 py-3 space-y-1">
                  <p className="text-white font-medium">${priceNum.toLocaleString()} USD</p>
                  {iqdApprox != null && (
                    <p className="text-sm text-violet-200/90">
                      {t("iqdApprox", { amount: iqdApprox.toLocaleString() })}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500">{t("iqdDisclaimer")}</p>
                </div>
              )}
              {errors.price && <p className="text-red-400 text-sm">{errors.price}</p>}
            </div>
          </Section>

          <Section title={t("sectionHistory")} icon={Shield}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-gray-200">{t("previousOwners")}</Label>
                <Select value={form.previous_owners || undefined} onValueChange={(v) => update({ previous_owners: v })}>
                  <SelectTrigger className={inputClass()}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-200">{t("accidentHistory")}</Label>
                <Select value={form.accident_history || undefined} onValueChange={(v) => update({ accident_history: v })}>
                  <SelectTrigger className={inputClass()}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCIDENT.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          <Section title={t("sectionFeatures")} icon={LayoutGrid}>
            <div className="flex flex-wrap gap-2.5">
              {FEATURES.map((opt) => {
                const on = form.features.includes(opt.value)
                const Fi = FEATURE_ICON[opt.value] ?? LayoutGrid
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleFeature(opt.value)}
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition-all",
                      on
                        ? "bg-gradient-to-r from-violet-600/40 to-indigo-600/35 border-violet-400/50 text-white shadow-md shadow-violet-500/15"
                        : "bg-white/[0.04] border-white/10 text-gray-300 hover:border-violet-400/35 hover:bg-white/[0.07]"
                    )}
                  >
                    <Fi className={cn("h-4 w-4 shrink-0", on ? "text-violet-200" : "text-gray-500")} />
                    {t(opt.key)}
                  </button>
                )
              })}
            </div>
          </Section>

          <SellWizardFooter
            backLabel={t("back")}
            onBack={() => router.push(`/${locale}/sell/step2`)}
            continueLabel={t("continue")}
            onContinue={handleContinue}
            continueType="submit"
          />
        </form>
      </div>
    </div>
  )
}
