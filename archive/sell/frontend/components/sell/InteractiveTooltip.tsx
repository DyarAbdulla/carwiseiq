"use client"

import { useState } from 'react'
import { Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface InteractiveTooltipProps {
  content: string
  children?: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function InteractiveTooltip({ 
  content, 
  children,
  side = 'top' 
}: InteractiveTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <button
              type="button"
              className="inline-flex items-center justify-center text-[#5B7FFF] hover:text-[#4c6ee5] transition-colors ml-1"
              aria-label="More information"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent 
          side={side}
          className="bg-[#1a1d29] border-[#2a2d3a] text-white max-w-xs p-3 text-sm"
        >
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Predefined tooltips for common fields
export const FIELD_TOOLTIPS = {
  vin: "17-character unique identifier found on your car's dashboard (visible through windshield) or driver's side door jamb. Format: Example: 1HGBH41JXMN109186",
  trim: "Model variant indicating the trim level (e.g., XLE, Sport, Limited, SE). This affects features and price.",
  mileage: "Total distance your car has traveled in kilometers. Lower mileage generally increases value.",
  year: "Manufacturing year of your vehicle. Newer cars typically have higher value.",
  make: "Vehicle manufacturer (e.g., Toyota, Honda, Ford).",
  model: "Specific vehicle model name (e.g., Camry, Civic, F-150).",
  color: "Exterior color of your vehicle. Popular colors may slightly affect resale value.",
  location: "City or region where the vehicle is located. Prices vary by market.",
  condition: "Overall condition rating: Excellent (showroom), Good (minor wear), Fair (visible wear), Poor (needs repair).",
  overall_condition: "Overall vehicle condition considering all aspects: interior, exterior, and mechanical.",
  interior_condition: "Condition of seats, dashboard, controls, and interior materials.",
  exterior_condition: "Paint, body panels, wheels, and external appearance.",
  mechanical_condition: "Engine, transmission, brakes, and overall mechanical function.",
  service_history: "Maintenance records: Full (all records), Partial (some records), None (no records).",
  previous_owners: "Number of previous owners. Lower is generally better for value.",
  remaining_warranty: "Whether the vehicle still has active manufacturer or extended warranty coverage.",
  has_accident: "Whether the vehicle has been involved in any accidents or collisions.",
  severity: "Accident severity: Minor (cosmetic), Moderate (repairs needed), Severe (structural damage).",
  damaged_parts_count: "Number of parts that were damaged in the accident.",
  affected_parts: "Specific parts of the vehicle that were damaged (e.g., bumper, fender, hood).",
  repaired: "Whether damage from the accident has been repaired.",
  repair_quality: "Quality of repairs performed: Excellent (professional, invisible), Good (well done), Fair (noticeable), Poor (obvious).",
  premium_features: "Additional features that increase value: leather seats, navigation, safety features, etc.",
  asking_price: "Your desired selling price. We'll help you determine if this is competitive.",
  email: "Your email address for buyer inquiries (optional but recommended).",
  phone: "Your phone number for buyer contact (required)."
}