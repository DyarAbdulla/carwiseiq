"use client"

/**
 * Full-viewport background for the home page.
 * - Mobile/tablet (≤1024px): static image via CSS — no video decode, faster.
 * - Desktop (>1024px): video (car-bg.mp4) with overlay.
 * Step 1: CSS-only; video is hidden on mobile, static bg shown.
 */
export function BackgroundVideo() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Mobile/tablet: static image (CSS media query, no JS) */}
      <div
        className="block lg:hidden absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/hero-bg.jpg')" }}
        aria-hidden
      />
      {/* Desktop: video */}
      <video
        src="/car-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        className="hidden lg:block absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-slate-950/70 md:bg-slate-950/60 backdrop-blur-[2px]" />
    </div>
  )
}
