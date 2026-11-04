export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const { getEnemy } = require('@/lib/game-data/enemies') as { getEnemy: (slug: string) => RegistryEnemy | undefined }
const { getEnemyTraits } = require('@/lib/game-data/enemy-traits') as {
  getEnemyTraits: (enemy: RegistryEnemy) => { id: string; label: string }[]
}

type DropEntry = string | { itemSlug: string; qty?: number; min?: number; max?: number; chance?: number }
interface RegistryEnemy {
  slug: string
  name: string
  description?: string
  level: number
  drops?: { main?: DropEntry[]; always?: DropEntry[]; firstKill?: string[] }
  [key: string]: unknown
}

/** The kill counts a tier ladder marks, as the original's achievements did by feel. */
const TIERS = [1, 10, 100, 1000]

/** The board's rows: one per player, their lowest-level win, ranked. */
interface FellRow {
  id: string
  userId: string
  playerLevel: number
  playerXp: number | null
  turnsCount: number
  createdAt: Date
  username: string
  uIcon: string | null
  uIconColor: string | null
}

function dropSlug(entry: DropEntry): string {
  return typeof entry === 'string' ? entry : entry.itemSlug
}

function qtyLabel(entry: DropEntry): string {
  if (typeof entry === 'string') return ''
  if (typeof entry.qty === 'number' && entry.qty > 1) return ` ×${entry.qty}`
  if (typeof entry.min === 'number' && typeof entry.max === 'number') return entry.min === entry.max ? (entry.min > 1 ? ` ×${entry.min}` : '') : ` ×${entry.min}–${entry.max}`
  return ''
}

/**
 * The bestiary card's record for one enemy, for the player asking.
 *
 * Only an enemy the player has felled has a card: an unkilled one's drops
 * and prose stay in the dark, as the gray name on the Kill List is. The
 * record is read from the Battle Log (first kill, fastest win, biggest hit,
 * deaths to it, the dates the kill tiers were reached) and the KillList row
 * (the count); the drops are the registry's, each marked whether this
 * character has ever held the item (PlayerItemSeen). "First to fell" is the
 * one board here: each player's lowest-level win over this enemy, ranked by
 * level, then XP, then turns, then date. Rows older than the snapshot
 * columns sit it out.
 */
