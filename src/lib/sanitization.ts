/**
 * Sanitization utilities for user input
 * Prevents XSS attacks and ensures data integrity
 */

export interface SanitizationOptions {
  maxLength?: number
  allowHtml?: boolean
  allowSpecialChars?: boolean
}

const DEFAULT_OPTIONS: Required<SanitizationOptions> = {
  maxLength: 500,
  allowHtml: false,
  allowSpecialChars: false
}

/**
 * Sanitizes text input by removing potentially dangerous content
 */
export function sanitizeText(input: string, options: SanitizationOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  if (!input || typeof input !== 'string') {
    return ''
  }

  let sanitized = input.trim()

  // Remove HTML tags if not allowed
  if (!opts.allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '')
  }

  // Remove special characters if not allowed
  if (!opts.allowSpecialChars) {
    // Allow alphanumeric, spaces, basic punctuation, and common game symbols
    sanitized = sanitized.replace(/[^a-zA-Z0-9\s.,!?;:'"()-]/g, '')
  }

  // Limit length
  if (sanitized.length > opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength)
  }

  return sanitized
}

/**
 * Sanitizes chat messages with specific rules
 */
export function sanitizeChatMessage(message: string): string {
  return sanitizeText(message, {
    maxLength: 200,
    allowHtml: false,
    allowSpecialChars: false
  })
}

/**
 * Sanitizes usernames with specific rules
 */
export function sanitizeUsername(username: string): string {
  return sanitizeText(username, {
    maxLength: 20,
    allowHtml: false,
    allowSpecialChars: false
  }).replace(/\s+/g, '') // Remove spaces from usernames
}

/**
 * Validates that a string is safe for display
 */
export function isValidText(input: string, maxLength: number = 500): boolean {
  if (!input || typeof input !== 'string') {
    return false
  }

  const sanitized = sanitizeText(input, { maxLength })
  return sanitized.length > 0 && sanitized === input.trim()
}

/**
 * Escapes HTML entities for safe display
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  }
  
  return text.replace(/[&<>"'/]/g, (s) => map[s])
}
