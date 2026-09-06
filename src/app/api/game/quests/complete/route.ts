export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { completeQuest } from '@/lib/game-engine/services/quest-service'

async function handleCompleteQuest(request: AuthenticatedRequest) {
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
    const result = await completeQuest(user.id, questId) as { success: boolean; error?: string; player?: any; inventory?: any; quests?: any; giversMet?: string[]; levelUp?: any; standing?: any }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    if (result.levelUp?.leveled) {
      const engine = (globalThis as any).gameEngine
      engine?.emitToPlayer(user.id, 'player:level-up', result.levelUp)
    }

    return NextResponse.json({
      success: true,
      player: result.player,
      inventory: result.inventory,
      quests: result.quests,
      giversMet: result.giversMet,
      standing: result.standing,
    })
  } catch (error) {
    console.error('Complete quest error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to complete quest'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleCompleteQuest)


