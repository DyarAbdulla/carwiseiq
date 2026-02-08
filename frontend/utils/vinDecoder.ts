/**
 * VIN Decoder using NHTSA API
 * https://vpic.nhtsa.dot.gov/api/
 */

export interface VINData {
  make: string
  model: string
  year: number
  bodyType?: string
  engineSize?: string
  transmission?: string
  trim?: string
}

// For backward compatibility
export interface VehicleData extends VINData {}

const VIN_CACHE_KEY = 'vin_decoder_cache'
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000 // 30 days

interface CachedVINData {
  data: VINData
  timestamp: number
}

/**
 * Get cached VIN data if available
 */
function getCachedVIN(vin: string): VINData | null {
  try {
    const cache = localStorage.getItem(VIN_CACHE_KEY)
    if (!cache) return null

    const cacheData: Record<string, CachedVINData> = JSON.parse(cache)
    const cached = cacheData[vin.toUpperCase()]

    if (!cached) return null

    // Check if cache is still valid
    const age = Date.now() - cached.timestamp
    if (age > CACHE_DURATION) {
      // Remove expired entry
      delete cacheData[vin.toUpperCase()]
      localStorage.setItem(VIN_CACHE_KEY, JSON.stringify(cacheData))
      return null
    }

    return cached.data
  } catch {
    return null
  }
}

/**
 * Cache VIN data
 */
function cacheVIN(vin: string, data: VINData): void {
  try {
    const cache = localStorage.getItem(VIN_CACHE_KEY)
    const cacheData: Record<string, CachedVINData> = cache ? JSON.parse(cache) : {}

    cacheData[vin.toUpperCase()] = {
      data,
      timestamp: Date.now(),
    }

    // Keep only last 100 entries to avoid localStorage overflow
    const entries = Object.entries(cacheData)
    if (entries.length > 100) {
      // Remove oldest entries
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      entries.slice(0, entries.length - 100).forEach(([key]) => delete cacheData[key])
    }

    localStorage.setItem(VIN_CACHE_KEY, JSON.stringify(cacheData))
  } catch (error) {
    console.warn('Failed to cache VIN data:', error)
  }
}

interface NHTSAResponse {
  Results: Array<{
    Variable: string
    Value: string | null
    ValueId?: string
    VariableId: number
  }>
}

/**
 * Decode VIN using NHTSA API with caching
 */
export async function decodeVIN(vin: string): Promise<VINData> {
  if (!vin || vin.length !== 17) {
    throw new Error('VIN must be exactly 17 characters')
  }

  const normalizedVIN = vin.toUpperCase()

  // Check cache first
  const cached = getCachedVIN(normalizedVIN)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${normalizedVIN}?format=json`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: NHTSAResponse = await response.json()

    if (!data.Results || data.Results.length === 0) {
      throw new Error('No data returned from VIN decoder')
    }

    // Extract relevant information
    const results = data.Results
    const getValue = (variable: string): string | null => {
      const result = results.find((r) => r.Variable === variable)
      return result?.Value || null
    }

    const make = getValue('Make')
    const model = getValue('Model')
    const modelYear = getValue('Model Year')
    const bodyClass = getValue('Body Class')
    const engine = getValue('Engine Model')
    const transmission = getValue('Transmission Style')
    const trim = getValue('Trim')

    // Validate required fields
    if (!make || !model || !modelYear) {
      throw new Error('Invalid VIN - VIN not found or missing required information')
    }

    const year = parseInt(modelYear, 10)
    if (!year || year < 1900 || year > new Date().getFullYear() + 1) {
      throw new Error('Invalid VIN - invalid model year')
    }

    const vinData: VINData = {
      make: make.trim(),
      model: model.trim(),
      year,
      bodyType: bodyClass?.trim() || undefined,
      engineSize: engine?.trim() || undefined,
      transmission: transmission?.trim() || undefined,
      trim: trim?.trim() || undefined,
    }

    // Cache the result
    cacheVIN(normalizedVIN, vinData)

    return vinData
  } catch (error) {
    if (error instanceof Error) {
      // Don't cache errors
      throw error
    }
    throw new Error('Failed to decode VIN')
  }
}

// Backward compatibility wrapper
export async function decodeVINLegacy(vin: string): Promise<VehicleData> {
  return decodeVIN(vin)
}

/**
 * Validate VIN format (basic check)
 */
export function validateVINFormat(vin: string): boolean {
  // VIN must be 17 characters, alphanumeric (excluding I, O, Q)
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i
  return vinRegex.test(vin)
}