"use client"

/**
 * Full-viewport fixed background for login/register only.
 * Blur is applied only to the image layer (low-res friendly).
 */
export function AuthWelcomeBackground() {
  return (
    <div className="auth-welcome-bg-wrap" aria-hidden>
      <div className="auth-welcome-bg-image" />
      <div className="auth-welcome-bg-overlay-dark" />
      <div className="auth-welcome-bg-overlay-vignette" />
    </div>
  )
}
