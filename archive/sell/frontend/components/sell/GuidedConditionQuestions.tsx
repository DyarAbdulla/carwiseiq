"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ConditionQuestion {
  id: string
  question: string
  impact: 'positive' | 'negative'
  weight: number
}

interface GuidedConditionQuestionsProps {
  category: 'overall' | 'interior' | 'mechanical'
  questions: ConditionQuestion[]
  answers: Record<string, boolean>
  onChange: (questionId: string, answer: boolean) => void
  onScoreChange: (score: number) => void
}

const OVERALL_QUESTIONS: ConditionQuestion[] = [
  { id: 'scratches_visible', question: 'Can you see scratches from 10 feet away?', impact: 'negative', weight: 1.5 },
  { id: 'large_dents', question: 'Are there dents larger than a golf ball?', impact: 'negative', weight: 2 },
  { id: 'paint_shine', question: 'Does the paint shine?', impact: 'positive', weight: 1 },
]

const INTERIOR_QUESTIONS: ConditionQuestion[] = [
  { id: 'seats_torn', question: 'Are seats torn or stained?', impact: 'negative', weight: 1.5 },
  { id: 'controls_work', question: 'Do all buttons/controls work?', impact: 'positive', weight: 1.5 },
  { id: 'unpleasant_odors', question: 'Any unpleasant odors?', impact: 'negative', weight: 1 },
]

const MECHANICAL_QUESTIONS: ConditionQuestion[] = [
  { id: 'warning_lights', question: 'Any warning lights on dashboard?', impact: 'negative', weight: 2 },
  { id: 'strange_noises', question: 'Strange noises when driving?', impact: 'negative', weight: 1.5 },
  { id: 'smooth_driving', question: 'Smooth acceleration/braking?', impact: 'positive', weight: 1.5 },
]

function calculateConditionScore(questions: ConditionQuestion[], answers: Record<string, boolean>): number {
  let score = 5 // Start at middle

  questions.forEach(q => {
    const answer = answers[q.id]
    if (answer === undefined) return

    if (q.impact === 'positive') {
      score += answer ? q.weight * 0.5 : -q.weight * 0.3
    } else {
      score += answer ? -q.weight * 0.5 : q.weight * 0.3
    }
  })

  // Clamp between 1 and 10, then convert to 1-5 scale
  score = Math.max(1, Math.min(10, score))
  return Math.round((score / 10) * 5)
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 4.5) return { label: 'Excellent (9-10)', color: 'text-green-400' }
  if (score >= 3.5) return { label: 'Good (7-8)', color: 'text-blue-400' }
  if (score >= 2.5) return { label: 'Fair (5-6)', color: 'text-yellow-400' }
  return { label: 'Poor (0-4)', color: 'text-red-400' }
}

export function GuidedConditionQuestions({
  category,
  questions,
  answers,
  onChange,
  onScoreChange,
}: GuidedConditionQuestionsProps) {
  const score = calculateConditionScore(questions, answers)
  const scoreLabel = getScoreLabel(score)

  const handleAnswerChange = (questionId: string, value: string) => {
    const answer = value === 'yes'
    onChange(questionId, answer)
    
    const newAnswers = { ...answers, [questionId]: answer }
    const newScore = calculateConditionScore(questions, newAnswers)
    onScoreChange(newScore)
  }

  return (
    <Card className="bg-[#1a1d29] border-[#2a2d3a]">
      <CardContent className="p-4 space-y-4">
        {questions.map((q, index) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-2"
          >
            <Label className="text-white">{q.question}</Label>
            <RadioGroup
              value={answers[q.id] === true ? 'yes' : answers[q.id] === false ? 'no' : undefined}
              onValueChange={(value) => handleAnswerChange(q.id, value)}
            >
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                  <Label htmlFor={`${q.id}-yes`} className="text-white cursor-pointer flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${q.impact === 'positive' ? 'text-green-500' : 'text-red-500'}`} />
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id={`${q.id}-no`} />
                  <Label htmlFor={`${q.id}-no`} className="text-white cursor-pointer flex items-center gap-2">
                    <XCircle className={`h-4 w-4 ${q.impact === 'negative' ? 'text-green-500' : 'text-red-500'}`} />
                    No
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </motion.div>
        ))}

        <div className="pt-4 border-t border-[#2a2d3a]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#94a3b8]">Calculated Score:</span>
            <Badge className={scoreLabel.color}>
              {score} / 5 - {scoreLabel.label}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { OVERALL_QUESTIONS, INTERIOR_QUESTIONS, MECHANICAL_QUESTIONS }