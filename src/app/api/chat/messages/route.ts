export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

async function handleGetMessages(request: AuthenticatedRequest) {
  try {
    // Get recent chat messages (last 50)
    const messages = await prisma.chatMessage.findMany({
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
      }))

    return NextResponse.json({ messages: formattedMessages })
  } catch (error) {
    console.error('Chat messages error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load messages'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetMessages)
