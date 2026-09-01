export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { prisma } from '@/lib/prisma'

async function handleResetQuests(request: AuthenticatedRequest) {
  try {
    // Development fixture only. Both modes clear the gold-chest flags, and
    // skip-to-chest also grants a Gold Key — so in production this is an
    // unbounded faucet: reset, re-open the chest for gold/XP/items, repeat.
    // Authentication alone is not a gate here; every player holds a token.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(COMMON_ERRORS.NOT_FOUND('Route'), { status: 404 })
    }

    const user = request.user
    const { randomUUID } = require('crypto')
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')

    if (mode === 'skip-to-chest') {
      // Complete all Old Man and Young Soldier quests, start Jack intro quest
      await prisma.questProgress.deleteMany({
        where: { userId: user.id },
      })

      // Reset the gold-chest opened flags
      await prisma.user.update({
        where: { id: user.id },
        data: { chest1: false, chest2: false },
      })

      const completedQuests = [
        'quest_oldman_000', 'quest_oldman_001', 'quest_oldman_002',
        'quest_oldman_003', 'quest_oldman_004',
        'quest_youngsoldier_000', 'quest_youngsoldier_001',
        'quest_youngsoldier_002', 'quest_youngsoldier_003',
      ]

      for (const questId of completedQuests) {
        await prisma.questProgress.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            questId,
            progress: 1,
            completed: true,
          },
        })
      }

      // Start Jack's intro quest (not completed)
      await prisma.questProgress.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          questId: 'quest_jacklumber_intro',
          progress: 0,
          completed: false,
        },
      })

      // Grant a Gold Key so the player can open the chest
      const goldKeyTemplate = await prisma.itemTemplate.findFirst({
        where: { slug: 'gold-key' },
      })
      if (goldKeyTemplate) {
        // Remove any existing gold keys first, then grant one
        await prisma.playerItem.deleteMany({
          where: { playerId: user.id, templateId: goldKeyTemplate.id },
        })
        await prisma.playerItem.create({
          data: {
            id: randomUUID(),
            playerId: user.id,
            templateId: goldKeyTemplate.id,
            quantity: 1,
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Quests set to chest/Jack testing state',
      })
    }

    // Default: full reset
    await prisma.questProgress.deleteMany({
      where: { userId: user.id },
    })

    // Reset the gold-chest opened flags
    await prisma.user.update({
      where: { id: user.id },
      data: { chest1: false, chest2: false },
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

