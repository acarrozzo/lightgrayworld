export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
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

    // Both modes start from nothing: no quests, nobody met, chests unopened.
    await prisma.questProgress.deleteMany({ where: { userId: user.id } })
    await prisma.giverMet.deleteMany({ where: { userId: user.id } })
    await prisma.user.update({
      where: { id: user.id },
      data: { chest1: false, chest2: false },
    })

    if (mode === 'skip-to-chest') {
      // The Old Man and the Young Soldier met and finished with; Jack Lumber
      // is revealed by the Scorpion Tails quest and waits behind the chest.
      await prisma.giverMet.createMany({
        data: ['old_man', 'young_soldier'].map((giverId) => ({ id: randomUUID(), userId: user.id, giverId })),
      })

      const completedQuests = [
        'quest_oldman_001', 'quest_oldman_002', 'quest_oldman_003', 'quest_oldman_004',
        'quest_youngsoldier_001', 'quest_youngsoldier_002', 'quest_youngsoldier_003',
      ]
      await prisma.questProgress.createMany({
        data: completedQuests.map((questId) => ({
          id: randomUUID(),
          userId: user.id,
          questId,
          progress: 1,
          completed: true,
        })),
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
