/**
 * API Types
 * Type definitions for API requests and responses
 */

// Generic API Response
export interface ApiResponse<T> {
  data: T
  message?: string
  success?: boolean
}

// API Error Response
export interface ApiError {
  detail?: string | string[] | { [key: string]: any }
  message?: string
  errors?: Array<{
    field: string
    message: string
  }>
}

// Auth Response
export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// User Type
export interface User {
  id: number
  email: string
}

// Register Request
export interface RegisterRequest {
  email: string
  password: string
}

// Login Request
export interface LoginRequest {
  email: string
  password: string
}

// Forgot Password Request
export interface ForgotPasswordRequest {
  email: string
}

// Forgot Password Response
export interface ForgotPasswordResponse {
  message: string
}
