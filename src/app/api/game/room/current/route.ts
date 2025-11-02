export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    const roomId = user?.currentRoom || '001'

    const room = await prisma.room.findUnique({
      where: { roomId },
      select: {
        id: true,
        roomId: true,
        name: true,
        description: true,
        dangerLevel: true,
        isSafe: true,
        north: true,
        northeast: true,
        east: true,
        southeast: true,
        south: true,
        southwest: true,
        west: true,
        northwest: true,
        up: true,
        down: true,
      },
    })

    if (!room) {
      const base = COMMON_ERRORS.NOT_FOUND('Room')
      const details =
        process.env.NODE_ENV !== 'production'
          ? { details: `roomId=${roomId}` }
          : {}
      return NextResponse.json(
        { ...base, error: { ...base.error, ...details } },
        { status: 404, headers: noCacheHeaders }
      )
    }

    let activePlayers: Array<{
      id: string
      username: string
      level: number
      hp: number
      hpMax: number
      mp: number
      mpMax: number
      currentRoom: string
      isActive: boolean
    }> = []

    if (user) {
      activePlayers = await prisma.user.findMany({
        where: {
          currentRoom: room.roomId,
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          level: true,
          hp: true,
          hpMax: true,
          mp: true,
          mpMax: true,
          currentRoom: true,
          isActive: true,
        },
      })
    }

    const payload: Record<string, unknown> = {
      room: {
        id: room.id,
        roomId: room.roomId,
        name: room.name,
        description: room.description,
        dangerLevel: room.dangerLevel,
        isSafe: room.isSafe,
        north: room.north,
        northeast: room.northeast,
        east: room.east,
        southeast: room.southeast,
        south: room.south,
        southwest: room.southwest,
        west: room.west,
        northwest: room.northwest,
        up: room.up,
        down: room.down,
      },
    }

    if (user) {
      payload.players = activePlayers
    }

    return NextResponse.json(
      payload,
      {
        headers: noCacheHeaders,
      }
    )
  } catch (error) {
    console.error('Current room fetch error:', {
      error,
    })
    const base = COMMON_ERRORS.INTERNAL_ERROR('Failed to load current room')
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
