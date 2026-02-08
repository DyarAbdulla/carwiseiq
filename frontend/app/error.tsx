'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f1117]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Something went wrong!</h2>
        <p className="text-[#94a3b8] mb-6">{error.message}</p>
        <Button onClick={() => reset()} className="bg-[#5B7FFF] hover:bg-[#5B7FFF]/90">
          Try again
        </Button>
      </div>
    </div>
  )
}








