/**
 * Stub for @imgly/background-removal to avoid bundling ONNX Runtime (causes build failures).
 * When used, returns the input blob as PNG so the UI still works; no AI removal.
 */
export async function removeBackground(
  input: Blob,
  _options?: { model?: string; output?: { format?: string; quality?: number }; progress?: (key: string, current: number, total: number) => void }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('No canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png', 0.9)
    }
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = URL.createObjectURL(input)
  })
}
