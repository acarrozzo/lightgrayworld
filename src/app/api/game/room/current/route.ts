import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

async function handleGetCurrentRoom(request: AuthenticatedRequest) {
  try {
    // Use the authenticated user's current room, default to 001 in dev if missing
    const actualRoomId = request.user.currentRoom || '001'

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
      const base = COMMON_ERRORS.NOT_FOUND('Room')
      const details = process.env.NODE_ENV !== 'production' ? { details: `roomId=${actualRoomId}` } : {}
      return NextResponse.json({ ...base, error: { ...base.error, ...details } }, { status: 404 })
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
    console.error('Current room fetch error:', {
      error,
      userId: request.user?.id,
      currentRoom: request.user?.currentRoom,
    })
    const base = COMMON_ERRORS.INTERNAL_ERROR('Failed to load current room')
    const details = process.env.NODE_ENV !== 'production' ? { details: (error as any)?.message || String(error) } : {}
    return NextResponse.json({ ...base, error: { ...base.error, ...details } }, { status: 500 })
  }
}

export const GET = withAuth(handleGetCurrentRoom)
