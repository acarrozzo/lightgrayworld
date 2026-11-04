export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

/**
 * The player's Kill List, and the marks beside it.
 *
 * `kills` is the KillList table as it stands: one row per enemy slug ever
 * felled, with the count. `marks` is what the Battle Log adds for the enemies
 * that got away or won: how many times each one killed the player (LOSS rows)
 * and how many fights with it were broken off (FLED rows). The Kill List tab
 * draws an enemy with neither as unknown, with marks but no kills as met, and
 * says "killed you ×N" on the row.
 */
async function handleGetKillList(request: AuthenticatedRequest) {
  try {
    const [kills, outcomes] = await Promise.all([
      prisma.killList.findMany({
        where: { userId: request.user.id },
        orderBy: { kills: 'desc' },
        select: { id: true, monster: true, kills: true },
      }),
      prisma.battleLog.groupBy({
        by: ['enemySlug', 'outcome'],
        where: { userId: request.user.id, outcome: { in: ['LOSS', 'FLED'] } },
        _count: { _all: true },
      }),
    ])
    const marksBySlug = new Map<string, { enemySlug: string; losses: number; fled: number }>()
    for (const row of outcomes) {
      const mark = marksBySlug.get(row.enemySlug) ?? { enemySlug: row.enemySlug, losses: 0, fled: 0 }
      if (row.outcome === 'LOSS') mark.losses += row._count._all
      else mark.fled += row._count._all
      marksBySlug.set(row.enemySlug, mark)
    }
    return NextResponse.json({ success: true, kills, marks: [...marksBySlug.values()] })
  } catch (error) {
    console.error('Get kill list error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get kill list' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetKillList)
