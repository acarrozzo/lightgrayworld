export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getQuestState, reconcileQuestState } from '@/lib/game-engine/services/quest-service'

/**
 * The player's quest journal: their quest rows and the givers they have met.
 *
 * Reconciling first opens any quest that has become open for a giver the
 * player already met — content added since they passed through, or a
 * dependency that completed through a path that did not open it. It also
 * infers a met giver from any row of that giver's quests, which is what makes
 * accounts from before GiverMet existed read correctly.
 */
async function handleGetProgress(request: AuthenticatedRequest) {
  try {
    const user = request.user
    await reconcileQuestState(user.id)
    const state = await getQuestState(user.id)

    return NextResponse.json({
      success: true,
      quests: state.quests,
      giversMet: state.giversMet,
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
