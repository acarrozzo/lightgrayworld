import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface AuthUser {
  id: string
  username: string
  level: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  currentRoom: string
  isActive: boolean
}

interface TokenPayload {
  id: string
  username: string
  scopes?: string[]
}

export function generateToken(user: AuthUser): string {
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload
    if (!decoded?.id || !decoded?.username) {
      return null
    }
    return decoded
  } catch (error) {
    return null
  }
}

export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    
    if (!decoded) {
      return null
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        level: true,
        hp: true,
        hpMax: true,
        mp: true,
        mpMax: true,
        currentRoom: true,
        isActive: true
      }
    })

    if (!user || !user.isActive) {
      return null
    }

    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export function createAuthResponse(user: AuthUser) {
  const token = generateToken(user)
  
  return {
    player: user,
    token,
    expiresIn: '7d'
  }
}
