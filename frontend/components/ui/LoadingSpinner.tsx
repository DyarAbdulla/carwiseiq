'use client'

/**
 * Lightweight loading spinner for dynamic import placeholders.
 * Keeps initial bundle small.
 */
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function PageLoadFallback() {
  return (
    <div className="flex min-h-[120px] items-center justify-center">
      <LoadingSpinner className="h-8 w-8 text-slate-400" />
    </div>
  )
}
