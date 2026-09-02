export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { SPELL_SELECT, projectSpellState, learnSpell } from '@/lib/game-engine/services/spell-service'
const { getSpell } = require('@/lib/game-data/spells') as { getSpell: (id: string) => { id: string } | null }

// The same player shape the CP/TP routes return, so the client can adopt it
// with one setPlayer. Spell levels and teacher flags ride along because the
// spellbook is what this route exists to change.
const selectPlayerFields = {
  id: true,
  username: true,
  level: true,
  hp: true,
  hpMax: true,
  mp: true,
  mpMax: true,
  currentRoom: true,
  isActive: true,
  xp: true,
  cp: true,
  tp: true,
  sp: true,
  currency: true,
  physicalTraining: true,
  mentalTraining: true,
  str: true,
  dex: true,
  mag: true,
  def: true,
  strMod: true,
  dexMod: true,
  magMod: true,
  defMod: true,
  uIcon: true,
  uIconColor: true,
  clicks: true,
  deaths: true,
  ...SPELL_SELECT,
} as const

async function loadPlayer(userId: string) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: selectPlayerFields })
  return row ? { ...row, ...projectSpellState(row) } : null
}

/** GET — the player's spell levels and the teachers they have met. */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const player = await loadPlayer(request.user.id)
    if (!player) {
      return NextResponse.json(COMMON_ERRORS.NOT_FOUND('User'), { status: 404 })
    }
    return NextResponse.json({ player })
  } catch (error) {
    console.error('Failed to load spells:', error)
    return NextResponse.json(COMMON_ERRORS.INTERNAL_ERROR('Failed to load spells'), { status: 500 })
  }
})

/**
 * PUT { spellId, mode?: 'one' | 'max' } — spend SP on a spell.
 *
 * The cap comes from the teachers the player has met and the cost from the
 * registry; the client sends only which spell and whether to keep going. The
 * service's guarded writes make a double submit a conflict, never a free level.
 */
export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json().catch(() => null)
    const spellId = typeof body?.spellId === 'string' ? body.spellId : null
    const mode = body?.mode === 'max' ? 'max' : 'one'

    if (!spellId || !getSpell(spellId)) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Invalid request. Provide { spellId: string, mode?: "one" | "max" }'),
        { status: 400 }
      )
    }

    const result = await learnSpell(request.user.id, spellId, { mode })
    const player = await loadPlayer(request.user.id)

    if (!result.success) {
      const status = /changed before/.test(result.message) ? 409 : 400
      return NextResponse.json({ success: false, message: result.message, player }, { status })
    }

    return NextResponse.json({ success: true, message: result.message, result, player })
  } catch (error) {
    console.error('Failed to learn spell:', error)
    return NextResponse.json(COMMON_ERRORS.INTERNAL_ERROR('Failed to learn spell'), { status: 500 })
  }
})
