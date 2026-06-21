import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'
import { DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

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
  xp: number
  cp: number
  tp: number
  sp: number
  currency: number
  physicalTraining: number
  mentalTraining: number
  str: number
  dex: number
  mag: number
  def: number
  strMod?: number
  dexMod?: number
  magMod?: number
  defMod?: number
  uIcon: string
  uIconColor: string
  clicks?: number
  deaths?: number
  chest1?: boolean
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
    const record = await prisma.user.findUnique({
      where: { id: decoded.id },
    })

    if (!record || !record.isActive) {
      return null
    }

    const avatarColor =
      (record as Record<string, unknown>).uIconColor as string | undefined

    const user: AuthUser = {
      id: record.id,
      username: record.username,
      level: record.level,
      hp: record.hp,
      hpMax: record.hpMax,
      mp: record.mp,
      mpMax: record.mpMax,
      currentRoom: record.currentRoom,
      isActive: record.isActive,
      xp: record.xp,
      cp: record.cp,
      tp: record.tp,
      sp: record.sp,
      currency: record.currency,
      physicalTraining: record.physicalTraining,
      mentalTraining: record.mentalTraining,
      str: record.str,
      dex: record.dex,
      mag: record.mag,
      def: record.def,
      uIcon: record.uIcon,
      uIconColor: avatarColor ?? DEFAULT_AVATAR_COLOR,
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
