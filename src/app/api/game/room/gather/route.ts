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
 * Returns the rolling gather cooldown status for a room (sand / dirt / stone /
 * berries). A room can host more than one gather action, so this is an array:
 *   { gatherCooldowns: Array<{ action, cooldownSeconds, secondsRemaining, quantity }> }
 * Used to seed the in-room countdowns on room entry. Lightweight by design.
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

    const { buildGatherCooldowns } = require('@/lib/game-engine/services/gather-status')
    const payload = { gatherCooldowns: await buildGatherCooldowns(user.id, roomId) }

    return NextResponse.json(payload, { headers: noCacheHeaders })
  } catch (error) {
    console.error('Gather status fetch error:', error)
    const base = COMMON_ERRORS.INTERNAL_ERROR('Failed to load gather status')
    return NextResponse.json(base, { status: 500, headers: noCacheHeaders })
  }
}
