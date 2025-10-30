import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'

async function handleNavigate(request: AuthenticatedRequest) {
  try {
    const { direction } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ direction }, ['direction'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Direction is required'),
        { status: 400 }
      )
    }

    // Valid directions
    const validDirections = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down']
    if (!validDirections.includes(direction.toLowerCase())) {
      return NextResponse.json(
        { 
          success: false,
          message: `Invalid direction: ${direction}`,
          action: 'navigate',
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    // Get current room data (minimal query for navigation check)
    const currentRoom = await prisma.room.findUnique({
      where: { roomId: request.user.currentRoom },
      select: {
        roomId: true,
        name: true,
        north: true,
        northeast: true,
        east: true,
        southeast: true,
        south: true,
        southwest: true,
        west: true,
        northwest: true,
        up: true,
        down: true
      }
    })

    if (!currentRoom) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Current room not found',
          action: 'navigate',
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      )
    }

    // Check if direction is available
    const directionKey = direction.toLowerCase() as keyof typeof currentRoom
    const targetRoomId = currentRoom[directionKey] as string | null

    if (!targetRoomId) {
      return NextResponse.json(
        { 
          success: false,
          message: `You cannot go ${direction} from here`,
          action: 'navigate',
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      )
    }

    // Get target room data (full query for new room)
    const targetRoom = await prisma.room.findUnique({
      where: { roomId: targetRoomId },
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

    if (!targetRoom) {
      return NextResponse.json(
        { 
          success: false,
          message: `Target room ${targetRoomId} not found`,
          action: 'navigate',
          player: request.user.username,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      )
    }

    // Update player's current room
    await prisma.user.update({
      where: { id: request.user.id },
      data: { currentRoom: targetRoomId }
    })

    // Filter active players for target room only (current room not needed)
    const targetRoomActivePlayers = targetRoom.players?.filter((player: any) => player.isActive) || []

    const result = {
      success: true,
      message: `You travel ${direction} to ${targetRoom.name}`,
      action: 'navigate',
      player: request.user.username,
      timestamp: new Date().toISOString(),
      roomData: {
        id: targetRoom.id,
        roomId: targetRoom.roomId,
        name: targetRoom.name,
        description: targetRoom.description,
        dangerLevel: targetRoom.dangerLevel,
        isSafe: targetRoom.isSafe,
        players: targetRoomActivePlayers,
        items: targetRoom.items || [],
        npcs: targetRoom.npcs || [],
        // Include navigation directions for the new room
        north: targetRoom.north,
        northeast: targetRoom.northeast,
        east: targetRoom.east,
        southeast: targetRoom.southeast,
        south: targetRoom.south,
        southwest: targetRoom.southwest,
        west: targetRoom.west,
        northwest: targetRoom.northwest,
        up: targetRoom.up,
        down: targetRoom.down
      }
    }

    // Record action in history
    try {
      await prisma.actionHistory.create({
        data: {
          userId: request.user.id,
          action: 'navigate',
          message: `Traveled ${direction} from ${currentRoom.name} to ${targetRoom.name}`,
          roomId: targetRoomId,
          metadata: JSON.stringify({
            fromRoom: currentRoom.roomId,
            toRoom: targetRoomId,
            direction
          })
        }
      })
    } catch (historyError) {
      console.error('Failed to record navigation action:', historyError)
      // Don't fail the request if history recording fails
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Navigation error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to navigate'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleNavigate)
