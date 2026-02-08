'use client'

import { PlatformInfo } from '@/utils/platformDetection'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PlatformBadgeProps {
  platform: PlatformInfo | null
  className?: string
}

export function PlatformBadge({ platform, className = '' }: PlatformBadgeProps) {
  if (!platform) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1a1d29] border border-[#2a2d3a] hover:border-[${platform.color}] transition-colors ${className}`}
            style={{ borderColor: platform.color + '40' }}
          >
            <span className="text-lg">{platform.logo}</span>
            <span className="text-sm font-medium text-white">{platform.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Detected: {platform.name}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Example: {platform.exampleUrl}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
