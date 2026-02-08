"use client"

import { useEffect, useState } from 'react'
import React from 'react'

interface ClientOnlyIconProps {
  children: React.ReactNode
}

/**
 * Wrapper component to ensure icons only render on client-side
 * This prevents React hydration warnings for SVG elements
 * Also filters out any width/height props that might be incorrectly set
 */
export function ClientOnlyIcon({ children }: ClientOnlyIconProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Safely render children, filtering out any invalid width/height props
  if (React.isValidElement(children)) {
    const props = { ...children.props }
    // Remove any width/height that might be className strings
    if (props.width && typeof props.width === 'string' && props.width.includes('w-')) {
      delete props.width
    }
    if (props.height && typeof props.height === 'string' && props.height.includes('h-')) {
      delete props.height
    }
    return React.cloneElement(children, props)
  }

  return <>{children}</>
}
