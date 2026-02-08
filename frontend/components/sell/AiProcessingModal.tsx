"use client"

import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type AiProcessingStep = 'analyzing' | 'done' | 'error'

type AiProcessingModalProps = {
  open: boolean
  step: AiProcessingStep
  detectedMake?: string | null
  detectedModel?: string | null
  errorMessage?: string
  onContinue: () => void
}

export function AiProcessingModal({
  open,
  step,
  detectedMake,
  detectedModel,
  errorMessage,
  onContinue,
}: AiProcessingModalProps) {
  if (!open) return null

  const isAnalyzing = step === 'analyzing'
  const isDone = step === 'done'
  const isError = step === 'error'
  const detected = [detectedMake, detectedModel].filter(Boolean).join(' ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-gray-600 bg-gray-800 p-6 shadow-xl">
        <p className="text-center text-lg font-medium text-white">
          {isAnalyzing && 'Analyzing car images...'}
          {isDone && 'Detection complete'}
          {isError && (errorMessage || "AI couldn't detect car details")}
        </p>
        <div className="mt-4 flex flex-col items-center gap-4">
          {isAnalyzing && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" aria-hidden />
              <p className="text-center text-sm text-gray-400">Using AI to identify make and model</p>
            </>
          )}
          {isDone && detected && (
            <>
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-center text-gray-300">
                Detected: <span className="font-semibold text-white">{detected}</span>
              </p>
              <p className="text-center text-xs text-gray-400">You can edit these in the next step</p>
            </>
          )}
          {isError && (
            <p className="text-center text-sm text-gray-400">
              Please enter make and model manually in the next step.
            </p>
          )}
          {(isDone || isError) && (
            <Button onClick={onContinue} className="mt-2 bg-blue-600 hover:bg-blue-700">
              {isError ? 'Continue with manual entry' : 'Continue'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
