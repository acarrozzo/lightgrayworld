export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { sanitizeChatMessage, isValidText } from '@/lib/sanitization'
import { COMMON_ERRORS, validateRequiredFields, rateLimiter } from '@/lib/error-handling'

async function handleChatSend(request: AuthenticatedRequest) {
  try {
    const { message } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ message }, ['message'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Message is required'),
        { status: 400 }
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

    // Create chat message using authenticated user
    const chatMessage = await prisma.chatMessage.create({
      data: {
        userId: request.user.id,
        message: sanitizedMessage,
        roomId: request.user.currentRoom
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
      chatMessage: {
        id: chatMessage.id,
        message: sanitizedMessage,
        timestamp: chatMessage.timestamp
      }
    })
  } catch (error) {
    console.error('Chat send error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to send message'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleChatSend)
