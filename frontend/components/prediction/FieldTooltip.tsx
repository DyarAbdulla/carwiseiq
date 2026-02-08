"use client"

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FieldTooltipProps {
  content: string
  children: React.ReactNode
}

export function FieldTooltip({ content, children }: FieldTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2">
            {children}
            <Info className="h-4 w-4 text-[#94a3b8] hover:text-[#5B7FFF] transition-colors" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Tooltip content constants
export const FIELD_TOOLTIPS = {
  make: 'The car manufacturer (e.g., Toyota, Honda). Different brands have different market values.',
  model: 'The specific car model. Popular models typically have more accurate predictions.',
  trim: 'Optional: The trim level or variant. Can affect price but is not always required.',
  year: 'The manufacturing year. Newer cars generally cost more, but depreciation rates vary by make/model.',
  mileage: 'Total kilometers driven. Lower mileage = higher value. One of the most important price factors.',
  engine_size: 'Engine displacement in liters. Larger engines often mean higher prices and more power.',
  cylinders: 'Number of engine cylinders. More cylinders generally indicate better performance and higher price.',
  fuel_type: 'Type of fuel the car uses. Electric and hybrid cars often have different pricing dynamics.',
  condition: 'Vehicle condition significantly impacts price. Excellent condition can add 10-20% to value.',
  location: 'Geographic location affects pricing due to regional market differences and demand.',
}

