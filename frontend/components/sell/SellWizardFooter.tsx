"use client"

import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export interface SellWizardFooterProps {
  backLabel: string
  onBack?: () => void
  continueLabel: string
  onContinue: () => void
  continueDisabled?: boolean
  continueLoading?: boolean
  continueType?: "button" | "submit"
  /** Hide back on step 1 if desired */
  showBack?: boolean
}

export function SellWizardFooter({
  backLabel,
  onBack,
  continueLabel,
  onContinue,
  continueDisabled = false,
  continueLoading = false,
  continueType = "button",
  showBack = true,
}: SellWizardFooterProps) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-8 mt-2 border-t border-white/10">
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack ?? (() => {})}
          className="h-12 px-6 text-base border-white/15 bg-white/[0.03] text-gray-200 hover:bg-white/10 hover:text-white"
        >
          {backLabel}
        </Button>
      ) : (
        <span className="hidden sm:block sm:w-[1px]" aria-hidden />
      )}
      <Button
        type={continueType}
        disabled={continueDisabled || continueLoading}
        onClick={continueType === "button" ? onContinue : undefined}
        className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 border-0 disabled:opacity-45"
      >
        {continueLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden />
            {continueLabel}
          </>
        ) : (
          continueLabel
        )}
      </Button>
    </div>
  )
}
