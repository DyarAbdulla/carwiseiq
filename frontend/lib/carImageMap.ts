/**
 * Car Image Map
 * Maps car make/model/year/trim combinations to image paths
 * Priority: make|model|year|trim > make|model|year > make|model > make > default
 * All paths point to real JPG/WebP images (not SVG placeholders)
 */

export const carImageMap: Record<string, string> = {
  // Toyota with trim examples
  'toyota|camry|xle|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|camry|xse|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|camry|le|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|camry|se|2025': '/images/cars/toyota-camry-2025.jpg',
  // Toyota
  'toyota|camry|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|camry|2024': '/images/cars/toyota-camry-2025.jpg',
  'toyota|camry|2023': '/images/cars/toyota-camry-2025.jpg',
  'toyota|camry': '/images/cars/toyota-camry.jpg',
  'toyota|corolla|2025': '/images/cars/toyota-corolla.jpg',
  'toyota|corolla|2024': '/images/cars/toyota-corolla.jpg',
  'toyota|corolla': '/images/cars/toyota-corolla.jpg',
  // Toyota Avalon
  'toyota|avalon|limited|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|limited|2024': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|limited|2023': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|limited|2022': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|limited|2021': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|limited': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|xle|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|xle|2024': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|xle': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|2025': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|2024': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|2023': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|2022': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon|2021': '/images/cars/toyota-camry-2025.jpg',
  'toyota|avalon': '/images/cars/toyota-camry-2025.jpg',
  'toyota|rav4': '/images/cars/toyota-camry.jpg', // Fallback to camry
  'toyota|highlander': '/images/cars/toyota-camry.jpg',
  'toyota|prius': '/images/cars/toyota-corolla.jpg',
  'toyota|tacoma': '/images/cars/toyota-camry.jpg',
  'toyota|tundra': '/images/cars/toyota-camry.jpg',
  'toyota|4runner': '/images/cars/toyota-camry.jpg',
  'toyota|sienna': '/images/cars/toyota-camry.jpg',
  'toyota': '/images/cars/toyota-camry.jpg',

  // Honda
  'honda|accord|2025': '/images/cars/honda-accord.jpg',
  'honda|accord|2024': '/images/cars/honda-accord.jpg',
  'honda|accord': '/images/cars/honda-accord.jpg',
  'honda|civic|2025': '/images/cars/honda-civic.jpg',
  'honda|civic': '/images/cars/honda-civic.jpg',
  'honda|cr-v': '/images/cars/honda-accord.jpg',
  'honda': '/images/cars/honda-civic.jpg',

  // Hyundai
  'hyundai|sonata|2025': '/images/cars/hyundai-sonata.jpg',
  'hyundai|sonata|2024': '/images/cars/hyundai-sonata.jpg',
  'hyundai|sonata': '/images/cars/hyundai-sonata.jpg',
  'hyundai|elantra|2025': '/images/cars/hyundai-elantra.jpg',
  'hyundai|elantra': '/images/cars/hyundai-elantra.jpg',
  'hyundai|tucson': '/images/cars/hyundai-sonata.jpg',
  'hyundai': '/images/cars/hyundai-sonata.jpg',

  // BMW
  'bmw|3-series|2025': '/images/cars/bmw-3-series.jpg',
  'bmw|3-series|2024': '/images/cars/bmw-3-series.jpg',
  'bmw|3-series': '/images/cars/bmw-3-series.jpg',
  'bmw|3 series|2025': '/images/cars/bmw-3-series.jpg',
  'bmw|3 series|2024': '/images/cars/bmw-3-series.jpg',
  'bmw|3 series': '/images/cars/bmw-3-series.jpg',
  'bmw|5-series': '/images/cars/bmw-3-series.jpg',
  'bmw|5 series': '/images/cars/bmw-3-series.jpg',
  'bmw|x3': '/images/cars/bmw-3-series.jpg',
  'bmw': '/images/cars/bmw-3-series.jpg',

  // Mercedes-Benz
  'mercedes-benz|c-class': '/images/cars/bmw-3-series.jpg', // Fallback
  'mercedes-benz|e-class': '/images/cars/bmw-3-series.jpg',
  'mercedes-benz': '/images/cars/bmw-3-series.jpg',

  // Ford
  'ford|f-150': '/images/cars/default-car.jpg',
  'ford|mustang': '/images/cars/default-car.jpg',
  'ford|explorer': '/images/cars/default-car.jpg',
  'ford': '/images/cars/default-car.jpg',

  // Chevrolet
  'chevrolet|silverado': '/images/cars/default-car.jpg',
  'chevrolet|equinox': '/images/cars/default-car.jpg',
  'chevrolet': '/images/cars/default-car.jpg',

  // Nissan
  'nissan|altima': '/images/cars/default-car.jpg',
  'nissan|sentra': '/images/cars/default-car.jpg',
  'nissan|rogue': '/images/cars/default-car.jpg',
  'nissan': '/images/cars/default-car.jpg',

  // Audi
  'audi|a4': '/images/cars/bmw-3-series.jpg',
  'audi|a6': '/images/cars/bmw-3-series.jpg',
  'audi': '/images/cars/bmw-3-series.jpg',

  // Lexus
  'lexus|es': '/images/cars/toyota-camry.jpg',
  'lexus|rx': '/images/cars/toyota-camry.jpg',
  'lexus': '/images/cars/toyota-camry.jpg',
}

/**
 * Car preview image options
 */
export interface CarPreviewOptions {
  make: string
  model?: string
  year?: number
  trim?: string
}

