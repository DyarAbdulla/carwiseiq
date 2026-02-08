"use client"

export function ImageShimmer() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 animate-pulse">
      <div className="w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
    </div>
  )
}
