export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getCurrentUser } from '@/lib/auth'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 60

type RateLimitRecord = {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitRecord>()

const noCacheHeaders = {
  'Cache-Control': 'private, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

function checkRateLimit(ip: string): boolean {
  if (!ip) {
    return true
  }

  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  entry.count += 1
  rateLimitMap.set(ip, entry)
  return true
}

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request)
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { message: 'Too many requests, please try again shortly.' },
        { status: 429, headers: noCacheHeaders }
      )
    }

    const authHeader = request.headers.get('authorization')
    const user = authHeader?.startsWith('Bearer ')
      ? await getCurrentUser(request)
      : null

    if (!user) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401, headers: noCacheHeaders }
      )
    }

    const requestedRoomIdRaw = request.nextUrl.searchParams.get('roomId')
    const requestedRoomId = requestedRoomIdRaw?.trim()
    const roomId = requestedRoomId && requestedRoomId.length > 0
      ? requestedRoomId
      : user.currentRoom || '001'

    const payload: Record<string, unknown> = {}

    // Fetch action cap data for rooms with capped actions
    const actionCaps: Record<string, number> = {}
    const gameEngine = (globalThis as any).gameEngine

    if (gameEngine?.tickClock && roomId) {
      // Always use TickClock methods - single source of truth
      const currentTickNumber = gameEngine.tickClock.getCurrentTickId()

      // Room 002: "pick redberry" (maxPerTick: 5)
      if (roomId === '002') {
        const { getRemainingCap } = require('@/lib/game-engine/services/action-cap-service')
        try {
          const remaining = await getRemainingCap(user.id, roomId, 'pick redberry', 5, currentTickNumber)
          actionCaps['pick redberry'] = remaining
        } catch (error) {
          console.error('[Caps API] Error fetching redberry cap:', error)
        }
      }

      // Room 005: "pick blueberry" (maxPerTick: 3)
      if (roomId === '005') {
        const { getRemainingCap } = require('@/lib/game-engine/services/action-cap-service')
        try {
          const remaining = await getRemainingCap(user.id, roomId, 'pick blueberry', 3, currentTickNumber)
          actionCaps['pick blueberry'] = remaining
        } catch (error) {
          console.error('[Caps API] Error fetching blueberry cap:', error)
        }
      }
    }

    if (Object.keys(actionCaps).length > 0) {
      payload.actionCaps = actionCaps
    }

    // Include world tick information
    // Always use TickClock methods - no fallback math
    if (gameEngine?.tickClock) {
      const tickId = gameEngine.tickClock.getCurrentTickId()
      const nextTickAt = gameEngine.tickClock.getNextTickTimestamp()
      const tickIntervalMs = gameEngine.tickClock.tickMs

      payload.worldTick = {
        tickId,
        tickNumber: tickId, // for backwards compatibility
        nextTickAt,
        tickIntervalMs,
      }
    } else {
      // Fail loudly in dev if tickClock is missing
      if (process.env.NODE_ENV === 'development') {
        console.error('[Caps API] tickClock missing - cannot compute worldTick')
      }
      // worldTick will be undefined - client handles gracefully
    }

    return NextResponse.json(
      payload,
      {
        headers: noCacheHeaders,
      }
    )
  } catch (error) {
    console.error('Caps fetch error:', {
      error,
    })
    const base = COMMON_ERRORS.INTERNAL_ERROR('Failed to load caps')
    const details =
      process.env.NODE_ENV !== 'production'
        ? { details: (error as any)?.message || String(error) }
        : {}
    return NextResponse.json(
      { ...base, error: { ...base.error, ...details } },
      { status: 500, headers: noCacheHeaders }
    )
  }
}

