"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DetailedFeedbackModal } from './DetailedFeedbackModal'
import type { PredictionResponse } from '@/lib/types'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface FeedbackPromptProps {
  predictionId: number
  result: PredictionResponse
  carFeatures: {
    make: string
    model: string
    year: number
  }
  onFeedbackSubmitted?: () => void
}

export function FeedbackPrompt({
  predictionId,
  result,
  carFeatures,
  onFeedbackSubmitted
}: FeedbackPromptProps) {
  const t = useTranslations('feedback')
  const [rating, setRating] = useState<number | null>(null)
  const [isAccurate, setIsAccurate] = useState<boolean | null>(null)
  const [showDetailedModal, setShowDetailedModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Calculate AI confidence score from precision or confidence level
  const confidenceScore = result.precision
    ? Math.round(100 - result.precision)
    : result.confidence_level === 'high'
      ? 90
      : result.confidence_level === 'medium'
        ? 75
        : 60

  const handleQuickFeedback = async (accurate: boolean) => {
    setIsAccurate(accurate)
    setRating(accurate ? 5 : 1)

    if (!accurate) {
      // Show detailed modal for inaccurate predictions
      setShowDetailedModal(true)
    } else {
      // Submit quick positive feedback
      await submitFeedback({
        rating: 5,
        is_accurate: true,
        feedback_type: 'accurate'
      })
    }
  }

  const handleStarClick = async (starRating: number) => {
    setRating(starRating)
    setIsAccurate(starRating >= 4)

    if (starRating < 4) {
      // Show detailed modal for low ratings
      setShowDetailedModal(true)
    } else {
      // Submit quick positive feedback
      await submitFeedback({
        rating: starRating,
        is_accurate: true,
        feedback_type: 'accurate'
      })
    }
  }

  const submitFeedback = async (feedback: {
    rating?: number
    is_accurate?: boolean
    feedback_type?: string
    feedback_reasons?: string[]
    correct_make?: string
    correct_model?: string
    correct_year?: number
    correct_price?: number
    other_details?: string
  }) => {
    try {
      setSubmitting(true)
      setError(null)
      
      console.log('Submitting feedback:', { prediction_id: predictionId, ...feedback })
      
      const result = await apiClient.submitFeedback({
        prediction_id: predictionId,
        ...feedback,
        feedback_type: (feedback.feedback_type === 'accurate' || feedback.feedback_type === 'inaccurate' || feedback.feedback_type === 'partial' ? feedback.feedback_type : undefined),
      })

      console.log('Feedback submitted successfully:', result)
      
      setFeedbackSubmitted(true)
      
      toast({ title: 'Thank you!', description: 'Your feedback helps us improve.', variant: 'default' })
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted()
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error)
      const errorMessage = error?.message || 'Sorry, couldn\'t save feedback. Please try again.'
      setError(errorMessage)
      
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDetailedFeedbackSubmit = async (details: {
    feedback_reasons: string[]
    correct_make?: string
    correct_model?: string
    correct_year?: number
    correct_price?: number
    other_details?: string
  }) => {
    try {
      await submitFeedback({
        rating: rating || undefined,
        is_accurate: isAccurate || undefined,
        feedback_type: 'inaccurate',
        ...details
      })
      setShowDetailedModal(false)
    } catch (error) {
      // Error is already handled in submitFeedback
      console.error('Error in detailed feedback submission:', error)
    }
  }

  if (feedbackSubmitted) {
    return (
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardContent className="py-6 text-center">
          <div className="text-green-500 text-2xl mb-2">✓</div>
          <p className="text-white font-medium">{t('thankYou') || 'Thank you! Your feedback helps us improve.'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-[#2a2d3a] bg-[#1a1d29]">
        <CardHeader>
          <CardTitle className="text-lg">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Confidence Score */}
          <div className="flex items-center justify-between p-3 bg-[#2a2d3a] rounded-lg">
            <span className="text-sm font-medium text-white">{t('aiConfidence')}:</span>
            <span className="text-lg font-semibold text-[#5B7FFF]">
              {confidenceScore}%
            </span>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <p className="text-sm text-[#94a3b8]">{t('starRating')}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleStarClick(star)}
                  disabled={submitting}
                  className={cn(
                    "transition-all duration-200 hover:scale-110",
                    rating && rating >= star
                      ? "text-yellow-400"
                      : "text-[#2a2d3a] hover:text-yellow-400/50"
                  )}
                >
                  <Star
                    className={cn(
                      "h-8 w-8",
                      rating && rating >= star ? "fill-current" : ""
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Feedback Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => handleQuickFeedback(true)}
              disabled={submitting || isAccurate === true}
              variant={isAccurate === true ? "default" : "outline"}
              className={cn(
                "flex-1",
                isAccurate === true
                  ? "bg-green-600 hover:bg-green-700 border-green-600"
                  : "border-[#2a2d3a] hover:bg-[#2a2d3a]"
              )}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              {t('accurate') || 'Accurate'}
            </Button>
            <Button
              onClick={() => handleQuickFeedback(false)}
              disabled={submitting || isAccurate === false}
              variant={isAccurate === false ? "default" : "outline"}
              className={cn(
                "flex-1",
                isAccurate === false
                  ? "bg-red-600 hover:bg-red-700 border-red-600"
                  : "border-[#2a2d3a] hover:bg-[#2a2d3a]"
              )}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              {t('notAccurate') || 'Not Accurate'}
            </Button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          {/* Loading Indicator */}
          {submitting && (
            <div className="mt-3 text-center">
              <p className="text-sm text-[#94a3b8]">Submitting feedback...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Feedback Modal */}
      {showDetailedModal && (
        <DetailedFeedbackModal
          open={showDetailedModal}
          onClose={() => setShowDetailedModal(false)}
          onSubmit={handleDetailedFeedbackSubmit}
          carFeatures={carFeatures}
          predictedPrice={result.predicted_price}
        />
      )}
    </>
  )
}
