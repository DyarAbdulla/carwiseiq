"use client"

import { useEffect } from "react"
import { registerCarWiseServiceWorker } from "@/lib/push/sw-register"
import { PushEngagementTracker } from "./PushEngagementTracker"
import { PushNotificationPrompt } from "./PushNotificationPrompt"
import { PushMessageBridge } from "./PushMessageBridge"

export function PushClientKit() {
  useEffect(() => {
    registerCarWiseServiceWorker().catch(() => {
      /* HTTP or unsupported — ignore */
    })
  }, [])

  return (
    <>
      <PushEngagementTracker />
      <PushMessageBridge />
      <PushNotificationPrompt />
    </>
  )
}
