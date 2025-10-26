import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, AuthUser } from './auth'

export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
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

      return handler(authenticatedRequest)
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