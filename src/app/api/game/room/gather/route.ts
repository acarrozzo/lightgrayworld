export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getCurrentUser } from '@/lib/auth'

/**
 * Static shape of a room's gather action, as returned by getGatherActionsForRoom.
 * `maxHeld` is set only for capped nodes (e.g. Jack's starter tree); the client
 * compares it against its own live inventory count of `itemSlug` to decide
 * whether the node reads as tapped out, and labels it with `itemNamePlural`.
 */
type GatherActionDef = {
  action: string
  cooldownMs: number | null
  quantity: number | null
  itemSlug: string | null
  itemNamePlural: string | null
  maxHeld: number | null
}

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

    const payload: Record<string, unknown> = { gatherCooldowns: [] }

    const { getGatherActionsForRoom } = require('@/lib/game-engine/room-action-handlers')
    const { getCooldownRemaining } = require('@/lib/game-engine/services/action-cap-service')
    const gathers = getGatherActionsForRoom(roomId)
    if (gathers.length > 0) {
      payload.gatherCooldowns = await Promise.all(
        gathers.map(async (gather: GatherActionDef) => ({
          action: gather.action,
          // A capped node can have no timer at all (Jack's tree): report it as
          // always-ready rather than asking the cooldown service about it.
          cooldownSeconds: gather.cooldownMs ? Math.ceil(gather.cooldownMs / 1000) : 0,
          secondsRemaining: gather.cooldownMs
            ? await getCooldownRemaining(user.id, roomId, gather.action, gather.cooldownMs)
            : 0,
          quantity: gather.quantity ?? null,
          itemSlug: gather.itemSlug ?? null,
          itemNamePlural: gather.itemNamePlural ?? null,
          maxHeld: gather.maxHeld ?? null,
        }))
      )
    }

    return NextResponse.json(payload, { headers: noCacheHeaders })
  } catch (error) {
    console.error('Gather status fetch error:', error)
    const base = COMMON_ERRORS.INTERNAL_ERROR('Failed to load gather status')
    return NextResponse.json(base, { status: 500, headers: noCacheHeaders })
  }
}
