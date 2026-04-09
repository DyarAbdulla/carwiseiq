// Use stub to avoid bundling ONNX Runtime (causes build failures). For full AI removal, use @imgly/background-removal when build supports it.
import { removeBackground } from '@/lib/backgroundRemovalStub'

const isDev = process.env.NODE_ENV === 'development'

function devLog(...args: unknown[]) {
  if (isDev) console.log(...args)
}

/**
 * Resizes an image to a maximum width while maintaining aspect ratio
 */
async function resizeImage(blob: Blob, maxWidth: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      // If image is smaller than max width, return original
      if (img.width <= maxWidth) {
        resolve(blob)
        return
      }

      // Calculate new dimensions
      const aspectRatio = img.width / img.height
      const newWidth = maxWidth
      const newHeight = maxWidth / aspectRatio

      // Create canvas and resize
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      // Use high-quality image smoothing
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Draw resized image
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      // Convert to blob
      canvas.toBlob((resizedBlob) => {
        if (resizedBlob) {
          resolve(resizedBlob)
        } else {
          reject(new Error('Failed to resize image'))
        }
      }, 'image/jpeg', 0.9)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}

/**
 * Removes the background from a car image using AI
 * @param imageSrc - The source URL or data URL of the image
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - A blob URL of the image with transparent background
 */
export async function removeCarBackground(
  imageSrc: string,
  onProgress?: (key: string, current: number, total: number) => void
): Promise<string> {
  devLog('🚗 removeCarBackground() - Using AI Library')

  if (!imageSrc) {
    if (isDev) console.error('❌ No image URL provided!')
    throw new Error('No image URL')
  }

  try {
    if (onProgress) onProgress('loading', 1, 5)

    let imageBlob: Blob

    if (imageSrc.startsWith('data:')) {
      const response = await fetch(imageSrc)
      if (!response.ok) {
        return imageSrc
      }
      imageBlob = await response.blob()
    } else if (imageSrc.startsWith('blob:')) {
      const response = await fetch(imageSrc)
      if (!response.ok) {
        return imageSrc
      }
      imageBlob = await response.blob()
    } else {
      const response = await fetch(imageSrc, { mode: 'cors' })
      // Missing images: skip AI pipeline immediately (no retries, no red console spam)
      if (response.status === 404 || response.status === 403) {
        devLog('Background removal skipped: image not found (', response.status, ')')
        return imageSrc
      }
      if (!response.ok) {
        devLog('Background removal skipped: fetch status', response.status)
        return imageSrc
      }
      imageBlob = await response.blob()
    }

    devLog('✅ Image fetched, size:', imageBlob.size, 'bytes')
    if (onProgress) onProgress('preparing', 2, 5)

    const resizedBlob = await resizeImage(imageBlob, 600)
    devLog('✅ Image resized, new size:', resizedBlob.size, 'bytes')
    if (onProgress) onProgress('processing', 3, 5)

    devLog('🤖 Starting AI background removal...')
    const resultBlob = await removeBackground(resizedBlob, {
      model: 'isnet_quint8',
      output: {
        format: 'image/png',
        quality: 0.9,
      },
      progress: (key, current, total) => {
        devLog(`[AI] ${key}: ${current}/${total}`)
        if (onProgress) {
          const mappedProgress = 3 + (current / total)
          onProgress(key, mappedProgress, 5)
        }
      },
    })

    devLog('✅ AI background removal complete, result size:', resultBlob.size, 'bytes')
    if (onProgress) onProgress('finalizing', 5, 5)

    const resultUrl = URL.createObjectURL(resultBlob)
    return resultUrl
  } catch (error) {
    if (isDev) console.warn('Background removal failed, using original:', error)
    return imageSrc
  }
}

/**
 * Composes a car image onto a professional background
 */
export async function composeCarOnBackground(
  carImageSrc: string,
  backgroundSrc?: string
): Promise<string> {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { alpha: true })

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    canvas.width = 800
    canvas.height = 450

    if (backgroundSrc) {
      const bgImg = new Image()
      bgImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        bgImg.onload = () => resolve()
        bgImg.onerror = () => resolve()
        bgImg.src = backgroundSrc
      })
      if (bgImg.complete && bgImg.naturalWidth) {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)
      }
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, '#1e293b')
      gradient.addColorStop(0.5, '#0f172a')
      gradient.addColorStop(1, '#1e293b')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const floorGradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height)
      floorGradient.addColorStop(0, 'transparent')
      floorGradient.addColorStop(1, 'rgba(100, 100, 120, 0.15)')
      ctx.fillStyle = floorGradient
      ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3)
    }

    const carImg = new Image()
    carImg.crossOrigin = 'anonymous'
    await new Promise<void>((resolve) => {
      carImg.onload = () => resolve()
      carImg.onerror = () => resolve()
      carImg.src = carImageSrc
    })

    if (!carImg.naturalWidth) {
      return carImageSrc
    }

    const carAspectRatio = carImg.width / carImg.height
    const maxCarWidth = canvas.width * 0.8
    const maxCarHeight = canvas.height * 0.8

    let carWidth = carImg.width
    let carHeight = carImg.height

    if (carWidth > maxCarWidth) {
      carWidth = maxCarWidth
      carHeight = carWidth / carAspectRatio
    }
    if (carHeight > maxCarHeight) {
      carHeight = maxCarHeight
      carWidth = carHeight * carAspectRatio
    }

    const carX = (canvas.width - carWidth) / 2
    const carY = (canvas.height - carHeight) / 2

    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 20
    ctx.drawImage(carImg, carX, carY, carWidth, carHeight)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob'))
        }
      }, 'image/png', 0.95)
    })

    return URL.createObjectURL(blob)
  } catch (error) {
    if (isDev) console.warn('composeCarOnBackground:', error)
    return carImageSrc
  }
}
