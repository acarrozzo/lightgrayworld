export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { getAllQuestProgress, getQuestProgress } from '@/lib/game-engine/services/quest-service'
import { prisma } from '@/lib/prisma'

async function handleGetProgress(request: AuthenticatedRequest) {
  try {
    const user = request.user
    
    // Lazy-ensure quest_oldman_000 exists for existing users
    const questOldman000 = await getQuestProgress(user.id, 'quest_oldman_000')
    if (!questOldman000) {
      try {
        const { randomUUID } = require('crypto')

        // Check if downstream quests exist (quest_oldman_001, quest_youngsoldier_000, or quest_youngsoldier_001)
        const questOldman001 = await getQuestProgress(user.id, 'quest_oldman_001')
        const questYoungsoldier000 = await getQuestProgress(user.id, 'quest_youngsoldier_000')
        const questYoungsoldier001 = await getQuestProgress(user.id, 'quest_youngsoldier_001')

        // If any downstream quest exists, create quest_oldman_000 as completed (prevents stuck state)
        // Otherwise, create it as active (for new users)
        const shouldComplete = !!(questOldman001 || questYoungsoldier000 || questYoungsoldier001)

        await prisma.questProgress.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            questId: 'quest_oldman_000',
            progress: shouldComplete ? 1 : 0,
            completed: shouldComplete,
          },
        })
      } catch (error) {
        console.error('Failed to lazy-ensure quest_oldman_000:', error)
        // Continue even if creation fails
      }
    }

    // Backfill quest_oldman_004 for players who completed quest_oldman_002 before quest_oldman_004 was added
    const questOldman004 = await getQuestProgress(user.id, 'quest_oldman_004')
    if (!questOldman004) {
      try {
        const questOldman002 = await getQuestProgress(user.id, 'quest_oldman_002')
        if ((questOldman002 as any)?.completed) {
          const { randomUUID } = require('crypto')
          await prisma.questProgress.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              questId: 'quest_oldman_004',
              progress: 0,
              completed: false,
              data: undefined,
            },
          })
        }
      } catch (error) {
        console.error('Failed to backfill quest_oldman_004:', error)
      }
    }

    // Backfill Jack Lumber quests for players who completed Scorpion Tails before the Jack quest chain was added
    const questScorpionTails = await getQuestProgress(user.id, 'quest_youngsoldier_002')
    if ((questScorpionTails as any)?.completed) {
      const jackQuests = ['quest_jacklumber_000', 'quest_jacklumber_001', 'quest_jacklumber_002']
      for (const questId of jackQuests) {
        const existing = await getQuestProgress(user.id, questId)
        if (!existing) {
          try {
            const { randomUUID } = require('crypto')
            await prisma.questProgress.create({
              data: {
                id: randomUUID(),
                userId: user.id,
                questId,
                progress: 0,
                completed: false,
              },
            })
          } catch (error) {
            console.error(`Failed to backfill ${questId}:`, error)
          }
        }
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


