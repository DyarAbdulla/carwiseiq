"use client"

import { useEffect } from "react"

/** Dispatches DOM events when the service worker reports new marketplace activity. */
export function PushMessageBridge() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return

    const onMessage = (event: MessageEvent) => {
      const d = event.data
      if (d?.type === "CARWISE_MARKET_UNSEEN" && typeof d.count === "number") {
        window.dispatchEvent(
          new CustomEvent("carwise-market-unseen", { detail: { count: d.count } })
        )
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage)
    return () => navigator.serviceWorker.removeEventListener("message", onMessage)
  }, [])

  return null
}
