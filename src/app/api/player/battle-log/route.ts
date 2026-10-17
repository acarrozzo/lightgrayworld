export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

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
  createdAt: true,
} as const

/**
 * The player's own Battle Log.
 *
 * Two reads, one route, both owner-scoped:
 * - `GET /api/player/battle-log?limit=&cursor=` pages the summaries newest
 *   first (`nextCursor` is the last row's id; pass it back for the next
 *   page, null when there is no more). The ledger is left out of the list,
 *   since a long fight's rows are most of a record's weight.
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
    const rows = await prisma.battleLog.findMany({
      where: { userId: request.user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
