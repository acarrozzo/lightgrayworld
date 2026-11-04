export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

const { getEnemy } = require('@/lib/game-data/enemies') as {
  getEnemy: (slug: string) => { slug: string; name: string; level: number; hp: number; att: number; def: number; rank?: string; damageType?: string; icon?: string } | undefined
}

/**
 * One won fight, for anyone signed in to watch.
 *
 * The bestiary's "First to fell" board links here: the summary, the turn
 * ledger and the snapshot of the player as the fight began, with who they
 * are. Only a WIN is public — a death or a retreat is the player's own, and
 * the Battle Log route serves those to their owner alone.
 */
async function handleGetBattle(request: AuthenticatedRequest) {
  try {
    // /api/battles/<id> — the id is the last segment.
    const segments = new URL(request.url).pathname.split('/').filter(Boolean)
    const id = decodeURIComponent(segments[segments.length - 1] ?? '')
    const log = await prisma.battleLog.findFirst({
      where: { id, outcome: 'WIN' },
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
        turns: true,
        playerLevel: true,
        playerXp: true,
        snapshot: true,
        createdAt: true,
        user: { select: { id: true, username: true, level: true, uIcon: true, uIconColor: true } },
      },
    })
    if (!log) return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 })
    const enemy = getEnemy(log.enemySlug)
    const { user, ...battle } = log
    return NextResponse.json({
      success: true,
      battle,
      player: user,
      enemy: enemy
        ? { slug: enemy.slug, name: enemy.name, level: enemy.level, hp: enemy.hp, att: enemy.att, def: enemy.def, rank: enemy.rank ?? null, damageType: enemy.damageType ?? null, icon: enemy.icon ?? null }
        : null,
    })
  } catch (error) {
    console.error('Get battle error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get the battle' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetBattle)
