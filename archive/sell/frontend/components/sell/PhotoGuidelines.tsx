"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PhotoGuide {
  id: number
  title: string
  icon: string
  description: string
  angle: string
}

const photoGuides: PhotoGuide[] = [
  {
    id: 1,
    title: 'Front 45° Angle',
    icon: '🚗',
    description: 'Front corner view showing front and side',
    angle: 'Take from front-left or front-right corner at 45 degrees'
  },
  {
    id: 2,
    title: 'Rear 45° Angle',
    icon: '🚙',
    description: 'Rear corner view showing rear and side',
    angle: 'Take from rear-left or rear-right corner at 45 degrees'
  },
  {
    id: 3,
    title: 'Driver Side Profile',
    icon: '🚕',
    description: 'Full side view from driver side',
    angle: 'Stand 3-4 meters away, capture entire side'
  },
  {
    id: 4,
    title: 'Passenger Side Profile',
    icon: '🚖',
    description: 'Full side view from passenger side',
    angle: 'Stand 3-4 meters away, capture entire side'
  },
  {
    id: 5,
    title: 'Interior Dashboard',
    icon: '📊',
    description: 'Front interior showing dashboard and controls',
    angle: 'From driver seat, capture dashboard, steering wheel, center console'
  },
  {
    id: 6,
    title: 'Front Seats',
    icon: '💺',
    description: 'Front seats and interior space',
    angle: 'From behind front seats, show seats and interior quality'
  },
  {
    id: 7,
    title: 'Rear Seats',
    icon: '🪑',
    description: 'Rear seating area and legroom',
    angle: 'From front seats looking back, show rear seat condition'
  },
  {
    id: 8,
    title: 'Trunk/Boot',
    icon: '🧳',
    description: 'Trunk space and cargo area',
    angle: 'Open trunk, show space and condition from above'
  },
]

export function PhotoGuidelines() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-[#2a2d3a] text-white hover:bg-[#2a2d3a]"
        >
          <Camera className="h-4 w-4 mr-2" />
          Show Photo Guidelines
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1d29] border-[#2a2d3a] text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">📸 Recommended Photo Angles</DialogTitle>
          <DialogDescription className="text-[#94a3b8]">
            Follow these 8 recommended angles for the best listing photos
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {photoGuides.map((guide, index) => (
            <motion.div
              key={guide.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#0f1117] border border-[#2a2d3a] rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <div className="text-4xl flex-shrink-0">{guide.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{guide.title}</h3>
                  <p className="text-sm text-[#94a3b8] mb-2">{guide.description}</p>
                  <p className="text-xs text-[#64748b] italic">💡 {guide.angle}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
          <p className="text-sm text-blue-200">
            <strong>💡 Pro Tips:</strong>
          </p>
          <ul className="text-xs text-blue-300/80 mt-2 space-y-1 list-disc list-inside">
            <li>Take photos in good lighting (natural light preferred)</li>
            <li>Clean your car before photographing</li>
            <li>Remove personal items from interior</li>
            <li>Take photos on a clean, uncluttered background</li>
            <li>Capture close-ups of any damage or special features</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}