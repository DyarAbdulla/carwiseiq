"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, DollarSign, Gauge, Settings, Fuel, CheckCircle, Palette } from "lucide-react"
import { useSellWizard } from "@/context/SellWizardContext"
import type { WizardCarDetails } from "@/context/SellWizardContext"

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

  return (
    <div className="relative px-4 py-12 md:py-16">
      {/* Ambient gradient glow - Enhanced for active step */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-indigo-500/20 via-purple-500/10 to-transparent blur-3xl opacity-60" />
      </div>
      
      <div className="max-w-4xl mx-auto relative">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">{t("step3Title")}</h1>
          <p className="text-gray-400 text-lg">
            {t("step3Description")}
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleContinue() }} className="space-y-6">
            {/* Row 1: Make, Model */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium">{t("make")} *</Label>
                <Input
                  value={form.make ?? ""}
                  onChange={(e) => update({ make: e.target.value })}
                  placeholder={t("makePlaceholder")}
                  className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10 ${errors.make ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                />
                {errors.make && <p className="text-red-400 text-sm mt-1">{errors.make}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium">{t("model")} *</Label>
                <Input
                  value={form.model ?? ""}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder={t("modelPlaceholder")}
                  className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10 ${errors.model ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                />
                {errors.model && <p className="text-red-400 text-sm mt-1">{errors.model}</p>}
              </div>
            </div>

            {/* Row 2: Year, Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> {t("year")} *
                </Label>
                <Select value={form.year || undefined} onValueChange={(v) => update({ year: v })}>
                  <SelectTrigger className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 ${errors.year ? "border-red-500 focus:ring-red-500/30" : ""}`}>
                    <SelectValue placeholder={t("selectYear")} />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.year && <p className="text-red-400 text-sm mt-1">{errors.year}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> {t("price")} *
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price ?? ""}
                  onChange={(e) => update({ price: e.target.value })}
                  placeholder={t("pricePlaceholder")}
                  className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10 ${errors.price ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                />
                {form.price && !isNaN(parseFloat(form.price)) && (
                  <p className="text-sm text-gray-400 mt-1">${parseFloat(form.price).toLocaleString()}</p>
                )}
                {errors.price && <p className="text-red-400 text-sm mt-1">{errors.price}</p>}
              </div>
            </div>

            {/* Row 3: Mileage, Transmission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium flex items-center gap-2">
                  <Gauge className="h-4 w-4" /> {t("mileage")} *
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.mileage ?? ""}
                  onChange={(e) => update({ mileage: e.target.value })}
                  placeholder={t("mileagePlaceholder")}
                  className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10 ${errors.mileage ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
                />
                {form.mileage && !isNaN(parseInt(form.mileage, 10)) && (
                  <p className="text-sm text-gray-400 mt-1">{parseInt(form.mileage, 10).toLocaleString()} km</p>
                )}
                {errors.mileage && <p className="text-red-400 text-sm mt-1">{errors.mileage}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" /> {t("transmission")} *
                </Label>
                <Select value={form.transmission || undefined} onValueChange={(v) => update({ transmission: v })}>
                  <SelectTrigger className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 ${errors.transmission ? "border-red-500 focus:ring-red-500/30" : ""}`}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSMISSIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transmission && <p className="text-red-400 text-sm mt-1">{errors.transmission}</p>}
              </div>
            </div>

            {/* Row 4: Fuel, Condition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium flex items-center gap-2">
                  <Fuel className="h-4 w-4" /> {t("fuelType")} *
                </Label>
                <Select value={form.fuel_type || undefined} onValueChange={(v) => update({ fuel_type: v })}>
                  <SelectTrigger className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 ${errors.fuel_type ? "border-red-500 focus:ring-red-500/30" : ""}`}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fuel_type && <p className="text-red-400 text-sm mt-1">{errors.fuel_type}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> {t("condition")} *
                </Label>
                <Select value={form.condition || undefined} onValueChange={(v) => update({ condition: v })}>
                  <SelectTrigger className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10 ${errors.condition ? "border-red-500 focus:ring-red-500/30" : ""}`}>
                    <SelectValue placeholder={t("select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{t(opt.key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.condition && <p className="text-red-400 text-sm mt-1">{errors.condition}</p>}
              </div>
            </div>

            {/* Row 5: Color */}
            <div className="space-y-2">
              <Label className="text-gray-300 font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" /> {t("color")} *
              </Label>
              <Input
                value={form.color ?? ""}
                onChange={(e) => update({ color: e.target.value })}
                placeholder={t("colorPlaceholder")}
                className={`h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:bg-white/10 ${errors.color ? "border-red-500 focus-visible:ring-red-500/30" : ""}`}
              />
              {errors.color && <p className="text-red-400 text-sm mt-1">{errors.color}</p>}
            </div>

            {/* Row 6: Owners, Accident (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-gray-300 font-medium">{t("previousOwners")}</Label>
                <Select value={form.previous_owners || undefined} onValueChange={(v) => update({ previous_owners: v })}>
                  <SelectTrigger className="h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10">
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
                <Label className="text-gray-300 font-medium">{t("accidentHistory")}</Label>
                <Select value={form.accident_history || undefined} onValueChange={(v) => update({ accident_history: v })}>
                  <SelectTrigger className="h-12 text-base bg-white/5 backdrop-blur-sm border-white/10 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:bg-white/10">
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

            {/* Additional Features */}
            <div className="space-y-3">
              <Label className="text-gray-300 font-medium">{t("additionalFeatures")}</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FEATURES.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white transition-colors">
                    <Checkbox
                      checked={form.features.includes(opt.value)}
                      onCheckedChange={() => toggleFeature(opt.value)}
                    />
                    <span className="text-sm">{t(opt.key)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-6 gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/${locale}/sell/step2`)}
                className="border-white/10 text-gray-300 hover:bg-white/5 h-12 px-6 text-base"
              >
                {t("back")}
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 h-12 px-8 text-base font-medium shadow-lg shadow-indigo-500/20"
              >
                {t("continue")}
              </Button>
            </div>
          </form>
      </div>
    </div>
  )
}
