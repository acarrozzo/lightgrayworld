export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getCurrentUser } from '@/lib/auth'
import { createWorldFeedEvent } from '@/lib/services/world-feed-event-service'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(COMMON_ERRORS.AUTHENTICATION_ERROR('Not authenticated'), { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: false,
        lastActive: new Date(),
      },
    })

    try {
      await createWorldFeedEvent({
        userId: user.id,
        username: user.username,
        eventType: 'logout',
      })
    } catch (error) {
      console.error('Failed to record logout world feed event', error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(COMMON_ERRORS.INTERNAL_ERROR('Logout failed'), { status: 500 })
  }
}

