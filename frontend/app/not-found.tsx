'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0f1117] p-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full max-w-4xl h-96 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-full opacity-50" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        <div className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-12 md:p-16 shadow-2xl">
          <div className="text-center space-y-8">
            <div className="flex justify-center">
              <div className="relative bg-gradient-to-br from-amber-500/20 to-red-500/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-8">
                <span className="text-6xl" aria-hidden>⚠</span>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-6xl md:text-7xl font-bold text-slate-900 dark:text-white">
                404
              </h1>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                Wrong Turn
              </h2>
            </div>

            <p className="text-lg md:text-xl text-slate-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed">
              Looks like this road ends here. Let&apos;s get you back on track.
            </p>

            <div className="pt-4">
              <Link href="/">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 px-8 py-6 text-lg font-semibold transition-all duration-300 hover:scale-105"
                >
                  Return Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
