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
        <div className="sell-flow-root text-gray-100">
          <div className="sell-flow-bg-layers" aria-hidden>
            <div className="sell-flow-bg-image" />
            <div className="sell-flow-bg-overlay-dark" />
            <div className="sell-flow-bg-overlay-vignette" />
          </div>

          {showProgress && (
            <div className="sticky top-16 z-30 px-3 sm:px-4 pt-3 pb-2">
              <div className="sell-glass max-w-5xl mx-auto px-3 sm:px-5 py-4 sm:py-5 shadow-lg shadow-black/20">
                <div className="relative">
                  <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-white/[0.06] rounded-full" />
                  <div
                    className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 transition-[width] duration-700 ease-out shadow-[0_0_12px_rgba(139,92,246,0.45)]"
                    style={{ width: `${((current - 1) / (steps.length - 1)) * 100}%` }}
                  />
                  <div className="relative flex justify-between items-start gap-1 sm:gap-2">
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
                          className="group flex flex-col items-center gap-2 relative z-10 min-w-0 flex-1"
                        >
                          <div
                            className={`
                            flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl
                            transition-all duration-500 ease-out
                            ${isActive
                              ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/40 scale-110 ring-2 ring-violet-400/50"
                              : isPast ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/35"
                              : "bg-white/[0.06] text-gray-500 border border-white/10 group-hover:border-violet-400/30 group-hover:text-gray-200"
                            }
                          `}
                          >
                            {isPast ? (
                              <Check className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.5} />
                            ) : (
                              <Icon className={`h-5 w-5 sm:h-5 sm:h-5 ${isActive ? "text-white" : ""}`} />
                            )}
                          </div>
                          <span
                            className={`
                            text-[10px] sm:text-xs font-semibold transition-colors duration-300 leading-tight
                            ${isActive ? "text-white" : isPast ? "text-emerald-400/90" : "text-gray-500 group-hover:text-gray-300"}
                            text-center max-w-[72px] sm:max-w-[88px]
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

          <div className="relative z-10 form-wizard-container min-h-screen">
            <div key={pathname} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
              {children}
            </div>
          </div>
        </div>
      </SellWizardProvider>
    </ProtectedRoute>
  )
}
