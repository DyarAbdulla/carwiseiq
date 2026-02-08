// Use stub to avoid bundling ONNX Runtime (causes build failures). For full AI removal, use @imgly/background-removal when build supports it.
import { removeBackground } from '@/lib/backgroundRemovalStub'

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
  console.log('🚗 removeCarBackground() - Using AI Library')
  console.log('📸 Input:', imageSrc?.substring(0, 80) + '...')

  if (!imageSrc) {
    console.error('❌ No image URL provided!')
    throw new Error('No image URL')
  }

  try {
    if (onProgress) onProgress('loading', 1, 5)

    // Fetch the image as blob
    console.log('🔍 Fetching image...')
    let imageBlob: Blob

    if (imageSrc.startsWith('data:')) {
      // Convert data URL to blob
      const response = await fetch(imageSrc)
      imageBlob = await response.blob()
    } else if (imageSrc.startsWith('blob:')) {
      const response = await fetch(imageSrc)
      imageBlob = await response.blob()
    } else {
      // Fetch from URL
      const response = await fetch(imageSrc, { mode: 'cors' })
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`)
      imageBlob = await response.blob()
    }

    console.log('✅ Image fetched, size:', imageBlob.size, 'bytes')
    if (onProgress) onProgress('preparing', 2, 5)

    // Resize image for faster processing (max 600px)
    const resizedBlob = await resizeImage(imageBlob, 600)
    console.log('✅ Image resized, new size:', resizedBlob.size, 'bytes')
    if (onProgress) onProgress('processing', 3, 5)

    // Use the AI background removal library
    console.log('🤖 Starting AI background removal...')
    const resultBlob = await removeBackground(resizedBlob, {
      model: 'isnet_quint8', // Use quantized model for faster processing
      output: {
        format: 'image/png',
        quality: 0.9,
      },
      progress: (key, current, total) => {
        console.log(`[AI] ${key}: ${current}/${total}`)
        if (onProgress) {
          // Map AI progress to our progress (3-4 range)
          const mappedProgress = 3 + (current / total)
          onProgress(key, mappedProgress, 5)
        }
      },
    })

    console.log('✅ AI background removal complete, result size:', resultBlob.size, 'bytes')
    if (onProgress) onProgress('finalizing', 5, 5)

    // Convert blob to URL
    const resultUrl = URL.createObjectURL(resultBlob)
    console.log('✅ Result URL created')

    return resultUrl

  } catch (error) {
    console.error('❌ AI background removal failed:', error)
    console.log('⚠️ Returning original image as fallback')
    // Return original image if AI fails
    return imageSrc
  }
}

/**
 * Composes a car image onto a professional background
 * @param carImageSrc - The car image with transparent background (blob URL)
 * @param backgroundSrc - Optional background image URL
 * @returns Promise<string> - A blob URL of the composed image
 */
export async function composeCarOnBackground(
  carImageSrc: string,
  backgroundSrc?: string
): Promise<string> {
  try {
    // Create canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { alpha: true })

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Default canvas size
    canvas.width = 800
    canvas.height = 450

    // Draw background (if provided) or use gradient
    if (backgroundSrc) {
      const bgImg = new Image()
      bgImg.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        bgImg.onload = () => resolve()
        bgImg.onerror = reject
        bgImg.src = backgroundSrc
      })
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)
    } else {
      // Create professional gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, '#1e293b')  // slate-800
      gradient.addColorStop(0.5, '#0f172a') // slate-900
      gradient.addColorStop(1, '#1e293b')   // slate-800
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Add subtle floor reflection
      const floorGradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height)
      floorGradient.addColorStop(0, 'transparent')
      floorGradient.addColorStop(1, 'rgba(100, 100, 120, 0.15)')
      ctx.fillStyle = floorGradient
      ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3)
    }

    // Load and draw car image
    const carImg = new Image()
    carImg.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      carImg.onload = () => resolve()
      carImg.onerror = reject
      carImg.src = carImageSrc
    })

    // Calculate car size to fit nicely (80% of canvas)
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

    // Center the car
    const carX = (canvas.width - carWidth) / 2
    const carY = (canvas.height - carHeight) / 2

    // Draw car with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 20
    ctx.drawImage(carImg, carX, carY, carWidth, carHeight)

    // Convert to blob URL
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
    console.error('Failed to compose car on background:', error)
    return carImageSrc
  }
}
