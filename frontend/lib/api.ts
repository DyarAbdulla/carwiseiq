import axios, { AxiosError } from 'axios'
import { apiCache } from './api-cache'
import type {
  CarFeatures,
  PredictionRequest,
  PredictionResponse,
  HealthResponse,
  BatchPredictionResult,
  DatasetStats,
  SellCarRequest,
  SellCarResponse,
} from './types'

// Use NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 in .env.local (or .env)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const AUTH_API_BASE_URL = (process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(':3001', ':8000')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
  withCredentials: true, // Include cookies for httpOnly token cookies
})

// Auth API uses the same backend as main API
const authApi = axios.create({
  baseURL: AUTH_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout (increased for slower connections)
  withCredentials: true, // Include cookies for httpOnly token cookies
})

// API instance for long-running operations (e.g., auto-detection)
const longRunningApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds (2 minutes) for AI inference
  withCredentials: true,
})

// Response caching for GET requests (5 minutes)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const getCacheKey = (config: any): string => {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`
}

const isCacheable = (config: any): boolean => {
  return config.method?.toLowerCase() === 'get' &&
    !config.headers?.['Cache-Control'] &&
    !config.headers?.['cache-control']
}

// Request interceptor: for FormData, remove Content-Type so browser sets multipart/form-data with boundary
api.interceptors.request.use((config) => {
  if (config.data && typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers as Record<string, unknown>
    if (h && 'Content-Type' in h) delete h['Content-Type']
  }
  return config
})

// Request interceptor to check cache BEFORE making request
api.interceptors.request.use((config) => {
  if (isCacheable(config)) {
    const cacheKey = getCacheKey(config)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Mark as cached for response interceptor
      ; (config as any).__fromCache = true
        ; (config as any).__cachedData = cached.data
    }
  }
  return config
})

// Response interceptor for caching successful responses
api.interceptors.response.use(
  (response) => {
    // Check if this was from cache
    if ((response.config as any).__fromCache) {
      return {
        ...response,
        data: (response.config as any).__cachedData,
      }
    }

    // Cache successful GET responses
    const cacheKey = getCacheKey(response.config)
    if (isCacheable(response.config)) {
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      })
    }
    return response
  },
  async (error) => {
    if ((error.config as any).__fromCache) {
      const cacheKey = getCacheKey(error.config)
      cache.delete(cacheKey)
      delete (error.config as any).__fromCache
      delete (error.config as any).__cachedData
      return api.request(error.config)
    }
    // Retry 5xx with exponential backoff (max 2 retries)
    const config = error.config
    if (!config) return Promise.reject(error)
    if (config.__retryCount === undefined) config.__retryCount = 0
    const status = error.response?.status
    const is5xx = status >= 500 && status < 600
    if (is5xx && config.__retryCount < 2) {
      config.__retryCount += 1
      const delay = 1000 * Math.pow(2, config.__retryCount - 1)
      await new Promise(r => setTimeout(r, delay))
      return api.request(config)
    }
    return Promise.reject(error)
  }
)

// Token management
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

// Get Supabase access token from session (for protected API calls)
// CRITICAL: Always gets fresh token and handles refresh if expired
const getSupabaseToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null
  try {
    const { supabase } = await import('@/lib/supabase')

    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('[getSupabaseToken] Session error:', sessionError)
      return null
    }

    if (!session) {
      console.log('[getSupabaseToken] No active session')
      return null
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = session.expires_at
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000)
      if (expiresIn < 300) { // Less than 5 minutes remaining
        console.log('[getSupabaseToken] Token expiring soon, refreshing...')
        try {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('[getSupabaseToken] Refresh error:', refreshError)
            // Return current token even if refresh failed
            return session.access_token || null
          }
          if (refreshedSession?.access_token) {
            console.log('[getSupabaseToken] ✅ Token refreshed successfully')
            return refreshedSession.access_token
          }
        } catch (refreshErr) {
          console.error('[getSupabaseToken] Exception during refresh:', refreshErr)
        }
      }
    }

    return session.access_token || null
  } catch (error) {
    console.error('[getSupabaseToken] Error getting Supabase session:', error)
    return null
  }
}

