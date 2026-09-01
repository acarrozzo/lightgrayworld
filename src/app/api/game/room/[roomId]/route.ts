export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { ROOM_ITEMS_SELECT, normalizeRoomData } from '@/lib/game-engine/services/room-normalization'

async function handleGetRoom(request: AuthenticatedRequest) {
  try {
    // Extract roomId from URL path
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const roomId = pathSegments[pathSegments.length - 1]

    // Use the authenticated user's current room, not the provided roomId
    const actualRoomId = request.user.currentRoom || '000'

    // Ensure auto-respawn items exist in the room
    const { ensureAutoRespawnItems } = require('@/lib/game-engine/services/room-item-service')
    await ensureAutoRespawnItems(actualRoomId)

    // Get room data
    const room = await prisma.room.findUnique({
      where: { roomId: actualRoomId },
      select: {
        id: true,
        roomId: true,
        name: true,
        subtitle: true,
        subtitlePosition: true,
        region: true,
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
        players: {
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
        },
        ...ROOM_ITEMS_SELECT,
        npcs: true
      }
    })

    if (!room) {
      return NextResponse.json(
        COMMON_ERRORS.NOT_FOUND('Room'),
        { status: 404 }
      )
    }

    const normalizedRoom = normalizeRoomData(room)
    const activePlayers = normalizedRoom?.players?.filter((player) => player.isActive) || []

    const { getGhostsForRoom } = require('@/lib/services/ghost-player-store')
    const activePlayerIds = new Set(activePlayers.map((p: { id: string }) => p.id))
    const ghosts = getGhostsForRoom(actualRoomId).filter((g: { id: string }) => !activePlayerIds.has(g.id))

    return NextResponse.json({
      room: normalizedRoom ? { ...normalizedRoom, players: activePlayers } : null,
      players: activePlayers,
      roomGhosts: ghosts,
    })
  } catch (error) {
    console.error('Room fetch error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load room'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetRoom)
