export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, rateLimiter } from '@/lib/error-handling'
import { sanitizeChatMessage, isValidText, MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import { buildDirectMessageSnippet, getCanonicalThreadPair } from '@/lib/direct-messages'
import { getSocketIO, getSocketIdsForUser, SOCKET_EVENTS } from '@/lib/socket-utils'

type DMSendBody = {
  recipientUserId?: string
  recipientUsername?: string
  message?: string
}

async function handleSendDirectMessage(request: AuthenticatedRequest) {
  try {
    const body = (await request.json()) as DMSendBody
    const recipientUserIdInput = body.recipientUserId?.trim()
    const recipientUsernameInput = body.recipientUsername?.trim()

    if (!recipientUserIdInput && !recipientUsernameInput) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('recipientUserId or recipientUsername is required'),
        { status: 400 }
      )
    }

    if (!rateLimiter.isAllowed(`dm:${request.user.id}`)) {
      return NextResponse.json(
        COMMON_ERRORS.RATE_LIMITED('You are sending direct messages too quickly'),
        { status: 429 }
      )
    }

    const sanitizedMessage = sanitizeChatMessage(body.message || '')
    if (!isValidText(sanitizedMessage, MESSAGE_MAX_LENGTH)) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters`),
        { status: 400 }
      )
    }

    const recipient = recipientUserIdInput
      ? await prisma.user.findUnique({
          where: { id: recipientUserIdInput },
          select: { id: true, username: true, uIcon: true, uIconColor: true },
        })
      : await prisma.user.findUnique({
          where: { username: recipientUsernameInput },
          select: { id: true, username: true, uIcon: true, uIconColor: true },
        })

    if (!recipient) {
      return NextResponse.json(COMMON_ERRORS.NOT_FOUND('Recipient user'), { status: 404 })
    }

    if (recipient.id === request.user.id) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('You cannot send a direct message to yourself'),
        { status: 400 }
      )
    }

    const pair = getCanonicalThreadPair(request.user.id, recipient.id)
    const snippet = buildDirectMessageSnippet(sanitizedMessage)
    const now = new Date()

    const { directMessage } = await prisma.$transaction(async (tx) => {
      const directMessage = await tx.directMessage.create({
        data: {
          senderId: request.user.id,
          recipientId: recipient.id,
          message: sanitizedMessage,
        },
      })

      await tx.directThread.upsert({
        where: {
          userAId_userBId: {
            userAId: pair.userAId,
            userBId: pair.userBId,
          },
        },
        create: {
          userAId: pair.userAId,
          userBId: pair.userBId,
          lastMessageAt: now,
          lastMessageSnippet: snippet,
          userAUnreadCount: pair.senderIsUserA ? 0 : 1,
          userBUnreadCount: pair.senderIsUserA ? 1 : 0,
        },
        update: {
          lastMessageAt: now,
          lastMessageSnippet: snippet,
          userAUnreadCount: pair.senderIsUserA ? undefined : { increment: 1 },
          userBUnreadCount: pair.senderIsUserA ? { increment: 1 } : undefined,
        },
      })

      return { directMessage }
    })

    // Emit to any online recipient sockets. Message persistence succeeds even when no sockets exist.
    try {
      const io = getSocketIO()
      const recipientSocketIds = getSocketIdsForUser(recipient.id)
      if (io && recipientSocketIds.length > 0) {
        const payload = {
          id: directMessage.id,
          senderId: request.user.id,
          senderUsername: request.user.username,
          senderAvatar: {
            uIcon: request.user.uIcon ?? null,
            uIconColor: request.user.uIconColor ?? null,
          },
          recipientId: recipient.id,
          recipientUsername: recipient.username,
          message: directMessage.message,
          createdAt: directMessage.createdAt.toISOString(),
          readAt: directMessage.readAt ? directMessage.readAt.toISOString() : null,
        }

        for (const socketId of recipientSocketIds) {
          io.to(socketId).emit(SOCKET_EVENTS.DIRECT_MESSAGE, payload)
        }
      }
    } catch (socketError) {
      console.error('[DM] Failed to emit direct-message event', socketError)
    }

    return NextResponse.json({
      success: true,
      directMessage: {
        id: directMessage.id,
        senderId: request.user.id,
        senderUsername: request.user.username,
        recipientId: recipient.id,
        recipientUsername: recipient.username,
        message: directMessage.message,
        createdAt: directMessage.createdAt.toISOString(),
        readAt: directMessage.readAt ? directMessage.readAt.toISOString() : null,
      },
    })
  } catch (error) {
    console.error('Direct message send error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to send direct message'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleSendDirectMessage)
