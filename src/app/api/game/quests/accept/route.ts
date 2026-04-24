export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { acceptQuest } from '@/lib/game-engine/services/quest-service'

async function handleAcceptQuest(request: AuthenticatedRequest) {
  try {
    const { questId } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ questId }, ['questId'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Quest ID is required'),
        { status: 400 }
      )
    }

    const user = request.user
    const result = await acceptQuest(user.id, questId) as { success: boolean; error?: string; questProgress?: any }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to accept quest' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      quest: result.questProgress,
    })
  } catch (error) {
    console.error('Accept quest error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to accept quest'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleAcceptQuest)


