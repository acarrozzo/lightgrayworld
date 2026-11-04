export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

const { BOSSES } = require('@/lib/game-data/bosses.generated') as { BOSSES: { slug: string }[] }
const BOSS_SLUGS = BOSSES.map((boss) => boss.slug)

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const OUTCOMES = new Set(['WIN', 'LOSS', 'FLED'])

/**
 * The orders the Battle Log can be read in. Each ends on the id so a page
 * cursor is unambiguous when two fights share a number. `newest` is the
 * default and what the Char page's Recent fights reads.
 */
const SORTS: Record<string, Prisma.BattleLogOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  'hit-desc': [{ maxSingleHit: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'hit-asc': [{ maxSingleHit: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'turns-desc': [{ turnsCount: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'turns-asc': [{ turnsCount: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'dealt-desc': [{ totalDamageDealt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'dealt-asc': [{ totalDamageDealt: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'took-desc': [{ totalDamageReceived: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'took-asc': [{ totalDamageReceived: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'xp-desc': [{ xpEarned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  'gold-desc': [{ goldEarned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
}

/** The summary columns: everything but the ledger, which is paged in by `?id=`. */
const SUMMARY_SELECT = {
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
  /// The player as the fight began and the HP it left them with — the fight row's bar. Null before the snapshot.
  snapshot: true,
  createdAt: true,
} as const

/**
 * The player's own Battle Log.
 *
 * Two reads, one route, both owner-scoped:
 * - `GET /api/player/battle-log?limit=&cursor=` pages the summaries newest
 *   first (`nextCursor` is the last row's id; pass it back for the next
 *   page, null when there is no more). The ledger is left out of the list,
 *   since a long fight's rows are most of a record's weight. The list takes
 *   the Battle Log tab's filters, so a page is of the filtered list:
 *   `outcome=WIN|LOSS|FLED`, `q=` (part of the enemy's name), `bosses=1`
 *   (ranked enemies only), `enemy=` (one slug), and `sort=` (one of SORTS:
 *   newest by default, or by biggest or smallest hit, most or fewest turns,
 *   damage dealt or taken either way, XP or gold earned).
 * - `GET /api/player/battle-log?id=` returns one record with its `turns`.
 */
async function handleGetBattleLog(request: AuthenticatedRequest) {
  try {
    const params = request.nextUrl.searchParams
    const id = params.get('id')
    if (id) {
      const log = await prisma.battleLog.findFirst({
        where: { id, userId: request.user.id },
        select: { ...SUMMARY_SELECT, turns: true },
      })
      if (!log) {
        return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, log })
    }

    const requested = Number.parseInt(params.get('limit') ?? '', 10)
    const limit = Number.isFinite(requested) ? Math.min(MAX_LIMIT, Math.max(1, requested)) : DEFAULT_LIMIT
    const cursor = params.get('cursor')
    const outcome = params.get('outcome')
    const q = params.get('q')?.trim() ?? ''
    const enemy = params.get('enemy')?.trim() ?? ''
    const where: Prisma.BattleLogWhereInput = { userId: request.user.id }
    if (outcome && OUTCOMES.has(outcome)) where.outcome = outcome
    if (q) where.enemyName = { contains: q.slice(0, 40), mode: 'insensitive' }
    if (enemy) where.enemySlug = enemy.slice(0, 64)
    else if (params.get('bosses') === '1') where.enemySlug = { in: BOSS_SLUGS }
    const orderBy = SORTS[params.get('sort') ?? 'newest'] ?? SORTS.newest
    const rows = await prisma.battleLog.findMany({
      where,
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: SUMMARY_SELECT,
    })
    const logs = rows.slice(0, limit)
    const nextCursor = rows.length > limit && logs.length > 0 ? logs[logs.length - 1].id : null
    return NextResponse.json({ success: true, logs, nextCursor })
  } catch (error) {
    console.error('Get battle log error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get battle log' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetBattleLog)
