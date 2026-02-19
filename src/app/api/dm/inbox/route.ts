export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

async function handleGetDirectInbox(request: AuthenticatedRequest) {
  try {
    const userId = request.user.id

    const threads = await prisma.directThread.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      include: {
        userA: {
          select: { id: true, username: true, level: true, uIcon: true, uIconColor: true },
        },
        userB: {
          select: { id: true, username: true, level: true, uIcon: true, uIconColor: true },
        },
      },
    })

    const inboxThreads = threads.map((thread) => {
      const isUserA = thread.userAId === userId
      const otherUser = isUserA ? thread.userB : thread.userA
      return {
        threadId: thread.id,
        otherUser: {
          id: otherUser.id,
          username: otherUser.username,
          level: otherUser.level,
          uIcon: otherUser.uIcon,
          uIconColor: otherUser.uIconColor,
        },
        lastMessageSnippet: thread.lastMessageSnippet,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        unreadCount: isUserA ? thread.userAUnreadCount : thread.userBUnreadCount,
      }
    })

    return NextResponse.json({
      success: true,
      threads: inboxThreads,
    })
  } catch (error) {
    console.error('DM inbox fetch error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load direct message inbox'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetDirectInbox)
