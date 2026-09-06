export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { playerAcceptQuest } from '@/lib/game-engine/services/quest-service'

async function handleAcceptQuest(request: AuthenticatedRequest) {
  try {
    const { questId } = await request.json()

    const validation = validateRequiredFields({ questId }, ['questId'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Quest ID is required'),
        { status: 400 }
      )
    }

    const user = request.user
    const result = await playerAcceptQuest(user.id, questId) as {
      success: boolean
      error?: string
      quests?: any[]
      giversMet?: string[]
      player?: any
      inventory?: any
      levelUp?: any
      startedQuestIds?: string[]
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to accept quest' },
        { status: 400 }
      )
    }

    if (result.levelUp?.leveled) {
      const engine = (globalThis as any).gameEngine
      engine?.emitToPlayer(user.id, 'player:level-up', result.levelUp)
    }

    return NextResponse.json({
      success: true,
      quests: result.quests,
      giversMet: result.giversMet,
      player: result.player,
      inventory: result.inventory,
      startedQuestIds: result.startedQuestIds,
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
