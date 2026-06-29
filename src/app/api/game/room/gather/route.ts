export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getCurrentUser } from '@/lib/auth'

const noCacheHeaders = {
  'Cache-Control': 'private, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

/**
 * Returns the rolling gather cooldown status for a room (sand / berries):
 *   { gatherCooldown: { action, cooldownSeconds, secondsRemaining } | null }
 * Used to seed the in-room countdown on room entry. Lightweight by design.
 */
export async function GET(request: NextRequest) {
  try {
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

    const requestedRoomId = request.nextUrl.searchParams.get('roomId')?.trim()
    const roomId = requestedRoomId && requestedRoomId.length > 0
      ? requestedRoomId
      : user.currentRoom || '001'

    const payload: Record<string, unknown> = { gatherCooldown: null }

    const { getGatherActionForRoom } = require('@/lib/game-engine/room-action-handlers')
    const { getCooldownRemaining } = require('@/lib/game-engine/services/action-cap-service')
    const gather = getGatherActionForRoom(roomId)
    if (gather) {
      const secondsRemaining = await getCooldownRemaining(user.id, roomId, gather.action, gather.cooldownMs)
      payload.gatherCooldown = {
        action: gather.action,
        cooldownSeconds: Math.ceil(gather.cooldownMs / 1000),
        secondsRemaining,
      }
    }

    return NextResponse.json(payload, { headers: noCacheHeaders })
  } catch (error) {
    console.error('Gather status fetch error:', error)
    const base = COMMON_ERRORS.INTERNAL_ERROR('Failed to load gather status')
    return NextResponse.json(base, { status: 500, headers: noCacheHeaders })
  }
}
