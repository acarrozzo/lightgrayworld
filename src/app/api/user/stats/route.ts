export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

const VALID_STATS = ['str', 'dex', 'mag', 'def'] as const
type StatName = typeof VALID_STATS[number]

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
  uIcon: true,
  uIconColor: true,
} as const

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json()
    
    // Support both single allocation (backward compatible) and batch allocations
    let allocations: Array<{ stat: StatName; amount: number }> = []
    
    if (body.allocations && Array.isArray(body.allocations)) {
      // Batch allocation mode
      allocations = body.allocations
    } else if (body.stat && typeof body.stat === 'string') {
      // Single allocation mode (backward compatible)
      allocations = [{ stat: body.stat as StatName, amount: 1 }]
    } else {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Invalid request. Provide either { stat: string } or { allocations: [{ stat: string, amount: number }, ...] }'),
        { status: 400 }
      )
    }

    // Validate allocations
    if (allocations.length === 0) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('No allocations provided'),
        { status: 400 }
      )
    }

    // Validate each allocation
    for (const allocation of allocations) {
      if (!allocation.stat || typeof allocation.stat !== 'string' || !VALID_STATS.includes(allocation.stat)) {
        return NextResponse.json(
          COMMON_ERRORS.VALIDATION_ERROR(`Invalid stat name: ${allocation.stat}. Must be one of: str, dex, mag, def`),
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

    // Get current user data to check CP
    const currentUser = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { cp: true, str: true, dex: true, mag: true, def: true },
    })

    if (!currentUser) {
      return NextResponse.json(
        COMMON_ERRORS.NOT_FOUND('User'),
        { status: 404 }
      )
    }

    // Calculate total CP needed
    const totalCpNeeded = allocations.reduce((sum, alloc) => sum + alloc.amount, 0)

    // Check if user has enough Core Points
    if (currentUser.cp < totalCpNeeded) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR(`Insufficient Core Points. You need ${totalCpNeeded} CP but only have ${currentUser.cp}.`),
        { status: 400 }
      )
    }

    // Build update data object
    const updateData: Record<string, any> = {
      cp: { decrement: totalCpNeeded },
    }

    // Group allocations by stat and sum amounts
    const statTotals: Record<StatName, number> = {
      str: 0,
      dex: 0,
      mag: 0,
      def: 0,
    }

    for (const allocation of allocations) {
      statTotals[allocation.stat] += allocation.amount
    }

    // Add increments for each stat
    for (const [stat, amount] of Object.entries(statTotals)) {
      if (amount > 0) {
        updateData[stat] = { increment: amount }
      }
    }

    // Update user with all allocations
    const updatedPlayer = await prisma.user.update({
      where: { id: request.user.id },
      data: updateData,
      select: selectPlayerFields,
    })

    return NextResponse.json({ player: updatedPlayer })
  } catch (error) {
    console.error('Failed to update stats:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to update stats'),
      { status: 500 }
    )
  }
})

