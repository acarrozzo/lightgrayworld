/**
 * Centralized error handling utilities
 * Provides consistent error responses and logging
 */

export interface ApiError {
  message: string
  status: number
  code?: string
  details?: any
}

export interface ErrorResponse {
  success: false
  error: {
    message: string
    code?: string
    details?: any
  }
  timestamp: string
}

/**
 * Standard error codes for consistent error handling
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SOCKET_ERROR: 'SOCKET_ERROR'
} as const

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error: {
      message,
      code,
      details
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Common error responses for reuse
 */
export const COMMON_ERRORS = {
  VALIDATION_ERROR: (message: string) => 
    createErrorResponse(message, 400, ERROR_CODES.VALIDATION_ERROR),
  
  AUTHENTICATION_ERROR: (message: string = 'Authentication required') => 
    createErrorResponse(message, 401, ERROR_CODES.AUTHENTICATION_ERROR),
  
  AUTHORIZATION_ERROR: (message: string = 'Insufficient permissions') => 
    createErrorResponse(message, 403, ERROR_CODES.AUTHORIZATION_ERROR),
  
  NOT_FOUND: (resource: string = 'Resource') => 
    createErrorResponse(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND),
  
  CONFLICT: (message: string) => 
    createErrorResponse(message, 409, ERROR_CODES.CONFLICT),
  
  RATE_LIMITED: (message: string = 'Too many requests') => 
    createErrorResponse(message, 429, ERROR_CODES.RATE_LIMITED),
  
  INTERNAL_ERROR: (message: string = 'Internal server error') => 
    createErrorResponse(message, 500, ERROR_CODES.INTERNAL_ERROR),
  
  NETWORK_ERROR: (message: string = 'Network error') => 
    createErrorResponse(message, 503, ERROR_CODES.NETWORK_ERROR)
}

/**
 * Handles API errors with consistent logging and response
 */
export function handleApiError(error: unknown, context: string): ErrorResponse {
  console.error(`[${context}] Error:`, error)
  
  if (error instanceof Error) {
    // Handle known error types
    if (error.message.includes('validation') || error.message.includes('required')) {
      return COMMON_ERRORS.VALIDATION_ERROR(error.message)
    }
    
    if (error.message.includes('not found')) {
      return COMMON_ERRORS.NOT_FOUND()
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return COMMON_ERRORS.AUTHENTICATION_ERROR(error.message)
    }
    
    // Default to internal error for unknown errors
    return COMMON_ERRORS.INTERNAL_ERROR(error.message)
  }
  
  // Fallback for unknown error types
  return COMMON_ERRORS.INTERNAL_ERROR()
}

/**
 * Wraps async functions with error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorResponse = handleApiError(error, context)
      throw new Error(JSON.stringify(errorResponse))
    }
  }
}

/**
 * Validates required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => 
    !body || body[field] === undefined || body[field] === null || body[field] === ''
  )
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  }
}

/**
 * Rate limiting helper (simple in-memory implementation)
 */
class RateLimiter {
  private requests = new Map<string, number[]>()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const userRequests = this.requests.get(identifier) || []
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < this.windowMs)
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    
    return true
  }
}

export const rateLimiter = new RateLimiter()
