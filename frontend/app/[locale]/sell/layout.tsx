"use client"

import { SellWizardProvider } from "@/context/SellWizardContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Check, MapPin, Camera, FileText, Phone, ClipboardCheck } from "lucide-react"

const STEP_KEYS = ["stepLocation", "stepMedia", "stepDetails", "stepContact", "stepReview"] as const
const STEP_ICONS = [MapPin, Camera, FileText, Phone, ClipboardCheck] as const

function stepFromPath(pathname: string): number {
  const m = pathname.match(/\/sell\/step(\d+)/)
  if (m) return Math.min(5, Math.max(1, parseInt(m[1]!, 10)))
  return 1
}

export default function SellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const locale = useLocale()
  const t = useTranslations("sell")
  const current = stepFromPath(pathname)
  const isSuccess = pathname.includes("/sell/success")
  const showProgress = pathname.includes("/sell/step") && !isSuccess

  const steps = STEP_KEYS.map((key, i) => ({
    id: i + 1,
    path: `step${i + 1}` as const,
    label: t(key),
    icon: STEP_ICONS[i]!,
  }))

  return (
    <ProtectedRoute redirectTo="login">
      <SellWizardProvider>
        {showProgress && (
          <div className="sticky top-16 z-30 backdrop-blur-xl border-b border-white/10 bg-black/20">
            <div className="max-w-5xl mx-auto px-4 py-6">
              {/* Modern Progress Bar with Step Indicators - Clean Floating Design */}
              <div className="relative">
                {/* Progress Track - Subtle */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-white/5 rounded-full" />
                {/* Progress Fill */}
                <div
                  className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((current - 1) / (steps.length - 1)) * 100}%` }}
                />
                {/* Step Indicators */}
                <div className="relative flex justify-between items-center">
                  {steps.map((s) => {
                    const stepNum = s.id
                    const isActive = current === stepNum
                    const isPast = current > stepNum
                    const Icon = s.icon
                    const href = `/${locale}/sell/${s.path}`

                    return (
                      <Link
                        key={s.path}
                        href={href}
                        className="group flex flex-col items-center gap-2 relative z-10"
                      >
                        {/* Step Circle */}
                        <div
                          className={`
                            flex items-center justify-center w-10 h-10 rounded-full
                            transition-all duration-300 ease-out
                            ${isActive 
                              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110" 
                              : isPast
                              ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/30"
                              : "bg-white/5 text-gray-400 border-2 border-white/10 group-hover:border-white/20 group-hover:text-gray-300"
                            }
                          `}
                        >
                          {isPast ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Icon className={`h-5 w-5 ${isActive ? "text-white" : ""}`} />
                          )}
                        </div>
                        {/* Step Label */}
                        <span
                          className={`
                            text-xs font-medium transition-colors duration-300
                            ${isActive 
                              ? "text-white" 
                              : isPast
                              ? "text-emerald-400"
                              : "text-gray-400 group-hover:text-gray-300"
                            }
                            hidden sm:block max-w-[80px] text-center
                          `}
                        >
                          {s.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="form-wizard-container min-h-screen text-gray-100">
          {children}
        </div>
      </SellWizardProvider>
    </ProtectedRoute>
  )
}
