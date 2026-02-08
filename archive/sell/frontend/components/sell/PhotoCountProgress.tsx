"use client"

import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PhotoCountProgressProps {
  count: number
  maxRecommended: number
}

export function PhotoCountProgress({ count, maxRecommended }: PhotoCountProgressProps) {
  const progress = Math.min((count / maxRecommended) * 100, 100)

  const getMessage = () => {
    if (count === 0) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        text: '⚠️ Add more photos for better accuracy',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/50',
      }
    }
    if (count <= 2) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        text: '⚠️ Add more photos for better accuracy',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/50',
      }
    }
    if (count <= 5) {
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        text: `👍 Good start! Add ${maxRecommended - count} more for best results`,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/50',
      }
    }
    if (count <= maxRecommended) {
      return {
        icon: <Sparkles className="h-4 w-4" />,
        text: '✨ Excellent! Your listing will stand out',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/50',
      }
    }
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      text: '🎉 Complete! You&apos;re all set',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/50',
    }
  }

  const message = getMessage()

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-[#94a3b8]">
            {count}/{maxRecommended} photos uploaded
          </span>
          <span className="text-[#94a3b8]">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Message */}
      <Alert className={`${message.bgColor} ${message.borderColor}`}>
        <div className={message.color}>{message.icon}</div>
        <AlertDescription className={message.color}>
          {message.text}
        </AlertDescription>
      </Alert>
    </motion.div>
  )
}