"use client"

import { motion } from 'framer-motion'
import { Car } from 'lucide-react'
import { ClientOnlyIcon } from '@/components/ui/ClientOnlyIcon'

export function FloatingCar() {
  return (
    <motion.div
      className="absolute right-0 top-1/2 -translate-y-1/2 hidden lg:block opacity-20 pointer-events-none"
      initial={{ opacity: 0, x: 100 }}
      animate={{
        opacity: 0.2,
        y: [0, -20, 0],
      }}
      transition={{
        y: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        },
        opacity: {
          duration: 1,
        },
      }}
    >
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#5B7FFF]/30 to-purple-500/30 blur-3xl rounded-full scale-150"></div>

        {/* Car icon with gradient */}
        <div className="relative">
          <ClientOnlyIcon>
            <Car
              className="w-64 h-64 xl:w-80 xl:h-80 text-[#5B7FFF]"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(91, 127, 255, 0.6))',
              }}
            />
          </ClientOnlyIcon>
        </div>
      </div>
    </motion.div>
  )
}
