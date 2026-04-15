/**
 * Shared UI state for BackendStatusBanner: health probe + burst API failures.
 * Avoid importing api.ts here (prevents circular deps).
 */

type Listener = (showBanner: boolean) => void

const listeners = new Set<Listener>()

let healthDown = false
let burstActive = false
const BURST_THRESHOLD = 3
/** Resets on any successful `api` response; increments on transport/server-down failures. */
let consecutiveApiFailures = 0

function emit() {
  const show = healthDown || burstActive
  listeners.forEach((l) => {
    try {
      l(show)
    } catch {
      /* ignore */
    }
  })
}

export function subscribeBackendBanner(listener: Listener): () => void {
  listeners.add(listener)
  listener(healthDown || burstActive)
  return () => {
    listeners.delete(listener)
  }
}

export function setBackendHealthDown(down: boolean) {
  if (healthDown === down) return
  healthDown = down
  emit()
}

export function recordApiFailureBurst() {
  consecutiveApiFailures += 1
  if (consecutiveApiFailures >= BURST_THRESHOLD) {
    burstActive = true
    emit()
  }
}

export function clearApiFailureBurst() {
  consecutiveApiFailures = 0
  if (!burstActive) return
  burstActive = false
  emit()
}