/**
 * Normalize string for image mapping
 * - Convert to lowercase
 * - Trim whitespace
 * - Replace spaces and underscores with hyphens
 * - Collapse multiple spaces/hyphens
 */
function normalizeForMapping(str: string): string {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// Cache for image paths to avoid repeated API calls
const imagePathCache = new Map<string, string>()

/**
 * Get car preview image path with full priority support
 * Priority: make|model|year|trim > make|model|year > make|model > make > default
 * Uses API endpoint to get images from car_images folder
 * @param options - Car details object
 * @returns Image path string (always valid, never empty)
 */
export async function getCarPreviewImageAsync(options: CarPreviewOptions): Promise<string> {
  const { make, model, year, trim } = options

  // Always return a valid path - never return empty string
  if (!make || make.trim() === '') {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CarPreview] No make provided, using default')
    }
    return '/images/cars/default-car.jpg'
  }

  // Create cache key
  const cacheKey = `${make.toLowerCase()}|${(model || '').toLowerCase()}|${year || ''}|${(trim || '').toLowerCase()}`

  // Check cache first
  if (imagePathCache.has(cacheKey)) {
    return imagePathCache.get(cacheKey)!
  }

  try {
    // Use API to get image path
    const { apiClient } = await import('./api')
    const result = await apiClient.getCarImage({
      make,
      model: model || '',
      year,
      trim: trim || undefined
    })

    let imagePath = result.image_path || '/images/cars/default-car.jpg'

    // Convert /car_images/ paths to full API URLs for high-quality images
    if (imagePath.startsWith('/car_images/')) {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000'
      const filename = imagePath.replace('/car_images/', '')
      imagePath = `${apiBaseUrl}/api/car-images/${filename}`
    }

    // Cache the result
    imagePathCache.set(cacheKey, imagePath)

    if (process.env.NODE_ENV === 'development') {
      console.log('[CarPreview] Image lookup:', {
        make,
        model,
        year,
        trim,
        match_type: result.match_type,
        imagePath
      })
    }

    return imagePath
  } catch (error) {
    console.error('[CarPreview] Error fetching image:', error)
    return '/images/cars/default-car.jpg'
  }
}

/**
 * Get car preview image path (synchronous version with fallback)
 * Uses cached results or falls back to old mapping system
 * @param options - Car details object
 * @returns Image path string (always valid, never empty)
 */
export function getCarPreviewImage(options: CarPreviewOptions): string {
  const { make, model, year, trim } = options

  // Always return a valid path - never return empty string
  if (!make || make.trim() === '') {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CarPreview] No make provided, using default')
    }
    return '/images/cars/default-car.jpg'
  }

  // Check cache first
  const cacheKey = `${make.toLowerCase()}|${(model || '').toLowerCase()}|${year || ''}|${(trim || '').toLowerCase()}`
  if (imagePathCache.has(cacheKey)) {
    return imagePathCache.get(cacheKey)!
  }

  // Fallback to old mapping system
  const normalizedMake = normalizeForMapping(make)
  const normalizedModel = normalizeForMapping(model || '')
  const normalizedTrim = normalizeForMapping(trim || '').replace(/__none__/g, '')

  let foundKey: string | null = null
  let foundPath: string | null = null

  // Try make|model|year|trim first (highest priority)
  if (year && normalizedModel && normalizedTrim && normalizedTrim !== '') {
    const key1 = `${normalizedMake}|${normalizedModel}|${normalizedTrim}|${year}`
    if (carImageMap[key1]) {
      foundKey = key1
      foundPath = carImageMap[key1]
    }
  }

  // Try make|model|year
  if (!foundPath && year && normalizedModel) {
    const key2 = `${normalizedMake}|${normalizedModel}|${year}`
    if (carImageMap[key2]) {
      foundKey = key2
      foundPath = carImageMap[key2]
    }
  }

  // Try make|model (with normalized model - handle "3 Series" -> "3-series")
  if (!foundPath && normalizedModel) {
    // Try exact match first
    const key3 = `${normalizedMake}|${normalizedModel}`
    if (carImageMap[key3]) {
      foundKey = key3
      foundPath = carImageMap[key3]
    } else {
      // Try alternative normalization (handle "3 Series" vs "3-series")
      const altModel = normalizedModel.replace(/\s+/g, '-')
      const key3Alt = `${normalizedMake}|${altModel}`
      if (carImageMap[key3Alt]) {
        foundKey = key3Alt
        foundPath = carImageMap[key3Alt]
      }
    }
  }

  // Try make only
  if (!foundPath && normalizedMake) {
    if (carImageMap[normalizedMake]) {
      foundKey = normalizedMake
      foundPath = carImageMap[normalizedMake]
    }
  }

  // Fallback to default - ALWAYS return a valid path
  const finalPath = foundPath || '/images/cars/default-car.jpg'

  // Cache the result
  imagePathCache.set(cacheKey, finalPath)

  // Debug logging (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[CarPreview] Image lookup (fallback):', {
      make: normalizedMake,
      model: normalizedModel,
      year,
      trim: normalizedTrim,
      foundKey,
      finalPath,
    })
  }

  return finalPath
}

/**
 * Get car image path based on make, model, and year (legacy function for backward compatibility)
 * @param make - Car make (e.g., "Toyota")
 * @param model - Car model (e.g., "Camry")
 * @param year - Car year (e.g., 2025)
 * @returns Image path string
 */
export function getCarImagePath(make: string, model: string, year?: number): string {
  return getCarPreviewImage({ make, model, year })
}
