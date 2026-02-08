"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Star, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export interface PhotoQuality {
  brightness: number
  fileSize: number
  resolution: { width: number; height: number }
  score: number
  issues: string[]
}

/**
 * Analyze photo quality client-side
 */
export async function analyzePhoto(file: File): Promise<PhotoQuality> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const issues: string[] = []

    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        // Get image data for brightness analysis
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Calculate average brightness (0-255)
        let totalBrightness = 0
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          // Calculate perceived brightness
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114)
          totalBrightness += brightness
        }
        const avgBrightness = totalBrightness / (data.length / 4)

        // Check file size
        const fileSizeKB = file.size / 1024
        if (fileSizeKB < 100) {
          issues.push('Photo quality too low - upload higher resolution')
        }

        // Check brightness
        if (avgBrightness < 50) {
          issues.push('Photo is too dark')
        } else if (avgBrightness > 220) {
          issues.push('Photo is too bright/overexposed')
        }

        // Check resolution
        const totalPixels = img.width * img.height
        if (totalPixels < 500000) { // Less than ~707x707
          issues.push('Resolution too low - recommend at least 1000x1000 pixels')
        }

        // Check aspect ratio (not too narrow/wide)
        const aspectRatio = img.width / img.height
        if (aspectRatio < 0.5 || aspectRatio > 2.5) {
          issues.push('Unusual aspect ratio - ensure photo is not distorted')
        }

        // Calculate quality score (0-5)
        let score = 5
        if (fileSizeKB < 100) score -= 2
        else if (fileSizeKB < 300) score -= 1
        
        if (avgBrightness < 50 || avgBrightness > 220) score -= 1
        if (totalPixels < 500000) score -= 1
        if (aspectRatio < 0.5 || aspectRatio > 2.5) score -= 1

        score = Math.max(0, score)

        resolve({
          brightness: avgBrightness,
          fileSize: fileSizeKB,
          resolution: { width: img.width, height: img.height },
          score,
          issues,
        })
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

interface PhotoQualityCheckerProps {
  file: File
  onRetake?: () => void
  index: number
}

export function PhotoQualityChecker({ file, onRetake, index }: PhotoQualityCheckerProps) {
  const [quality, setQuality] = useState<PhotoQuality | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyzePhoto(file)
      .then(setQuality)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [file])

  if (loading) {
    return (
      <div className="text-xs text-[#94a3b8] animate-pulse">
        Analyzing quality...
      </div>
    )
  }

  if (!quality) return null

  const getScoreColor = () => {
    if (quality.score >= 4) return 'text-green-500'
    if (quality.score >= 3) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreLabel = () => {
    if (quality.score >= 4) return 'Excellent'
    if (quality.score >= 3) return 'Good'
    if (quality.score >= 2) return 'Fair'
    return 'Poor'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-[#94a3b8]">Quality:</span>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-3 w-3 ${
                i < quality.score
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-[#2a2d3a]'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-semibold ${getScoreColor()}`}>
          {quality.score}/5 - {getScoreLabel()}
        </span>
      </div>

      {quality.issues.length > 0 && (
        <Alert className="bg-yellow-500/10 border-yellow-500/50 mt-2">
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
          <AlertDescription className="text-xs text-yellow-200">
            {quality.issues.map((issue, i) => (
              <div key={i}>• {issue}</div>
            ))}
            {onRetake && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetake}
                className="mt-2 border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retake Photo
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {quality.score >= 4 && (
        <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
          <CheckCircle2 className="h-3 w-3" />
          <span>Excellent quality</span>
        </div>
      )}
    </motion.div>
  )
}