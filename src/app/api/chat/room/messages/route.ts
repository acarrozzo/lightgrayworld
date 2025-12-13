export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

async function handleGetRoomMessages(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('roomId query parameter is required'),
        { status: 400 }
      )
    }

    // Validate player has access to room (they should be in it)
    if (request.user.currentRoom !== roomId) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('You must be in the room to view room chat messages'),
        { status: 403 }
      )
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { roomId },
    })

    if (!room) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Room not found'),
        { status: 404 }
      )
    }

    // Get recent room chat messages (last 50)
    const messages = await prisma.roomChatMessage.findMany({
      where: {
        roomId: roomId,
      },
      take: 50,
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            level: true,
          },
        },
      },
    })

    // Format messages for frontend and reverse to show newest at bottom
    const formattedMessages = messages
      .reverse()
      .map((msg: any) => ({
        id: msg.id,
        username: msg.user.username,
        message: msg.message,
        timestamp: msg.timestamp,
        level: msg.user.level,
        type: msg.type || 'chat',
      }))

    return NextResponse.json({ messages: formattedMessages })
  } catch (error) {
    console.error('Room chat messages error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load room chat messages'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetRoomMessages)

