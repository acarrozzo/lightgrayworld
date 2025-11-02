export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

async function handleGetRoom(request: AuthenticatedRequest) {
  try {
    // Extract roomId from URL path
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const roomId = pathSegments[pathSegments.length - 1]

    // Use the authenticated user's current room, not the provided roomId
    const actualRoomId = request.user.currentRoom || '000'

    // Get room data
    const room = await prisma.room.findUnique({
      where: { roomId: actualRoomId },
      include: {
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
        items: true,
        npcs: true
      }
    })

    if (!room) {
      return NextResponse.json(
        COMMON_ERRORS.NOT_FOUND('Room'),
        { status: 404 }
      )
    }

    // Filter active players
    const activePlayers = room.players.filter(player => player.isActive)

    return NextResponse.json({
      room: {
        id: room.id,
        roomId: room.roomId,
        name: room.name,
        description: room.description,
        dangerLevel: room.dangerLevel,
        isSafe: room.isSafe,
        players: activePlayers,
        // Include navigation directions
        north: room.north,
        northeast: room.northeast,
        east: room.east,
        southeast: room.southeast,
        south: room.south,
        southwest: room.southwest,
        west: room.west,
        northwest: room.northwest,
        up: room.up,
        down: room.down
      },
      players: activePlayers
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