async function handleGetRecord(request: AuthenticatedRequest) {
  try {
    // /api/enemies/<slug>/record — the slug is the segment before the last.
    const segments = new URL(request.url).pathname.split('/').filter(Boolean)
    const slug = decodeURIComponent(segments[segments.length - 2] ?? '')
    const enemy = getEnemy(slug)
    if (!enemy) return NextResponse.json({ success: false, error: 'No such enemy' }, { status: 404 })
    const userId = request.user.id

    const killRow = await prisma.killList.findUnique({ where: { userId_monster: { userId, monster: slug } }, select: { kills: true } })
    if (!killRow || killRow.kills < 1) {
      return NextResponse.json({ success: false, error: 'Not yet felled' }, { status: 404 })
    }

    const drops = enemy.drops ?? {}
    const dropList = [
      ...(drops.always ?? []).map((entry) => ({ slug: dropSlug(entry), qty: qtyLabel(entry), chance: 'always' as const })),
      ...(drops.main ?? []).map((entry) => ({
        slug: dropSlug(entry),
        qty: qtyLabel(entry),
        chance: typeof entry === 'string' ? '' : `${Math.round((entry.chance ?? 0) * 100)}%`,
      })),
      ...(drops.firstKill ?? []).map((itemSlug) => ({ slug: itemSlug, qty: '', chance: 'first kill' as const })),
    ]
    const dropSlugs = [...new Set(dropList.map((d) => d.slug))]

    const [wins, losses, fled, hits, firstWin, fastest, templates, seen, board, yours] = await Promise.all([
      prisma.battleLog.count({ where: { userId, enemySlug: slug, outcome: 'WIN' } }),
      prisma.battleLog.count({ where: { userId, enemySlug: slug, outcome: 'LOSS' } }),
      prisma.battleLog.count({ where: { userId, enemySlug: slug, outcome: 'FLED' } }),
      prisma.battleLog.aggregate({ where: { userId, enemySlug: slug }, _max: { maxSingleHit: true } }),
      prisma.battleLog.findFirst({
        where: { userId, enemySlug: slug, outcome: 'WIN' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { createdAt: true, playerLevel: true },
      }),
      prisma.battleLog.findFirst({
        where: { userId, enemySlug: slug, outcome: 'WIN', turnsCount: { gt: 0 } },
        orderBy: [{ turnsCount: 'asc' }, { createdAt: 'asc' }],
        select: { turnsCount: true },
      }),
      dropSlugs.length > 0
        ? prisma.itemTemplate.findMany({ where: { slug: { in: dropSlugs } }, select: { slug: true, name: true, metadata: true } })
        : Promise.resolve([]),
      dropSlugs.length > 0
        ? prisma.playerItemSeen.findMany({ where: { userId, slug: { in: dropSlugs } }, select: { slug: true } })
        : Promise.resolve([]),
      prisma.$queryRaw<FellRow[]>(Prisma.sql`
        SELECT b.id, b."userId", b."playerLevel", b."playerXp", b."turnsCount", b."createdAt",
               u.username, u."uIcon", u."uIconColor"
        FROM (
          SELECT DISTINCT ON ("userId") id, "userId", "playerLevel", "playerXp", "turnsCount", "createdAt"
          FROM "BattleLog"
          WHERE "enemySlug" = ${slug} AND outcome = 'WIN' AND "playerLevel" IS NOT NULL
          ORDER BY "userId", "playerLevel" ASC, "playerXp" ASC NULLS LAST, "turnsCount" ASC, "createdAt" ASC
        ) b
        JOIN "User" u ON u.id = b."userId"
        ORDER BY b."playerLevel" ASC, b."playerXp" ASC NULLS LAST, b."turnsCount" ASC, b."createdAt" ASC
        LIMIT 5`),
      prisma.battleLog.findFirst({
        where: { userId, enemySlug: slug, outcome: 'WIN', playerLevel: { not: null } },
        orderBy: [{ playerLevel: 'asc' }, { playerXp: 'asc' }, { turnsCount: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, playerLevel: true, playerXp: true, turnsCount: true, createdAt: true },
      }),
    ])

    // The date each tier was reached: the nth win's row, for the tiers the
    // count has passed. The KillList count is the kill count; the Battle Log
    // is only asked for the dates it has.
    const tierDates = await Promise.all(
      TIERS.map(async (n) => {
        if (killRow.kills < n || wins < n) return null
        const row = await prisma.battleLog.findFirst({
          where: { userId, enemySlug: slug, outcome: 'WIN' },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: n - 1,
          select: { createdAt: true },
        })
        return row?.createdAt ?? null
      })
    )

    const nameBySlug = new Map(templates.map((t) => [t.slug, t]))
    const had = new Set(seen.map((s) => s.slug))

    return NextResponse.json({
      success: true,
      enemy: {
        slug: enemy.slug,
        description: enemy.description ?? '',
        traits: getEnemyTraits(enemy).map((t) => t.label),
        drops: dropList.map((d) => {
          const template = nameBySlug.get(d.slug)
          const icon = (template?.metadata as { icon?: string } | null)?.icon ?? null
          return { slug: d.slug, name: template?.name ?? d.slug, icon, qty: d.qty, chance: d.chance, had: had.has(d.slug) }
        }),
      },
      record: {
        kills: killRow.kills,
        firstKillAt: firstWin?.createdAt ?? null,
        firstKillLevel: firstWin?.playerLevel ?? null,
        fastestWin: fastest?.turnsCount ?? null,
        biggestHit: hits._max.maxSingleHit ?? 0,
        killedYou: losses,
        fled,
        tiers: TIERS.map((n, i) => ({ at: n, reachedAt: tierDates[i] })),
      },
      firstToFell: board.map((row) => ({
        id: row.id,
        playerId: row.userId,
        username: row.username,
        uIcon: row.uIcon,
        uIconColor: row.uIconColor,
        level: row.playerLevel,
        xp: row.playerXp,
        turns: row.turnsCount,
        at: row.createdAt,
        isYou: row.userId === userId,
      })),
      yours: yours
        ? { id: yours.id, level: yours.playerLevel, xp: yours.playerXp, turns: yours.turnsCount, at: yours.createdAt }
        : null,
    })
  } catch (error) {
    console.error('Get enemy record error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get the record' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetRecord)
