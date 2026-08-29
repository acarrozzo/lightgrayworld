export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

/**
 * Standings for the Players tab's Ranks board.
 *
 * The aggregates are the same ones the world-tool /players page computes, so the
 * in-game board and the world tool cannot report different totals for the same
 * player. Read-only and derived entirely from durable rows.
 */

export interface RankRow {
  id: string
  username: string
  level: number
  xp: number
  kills: number
  deaths: number
  completedQuests: number
  chestsOpened: number
  clicks: number
  uIcon: string | null
  uIconColor: string | null
  lastActive: string
}

async function handleGetRanks() {
  try {
    const [users, killAgg, questAgg] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          level: true,
          xp: true,
          deaths: true,
          clicks: true,
          uIcon: true,
          uIconColor: true,
          lastActive: true,
          chest1: true, chest2: true, chest3: true, chest4: true, chest5: true,
          chest6: true, chest7: true, chest8: true, chest9: true, chest10: true,
        },
      }),
      prisma.killList.groupBy({ by: ['userId'], _sum: { kills: true } }),
      prisma.questProgress.groupBy({
        by: ['userId'],
        where: { completed: true },
        _count: { _all: true },
      }),
    ])

    const killsByUser = new Map(killAgg.map((k) => [k.userId, k._sum.kills ?? 0]))
    const questsByUser = new Map(questAgg.map((q) => [q.userId, q._count._all]))

    const rows: RankRow[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      level: u.level,
      xp: u.xp,
      kills: killsByUser.get(u.id) ?? 0,
      deaths: u.deaths,
      completedQuests: questsByUser.get(u.id) ?? 0,
      chestsOpened: [
        u.chest1, u.chest2, u.chest3, u.chest4, u.chest5,
        u.chest6, u.chest7, u.chest8, u.chest9, u.chest10,
      ].filter(Boolean).length,
      clicks: u.clicks,
      uIcon: u.uIcon,
      uIconColor: u.uIconColor,
      lastActive: u.lastActive.toISOString(),
    }))

    // Default order is the headline one: level, then XP as the tiebreak.
    rows.sort((a, b) => b.level - a.level || b.xp - a.xp)

    return NextResponse.json({ success: true, ranks: rows })
  } catch (error) {
    console.error('Get player ranks error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to load player ranks'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetRanks)
