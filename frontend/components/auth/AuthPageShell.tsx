"use client"

import { cn } from "@/lib/utils"
import { AuthWelcomeBackground } from "@/components/auth/AuthWelcomeBackground"

type AuthPageShellProps = {
  children: React.ReactNode
  className?: string
}

export function AuthPageShell({ children, className }: AuthPageShellProps) {
  return (
    <div className="relative min-h-[calc(100dvh-8rem)] min-h-[calc(100vh-8rem)] w-full">
      <AuthWelcomeBackground />
      <div
        className={cn(
          "relative z-[1] flex min-h-[calc(100dvh-8rem)] min-h-[calc(100vh-8rem)] w-full items-center justify-center p-6 md:p-8",
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
