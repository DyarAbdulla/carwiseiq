"use client"

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function NotFound() {
  const router = useRouter()
  const locale = useLocale() || 'en'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0f1117] p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full max-w-4xl h-96 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl rounded-full opacity-50" />
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-2xl w-full"
      >
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-12 md:p-16 shadow-2xl">
          <div className="text-center space-y-8">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center"
            >
              <div className="relative">
                {/* Glow effect behind icon */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/30 via-red-500/30 to-amber-500/30 blur-2xl rounded-full" />
                {/* Icon container */}
                <div className="relative bg-gradient-to-br from-amber-500/20 to-red-500/20 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-8">
                  <AlertTriangle
                    className="h-24 w-24 text-amber-400"
                    strokeWidth={1.5}
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))',
                    }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <h1 className="text-6xl md:text-7xl font-bold text-slate-900 dark:text-white">
                404
              </h1>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                Wrong Turn
              </h2>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-xl text-slate-600 dark:text-gray-300 max-w-md mx-auto leading-relaxed"
            >
              Looks like this road ends here. Let&apos;s get you back on track.
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link href={`/${locale}`}>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 px-8 py-6 text-lg font-semibold transition-all duration-300 hover:scale-105 w-full sm:w-auto"
                >
                  <Home className="h-5 w-5 mr-2" />
                  Return Home
                </Button>
              </Link>
              <Button
                onClick={() => router.back()}
                variant="outline"
                size="lg"
                className="border-slate-200 dark:border-white/20 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-900 dark:text-white px-8 py-6 text-lg font-semibold transition-all duration-300 w-full sm:w-auto"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Go Back
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
