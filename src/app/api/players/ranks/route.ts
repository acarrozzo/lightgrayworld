export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
const { earnedTitles, getQuestDef } = require('@/lib/game-data/quest-registry') as {
  earnedTitles: (rows: { questId: string; completed: boolean }[]) => string[]
  getQuestDef: (questId: string) => unknown
}

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
  /** Faction titles earned: one per faction at max standing. */
  titles: string[]
  chestsOpened: number
  clicks: number
  uIcon: string | null
  uIconColor: string | null
  lastActive: string
}

async function handleGetRanks() {
  try {
    const [users, killAgg, completedRows] = await Promise.all([
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
      prisma.questProgress.findMany({
        where: { completed: true },
        select: { userId: true, questId: true, completed: true },
      }),
    ])

    // Only quests that exist count: rows from retired ids (the old intro
    // quests) stay in the table but are not achievements.
    const completedByUser = new Map<string, { questId: string; completed: boolean }[]>()
    for (const row of completedRows) {
      if (!getQuestDef(row.questId)) continue
      const list = completedByUser.get(row.userId) ?? []
      list.push(row)
      completedByUser.set(row.userId, list)
    }

    const killsByUser = new Map(killAgg.map((k) => [k.userId, k._sum.kills ?? 0]))

    const rows: RankRow[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      level: u.level,
      xp: u.xp,
      kills: killsByUser.get(u.id) ?? 0,
      deaths: u.deaths,
      completedQuests: (completedByUser.get(u.id) ?? []).length,
      titles: earnedTitles(completedByUser.get(u.id) ?? []),
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
