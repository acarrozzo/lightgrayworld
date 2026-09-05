export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'
import { recomputeStatMods } from '@/lib/game-engine/services/equipment-service'
import { projectSpellState } from '@/lib/game-engine/services/spell-service'
import { projectSkillState } from '@/lib/game-engine/services/skill-service'
import { projectMapState } from '@/lib/game-engine/services/map-state'

async function handleGetMe(request: AuthenticatedRequest) {
  try {
    // User is already authenticated by middleware
    const user = request.user

    // Recalculate stat mods from equipped items
    await recomputeStatMods(user.id)

    // Get fresh user data from database
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { equipment: true }
    })

    if (!freshUser) {
      return NextResponse.json(
        COMMON_ERRORS.NOT_FOUND('User'),
        { status: 404 }
      )
    }

    // Return user data in the same format as login
    const playerData = {
      id: freshUser.id,
      username: freshUser.username,
      level: freshUser.level,
      hp: freshUser.hp,
      hpMax: freshUser.hpMax,
      mp: freshUser.mp,
      mpMax: freshUser.mpMax,
      currentRoom: freshUser.currentRoom,
      isActive: freshUser.isActive,
      xp: freshUser.xp,
      cp: freshUser.cp,
      tp: freshUser.tp,
      sp: freshUser.sp,
      currency: freshUser.currency,
      physicalTraining: freshUser.physicalTraining,
      mentalTraining: freshUser.mentalTraining,
      str: freshUser.str,
      dex: freshUser.dex,
      mag: freshUser.mag,
      def: freshUser.def,
      strMod: freshUser.strMod,
      dexMod: freshUser.dexMod,
      magMod: freshUser.magMod,
      defMod: freshUser.defMod,
      uIcon: freshUser.uIcon,
      uIconColor: freshUser.uIconColor,
      clicks: freshUser.clicks,
      deaths: freshUser.deaths,
      chest1: freshUser.chest1,
      ...projectSpellState(freshUser),
      ...projectSkillState(freshUser),
      ...projectMapState(freshUser),
    }

    return NextResponse.json({
      success: true,
      user: playerData
    })
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to get user data'),
      { status: 500 }
    )
  }
}

export const GET = withAuth(handleGetMe)
