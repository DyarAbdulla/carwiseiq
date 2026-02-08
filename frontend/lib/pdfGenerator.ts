/**
 * Premium PDF Generator for CarWiseIQ Valuation Certificates
 * Uses backend API to generate professional PDF reports with HTML/CSS
 * Features automatic background removal for car images
 */

import type { PredictionResponse, CarFeatures } from '@/lib/types'
import { removeBackground } from '@/lib/backgroundRemovalStub'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/**
 * Convert image URL to base64
 */
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error converting image to base64:', error)
    throw error
  }
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Get car image URL from prediction result
 */
function getCarImageUrl(result: PredictionResponse): string | null {
  // Priority order: preview_image, car_image_path, or first similar car image
  if (result.preview_image) {
    return result.preview_image
  }
  if (result.car_image_path) {
    // If it's a relative path, construct full URL
    if (result.car_image_path.startsWith('http')) {
      return result.car_image_path
    }
    return `${API_BASE_URL}/api/car-images/${result.car_image_path}`
  }
  if (result.similar_cars && result.similar_cars.length > 0 && result.similar_cars[0].image_url) {
    return result.similar_cars[0].image_url
  }
  return null
}

/**
 * Process car image with background removal
 */
async function processCarImageWithBackgroundRemoval(
  imageUrl: string | null,
  onProgress?: (message: string) => void
): Promise<{ original: string | null; processed: string | null }> {
  if (!imageUrl) {
    return { original: null, processed: null }
  }

  try {
    onProgress?.('Loading car image...')

    // Get original image as base64
    const originalBase64 = await imageUrlToBase64(imageUrl)

    onProgress?.('Removing background... this may take a moment')
    console.log('🔄 Removing background from car image...')

    // Remove background using @imgly/background-removal
    // Convert base64 data URL to blob for the library
    const base64Data = originalBase64.split(',')[1] // Remove data:image/...;base64, prefix
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const imageBlob = new Blob([bytes], { type: 'image/jpeg' })

    const processedBlob = await removeBackground(imageBlob, {
      model: 'isnet_fp16', // Use fp16 model for better quality
      output: {
        format: 'image/png', // PNG to preserve transparency
      },
    })

    // Convert processed blob to base64
    const processedBase64 = await blobToBase64(processedBlob)

    console.log('✅ Background removed successfully')
    onProgress?.('Background removed! Generating PDF...')

    return {
      original: originalBase64,
      processed: processedBase64,
    }
  } catch (error) {
    console.warn('⚠️ Background removal failed, using original image:', error)
    // Fallback: return original image
    try {
      const originalBase64 = await imageUrlToBase64(imageUrl)
      return {
        original: originalBase64,
        processed: null, // Will use original in template
      }
    } catch (fallbackError) {
      console.error('❌ Failed to load original image:', fallbackError)
      return { original: null, processed: null }
    }
  }
}

/**
 * Get background image (behind_background.jpg)
 */
async function getBackgroundImage(): Promise<string | null> {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      '/behind_background.jpg',
      '/behind_background.jpeg',
      '/images/behind_background.jpg',
      '/images/behind_background.jpeg',
    ]

    for (const path of possiblePaths) {
      try {
        const base64 = await imageUrlToBase64(path)
        return base64
      } catch (e) {
        // Try next path
        continue
      }
    }

    // If not found locally, try from backend static files
    try {
      const backendUrl = `${API_BASE_URL}/static/behind_background.jpg`
      const base64 = await imageUrlToBase64(backendUrl)
      return base64
    } catch (e) {
      console.warn('⚠️ Background image not found, PDF will use default background')
      return null
    }
  } catch (error) {
    console.warn('⚠️ Could not load background image:', error)
    return null
  }
}

/**
 * Generate PDF valuation report using backend API
 * Features automatic background removal for car images
 */
export async function generateValuationPDF(
  result: PredictionResponse,
  carFeatures: CarFeatures,
  onProgress?: (message: string) => void
): Promise<void> {
  try {
    onProgress?.('Preparing PDF generation...')

    // Step 1: Get car image URL
    const carImageUrl = getCarImageUrl(result)

    // Step 2: Process car image with background removal
    let processedCarImage: string | null = null
    let originalCarImage: string | null = null

    if (carImageUrl) {
      const imageData = await processCarImageWithBackgroundRemoval(carImageUrl, onProgress)
      processedCarImage = imageData.processed
      originalCarImage = imageData.original
    }

    // Step 3: Get background image
    onProgress?.('Loading background image...')
    const backgroundImage = await getBackgroundImage()

    // Step 4: Prepare data for backend
    const predictionResult = {
      predicted_price: result.predicted_price,
      confidence_interval: result.confidence_interval,
      confidence_range: result.confidence_range,
      confidence_level: result.confidence_level,
      market_comparison: result.market_comparison,
      deal_score: result.deal_score,
      deal_analysis: result.deal_analysis,
      similar_cars: result.similar_cars,
      car_image_path: result.car_image_path,
      preview_image: result.preview_image,
      // Add processed images
      processed_car_image: processedCarImage,
      original_car_image: originalCarImage,
      background_image: backgroundImage,
    }

    const carFeaturesData = {
      year: carFeatures.year,
      make: carFeatures.make,
      model: carFeatures.model,
      trim: carFeatures.trim,
      mileage: carFeatures.mileage,
      condition: carFeatures.condition,
      location: carFeatures.location,
      fuel_type: carFeatures.fuel_type,
      engine_size: carFeatures.engine_size,
      cylinders: carFeatures.cylinders,
    }

    onProgress?.('Generating PDF certificate...')

    // Step 5: Call backend API to generate PDF
    const response = await fetch(`${API_BASE_URL}/api/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prediction_result: predictionResult,
        car_features: carFeaturesData,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`PDF generation failed: ${response.status} ${errorText}`)
    }

    // Get PDF blob from response
    const blob = await response.blob()

    // Create download link and trigger download
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Generate filename
    const make = carFeatures.make || 'Car'
    const model = carFeatures.model || 'Model'
    const timestamp = Date.now()
    link.download = `CarWiseIQ-Valuation-${make}-${model}-${timestamp}.pdf`

    // Trigger download
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up
    window.URL.revokeObjectURL(url)

    onProgress?.('PDF downloaded successfully!')
    console.log('✅ PDF generated and downloaded successfully')
  } catch (error) {
    console.error('❌ Error generating PDF:', error)
    throw error
  }
}
