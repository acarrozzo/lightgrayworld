export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const { getEnemy } = require('@/lib/game-data/enemies') as {
  getEnemy: (slug: string) => { slug: string; name: string } | undefined
}

/** One win against the boss, as the board shows it. */
interface WinRow {
  id: string
  userId: string
  playerLevel: number | null
  playerXp: number | null
  turnsCount: number
  maxSingleHit: number
  multiplayerBonus: boolean
  createdAt: Date
  username: string
  /** The recent list only: the fight's numbers and haul. */
  totalDamageDealt?: number
  totalDamageReceived?: number
  xpEarned?: number
  goldEarned?: number
  itemsDropped?: unknown
}

const RECENT = 20
/** How deep each leaderboard goes (5 Nov 2026: "a way to expand to show the top 5"). */
const TOP = 5

/**
 * The lair board (5 Nov 2026): everyone's recent wins against one boss and
 * its four leaderboards, each five deep, from the same Battle Log rows the
 * bestiary's "First to win" board reads. Nothing new is stored. The ranked
 * boards hold one row per player (their best), so a top five is five players. Any signed-in player
 * may read any boss's board; the usernames on it are the ones presence and
 * the bestiary already show.
 */
async function handleGetBoard(request: AuthenticatedRequest) {
  try {
    const segments = new URL(request.url).pathname.split('/').filter(Boolean)
    const slug = decodeURIComponent(segments[segments.length - 2] ?? '')
    const enemy = getEnemy(slug)
    if (!enemy) return NextResponse.json({ success: false, error: 'No such enemy' }, { status: 404 })
    const userId = request.user.id

    // The recent list carries the whole fight: damage both ways, the XP and
    // gold, what dropped (5 Nov 2026, "more info on the recent fight rows").
    const winRows = (order: Prisma.Sql, limit: number, extra: Prisma.Sql = Prisma.empty) =>
      prisma.$queryRaw<WinRow[]>(Prisma.sql`
        SELECT b.id, b."userId", b."playerLevel", b."playerXp", b."turnsCount", b."maxSingleHit", b."multiplayerBonus", b."createdAt", u.username,
               b."totalDamageDealt", b."totalDamageReceived", b."xpEarned", b."goldEarned", b."itemsDropped"
        FROM "BattleLog" b
        JOIN "User" u ON u.id = b."userId"
        WHERE b."enemySlug" = ${slug} AND b.outcome = 'WIN' ${extra}
        ORDER BY ${order}
        LIMIT ${limit}`)

    // A ranked board: each player's best win by `order`, then the top `limit`
    // of those, so one player cannot fill the board. `order` takes the table
    // alias because both the log and the user row carry a "createdAt".
    const bestRows = (order: (t: Prisma.Sql) => Prisma.Sql, limit: number, extra: Prisma.Sql = Prisma.empty) =>
      prisma.$queryRaw<WinRow[]>(Prisma.sql`
        SELECT best.*, u.username FROM (
          SELECT DISTINCT ON (b."userId")
            b.id, b."userId", b."playerLevel", b."playerXp", b."turnsCount", b."maxSingleHit", b."multiplayerBonus", b."createdAt"
          FROM "BattleLog" b
          WHERE b."enemySlug" = ${slug} AND b.outcome = 'WIN' ${extra}
          ORDER BY b."userId", ${order(Prisma.raw('b'))}
        ) best
        JOIN "User" u ON u.id = best."userId"
        ORDER BY ${order(Prisma.raw('best'))}
        LIMIT ${limit}`)

    const [recent, lowest, fastest, hardest, mostKills, totals, yours, yourBestLevel, yourBestTurns] = await Promise.all([
      winRows(Prisma.sql`b."createdAt" DESC`, RECENT),
      bestRows((t) => Prisma.sql`${t}."playerLevel" ASC, ${t}."playerXp" ASC NULLS LAST, ${t}."turnsCount" ASC, ${t}."createdAt" ASC`, TOP, Prisma.sql`AND b."playerLevel" IS NOT NULL`),
      bestRows((t) => Prisma.sql`${t}."turnsCount" ASC, ${t}."createdAt" ASC`, TOP, Prisma.sql`AND b."turnsCount" > 0`),
      bestRows((t) => Prisma.sql`${t}."maxSingleHit" DESC, ${t}."createdAt" ASC`, TOP, Prisma.sql`AND b."maxSingleHit" > 0`),
      prisma.killList.findMany({
        where: { monster: slug, kills: { gte: 1 } },
        orderBy: [{ kills: 'desc' }, { id: 'asc' }],
        take: TOP,
        select: { userId: true, kills: true, user: { select: { username: true } } },
      }),
      prisma.killList.aggregate({ where: { monster: slug, kills: { gte: 1 } }, _sum: { kills: true }, _count: { _all: true } }),
      prisma.killList.findUnique({ where: { userId_monster: { userId, monster: slug } }, select: { kills: true } }),
      prisma.battleLog.findFirst({
        where: { userId, enemySlug: slug, outcome: 'WIN', playerLevel: { not: null } },
        orderBy: [{ playerLevel: 'asc' }, { playerXp: 'asc' }, { turnsCount: 'asc' }, { createdAt: 'asc' }],
        select: { playerLevel: true, playerXp: true, turnsCount: true, createdAt: true },
      }),
      prisma.battleLog.findFirst({
        where: { userId, enemySlug: slug, outcome: 'WIN', turnsCount: { gt: 0 } },
        orderBy: [{ turnsCount: 'asc' }, { createdAt: 'asc' }],
        select: { turnsCount: true, createdAt: true },
      }),
    ])

    // Your place on the two ranked boards: one row per player (their best),
    // so a rank is "how many players beat your best", plus one.
    const [betterByLevel, betterByTurns] = await Promise.all([
      yourBestLevel
        ? prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS n FROM (
              SELECT DISTINCT ON ("userId") "userId", "playerLevel", "playerXp", "turnsCount", "createdAt"
              FROM "BattleLog"
              WHERE "enemySlug" = ${slug} AND outcome = 'WIN' AND "playerLevel" IS NOT NULL AND "userId" <> ${userId}
              ORDER BY "userId", "playerLevel" ASC, "playerXp" ASC NULLS LAST, "turnsCount" ASC, "createdAt" ASC
            ) best
            WHERE ("playerLevel", COALESCE("playerXp", 2147483647), "turnsCount", "createdAt")
                < (${yourBestLevel.playerLevel}, ${yourBestLevel.playerXp ?? 2147483647}, ${yourBestLevel.turnsCount}, ${yourBestLevel.createdAt})`)
        : Promise.resolve([{ n: BigInt(-1) }]),
      yourBestTurns
        ? prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS n FROM (
              SELECT DISTINCT ON ("userId") "userId", "turnsCount", "createdAt"
              FROM "BattleLog"
              WHERE "enemySlug" = ${slug} AND outcome = 'WIN' AND "turnsCount" > 0 AND "userId" <> ${userId}
              ORDER BY "userId", "turnsCount" ASC, "createdAt" ASC
            ) best
            WHERE ("turnsCount", "createdAt") < (${yourBestTurns.turnsCount}, ${yourBestTurns.createdAt})`)
        : Promise.resolve([{ n: BigInt(-1) }]),
    ])

    const row = (r: WinRow | undefined) =>
      r
        ? {
            id: r.id,
            playerId: r.userId,
            username: r.username,
            level: r.playerLevel,
            xp: r.playerXp,
            turns: r.turnsCount,
            maxHit: r.maxSingleHit,
            party: r.multiplayerBonus,
            at: r.createdAt,
            isYou: r.userId === userId,
          }
        : null
    const fight = (r: WinRow) => ({
      ...row(r)!,
      dealt: r.totalDamageDealt ?? 0,
      taken: r.totalDamageReceived ?? 0,
      xpEarned: r.xpEarned ?? 0,
      goldEarned: r.goldEarned ?? 0,
      // The win handler stores names ("Raw Meat x2"), one per template.
      drops: Array.isArray(r.itemsDropped) ? r.itemsDropped.filter((d): d is string => typeof d === 'string') : [],
    })

    return NextResponse.json({
      success: true,
      enemy: { slug: enemy.slug, name: enemy.name },
      totals: { kills: totals._sum.kills ?? 0, players: totals._count._all },
      recent: recent.map((r) => fight(r)),
      boards: {
        firstToWin: lowest.map((r) => row(r)),
        fewestTurns: fastest.map((r) => row(r)),
        biggestHit: hardest.map((r) => row(r)),
        mostKills: mostKills.map((k) => ({ playerId: k.userId, username: k.user.username, kills: k.kills, isYou: k.userId === userId })),
      },
      yours: yours
        ? {
            kills: yours.kills,
            rankByLevel: Number(betterByLevel[0]?.n ?? -1) >= 0 ? Number(betterByLevel[0].n) + 1 : null,
            rankByTurns: Number(betterByTurns[0]?.n ?? -1) >= 0 ? Number(betterByTurns[0].n) + 1 : null,
          }
        : null,
    })
  } catch (error) {
    console.error('Get lair board error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get the board' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetBoard)
