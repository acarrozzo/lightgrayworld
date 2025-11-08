import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, AuthUser } from './auth'

export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser
}

// Overload for handlers without params
export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse>

// Overload for handlers with params (Next.js 15 uses Promise-based params)
// Uses generic type parameter to support both generic and specific param types
export function withAuth<T extends { [key: string]: string }>(
  handler: (
    request: AuthenticatedRequest,
    context: { params: Promise<T> }
  ) => Promise<NextResponse>
): (
  request: NextRequest,
  context: { params: Promise<T> }
) => Promise<NextResponse>

// Implementation
export function withAuth<T extends { [key: string]: string }>(
  handler: (
    request: AuthenticatedRequest,
    context?: { params: Promise<T> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<T> }
  ): Promise<NextResponse> => {
    try {
      const user = await getCurrentUser(request)
      
      if (!user) {
        return NextResponse.json(
          { message: 'Authentication required' },
          { status: 401 }
        )
      }

      // Add user to request object
      const authenticatedRequest = request as AuthenticatedRequest
      authenticatedRequest.user = user

      // Pass through params if present
      if (context) {
        return handler(authenticatedRequest, context)
      } else {
        return handler(authenticatedRequest)
      }
    } catch (error) {
      console.error('Middleware error:', error)
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

export function withOptionalAuth(
  handler: (request: NextRequest, user: AuthUser | null) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const user = await getCurrentUser(request)
      return handler(request, user)
    } catch (error) {
      console.error('Middleware error:', error)
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}