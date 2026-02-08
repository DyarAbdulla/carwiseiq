/**
 * TypeScript types for Car Price Predictor
 */

export interface CarFeatures {
  year: number
  mileage: number
  engine_size: number
  cylinders: number
  make: string
  model: string
  trim?: string
  condition: string
  fuel_type: string
  location: string
  color?: string
}

// ============================================================================
// Sell Car Types (for /api/sell/predict and useCarValidation)
// ============================================================================
export interface SellCarRequest {
  make?: string
  model?: string
  year?: number
  mileage?: number
  condition?: string
  fuel_type?: string
  transmission?: string
  location?: string
  has_accident?: boolean
  severity?: string
  [key: string]: unknown
}

export interface SellCarResponse {
  predicted_price?: number
  confidence_interval?: { lower: number; upper: number }
  [key: string]: unknown
}

export interface PredictionRequest {
  features: CarFeatures
}

export interface ConfidenceInterval {
  lower: number
  upper: number
}

export interface MarketComparison {
  your_car: number
  market_average: number
  difference: number
  percentage_difference: number
}

export interface SimilarCar {
  year: number
  mileage: number
  condition: string
  price: number
  make?: string
  model?: string
  link?: string
  image_id?: string
  image_url?: string
}

export interface MarketTrend {
  month: string
  average_price: number
  date?: string
}

export interface PriceFactor {
  factor: string
  impact: number
  direction: 'up' | 'down'
  description?: string
}

export interface DealScore {
  score: 'excellent' | 'good' | 'fair' | 'poor'
  badge: string
  percentage: number
  label: string
}

export interface MarketDemand {
  level: 'high' | 'medium' | 'low'
  badge: string
  description?: string
}

export interface PredictionResponse {
  predicted_price: number
  confidence_interval?: ConfidenceInterval
  confidence_range?: number
  precision?: number
  confidence_level?: 'high' | 'medium' | 'low'
  market_comparison?: MarketComparison
  deal_analysis?: 'excellent' | 'good' | 'fair' | 'poor'
  deal_score?: DealScore
  price_factors?: PriceFactor[]
  market_demand?: MarketDemand
  similar_cars?: SimilarCar[]
  market_trends?: MarketTrend[]
  message?: string
  car_image_path?: string
  preview_image?: string
  image_match_type?: 'exact' | 'same_model_different_year' | 'same_make' | 'fallback'
  image_match_info?: string
}

export interface HealthResponse {
  status: string
  message: string
  model_loaded: boolean
  timestamp?: string
}

export interface BatchPredictionResult {
  car: CarFeatures
  predicted_price: number
  confidence_interval?: ConfidenceInterval
  error?: string
}

export interface DatasetStats {
  total_cars: number
  average_price: number
  median_price: number
  min_price: number
  max_price: number
  year_range: {
    min: number
    max: number
  }
  price_distribution?: {
    bin: string
    count: number
  }[]
  top_makes?: {
    make: string
    count: number
  }[]
  fuel_type_distribution?: {
    fuel_type: string
    count: number
  }[]
  price_by_year?: {
    year: number
    average_price: number
  }[]
  price_by_condition?: {
    condition: string
    average_price: number
  }[]
}

// Sidebar and UI related types
export interface SidebarSection {
  id: string
  title: string
  icon?: string
  content?: React.ReactNode
}

export interface DealAnalysisData {
  status: 'excellent' | 'good' | 'fair' | 'poor'
  percentage_above_market: number
  market_position: number // 0-100
  price_range: {
    min: number
    max: number
  }
  description: string
}

export interface MarketTrendData {
  month: string
  price: number
  trend: 'up' | 'down' | 'stable'
  percentage_change: number
}

export interface SmartTip {
  id: string
  title: string
  icon: string
  content: string
  expanded?: boolean
}

export interface BudgetCarResult {
  make: string
  model: string
  year: number
  mileage: number
  condition: string
  fuel_type: string
  location: string
  engine_size: number
  cylinders: number
  price: number  // Changed from predicted_price to price (actual dataset price)
  trim?: string
  image_filename?: string
  image_url?: string  // For marketplace listings
  price_difference?: number  // Difference from target budget
  source?: 'database' | 'marketplace'  // Source of the car listing
  listing_id?: number  // For marketplace listings
  is_new?: boolean  // True if added in last 24 hours
}

export interface BudgetSearchResponse {
  total: number
  page: number
  page_size: number
  results: BudgetCarResult[]
  error?: string
}

export interface StatsSummary {
  top_makes: { make: string; count: number }[]
  fuel_type_distribution: { fuel_type: string; count: number; percentage: number }[]
  price_trends_by_year: { year: number; average_price: number; count: number }[]
  price_by_condition: { condition: string; average_price: number; count: number }[]
}

// ============================================================================
// Feedback Types
// ============================================================================
export interface FeedbackSubmissionRequest {
  prediction_id: number
  rating?: number  // 1-5 stars
  is_accurate?: boolean  // Quick thumbs up/down
  feedback_type?: 'accurate' | 'inaccurate' | 'partial'
  feedback_reasons?: string[]  // Array of reason keys
  correct_make?: string
  correct_model?: string
  correct_year?: number
  correct_price?: number
  other_details?: string  // 50-500 characters
}
export interface FeedbackSubmissionResponse {
  feedback_id: number
  success: boolean
  message: string
}
export interface PredictionHistoryItem {
  id: number
  car_features: CarFeatures
  predicted_price: number
  confidence_interval?: ConfidenceInterval
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
}export interface PredictionHistoryResponse {
  predictions: PredictionHistoryItem[]
  total: number
  message: string
}// ============================================================================
// Sell flow: AI detection & draft
// ============================================================================

export type ConfidenceLabel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface AIDetectionResult {
  make?: string
  model?: string
  color?: string
  confidence: number
  confidence_label: ConfidenceLabel
  raw?: Record<string, unknown>
}

export interface AIDetectCarResponse {
  status: 'ok' | 'low_confidence' | 'error'
  make?: string
  model?: string
  color?: string
  confidence: number
  confidence_label: ConfidenceLabel
  per_image?: Array<{ image: string; make?: string; model?: string; confidence?: number }>
  debug?: Record<string, unknown>
  image_urls?: string[]
}

export interface SellDraftLocation {
  city: string
  state: string
  country: string
  lat?: number
  lng?: number
}

export interface SellDraftImage {
  id: string
  file?: File
  previewUrl: string
}

export interface SellDraftUploadedImage {
  id: number
  url: string
}

export interface SellDraftState {
  draftId: string | null
  listingId: number | null
  images: SellDraftImage[]
  uploadedImages: SellDraftUploadedImage[]
  aiDetection: AIDetectionResult | null
  location: SellDraftLocation | null
  phone: string
  carDetails: Record<string, unknown> | null
}

export interface FeedbackMetrics {
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
}
