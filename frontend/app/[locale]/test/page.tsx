"use client"

import React, { useState, useEffect, Component, ErrorInfo } from 'react'

// Minimal ErrorBoundary component (zero dependencies)
class MinimalErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Test page error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-md">
            <h2 className="text-red-400 font-bold mb-2">Error occurred</h2>
            <p className="text-red-300 text-sm">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Minimal test page to debug browser compatibility issues
 * This page has zero dependencies on other components
 */
export default function TestPage() {
  const [mounted, setMounted] = useState(false)

  // Ensure component only renders on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f1117]">
        <div className="text-[#94a3b8]">Loading...</div>
      </div>
    )
  }

  return (
    <MinimalErrorBoundary>
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-[#1a1d29] border border-[#2a2d3a] rounded-lg p-8 shadow-lg">
            <h1 className="text-4xl font-bold text-white mb-4">
              Hello World
            </h1>
            <p className="text-[#94a3b8] text-lg mb-6">
              This is a minimal test page with zero dependencies.
            </p>
            <div className="space-y-4">
              <div className="bg-[#0f1117] border border-[#2a2d3a] rounded p-4">
                <h2 className="text-white font-semibold mb-2">Test Status:</h2>
                <ul className="text-[#94a3b8] space-y-1 text-sm">
                  <li>✓ Client-side rendering: Active</li>
                  <li>✓ Error boundary: Active</li>
                  <li>✓ No external component dependencies</li>
                  <li>✓ Basic styling only</li>
                </ul>
              </div>
              <div className="bg-[#0f1117] border border-[#2a2d3a] rounded p-4">
                <h2 className="text-white font-semibold mb-2">Browser Info:</h2>
                <p className="text-[#94a3b8] text-sm break-all">
                  User Agent: {typeof window !== 'undefined' && navigator ? navigator.userAgent : 'SSR'}
                </p>
                <p className="text-[#94a3b8] text-sm mt-2">
                  Mounted: {mounted ? 'Yes' : 'No'}
                </p>
                <p className="text-[#94a3b8] text-sm mt-2">
                  Window Available: {typeof window !== 'undefined' ? 'Yes' : 'No'}
                </p>
              </div>
              <div className="bg-[#0f1117] border border-[#2a2d3a] rounded p-4">
                <h2 className="text-white font-semibold mb-2">Next.js Info:</h2>
                <p className="text-[#94a3b8] text-sm">
                  Route: /test
                </p>
                <p className="text-[#94a3b8] text-sm mt-2">
                  Render Mode: Client Component
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MinimalErrorBoundary>
  )
}
