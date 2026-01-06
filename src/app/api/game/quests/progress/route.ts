export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getAllQuestProgress, getQuestProgress } from '@/lib/game-engine/services/quest-service'
import { prisma } from '@/lib/prisma'

async function handleGetProgress(request: AuthenticatedRequest) {
  try {
    const user = request.user
    
    // Lazy-ensure quest_001 exists for existing users
    const quest001 = await getQuestProgress(user.id, 'quest_001')
    if (!quest001) {
      try {
        const { randomUUID } = require('crypto')
        
        // Check if downstream quests exist (quest_002, quest_003, or quest_004)
        const quest002 = await getQuestProgress(user.id, 'quest_002')
        const quest003 = await getQuestProgress(user.id, 'quest_003')
        const quest004 = await getQuestProgress(user.id, 'quest_004')
        
        // If any downstream quest exists, create quest_001 as completed (prevents stuck state)
        // Otherwise, create it as active (for new users)
        const shouldComplete = !!(quest002 || quest003 || quest004)
        
        await prisma.questProgress.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            questId: 'quest_001',
            progress: shouldComplete ? 1 : 0,
            completed: shouldComplete,
          },
        })
      } catch (error) {
        console.error('Failed to lazy-ensure quest_001:', error)
        // Continue even if creation fails
      }
    }
    
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


