export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getCurrentUser } from '@/lib/auth'
import { ROOM_ITEMS_SELECT, normalizeRoomData } from '@/lib/game-engine/services/room-normalization'

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

    const requestedRoomIdRaw = request.nextUrl.searchParams.get('roomId')
    const requestedRoomId = requestedRoomIdRaw?.trim()
    const roomId = requestedRoomId && requestedRoomId.length > 0
      ? requestedRoomId
      : user?.currentRoom || '001'

    // Ensure auto-respawn items exist in the room
    const { ensureAutoRespawnItems } = require('@/lib/game-engine/services/room-item-service')
    await ensureAutoRespawnItems(roomId)

    const room = await prisma.room.findUnique({
      where: { roomId },
      select: {
        id: true,
        roomId: true,
        name: true,
        subtitle: true,
        subtitlePosition: true,
        nameColor: true,
        subtitleColor: true,
        icon: true,
        iconColor: true,
        iconSize: true,
        directionColors: true,
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
        ...ROOM_ITEMS_SELECT,
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
      uIcon: string | null
      uIconColor: string | null
      str: number
      dex: number
      mag: number
      def: number
      strMod: number
      dexMod: number
      magMod: number
      defMod: number
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
          inFight: true,
          uIcon: true,
          uIconColor: true,
          str: true,
          dex: true,
          mag: true,
          def: true,
          strMod: true,
          dexMod: true,
          magMod: true,
          defMod: true,
        },
      })
    }

    const normalizedRoom = normalizeRoomData(room)

    // Attach static enemy data for rooms that have enemies
    const { getRoomEnemies } = require('@/lib/game-data/room-enemies')
    const { getEnemy } = require('@/lib/game-data/enemies')
    const roomEnemyConfig = getRoomEnemies(roomId)
    const roomEnemies = roomEnemyConfig
      ? roomEnemyConfig.enemies.map((slug: string) => getEnemy(slug)).filter(Boolean)
      : []

    const { getRoomStateNote, getRoomActionOverrides } = require('@/lib/game-engine/lever-state')
    const {
      getRoomStateNote: getSearchRevealStateNote,
      getExitOverlay: getSearchRevealExitOverlay,
    } = require('@/lib/game-engine/search-reveal-state')
    const leverStateNote = user ? getRoomStateNote(user.id, roomId) : null
    const searchRevealStateNote = user ? getSearchRevealStateNote(user.id, roomId) : null
    const stateNote = leverStateNote || searchRevealStateNote || null
    const actionOverrides = user ? getRoomActionOverrides(user.id, roomId) : null
    const exitOverlay = user ? getSearchRevealExitOverlay(user.id, roomId) : null

    const payload: Record<string, unknown> = {
      room: {
        ...normalizedRoom,
        ...(exitOverlay || {}),
        enemies: roomEnemies,
        stateNote,
        actionOverrides,
      },
    }

    if (user) {
      payload.players = activePlayers

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
            console.error('[Room API] Error fetching redberry cap:', error)
          }
        }

        // Room 005: "pick blueberry" (maxPerTick: 3)
        if (roomId === '005') {
          const { getRemainingCap } = require('@/lib/game-engine/services/action-cap-service')
          try {
            const remaining = await getRemainingCap(user.id, roomId, 'pick blueberry', 3, currentTickNumber)
            actionCaps['pick blueberry'] = remaining
          } catch (error) {
            console.error('[Room API] Error fetching blueberry cap:', error)
          }
        }
      }

      if (Object.keys(actionCaps).length > 0) {
        payload.actionCaps = actionCaps
      }

      // Include world tick information for immediate countdown display
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
          console.error('[API] tickClock missing - cannot compute worldTick')
        }
        // worldTick will be undefined - client handles gracefully
      }
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