const setToken = (token: string) => {
  if (typeof window === 'undefined') {
    console.log('[setToken] Not in browser, skipping')
    return
  }
  console.log('[setToken] Saving token to localStorage:', !!token)
  console.log('[setToken] Token value:', token ? token.substring(0, 20) + '...' : 'null')
  localStorage.setItem('auth_token', token)
  // Also set in axios default headers
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`
  longRunningApi.defaults.headers.common['Authorization'] = `Bearer ${token}`

  // Verify it was saved
  const saved = localStorage.getItem('auth_token')
  console.log('[setToken] Verification - token saved:', !!saved)
  if (!saved) {
    console.error('[setToken] CRITICAL: Token was not saved!')
  }
}

const removeToken = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('auth_token')
  localStorage.removeItem('refresh_token')
  sessionStorage.removeItem('auth_token')
  sessionStorage.removeItem('refresh_token')
  delete api.defaults.headers.common['Authorization']
  delete authApi.defaults.headers.common['Authorization']
  delete longRunningApi.defaults.headers.common['Authorization']
}

// Request interceptor to add token to main API
// CRITICAL: This MUST wait for token before proceeding
api.interceptors.request.use(async (config) => {
  // Check if this is a protected endpoint (requires auth)
  const isProtectedEndpoint = config.url?.includes('/api/favorites') ||
    config.url?.includes('/api/marketplace') ||
    config.url?.includes('/api/auth/me') ||
    config.url?.includes('/api/messaging')

  if (isProtectedEndpoint) {
    // CRITICAL FIX: Use getSupabaseToken() which handles refresh automatically
    // This function waits for the token and refreshes if needed
    const supabaseToken = await getSupabaseToken()

    if (supabaseToken && typeof supabaseToken === 'string' && supabaseToken.length > 0) {
      // Set Authorization header with fresh/refreshed token
      config.headers.Authorization = `Bearer ${supabaseToken}`
      console.log('[API Interceptor] ✅ Attached Supabase token to:', config.url?.substring(0, 60))
      return config
    }

    // Fallback to REST token (for email/password login)
    const restToken = getToken()
    if (restToken && typeof restToken === 'string' && restToken.length > 0) {
      config.headers.Authorization = `Bearer ${restToken}`
      console.log('[API Interceptor] ✅ Attached REST token to:', config.url?.substring(0, 60))
    } else {
      console.warn('[API Interceptor] ⚠️ No token available for protected endpoint:', config.url)
      console.warn('[API Interceptor] Supabase token:', !!supabaseToken, 'REST token:', !!restToken)
      // Continue without token - backend will return 401 and response interceptor will handle redirect
    }
  } else {
    // For non-protected endpoints, optionally add token if available
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
}, (error) => {
  // Handle request setup errors
  console.error('[API Interceptor] Request setup error:', error)
  return Promise.reject(error)
})

// Request interceptor to add token to auth API (do not send Bearer for login/register)
authApi.interceptors.request.use((config) => {
  const isLoginOrRegister =
    config.url && (String(config.url).includes('/api/auth/login') || String(config.url).includes('/api/auth/register'))
  if (isLoginOrRegister) {
    return config // Authorization only after login
  }
  const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const userToken = getToken()
  const token = adminToken || userToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Request interceptor to add token to long-running API (AI detect, etc.)
longRunningApi.interceptors.request.use(async (config) => {
  // Try Supabase token first for protected endpoints
  const isProtectedEndpoint = config.url?.includes('/api/favorites') ||
    config.url?.includes('/api/marketplace')

  if (isProtectedEndpoint) {
    // Use getSupabaseToken() which handles refresh automatically
    const supabaseToken = await getSupabaseToken()

    if (supabaseToken && typeof supabaseToken === 'string' && supabaseToken.length > 0) {
      config.headers.Authorization = `Bearer ${supabaseToken}`
      console.log('[LongRunningAPI Interceptor] ✅ Attached Supabase token to:', config.url?.substring(0, 60))
      return config
    }
  }

  // Fallback to REST token
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for long-running API to handle 401 errors
longRunningApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear all auth data
      removeToken()
      delete longRunningApi.defaults.headers.common['Authorization']
      if (typeof window !== 'undefined') {
        // Clear all auth-related tokens
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        sessionStorage.removeItem('auth_token')
        sessionStorage.removeItem('refresh_token')

        const pathname = window.location.pathname
        console.log('[LongRunningAPI Interceptor] 401 error on path:', pathname)

        // Don't redirect if already on login/register pages or if on protected pages that handle their own redirects
        const isLoginPage = pathname.includes('/login') || pathname.includes('/register')
        const isProtectedPage = pathname.includes('/favorites') || pathname.includes('/my-listings') || pathname.includes('/profile')

        // Only redirect if NOT on login/register AND NOT on pages that handle their own auth
        if (!isLoginPage && !isProtectedPage) {
          // Extract locale from pathname (e.g., /en/favorites -> en)
          const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
          const locale = localeMatch ? localeMatch[1] : 'en'
          console.log('[LongRunningAPI Interceptor] Redirecting to login:', `/${locale}/login`)
          window.location.href = `/${locale}/login`
        } else {
          console.log('[LongRunningAPI Interceptor] Skipping redirect - page handles auth:', pathname)
        }
      }
    }
    return Promise.reject(error)
  }
)

// Response interceptor for auth API to handle errors globally and auto-refresh tokens
let isRefreshing = false
let failedQueue: Array<{ resolve: (value?: any) => void; reject: (reason?: any) => void }> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Do not refresh or redirect for login/register or for /refresh itself: show error once, no retry
    const u = String(originalRequest?.url || '')
    const isLoginOrRegister = u.includes('/api/auth/login') || u.includes('/api/auth/register')
    const isRefresh = u.includes('/api/auth/refresh')
    if (error.response?.status === 401 && (isLoginOrRegister || isRefresh)) {
      return Promise.reject(error)
    }

    // Handle 401 errors (token expired) on protected auth endpoints
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return authApi(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      // Try to refresh token
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null

      if (refreshToken) {
        try {
          // Call refresh endpoint directly to avoid circular dependency
          const response = await authApi.post('/api/auth/refresh', {
            refresh_token: refreshToken
          })
          const newToken = response.data.access_token

          if (newToken) {
            setToken(newToken)
            authApi.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
            originalRequest.headers.Authorization = `Bearer ${newToken}`

            processQueue(null, newToken)
            isRefreshing = false

            // Retry original request
            return authApi(originalRequest)
          }
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          processQueue(refreshError, null)
          isRefreshing = false

          removeToken()
          if (typeof window !== 'undefined') {
            localStorage.removeItem('refresh_token')
          }
          delete authApi.defaults.headers.common['Authorization']

          // Redirect to login if not already on login/register page
          if (typeof window !== 'undefined') {
            const pathname = window.location.pathname
            if (!pathname.includes('/login') && !pathname.includes('/register')) {
              window.location.href = '/en/login'
            }
          }
        }
      } else {
        // No refresh token: clear and redirect (no retry loop)
        processQueue(new Error('No refresh token'), null)
        isRefreshing = false
        removeToken()
        if (typeof window !== 'undefined') {
          localStorage.removeItem('refresh_token')
        }
        delete authApi.defaults.headers.common['Authorization']
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname
          if (!pathname.includes('/login') && !pathname.includes('/register')) {
            window.location.href = '/en/login'
          }
        }
      }
    }

    // Handle rate limiting (429) and account lockout
    if (error.response?.status === 429) {
      const errorMessage = error.response?.data?.detail || 'Too many requests. Please try again later.'
      // This will be handled by the UI component
    }

    return Promise.reject(error)
  }
)

// Response interceptor for main API to handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401) {
      // Try to refresh Supabase token first before giving up
      if (originalRequest && !originalRequest._retry) {
        originalRequest._retry = true

        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()

          if (!refreshError && session?.access_token) {
            // Token refreshed successfully - retry original request
            originalRequest.headers.Authorization = `Bearer ${session.access_token}`
            console.log('[API Interceptor] ✅ Token refreshed, retrying request:', originalRequest.url?.substring(0, 60))
            return api(originalRequest)
          }
        } catch (refreshErr) {
          console.error('[API Interceptor] Token refresh failed:', refreshErr)
        }
      }

      // Token refresh failed or not possible - clear auth data
      console.error('[API Interceptor] ❌ 401 Unauthorized - authentication failed')
      removeToken()
      delete api.defaults.headers.common['Authorization']

      if (typeof window !== 'undefined') {
        // Clear all auth-related tokens
        localStorage.removeItem('auth_token')
        localStorage.removeItem('refresh_token')
        sessionStorage.removeItem('auth_token')
        sessionStorage.removeItem('refresh_token')

        const pathname = window.location.pathname
        console.log('[API Interceptor] 401 error on path:', pathname)

        // Don't redirect if already on login/register pages or if on protected pages that handle their own redirects
        const isLoginPage = pathname.includes('/login') || pathname.includes('/register')
        const isProtectedPage = pathname.includes('/favorites') || pathname.includes('/my-listings') || pathname.includes('/profile')

        // Only redirect if NOT on login/register AND NOT on pages that handle their own auth
        if (!isLoginPage && !isProtectedPage) {
          // Extract locale from pathname (e.g., /en/favorites -> en)
          const localeMatch = pathname.match(/^\/([a-z]{2})(?:\/|$)/)
          const locale = localeMatch ? localeMatch[1] : 'en'
          console.log('[API Interceptor] Redirecting to login:', `/${locale}/login`)
          window.location.href = `/${locale}/login`
        } else {
          console.log('[API Interceptor] Skipping redirect - page handles auth:', pathname)
        }
      }
    } else if (error.response?.status === 404) {
      // Could redirect to 404 page if needed
      console.error('Resource not found:', error.config?.url)
    } else if (error.response?.status === 500) {
      // Could redirect to 500 error page
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname
        if (!pathname.includes('/errors')) {
          // Optionally redirect to error page
          // window.location.href = '/en/errors/server-error'
        }
      }
    } else if (!error.response && error.request) {
      // Network error
      console.error('Network error - check connection')
      // Could redirect to network error page
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname
        if (!pathname.includes('/errors')) {
          // Optionally redirect to error page
          // window.location.href = '/en/errors/network-error'
        }
      }
    }
    return Promise.reject(error)
  }
)

// Error handler
const handleError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | string[]; message?: string }>

    // Handle validation errors (400, 422) - FastAPI returns detail
    if (axiosError.response?.status === 422 || axiosError.response?.status === 400) {
      const detail = axiosError.response.data?.detail
      if (Array.isArray(detail)) {
        // Format Pydantic validation errors
        return detail.map((err: any) => {
          const field = err.loc?.join('.') || 'field'
          const msg = err.msg || 'Invalid value'
          return `${field}: ${msg}`
        }).join(', ')
      }
      // FastAPI returns detail as string for custom errors (like password length)
      if (typeof detail === 'string') {
        return detail
      }
    }

    // Handle other errors with detail field
    const errorDetail = axiosError.response?.data?.detail
    if (typeof errorDetail === 'string') {
      return errorDetail
    }

    return axiosError.response?.data?.message || axiosError.message || 'An error occurred'
  }
  return error instanceof Error ? error.message : 'An unknown error occurred'
}

// API Functions
export const apiClient = {
  // Health check
  async getHealth(): Promise<HealthResponse> {
    try {
      const response = await api.get<HealthResponse>('/api/health')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Single prediction
  async predictPrice(features: CarFeatures | null | undefined, imageFeatures?: number[]): Promise<PredictionResponse> {
    try {
      console.log('📡 [API] predictPrice called', { features, hasImageFeatures: !!imageFeatures })

      // Validate input
      if (!features || typeof features !== 'object') {
        console.error('❌ [API] Invalid car features provided:', features)
        throw new Error('Invalid car features provided')
      }

      // Validate required fields
      const requiredFields = ['make', 'model', 'year', 'mileage', 'engine_size', 'cylinders', 'condition', 'fuel_type', 'location']
      const missingFields = requiredFields.filter(field => !features[field as keyof CarFeatures])

      if (missingFields.length > 0) {
        console.error('❌ [API] Missing required fields:', { missingFields, features })
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
      }

      if (!features.make || !features.model || !features.year) {
        console.error('❌ [API] Missing basic required fields:', { make: features.make, model: features.model, year: features.year })
        throw new Error('Missing required fields: make, model, and year are required')
      }

      const requestBody: any = {
        features,
      }

      // Add image_features if provided
      if (imageFeatures && imageFeatures.length > 0) {
        requestBody.image_features = imageFeatures
      }

      console.log('📤 [API] Sending request to /api/predict', {
        url: '/api/predict',
        requestBody,
        hasAuth: !!api.defaults.headers.common['Authorization']
      })

      const response = await api.post<PredictionResponse>('/api/predict', requestBody)

      console.log('📥 [API] Response received', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        hasPredictedPrice: typeof response.data?.predicted_price === 'number'
      })

      // Validate response
      if (!response || !response.data || typeof response.data !== 'object') {
        console.error('❌ [API] Invalid response from server:', response)
        throw new Error('Invalid response from server')
      }

      if (typeof response.data.predicted_price !== 'number') {
        console.error('❌ [API] Response missing predicted_price:', response.data)
        throw new Error('Response missing predicted_price')
      }

      console.log('✅ [API] predictPrice successful', { predicted_price: response.data.predicted_price })
      return response.data
    } catch (error: any) {
      console.error('❌ [API] predictPrice error:', {
        error,
        errorMessage: error?.message,
        errorResponse: error?.response?.data,
        errorStatus: error?.response?.status,
        errorStatusText: error?.response?.statusText
      })
      throw new Error(handleError(error))
    }
  },

  // Batch prediction
  async predictBatch(cars: CarFeatures[]): Promise<BatchPredictionResult[]> {
    try {
      console.log('🔮 [API] predictBatch called with', cars.length, 'cars')

      // Try to use batch endpoint if available, otherwise fall back to individual calls
      try {
        console.log('🚀 [API] Attempting batch endpoint /api/predict/batch')
        const response = await api.post<{ predictions: BatchPredictionResult[] }>('/api/predict/batch', {
          cars,
        })
        console.log('✅ [API] Batch endpoint successful:', response.data.predictions.length, 'predictions')
        return response.data.predictions
      } catch (batchError) {
        console.warn('⚠️ [API] Batch endpoint failed, falling back to individual calls:', batchError)

        // Fallback: make individual calls with progress tracking
        console.log('🔄 [API] Making individual prediction calls...')
        const predictions: BatchPredictionResult[] = []

        for (let i = 0; i < cars.length; i++) {
          const car = cars[i]
          console.log(`🚗 [API] Predicting ${i + 1}/${cars.length}: ${car.make} ${car.model}`)

          try {
            const result = await this.predictPrice(car)
            predictions.push({
              car,
              predicted_price: result.predicted_price,
              confidence_interval: result.confidence_interval,
            })
            console.log(`✅ [API] Prediction ${i + 1}/${cars.length} successful: $${result.predicted_price}`)
          } catch (carError: any) {
            console.error(`❌ [API] Prediction ${i + 1}/${cars.length} failed:`, carError)
            // Include failed item with error message
            predictions.push({
              car,
              predicted_price: 0,
              confidence_interval: undefined,
              error: carError.message || 'Prediction failed',
            })
          }
        }

        console.log('✅ [API] Individual predictions completed:', predictions.length, 'successful')
        return predictions
      }
    } catch (error) {
      console.error('❌ [API] Batch prediction failed completely:', error)
      throw new Error(handleError(error))
    }
  },

  // Get makes from backend dataset (with aggressive caching)
  async getMakes(): Promise<string[]> {
    return apiCache.getOrFetch(
      '/api/cars/makes',
      async () => {
        try {
          const response = await api.get<string[]>('/api/cars/makes')
          return response.data
        } catch (error) {
          // Fallback to constants if API fails
          const { CAR_MAKES } = await import('./constants')
          return CAR_MAKES
        }
      },
      undefined,
      30 * 60 * 1000 // 30 minutes cache
    )
  },

  // Get models for a make from backend dataset (with aggressive caching)
  async getModels(make: string): Promise<string[]> {
    return apiCache.getOrFetch(
      `/api/cars/models/${encodeURIComponent(make)}`,
      async () => {
        try {
          const response = await api.get<string[]>(`/api/cars/models/${encodeURIComponent(make)}`)
          return response.data
        } catch (error) {
          // Fallback to constants if API fails
          const { MODELS_BY_MAKE } = await import('./constants')
          return MODELS_BY_MAKE[make] || []
        }
      },
      { make },
      30 * 60 * 1000 // 30 minutes cache
    )
  },

  // Fallback when /api/cars/locations fails or dataset has no locations (e.g. after DB reset, backend down)
  async getLocations(): Promise<string[]> {
    const LOCATIONS_FALLBACK = [
      'Baghdad', 'Erbil', 'Basra', 'Mosul', 'Kirkuk', 'Najaf', 'Karbala', 'Sulaymaniyah', 'Duhok',
      'Al-Fallujah', 'Ramadi', 'Samarra', 'Baqubah', 'Amara', 'Diwaniyah', 'Kut', 'Hillah', 'Nasiriyah',
      'Dubai', 'Abu Dhabi', 'California', 'Texas', 'New York', 'London', 'Berlin', 'Istanbul',
    ]
    return apiCache.getOrFetch(
      '/api/cars/locations',
      async () => {
        try {
          const response = await api.get<string[]>('/api/cars/locations')
          const data = Array.isArray(response?.data) ? response.data : []
          return data.length > 0 ? data : LOCATIONS_FALLBACK
        } catch {
          return LOCATIONS_FALLBACK
        }
      },
      undefined,
      30 * 60 * 1000 // 30 minutes cache
    )
  },

  async getTrims(make: string, model: string): Promise<string[]> {
    return apiCache.getOrFetch(
      `/api/cars/trims/${encodeURIComponent(make)}/${encodeURIComponent(model)}`,
      async () => {
        try {
          const response = await api.get<string[]>(`/api/cars/trims/${encodeURIComponent(make)}/${encodeURIComponent(model)}`)
          return response.data
        } catch (error) {
          throw new Error(handleError(error))
        }
      },
      { make, model },
      30 * 60 * 1000 // 30 minutes cache
    )
  },

  // Get all engine sizes from dataset (no make/model filter)
  async getAllEngineSizes(): Promise<Array<{ size: number; display: string }>> {
    try {
      const response = await api.get<number[]>(
        '/api/cars/engine-sizes',
        {
          headers: { 'Cache-Control': 'max-age=300' }, // Cache for 5 minutes
        }
      )
      // Convert to engine options with display names
      return response.data.map((size) => ({
        size,
        display: size === Math.floor(size) ? `${Math.floor(size)}L` : `${size}L`
      }))
    } catch (error) {
      console.error('Error fetching all engine sizes:', error)
      // Return common engine sizes as fallback
      const commonSizes = [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]
      return commonSizes.map((size) => ({
        size,
        display: size === Math.floor(size) ? `${Math.floor(size)}L` : `${size}L`
      }))
    }
  },

  // Get available engines for a make/model
  async getAvailableYears(make: string, model?: string): Promise<{ years: number[] }> {
    try {
      const meta = await this.getMetadata()
      const r = meta?.year_range ?? { min: 2010, max: 2025 }
      const years: number[] = []
      for (let y = r.min; y <= r.max; y++) years.push(y)
      return { years }
    } catch {
      return { years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] }
    }
  },

  async getAvailableEngines(make: string, model: string): Promise<Array<{ size: number; display: string }>> {
    try {
      const response = await api.get<{ engines: Array<{ size: number; display: string }> }>(
        `/api/available-engines?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        {
          headers: { 'Cache-Control': 'max-age=300' }, // Cache for 5 minutes
        }
      )
      return response.data.engines || []
    } catch (error) {
      console.error('Error fetching engines:', error)
      return []
    }
  },

  // Get available cylinders for a make/model/engine
  async getAvailableCylinders(make: string, model: string, engine: number): Promise<number[]> {
    try {
      const response = await api.get<{ cylinders: number[] }>(
        `/api/available-cylinders?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&engine=${engine}`,
        {
          headers: { 'Cache-Control': 'max-age=300' }, // Cache for 5 minutes
        }
      )
      return response.data.cylinders || [4]
    } catch (error) {
      console.error('Error fetching cylinders:', error)
      return [4] // Default to 4 cylinders
    }
  },

  // Get available colors for a make/model
  async getAvailableColors(make: string, model: string): Promise<string[]> {
    try {
      const response = await api.get<{ colors: string[] }>(
        `/api/available-colors?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`,
        {
          headers: { 'Cache-Control': 'max-age=300' }, // Cache for 5 minutes
        }
      )
      return response.data.colors || []
    } catch (error) {
      console.error('Error fetching colors:', error)
      // Return default colors on error
      return ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Gold', 'Brown', 'Orange', 'Yellow', 'Purple', 'Beige', 'Other']
    }
  },

  // Get available fuel types for a make/model
  async getAvailableFuelTypes(make: string, model: string): Promise<string[]> {
    try {
      const response = await api.get<string[]>(
        `/api/cars/fuel-types/${encodeURIComponent(make)}/${encodeURIComponent(model)}`,
        {
          headers: { 'Cache-Control': 'max-age=300' }, // Cache for 5 minutes
        }
      )
      return response.data || []
    } catch (error) {
      console.error('Error fetching fuel types:', error)
      // Return default fuel types on error
      return ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']
    }
  },

  // Get metadata (conditions, fuel types, ranges) - with caching
  async getMetadata(): Promise<{
    conditions: string[]
    fuel_types: string[]
    year_range: { min: number; max: number }
    mileage_range: { min: number; max: number }
  }> {
    return apiCache.getOrFetch(
      '/api/cars/metadata',
      async () => {
        try {
          const response = await api.get<{
            conditions: string[]
            fuel_types: string[]
            year_range: { min: number; max: number }
            mileage_range: { min: number; max: number }
          }>('/api/cars/metadata')
          return response.data
        } catch (error) {
          throw new Error(handleError(error))
        }
      },
      undefined,
      30 * 60 * 1000 // 30 minutes cache
    )
  },

  // Get dataset statistics
  async getStats(): Promise<DatasetStats> {
    try {
      const response = await api.get('/api/stats/basic')
      const data = response.data
      return {
        total_cars: data.total_cars,
        average_price: data.average_price,
        median_price: data.median_price,
        min_price: data.min_price,
        max_price: data.max_price,
        year_range: data.year_range,
        top_makes: data.top_makes,
      }
    } catch (error) {
      // Fallback to placeholder data if API fails
      console.error('Failed to fetch stats:', error)
      return {
        total_cars: 62181,
        average_price: 18776,
        median_price: 16200,
        min_price: 1000,
        max_price: 200000,
        year_range: { min: 1948, max: 2025 },
      }
    }
  },

  // Get statistics summary (for stats page visualizations)
  async getStatsSummary(): Promise<any> {
    try {
      const response = await api.get('/api/stats/summary')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Search cars by budget
  async searchBudget(params: {
    budget?: number
    min_price?: number
    max_price?: number
    make?: string
    model?: string
    min_year?: number
    max_year?: number
    max_mileage?: number
    condition?: string
    fuel_type?: string
    transmission?: string
    location?: string
    source?: 'database' | 'marketplace' | 'both'
    page?: number
    page_size?: number
  }): Promise<any> {
    try {
      const response = await api.get('/api/budget/search', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Export Excel
  async exportExcel(data: any): Promise<Blob> {
    try {
      // TODO: Implement POST /api/export/excel endpoint in backend
      // For now, create client-side export
      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Predictions')
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Export PDF
  async exportPDF(data: any): Promise<Blob> {
    try {
      // TODO: Implement POST /api/export/pdf endpoint in backend
      // For now, return placeholder
      throw new Error('PDF export not yet implemented')
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Download helper
  downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  },

  // Authentication (FastAPI backend on port 8000)
  async register(
    email: string,
    password: string,
    confirmPassword: string,
    fullName?: string,
    termsAccepted: boolean = false
  ): Promise<{ token: string; refresh_token?: string; user: { id: number; email: string; full_name?: string; email_verified: boolean } }> {
    try {
      // Validate input
      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        throw new Error('Email and password are required')
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      if (!termsAccepted) {
        throw new Error('You must accept the Terms of Service')
      }

      const response = await authApi.post<{
        access_token: string
        refresh_token?: string
        user: { id: number; email: string; full_name?: string; email_verified: boolean }
      }>('/api/auth/register', {
        email,
        password,
        confirm_password: confirmPassword,
        full_name: fullName,
        terms_accepted: termsAccepted
      })

      // Validate response
      if (!response || !response.data) {
        throw new Error('Invalid response from server')
      }

      // Backend returns access_token, map it to token for compatibility
      const token = response.data.access_token
      if (token && typeof token === 'string') {
        setToken(token)
        authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }

      // Store refresh token
      if (response.data.refresh_token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('refresh_token', response.data.refresh_token)
        }
      }

      // Validate user object
      if (!response.data.user || typeof response.data.user !== 'object') {
        throw new Error('Invalid user data received')
      }

      // Return with token field for compatibility
      return {
        token: token || '',
        refresh_token: response.data.refresh_token,
        user: response.data.user
      }
    } catch (error) {
      console.error('Register error:', error)
      throw new Error(handleError(error))
    }
  },

  async login(email: string, password: string, rememberMe: boolean = false): Promise<{ token: string; refresh_token?: string; user: { id: number; email: string; full_name?: string; email_verified: boolean } }> {
    try {
      console.log('[apiClient.login] ========== STARTING API LOGIN ==========')
      console.log('[apiClient.login] Email:', email)
      console.log('[apiClient.login] API URL:', authApi.defaults.baseURL + '/api/auth/login')

      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        throw new Error('Email and password are required')
      }

      console.log('[apiClient.login] Making POST request...')
      const response = await authApi.post<{
        access_token: string
        refresh_token?: string
        user: { id: number; email: string; full_name?: string; email_verified: boolean }
      }>('/api/auth/login', {
        email,
        password,
        remember_me: rememberMe
      })

      console.log('[apiClient.login] Response received:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      })

      if (!response || !response.data) {
        console.error('[apiClient.login] ❌ Invalid response from server')
        throw new Error('Invalid response from server')
      }

      const token = response.data.access_token
      console.log('[apiClient.login] Token extracted:', !!token)
      console.log('[apiClient.login] Token value:', token ? token.substring(0, 30) + '...' : 'null')
      console.log('[apiClient.login] Response data:', {
        hasAccessToken: !!response.data.access_token,
        hasRefreshToken: !!response.data.refresh_token,
        hasUser: !!response.data.user,
        userEmail: response.data.user?.email
      })

      if (!token || typeof token !== 'string') {
        console.error('[apiClient.login] ❌ No valid token in response!')
        console.error('[apiClient.login] Full response:', JSON.stringify(response.data, null, 2))
        throw new Error('No access token received from server')
      }

      console.log('[apiClient.login] Calling setToken with token...')
      setToken(token)
      authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // Immediate verification
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      console.log('[apiClient.login] Immediate token verification:', !!savedToken)

      if (!savedToken) {
        console.error('[apiClient.login] ❌ CRITICAL: Token was not saved! Attempting manual save...')
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('auth_token', token)
            await new Promise(r => setTimeout(r, 50))
            const recheck = localStorage.getItem('auth_token')
            console.log('[apiClient.login] Manual save result:', !!recheck)
            if (!recheck) {
              console.error('[apiClient.login] ❌❌❌ MANUAL SAVE FAILED! localStorage might be blocked!')
            }
          } catch (e) {
            console.error('[apiClient.login] ❌ localStorage.setItem threw error:', e)
          }
        }
      } else {
        console.log('[apiClient.login] ✅ Token successfully saved!')
      }

      if (response.data.refresh_token && typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', response.data.refresh_token)
        console.log('[apiClient.login] Refresh token saved')
      }

      console.log('[apiClient.login] ========== LOGIN SUCCESS ==========')
      return {
        token: token,
        refresh_token: response.data.refresh_token,
        user: response.data.user
      }
    } catch (error: any) {
      console.error('[apiClient.login] ========== LOGIN ERROR ==========')
      console.error('[apiClient.login] Error:', error)
      console.error('[apiClient.login] Error message:', error.message)
      console.error('[apiClient.login] Error response:', error.response)
      console.error('[apiClient.login] Error status:', error.response?.status)
      console.error('[apiClient.login] Error data:', error.response?.data)
      throw new Error(handleError(error))
    }
  },

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const response = await authApi.post('/api/auth/refresh', { refresh_token: refreshToken })
      const token = response.data.access_token
      if (token) {
        setToken(token)
        authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async verifyEmail(token: string): Promise<void> {
    try {
      await authApi.post('/api/auth/verify-email', { token })
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async resendVerification(email: string): Promise<void> {
    try {
      await authApi.post('/api/auth/resend-verification', { email })
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async forgotPassword(email: string): Promise<void> {
    try {
      await authApi.post('/api/auth/forgot-password', { email })
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<void> {
    try {
      await authApi.post('/api/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async updateProfile(data: { full_name?: string; phone?: string; location?: string }): Promise<any> {
    try {
      const response = await authApi.put('/api/auth/profile', data)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
    try {
      await authApi.put('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async updatePrivacySettings(settings: {
    privacy_show_phone?: boolean
    privacy_show_email?: boolean
    privacy_location_precision?: 'exact' | 'city'
    privacy_allow_ai_training?: boolean
  }): Promise<void> {
    try {
      await authApi.put('/api/auth/privacy-settings', settings)
    } catch (error) {
      // Re-throw original so caller can check error?.response?.status (e.g. 401)
      throw error
    }
  },

  async exportData(): Promise<any> {
    try {
      const response = await authApi.get('/api/auth/export-data')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async deleteAccount(): Promise<void> {
    try {
      await authApi.delete('/api/auth/account')
      removeToken()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token')
      }
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async logoutAll(): Promise<void> {
    try {
      await authApi.post('/api/auth/logout-all')
      removeToken()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token')
      }
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async saveCookieConsent(consent: { essential: boolean; analytics: boolean; marketing: boolean }): Promise<void> {
    try {
      await authApi.post('/api/auth/cookie-consent', consent)
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async logout(): Promise<void> {
    try {
      // Try to call logout endpoint if token exists
      const token = getToken()
      if (token) {
        await authApi.post('/api/auth/logout').catch(() => {
          // Ignore errors on logout
        })
      }
    } catch (error) {
      // Ignore errors
    } finally {
      removeToken()
      delete authApi.defaults.headers.common['Authorization']
    }
  },

  async getMe(): Promise<{ id: number; email: string; full_name?: string; phone?: string; location?: string; email_verified?: boolean }> {
    try {
      if (typeof window === 'undefined') {
        throw new Error('Cannot get user info on server side')
      }

      const token = getToken()
      if (!token || typeof token !== 'string') {
        throw new Error('No token found')
      }

      const response = await authApi.get<{ id: number; email: string; full_name?: string; phone?: string; location?: string; email_verified?: boolean }>('/api/auth/me')

      if (!response?.data || typeof response.data !== 'object' || typeof response.data.email !== 'string') {
        throw new Error('Invalid response from server')
      }

      return {
        id: response.data.id,
        email: response.data.email,
        full_name: response.data.full_name,
        phone: response.data.phone,
        location: response.data.location,
        email_verified: response.data.email_verified || false
      }
    } catch (error: any) {
      console.error('getMe error:', error)
      throw error // keep response so checkAuth can detect 401
    }
  },

  async verifyToken(): Promise<{ valid: boolean; user: { id: number; email: string } | null }> {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        return { valid: false, user: null }
      }

      const token = getToken()
      if (!token || typeof token !== 'string') {
        return { valid: false, user: null }
      }

      const response = await authApi.get<{ valid: boolean; user: { id: number; email: string } | null }>('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Validate response
      if (!response || !response.data || typeof response.data !== 'object') {
        return { valid: false, user: null }
      }

      return response.data
    } catch (error) {
      console.error('verifyToken error:', error)
      return { valid: false, user: null }
    }
  },

  // Sell car prediction
  async predictSellPrice(features: SellCarRequest, imageFeatures?: number[]): Promise<SellCarResponse> {
    try {
      const requestBody: any = { ...features }
      if (imageFeatures && imageFeatures.length > 0) {
        requestBody.image_features = imageFeatures
      }
      const response = await api.post<SellCarResponse>('/api/sell/predict', requestBody)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Analyze images
  async analyzeImages(files: File[]): Promise<{
    success: boolean
    data: {
      summary: string
      bullets: string[]
      guessed_make: string | null
      guessed_model: string | null
      guessed_color: string | null
      condition: string
      confidence: number
      image_features?: number[]
    }
  }> {
    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('images', file)
      })

      const response = await api.post<{
        success: boolean
        data: {
          summary: string
          bullets: string[]
          guessed_make: string | null
          guessed_model: string | null
          guessed_color: string | null
          condition: string
          confidence: number
          image_features?: number[]
        }
      }>('/api/analyze-images', formData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Predict price with images
  async predictPriceWithImages(
    features: CarFeatures,
    imageFeatures?: number[]
  ): Promise<PredictionResponse> {
    try {
      const requestBody: any = { features }
      if (imageFeatures && imageFeatures.length > 0) {
        requestBody.image_features = imageFeatures
      }
      const response = await api.post<PredictionResponse>('/api/predict', requestBody)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Get car image path based on make, model, year, trim
  async getCarImage(params: {
    make: string
    model: string
    year?: number
    trim?: string
  }): Promise<{
    image_path: string
    found: boolean
    match_type: string
    filename?: string
  }> {
    try {
      const queryParams = new URLSearchParams({
        make: params.make,
        model: params.model,
      })
      if (params.year) {
        queryParams.append('year', params.year.toString())
      }
      if (params.trim) {
        queryParams.append('trim', params.trim)
      }

      const response = await api.get<{
        image_path: string
        found: boolean
        match_type: string
        filename?: string
      }>(`/api/cars/car-image?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      console.error('Error fetching car image:', error)
      return {
        image_path: '/images/cars/default-car.jpg',
        found: false,
        match_type: 'error'
      }
    }
  },

  // Predict from URL
  async predictFromUrl(url: string): Promise<{
    extracted_data: CarFeatures
    predicted_price: number
    listing_price?: number
    price_comparison?: {
      listing_price: number
      predicted_price: number
      difference: number
      difference_percent: number
      is_above_market: boolean
      is_below_market: boolean
    }
    confidence_interval?: {
      lower: number
      upper: number
    }
    message?: string
  }> {
    try {
      if (!url || typeof url !== 'string' || !url.trim()) {
        throw new Error('URL is required')
      }

      const response = await api.post<{ success: boolean; data?: any; error?: string }>('/api/predict/from-url', { url: url.trim() })

      // Handle new backend format: { success: true, data: {...} }
      if (response.data.success && response.data.data) {
        const data = response.data.data

        // Map backend response to frontend format
        const result = {
          extracted_data: {
            make: data.make,
            model: data.model,
            year: data.year,
            mileage: data.mileage,
            condition: data.condition,
            fuel_type: data.fuel_type,
            location: data.location || 'Unknown',
            engine_size: data.engine_size || 2.0,
            cylinders: data.cylinders || 4,
          } as CarFeatures,
          predicted_price: data.predicted_price,
          listing_price: data.listing_price,
          confidence_interval: data.price_range ? {
            lower: data.price_range.min,
            upper: data.price_range.max,
          } : undefined,
          price_comparison: data.listing_price && data.predicted_price ? {
            listing_price: data.listing_price,
            predicted_price: data.predicted_price,
            difference: data.listing_price - data.predicted_price,
            difference_percent: ((data.listing_price - data.predicted_price) / data.predicted_price) * 100,
            is_above_market: data.listing_price > data.predicted_price,
            is_below_market: data.listing_price < data.predicted_price,
          } : undefined,
          message: data.deal_explanation || data.message,
        }

        return result
      }

      // Handle error response
      if (response.data.error) {
        throw new Error(response.data.error)
      }

      throw new Error('Invalid response format from server')
    } catch (error: any) {
      // Enhanced error handling with specific error messages
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        throw new Error('Backend not running - Please start the backend server')
      }

      if (error.response?.status === 404) {
        throw new Error('Listing no longer available - The URL may be expired or removed')
      }

      if (error.response?.status === 408 || error.message?.includes('timeout')) {
        throw new Error('Timeout while scraping - The listing page took too long to respond')
      }

      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded - Please try again in 1 minute')
      }

      if (error.response?.status === 400) {
        const errorDetail = error.response?.data?.detail || error.message
        if (errorDetail.includes('Unsupported platform') || errorDetail.includes('Invalid URL format')) {
          throw new Error(`Invalid URL format - ${errorDetail}`)
        }
        throw new Error(errorDetail || 'Invalid request')
      }

      // Use the error message from backend if available
      const errorMessage = handleError(error)
      throw new Error(errorMessage)
    }
  },

  // Save a prediction attempt (called automatically after prediction)
  async savePrediction(prediction: {
    car_features: CarFeatures
    predicted_price: number
    confidence_interval?: { lower: number; upper: number }
    confidence_level?: string
    image_features?: number[]
  }): Promise<{ prediction_id: number; success: boolean }> {
    try {
      const response = await api.post<{ prediction_id: number; success: boolean }>(
        '/api/feedback/predictions',
        {
          car_features: prediction.car_features,
          predicted_price: prediction.predicted_price,
          confidence_interval: prediction.confidence_interval,
          confidence_level: prediction.confidence_level,
          image_features: prediction.image_features
        }
      )
      return response.data
    } catch (error) {
      console.error('Error saving prediction:', error)
      throw new Error(handleError(error))
    }
  },

  // Submit feedback for a prediction
  async submitFeedback(feedback: {
    prediction_id: number
    rating?: number
    is_accurate?: boolean
    feedback_type?: 'accurate' | 'inaccurate' | 'partial'
    feedback_reasons?: string[]
    correct_make?: string
    correct_model?: string
    correct_year?: number
    correct_price?: number
    other_details?: string
  }): Promise<{ feedback_id: number; success: boolean; message: string }> {
    try {
      const response = await api.post<{ feedback_id: number; success: boolean; message: string }>(
        '/api/feedback/submit',
        feedback
      )
      return response.data
    } catch (error) {
      console.error('Error submitting feedback:', error)
      throw new Error(handleError(error))
    }
  },

  // Get prediction history
  async getPredictionHistory(limit: number = 50, offset: number = 0): Promise<{
    predictions: Array<{
      id: number
      car_features: CarFeatures
      predicted_price: number
      confidence_interval?: { lower: number; upper: number }
      confidence_level?: string
      timestamp: string
      feedback?: {
        rating?: number
        is_accurate?: boolean
        feedback_type?: string
        feedback_reasons?: string[]
        correct_make?: string
        correct_model?: string
        correct_price?: number
        updated_at?: string
      }
    }>
    total: number
    message: string
  }> {
    try {
      const response = await api.get('/api/feedback/history', {
        params: { limit, offset }
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Get feedback metrics
  async getFeedbackMetrics(): Promise<{
    overall: {
      total_feedback: number
      avg_rating: number
      accuracy_percent: number
      positive_feedback_percent: number
    }
    by_make: Array<{
      make: string
      count: number
      avg_rating: number
      accuracy_percent: number
    }>
    trend: Array<{
      date: string
      avg_rating: number
      accuracy_percent: number
    }>
    improvement?: {
      improvement_percent: number
      improvement_absolute: number
      current_period: {
        accuracy_percent: number
        total_feedback: number
      }
      previous_period: {
        accuracy_percent: number
        total_feedback: number
      }
    }
  }> {
    try {
      const response = await api.get('/api/feedback/metrics')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Admin API
  async adminLogin(email: string, password: string): Promise<{ access_token: string; admin: { id: number; email: string; name: string; role: string } }> {
    try {
      const response = await authApi.post('/api/admin/login', { email, password })
      const token = response.data.access_token
      if (token) {
        localStorage.setItem('admin_token', token)
        authApi.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminLogout(): Promise<void> {
    try {
      await authApi.post('/api/admin/logout').catch(() => { })
    } finally {
      localStorage.removeItem('admin_token')
      delete authApi.defaults.headers.common['Authorization']
    }
  },

  async getAdminMe(): Promise<{ id: number; email: string; name: string; role: string }> {
    try {
      const token = localStorage.getItem('admin_token')
      if (!token) throw new Error('No admin token')
      const response = await authApi.get('/api/admin/me')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getDashboardStats(): Promise<any> {
    try {
      const response = await authApi.get('/api/admin/dashboard/stats')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getPredictionsOverTime(days: number = 30): Promise<any[]> {
    try {
      const response = await authApi.get(`/api/admin/dashboard/charts/predictions-over-time?days=${days}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getFeedbackRatings(): Promise<any[]> {
    try {
      const response = await authApi.get('/api/admin/dashboard/charts/feedback-ratings')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getAccuracyTrend(days: number = 30): Promise<any[]> {
    try {
      const response = await authApi.get(`/api/admin/dashboard/charts/accuracy-trend?days=${days}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getFeedbackList(params: {
    page?: number
    page_size?: number
    rating?: number
    accuracy?: string
    make?: string
    search?: string
    date_from?: string
    date_to?: string
  }): Promise<any> {
    try {
      const response = await authApi.get('/api/admin/feedback', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getFeedbackDetail(feedbackId: number): Promise<any> {
    try {
      const response = await authApi.get(`/api/admin/feedback/${feedbackId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getUsersList(params: {
    page?: number
    page_size?: number
    search?: string
  }): Promise<any> {
    try {
      const response = await authApi.get('/api/admin/users', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getUserDetail(userId: number): Promise<any> {
    try {
      const response = await authApi.get(`/api/admin/users/${userId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async deleteUser(userId: number): Promise<void> {
    try {
      await authApi.delete(`/api/admin/users/${userId}`)
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getSettings(): Promise<any> {
    try {
      const response = await authApi.get('/api/admin/settings')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async triggerModelRetrain(): Promise<any> {
    try {
      const response = await authApi.post('/api/admin/settings/model/retrain')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getDailyFeedbackReport(date?: string): Promise<any> {
    try {
      const response = await authApi.get('/api/admin/reports/daily-feedback', {
        params: date ? { date } : {}
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getMarketplaceAnalytics(): Promise<any> {
    try {
      const response = await authApi.get('/api/admin/dashboard/marketplace-analytics')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getAdminListings(params: {
    page?: number
    page_size?: number
    status?: string
    search?: string
  }): Promise<{ items: any[]; total: number }> {
    try {
      const response = await authApi.get('/api/admin/listings', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminPatchListing(id: number, body: { status: string }): Promise<void> {
    try {
      await authApi.patch(`/api/admin/listings/${id}`, body)
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminDeleteListing(id: number): Promise<void> {
    try {
      await authApi.delete(`/api/admin/listings/${id}`)
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Marketplace API
  async createListing(listing: any): Promise<{ listing_id: number; success: boolean }> {
    try {
      const response = await api.post('/api/marketplace/listings', listing)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async createDraftListing(listingData?: any): Promise<{ listing_id: number; success: boolean }> {
    try {
      const response = await api.post('/api/marketplace/listings/draft', listingData || {})
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async uploadListingImages(listingId: number, images: File[]): Promise<{ success: boolean; image_ids: number[]; image_urls: string[] }> {
    try {
      const formData = new FormData()
      images.forEach((img) => formData.append('images', img))
      const response = await api.post(`/api/marketplace/listings/${listingId}/images`, formData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async deleteListingImage(listingId: number, imageId: number): Promise<{ success: boolean }> {
    try {
      const response = await api.delete(`/api/marketplace/listings/${listingId}/images/${imageId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async autoDetectCar(listingId: number): Promise<{
    success: boolean
    status?: 'ok' | 'low_confidence' | 'error'
    error?: string
    detection: any
    prefill: { make?: string; model?: string; color?: string; year?: number }
    confidence_level?: 'high' | 'medium' | 'low'
  }> {
    try {
      // Use long-running API instance with 120 second timeout
      const response = await longRunningApi.post(`/api/marketplace/listings/${listingId}/auto-detect`)
      return response.data
    } catch (err: unknown) {
      const e = err as { response?: { data?: { status?: string } }; code?: string; message?: string }
      if (e?.response?.data?.status === 'error') {
        return e.response!.data as never
      }
      if (e?.code === 'ECONNABORTED' || (typeof e?.message === 'string' && e.message.includes('timeout'))) {
        return {
          success: false,
          status: 'error',
          error: 'Detection timed out. The AI model may be loading. Please try again in a moment.',
          detection: null,
          prefill: {}
        }
      }
      throw new Error(handleError(err))
    }
  },

  /**
   * Claude vision: detect car make and model from 4-10 images (base64).
   * Used by sell step2 when user uploads 4-10 photos and clicks Next.
   * Returns { make?, model?, confidence, error? }.
   */
  async detectCarVision(files: File[]): Promise<{ make?: string | null; model?: string | null; confidence: number; error?: string }> {
    try {
      const readAsBase64 = (f: File): Promise<{ data: string; media_type: string }> =>
        new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => {
            const s = String(r.result)
            const data = s.includes(',') ? s.split(',')[1]! : s
            const media = (f.type || 'image/jpeg').toLowerCase()
            const media_type = /^image\/(jpeg|png|webp|gif)$/i.test(media) ? media : 'image/jpeg'
            res({ data, media_type })
          }
          r.onerror = rej
          r.readAsDataURL(f)
        })
      const images = await Promise.all(files.map(readAsBase64))
      const response = await longRunningApi.post<{ make?: string | null; model?: string | null; confidence: number; error?: string }>(
        '/api/ai/detect-car-vision',
        { images }
      )
      return response.data
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes?.('timeout')) {
        return { make: null, model: null, confidence: 0, error: 'Detection timed out. Please try again.' }
      }
      const msg = handleError(err)
      return { make: null, model: null, confidence: 0, error: msg }
    }
  },

  async updateDraftListing(listingId: number, data: Record<string, unknown>): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await api.patch(`/api/marketplace/listings/${listingId}`, data)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async updateListingUserOverrides(listingId: number, selectedByUser: {
    make?: string
    model?: string
    color?: string
    year?: string
  }): Promise<any> {
    try {
      const response = await api.put(`/api/marketplace/listings/${listingId}/user-overrides`, {
        selected_by_user: selectedByUser,
        user_overrode: true
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getListing(listingId: number): Promise<any> {
    if (typeof listingId === 'string' && /^[0-9a-f-]{36}$/i.test(listingId)) {
      return Promise.reject(new Error('UUID listings must be fetched from Supabase, not the marketplace API.'))
    }
    const id = typeof listingId === 'number' ? listingId : parseInt(String(listingId).replace(/\.(txt|html?)$/i, ''), 10)
    if (!Number.isInteger(id) || id <= 0) {
      return Promise.reject(new Error('getListing requires a positive integer listing ID.'))
    }
    try {
      const response = await api.get(`/api/marketplace/listings/${id}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getListingAnalytics(listingId: number): Promise<any> {
    try {
      const response = await api.get(`/api/marketplace/listings/${listingId}/analytics`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getMyListings(status?: string): Promise<any> {
    try {
      const params = status ? { status } : {}
      const response = await api.get('/api/marketplace/my-listings', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async markListingAsSold(listingId: number): Promise<any> {
    try {
      const response = await api.put(`/api/marketplace/listings/${listingId}/mark-sold`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async deleteListing(listingId: number): Promise<any> {
    try {
      const response = await api.delete(`/api/marketplace/listings/${listingId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async searchListings(params: {
    page?: number
    page_size?: number
    sort_by?: string
    search?: string
    min_price?: number
    max_price?: number
    makes?: string
    models?: string
    min_year?: number
    max_year?: number
    max_mileage?: number
    conditions?: string
    transmissions?: string
    fuel_types?: string
    location_city?: string
  }): Promise<any> {
    try {
      const response = await api.get('/api/marketplace/listings', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async saveListing(listingId: number): Promise<any> {
    try {
      const response = await api.post(`/api/marketplace/listings/${listingId}/save`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async unsaveListing(listingId: number): Promise<any> {
    try {
      const response = await api.delete(`/api/marketplace/listings/${listingId}/save`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async publishListing(listingId: number): Promise<any> {
    try {
      const response = await api.put(`/api/marketplace/listings/${listingId}/publish`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Messaging API
  async sendMessage(listingId: number, recipientId: number, content: string, imageUrl?: string): Promise<any> {
    try {
      const response = await api.post('/api/messaging/messages', {
        listing_id: listingId,
        recipient_id: recipientId,
        content,
        image_url: imageUrl
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getMessages(listingId: number, otherUserId: number, limit: number = 50, offset: number = 0): Promise<any> {
    try {
      const response = await api.get('/api/messaging/messages', {
        params: { listing_id: listingId, other_user_id: otherUserId, limit, offset }
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getConversations(): Promise<any> {
    try {
      const response = await api.get('/api/messaging/conversations')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getUnreadCount(): Promise<number> {
    try {
      const response = await api.get('/api/messaging/messages/unread-count')
      return response.data.unread_count || 0
    } catch (error) {
      return 0
    }
  },

  async markMessagesAsRead(listingId: number, otherUserId: number): Promise<any> {
    try {
      const response = await api.post('/api/messaging/messages/mark-read', {
        listing_id: listingId,
        other_user_id: otherUserId
      })
      return response.data
    } catch (error) {
      // Ignore errors for marking as read
      return { success: false }
    }
  },

  async blockUser(conversationId: number): Promise<any> {
    try {
      const response = await api.post(`/api/messaging/conversations/${conversationId}/block`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async unblockUser(conversationId: number): Promise<any> {
    try {
      const response = await api.post(`/api/messaging/conversations/${conversationId}/unblock`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async reportMessage(messageId: number, reason?: string): Promise<any> {
    try {
      const response = await api.post(`/api/messaging/messages/${messageId}/report`, null, {
        params: { reason }
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async deleteConversation(conversationId: number): Promise<any> {
    try {
      const response = await api.delete(`/api/messaging/conversations/${conversationId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async starConversation(conversationId: number, starred: boolean): Promise<any> {
    try {
      const response = await api.post(`/api/messaging/conversations/${conversationId}/star`, null, {
        params: { starred }
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async setTypingIndicator(conversationId: number, isTyping: boolean): Promise<any> {
    try {
      const response = await api.post('/api/messaging/typing-indicator', {
        conversation_id: conversationId,
        is_typing: isTyping
      })
      return response.data
    } catch (error) {
      // Ignore errors for typing indicator
      return { success: false }
    }
  },

  async getTypingIndicator(conversationId: number): Promise<boolean> {
    try {
      const response = await api.get(`/api/messaging/typing-indicator/${conversationId}`)
      return response.data.is_typing || false
    } catch (error) {
      return false
    }
  },

  // Favorites API
  // Supports both numeric IDs (REST API) and UUID strings (Supabase)
  async toggleFavorite(listingId: number | string): Promise<any> {
    try {
      const response = await api.post('/api/favorites/toggle', null, {
        params: { listing_id: String(listingId) }
      })
      return response.data
    } catch (error) {
      // Re-throw original axios error so caller can check response.status (404, 500, etc.)
      if (axios.isAxiosError(error)) throw error
      throw new Error(handleError(error))
    }
  },

  async checkFavorite(listingId: number | string): Promise<any> {
    try {
      const response = await api.get(`/api/favorites/check/${String(listingId)}`)
      return response.data
    } catch (error) {
      return { is_favorite: false }
    }
  },

  async getFavorites(params: {
    page?: number
    page_size?: number
    sort_by?: string
  }): Promise<any> {
    try {
      console.log('[apiClient.getFavorites] Making request with params:', params)

      // The interceptor will handle token attachment automatically
      // No need to manually set headers - the interceptor gets fresh token from Supabase
      const response = await api.get('/api/favorites/list', { params })

      console.log('[apiClient.getFavorites] Response received:', {
        status: response.status,
        hasData: !!response.data,
        itemsCount: response.data?.items?.length || 0,
        total: response.data?.total || 0
      })

      return response.data
    } catch (error: any) {
      console.error('[apiClient.getFavorites] Error:', error)
      console.error('[apiClient.getFavorites] Error status:', error.response?.status)
      console.error('[apiClient.getFavorites] Error data:', error.response?.data)
      throw new Error(handleError(error))
    }
  },

  async getFavoritesCount(listingId: number | string): Promise<number> {
    try {
      const response = await api.get(`/api/favorites/count/${String(listingId)}`)
      return response.data.count || 0
    } catch (error) {
      return 0
    }
  },

  async saveSearch(name: string, filters: any, emailAlerts: boolean = true, frequency: string = 'instant'): Promise<any> {
    try {
      const response = await api.post('/api/favorites/searches', {
        name,
        filters,
        email_alerts: emailAlerts,
        frequency
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getSavedSearches(): Promise<any> {
    try {
      const response = await api.get('/api/favorites/searches')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async updateSavedSearch(searchId: number, updates: {
    name?: string
    email_alerts?: boolean
    frequency?: string
  }): Promise<any> {
    try {
      const response = await api.put(`/api/favorites/searches/${searchId}`, updates)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async deleteSavedSearch(searchId: number): Promise<any> {
    try {
      const response = await api.delete(`/api/favorites/searches/${searchId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getPriceHistory(listingId: number, days: number = 30): Promise<any> {
    try {
      const response = await api.get(`/api/favorites/price-history/${listingId}`, {
        params: { days }
      })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getNotificationSettings(): Promise<any> {
    try {
      const response = await api.get('/api/favorites/notifications/settings')
      return response.data
    } catch (error) {
      // Re-throw original so caller can check error?.response?.status (e.g. 401)
      throw error
    }
  },

  async updateNotificationSettings(settings: {
    email_new_matches?: boolean
    email_price_drops?: boolean
    push_notifications?: boolean
    frequency?: string
  }): Promise<any> {
    try {
      const response = await api.put('/api/favorites/notifications/settings', settings)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // Services API
  async getServices(params?: { location_id?: string; featured_only?: boolean; status?: string }): Promise<{ services: any[]; count: number }> {
    try {
      console.log('🔵 [API] getServices called with params:', params)
      console.log('🔵 [API] Base URL:', api.defaults.baseURL)
      const response = await api.get('/api/services', { params })
      console.log('✅ [API] getServices response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [API] getServices error:', error)
      console.error('❌ [API] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      })
      throw new Error(handleError(error))
    }
  },

  async getService(serviceId: string): Promise<any> {
    try {
      const response = await api.get(`/api/services/${serviceId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getServicesByLocation(locationId: string): Promise<{ services: any[]; count: number; location_id: string }> {
    try {
      const response = await api.get(`/api/services/location/${locationId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getFeaturedServices(): Promise<{ services: any[]; count: number }> {
    try {
      const response = await api.get('/api/services/featured')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async trackServiceView(serviceId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`/api/services/${serviceId}/view`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async trackServiceClick(serviceId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.post(`/api/services/${serviceId}/click`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getLocations(activeOnly: boolean = true): Promise<{ locations: any[]; count: number }> {
    try {
      console.log('🔵 [API] getLocations called with activeOnly:', activeOnly)
      const response = await api.get('/api/locations', { params: { active_only: activeOnly } })
      console.log('✅ [API] getLocations response:', response.data)
      return response.data
    } catch (error: any) {
      console.error('❌ [API] getLocations error:', error)
      console.error('❌ [API] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      throw new Error(handleError(error))
    }
  },

  // Admin Services API
  async adminGetServices(params?: { status?: string; location_id?: string; page?: number; page_size?: number }): Promise<any> {
    try {
      const response = await api.get('/api/admin/services', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminGetService(serviceId: string): Promise<any> {
    try {
      const response = await api.get(`/api/admin/services/${serviceId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminCreateService(serviceData: any): Promise<any> {
    try {
      const response = await api.post('/api/admin/services', serviceData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminUpdateService(serviceId: string, serviceData: any): Promise<any> {
    try {
      const response = await api.put(`/api/admin/services/${serviceId}`, serviceData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminDeleteService(serviceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/api/admin/services/${serviceId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminToggleServiceStatus(serviceId: string, status: 'active' | 'inactive'): Promise<{ success: boolean; status: string }> {
    try {
      const response = await api.patch(`/api/admin/services/${serviceId}/status`, null, { params: { status } })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminBulkDeleteServices(serviceIds: string[]): Promise<{ success: boolean; deleted_count: number }> {
    try {
      const response = await api.post('/api/admin/services/bulk-delete', serviceIds)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminReorderServices(reorderData: Record<string, number>): Promise<{ success: boolean }> {
    try {
      const response = await api.post('/api/admin/services/reorder', reorderData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminGetLocations(): Promise<{ locations: any[]; count: number }> {
    try {
      const response = await api.get('/api/admin/locations')
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminCreateLocation(locationData: any): Promise<any> {
    try {
      const response = await api.post('/api/admin/locations', locationData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminUpdateLocation(locationId: string, locationData: any): Promise<any> {
    try {
      const response = await api.put(`/api/admin/locations/${locationId}`, locationData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminDeleteLocation(locationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/api/admin/locations/${locationId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Providers API
  async getServiceProviders(serviceId: string, params?: { location_id?: string; status?: string }): Promise<{ providers: any[]; count: number }> {
    try {
      const response = await api.get(`/api/services/${serviceId}/providers`, { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async getProvider(providerId: string): Promise<any> {
    try {
      const response = await api.get(`/api/providers/${providerId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminGetProviders(params?: { service_id?: string; location_id?: string; status?: string }): Promise<{ providers: any[]; count: number }> {
    try {
      const response = await authApi.get('/api/admin/providers', { params })
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminCreateProvider(providerData: any): Promise<any> {
    try {
      const response = await authApi.post('/api/admin/providers', providerData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminUpdateProvider(providerId: string, providerData: any): Promise<any> {
    try {
      const response = await authApi.put(`/api/admin/providers/${providerId}`, providerData)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  async adminDeleteProvider(providerId: string): Promise<{ message: string }> {
    try {
      const response = await authApi.delete(`/api/admin/providers/${providerId}`)
      return response.data
    } catch (error) {
      throw new Error(handleError(error))
    }
  },

  // Generic HTTP methods for dataset and other endpoints
  async get<T = any>(url: string, config?: any): Promise<{ data: T }> {
    try {
      const response = await api.get<T>(url, config)
      return response
    } catch (error) {
      throw error
    }
  },

  async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    try {
      const response = await api.post<T>(url, data, config)
      return response
    } catch (error) {
      throw error
    }
  },

  async put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
    try {
      const response = await api.put<T>(url, data, config)
      return response
    } catch (error) {
      throw error
    }
  },

  async delete<T = any>(url: string, config?: any): Promise<{ data: T }> {
    try {
      const response = await api.delete<T>(url, config)
      return response
    } catch (error) {
      throw error
    }
  },
}

// Export token management functions

export { getToken, setToken, removeToken }

