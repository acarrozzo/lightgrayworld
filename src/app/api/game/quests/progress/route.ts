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
      // Backfill intro quest: if player already has any Jack quest, mark intro as completed.
      // If they only have Scorpion Tails done (new flow), start intro as incomplete.
      const existingIntro = await getQuestProgress(user.id, 'quest_jacklumber_intro')
      if (!existingIntro) {
        const anyJackQuest = await getQuestProgress(user.id, 'quest_jacklumber_000')
        try {
          const { randomUUID } = require('crypto')
          await prisma.questProgress.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              questId: 'quest_jacklumber_intro',
              progress: anyJackQuest ? 1 : 0,
              completed: !!anyJackQuest,
            },
          })
        } catch (error) {
          console.error('Failed to backfill quest_jacklumber_intro:', error)
        }
      }
      // Only backfill the 3 Jack quests if the intro quest is completed
      const introProgress = await getQuestProgress(user.id, 'quest_jacklumber_intro')
      if ((introProgress as any)?.completed) {
        const jackQuests = ['quest_jacklumber_000', 'quest_jacklumber_001', 'quest_jacklumber_002']
        for (const questId of jackQuests) {
          const existing = await getQuestProgress(user.id, questId)
          if (!existing) {
            try {
              const { randomUUID } = require('crypto')
              await prisma.questProgress.create({
              data: {
                id: randomUUID(),
                questId,
                progress: 0,
                completed: false,
                userId: user.id,
              },
            })
          } catch (error) {
            console.error(`Failed to backfill ${questId}:`, error)
          }
        }
      }
      }
    }

    // Backfill the Forest Gnome chain for players who opened the Forest Path
    // (finished Jack's Chief's Cloak) before this chain existed. Mirrors the
    // Jack backfill above: the intro comes first, and only once it's completed
    // do its three follow-ups appear.
    const questChiefsCloak = await getQuestProgress(user.id, 'quest_jacklumber_000')
    if ((questChiefsCloak as any)?.completed) {
      const existingGnomeIntro = await getQuestProgress(user.id, 'quest_forestgnome_intro')
      if (!existingGnomeIntro) {
        try {
          const { randomUUID } = require('crypto')
          await prisma.questProgress.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              questId: 'quest_forestgnome_intro',
              progress: 0,
              completed: false,
            },
          })
        } catch (error) {
          console.error('Failed to backfill quest_forestgnome_intro:', error)
        }
      }

      const gnomeIntroProgress = await getQuestProgress(user.id, 'quest_forestgnome_intro')
      if ((gnomeIntroProgress as any)?.completed) {
        const gnomeQuests = ['quest_forestgnome_000', 'quest_forestgnome_001', 'quest_forestgnome_002']
        for (const questId of gnomeQuests) {
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
    }

    // Backfill the Hunter Bill chain for players who opened the Forest Path
    // (finished Jack's Chief's Cloak) before this chain existed. Same shape as
    // the Forest Gnome backfill above — both NPCs unlock on Forest entry.
    if ((questChiefsCloak as any)?.completed) {
      const existingBillIntro = await getQuestProgress(user.id, 'quest_hunterbill_intro')
      if (!existingBillIntro) {
        try {
          const { randomUUID } = require('crypto')
          await prisma.questProgress.create({
            data: {
              id: randomUUID(),
              userId: user.id,
              questId: 'quest_hunterbill_intro',
              progress: 0,
              completed: false,
            },
          })
        } catch (error) {
          console.error('Failed to backfill quest_hunterbill_intro:', error)
        }
      }

      const billIntroProgress = await getQuestProgress(user.id, 'quest_hunterbill_intro')
      if ((billIntroProgress as any)?.completed) {
        const billQuests = ['quest_hunterbill_000', 'quest_hunterbill_001']
        for (const questId of billQuests) {
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


