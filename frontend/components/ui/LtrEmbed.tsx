'use client'

import { cn } from '@/lib/utils'
import { forwardRef, type AnchorHTMLAttributes, type HTMLAttributes } from 'react'

/** Force LTR for phone numbers, emails, and URLs in RTL locales (Ku/Ar). */
export function LtrEmbed({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span dir="ltr" className={cn('ltr-embed', className)} {...props} />
}

export const LtrA = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(
  function LtrA({ className, ...props }, ref) {
    return <a ref={ref} dir="ltr" className={cn('ltr-embed', className)} {...props} />
  }
)
