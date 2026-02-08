"use client"

import { motion } from 'framer-motion'
import { Car } from 'lucide-react'
import { ClientOnlyIcon } from '@/components/ui/ClientOnlyIcon'

export function LoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      {/* Animated Car */}
      <motion.div
        animate={{
          x: [-20, 20, -20],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        <div className="absolute inset-0 bg-[#5B7FFF]/20 blur-2xl rounded-full scale-150"></div>
        <ClientOnlyIcon>
          <Car
            className="relative w-16 h-16 text-[#5B7FFF]"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(91, 127, 255, 0.6))',
            }}
          />
        </ClientOnlyIcon>
      </motion.div>

      {/* Analyzing Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <motion.p
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="text-lg font-semibold text-[#5B7FFF]"
        >
          Analyzing...
        </motion.p>
        <p className="text-sm text-[#94a3b8] mt-2">
          Processing your car details with AI
        </p>
      </motion.div>

      {/* Loading Dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-[#5B7FFF] rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  )
}

