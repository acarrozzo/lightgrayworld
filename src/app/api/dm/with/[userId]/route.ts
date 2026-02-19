export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { DIRECT_MESSAGE_HISTORY_LIMIT, getCanonicalThreadPair } from '@/lib/direct-messages'

async function handleGetDirectMessagesWithUser(request: AuthenticatedRequest) {
  try {
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const otherUserId = pathSegments[pathSegments.length - 1]

    if (!otherUserId) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('User id is required'),
        { status: 400 }
      )
    }

    if (otherUserId === request.user.id) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Cannot open a direct thread with yourself'),
        { status: 400 }
      )
    }

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: {
        id: true,
        username: true,
        level: true,
        uIcon: true,
        uIconColor: true,
      },
    })

    if (!otherUser) {
      return NextResponse.json(COMMON_ERRORS.NOT_FOUND('User'), { status: 404 })
    }

    const userId = request.user.id
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: userId },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: DIRECT_MESSAGE_HISTORY_LIMIT,
    })

    const orderedMessages = messages.reverse()

    const now = new Date()
    const pair = getCanonicalThreadPair(userId, otherUserId)
    const isUserA = pair.userAId === userId
    await prisma.$transaction([
      prisma.directMessage.updateMany({
        where: {
          senderId: otherUserId,
          recipientId: userId,
          readAt: null,
        },
        data: {
          readAt: now,
        },
      }),
      prisma.directThread.updateMany({
        where: {
          userAId: pair.userAId,
          userBId: pair.userBId,
        },
        data: isUserA ? { userAUnreadCount: 0 } : { userBUnreadCount: 0 },
      }),
    ])

    return NextResponse.json({
      success: true,
      otherUser: {
        id: otherUser.id,
        username: otherUser.username,
        level: otherUser.level,
        uIcon: otherUser.uIcon,
        uIconColor: otherUser.uIconColor,
      },
      messages: orderedMessages.map((message) => ({
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        message: message.message,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt ? message.readAt.toISOString() : null,
      })),
    })
  } catch (error) {
    console.error('Direct message history error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load direct message history'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetDirectMessagesWithUser)
