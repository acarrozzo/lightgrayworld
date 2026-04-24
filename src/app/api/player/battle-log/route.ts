export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

async function handleGetBattleLog(request: AuthenticatedRequest) {
  try {
    const logs = await prisma.battleLog.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        enemySlug: true,
        enemyName: true,
        outcome: true,
        turnsCount: true,
        totalDamageDealt: true,
        totalDamageReceived: true,
        maxSingleHit: true,
        xpEarned: true,
        goldEarned: true,
        itemsDropped: true,
        multiplayerBonus: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ success: true, logs })
  } catch (error) {
    console.error('Get battle log error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get battle log' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetBattleLog)
