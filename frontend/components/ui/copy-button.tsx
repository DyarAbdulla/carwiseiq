"use client"

import { useState } from 'react'
import { Button } from './button'
import { Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  text: string
  className?: string
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'outline' | 'ghost'
}

export function CopyButton({ text, className, size = 'icon', variant = 'ghost' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: 'Copied!',
        description: 'Code copied to clipboard',
        duration: 2000,
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  return (
    <Button
      onClick={handleCopy}
      size={size}
      variant={variant}
      className={cn(
        'h-8 w-8 p-0 border-[#2a2d3a] bg-[#1a1d29] hover:bg-[#2a2d3a] text-[#94a3b8] hover:text-white transition-colors',
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )
}






