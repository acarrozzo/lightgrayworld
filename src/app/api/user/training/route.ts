export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { SPELL_SELECT, projectSpellState } from '@/lib/game-engine/services/spell-service'
import { SKILL_SELECT, projectSkillState } from '@/lib/game-engine/services/skill-service'

const VALID_STATS = ['pt', 'mt'] as const
type TrainingStatName = typeof VALID_STATS[number]

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
  ...SKILL_SELECT,
} as const

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()

    let allocations: Array<{ stat: TrainingStatName; amount: number }> = []

    if (body.allocations && Array.isArray(body.allocations)) {
      allocations = body.allocations
    } else {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Invalid request. Provide { allocations: [{ stat: "pt"|"mt", amount: number }, ...] }'),
        { status: 400 }
      )
    }

    if (allocations.length === 0) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('No allocations provided'),
        { status: 400 }
      )
    }

    for (const allocation of allocations) {
      if (!allocation.stat || typeof allocation.stat !== 'string' || !VALID_STATS.includes(allocation.stat)) {
        return NextResponse.json(
          COMMON_ERRORS.VALIDATION_ERROR(`Invalid stat name: ${allocation.stat}. Must be one of: pt, mt`),
          { status: 400 }
        )
      }
      if (typeof allocation.amount !== 'number' || allocation.amount < 1 || !Number.isInteger(allocation.amount)) {
        return NextResponse.json(
          COMMON_ERRORS.VALIDATION_ERROR(`Invalid amount for ${allocation.stat}. Must be a positive integer.`),
          { status: 400 }
        )
      }
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { tp: true, physicalTraining: true, mentalTraining: true },
    })

    if (!currentUser) {
      return NextResponse.json(COMMON_ERRORS.NOT_FOUND('User'), { status: 404 })
    }

    const totalTpNeeded = allocations.reduce((sum, alloc) => sum + alloc.amount, 0)

    if (currentUser.tp < totalTpNeeded) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR(`Insufficient Training Points. You need ${totalTpNeeded} TP but only have ${currentUser.tp}.`),
        { status: 400 }
      )
    }

    const statTotals: Record<TrainingStatName, number> = { pt: 0, mt: 0 }
    for (const allocation of allocations) {
      statTotals[allocation.stat] += allocation.amount
    }

    const updateData: Record<string, any> = {
      tp: { decrement: totalTpNeeded },
    }

    if (statTotals.pt > 0) updateData.physicalTraining = { increment: statTotals.pt }
    if (statTotals.mt > 0) updateData.mentalTraining = { increment: statTotals.mt }

    // Spend behind a TP guard — same reasoning as the CP allocation route: the
    // pre-check is for the message, the conditional write is the actual guard
    // against two concurrent submits both spending the same training points.
    const applied = await prisma.user.updateMany({
      where: { id: request.user.id, tp: { gte: totalTpNeeded } },
      data: updateData,
    })

    if (applied.count === 0) {
      return NextResponse.json(
        COMMON_ERRORS.CONFLICT('Your Training Points changed before that could be applied. Please try again.'),
        { status: 409 }
      )
    }

    const updatedPlayer = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: selectPlayerFields,
    })

    return NextResponse.json({ player: { ...updatedPlayer, ...projectSpellState(updatedPlayer), ...projectSkillState(updatedPlayer) } })
  } catch (error) {
    console.error('Failed to update training stats:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to update training stats'),
      { status: 500 }
    )
  }
})
