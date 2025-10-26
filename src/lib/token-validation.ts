/**
 * Token validation utilities
 * Ensures stored tokens are still valid when the app loads
 */

import jwt from 'jsonwebtoken'

interface TokenPayload {
  userId: string
  username: string
  iat: number
  exp: number
}

/**
 * Validates if a JWT token is still valid
 */
export function isTokenValid(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as TokenPayload
    if (!decoded || !decoded.exp) {
      return false
    }
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000)
    return decoded.exp > currentTime
  } catch (error) {
    console.error('Token validation error:', error)
    return false
  }
}

/**
 * Gets user info from a valid token
 */
export function getUserFromToken(token: string): { userId: string; username: string } | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload
    if (!decoded || !decoded.userId || !decoded.username) {
      return null
    }
    
    return {
      userId: decoded.userId,
      username: decoded.username
    }
  } catch (error) {
    console.error('Token decode error:', error)
    return null
  }
}

/**
 * Validates token and refreshes user data if needed
 */
export async function validateAndRefreshUser(token: string): Promise<{ 
  isValid: boolean; 
  user?: any; 
  newToken?: string 
}> {
  if (!isTokenValid(token)) {
    return { isValid: false }
  }

  try {
    // Try to refresh user data from server
    const response = await fetch('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      return { 
        isValid: true, 
        user: data.user,
        newToken: data.token // In case server issues a new token
      }
    } else {
      return { isValid: false }
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return { isValid: false }
  }
}
