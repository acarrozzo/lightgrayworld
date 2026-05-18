export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { prisma } from '@/lib/prisma'

async function handleResetQuests(request: AuthenticatedRequest) {
  try {
    const user = request.user
    const { randomUUID } = require('crypto')

    // Delete all quest progress for the user
    await prisma.questProgress.deleteMany({
      where: {
        userId: user.id,
      },
    })

    // Create quest_oldman_000 as active (not completed, progress 0)
    await prisma.questProgress.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        questId: 'quest_oldman_000',
        progress: 0,
        completed: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Quests reset to initial state',
    })
  } catch (error) {
    console.error('Reset quests error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to reset quests'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleResetQuests)

