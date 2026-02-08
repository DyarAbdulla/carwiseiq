/**
 * Lazy wrapper for background removal.
 * The heavy @imgly/background-removal module is loaded only when the user
 * actually uses "Remove background", keeping initial bundle small and fast.
 */
export async function removeCarBackgroundLazy(
  imageSrc: string,
  onProgress?: (key: string, current: number, total: number) => void
): Promise<string> {
  const { removeCarBackground } = await import('@/lib/backgroundRemoval')
  return removeCarBackground(imageSrc, onProgress)
}
