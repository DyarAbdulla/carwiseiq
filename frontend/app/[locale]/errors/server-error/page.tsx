"use client"

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Home, RefreshCw, Mail } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ServerErrorPage() {
  const router = useRouter()
  const locale = useLocale() || 'en'

  const handleReport = () => {
    const subject = encodeURIComponent('Server Error Report')
    const body = encodeURIComponent(`Error occurred at: ${window.location.href}\n\nPlease describe what you were doing:`)
    window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-6xl mb-4"
            >
              ⚠️
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-2">500</h1>
            <h2 className="text-xl text-gray-300 mb-4">Server Error</h2>
            <p className="text-gray-400 mb-6">
              We're sorry, something went wrong on our end. Our team has been notified and is working to fix it.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => router.push(`/${locale}`)}
                className="bg-gradient-to-r from-[#5B7FFF] to-[#8B5CF6] hover:from-[#5B7FFF]/90 hover:to-[#8B5CF6]/90 text-white"
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={handleReport}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <Mail className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
