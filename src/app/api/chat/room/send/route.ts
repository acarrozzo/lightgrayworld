export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { sanitizeChatMessage, isValidText } from '@/lib/sanitization'
import { COMMON_ERRORS, validateRequiredFields, rateLimiter } from '@/lib/error-handling'

async function handleRoomChatSend(request: AuthenticatedRequest) {
  try {
    const { message, roomId } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ message, roomId }, ['message', 'roomId'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Message and roomId are required'),
        { status: 400 }
      )
    }

    // Validate player is in the specified room
    if (request.user.currentRoom !== roomId) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('You must be in the room to send room chat messages'),
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

    // Rate limiting
    if (!rateLimiter.isAllowed(request.user.id)) {
      return NextResponse.json(
        COMMON_ERRORS.RATE_LIMITED('Too many messages sent'),
        { status: 429 }
      )
    }

    // Sanitize the message
    const sanitizedMessage = sanitizeChatMessage(message)
    
    if (!isValidText(sanitizedMessage, 200)) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Invalid message content'),
        { status: 400 }
      )
    }

    // Create room chat message
    const roomChatMessage = await prisma.roomChatMessage.create({
      data: {
        userId: request.user.id,
        roomId: roomId,
        message: sanitizedMessage,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Room chat message sent successfully',
      roomChatMessage: {
        id: roomChatMessage.id,
        message: sanitizedMessage,
        timestamp: roomChatMessage.timestamp
      }
    })
  } catch (error) {
    console.error('Room chat send error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to send room chat message'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleRoomChatSend)

