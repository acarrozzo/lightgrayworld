export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getAllQuestProgress } from '@/lib/game-engine/services/quest-service'

async function handleGetProgress(request: AuthenticatedRequest) {
  try {
    const user = request.user
    const quests = await getAllQuestProgress(user.id)

    return NextResponse.json({
      success: true,
      quests,
    })
  } catch (error) {
    console.error('Get quest progress error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to get quest progress'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetProgress)


