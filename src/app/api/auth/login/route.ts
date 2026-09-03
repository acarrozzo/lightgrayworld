export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuthResponse } from '@/lib/auth'
import { DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'
import { recomputeStatMods } from '@/lib/game-engine/services/equipment-service'
import { SPELL_SELECT, projectSpellState } from '@/lib/game-engine/services/spell-service'
import { MAP_STATE_SELECT, projectMapState } from '@/lib/game-engine/services/map-state'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    // Validate required fields
    const validation = validateRequiredFields({ username, password }, ['username', 'password'])
    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('Username and password are required'),
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: { equipment: true }
    })

    if (!user) {
      return NextResponse.json(
        COMMON_ERRORS.AUTHENTICATION_ERROR('Invalid credentials'),
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        COMMON_ERRORS.AUTHENTICATION_ERROR('Invalid credentials'),
        { status: 401 }
      )
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        lastActive: new Date(),
        isActive: true 
      }
    })

    // Recalculate stat mods from equipped items
    await recomputeStatMods(user.id)

    // Get fresh user data with updated mods
    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
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
        chest1: true,
        ...SPELL_SELECT,
        ...MAP_STATE_SELECT,
      },
    })

    // Return player data with JWT token
    const authResponse = createAuthResponse({
      id: freshUser!.id,
      username: freshUser!.username,
      level: freshUser!.level,
      hp: freshUser!.hp,
      hpMax: freshUser!.hpMax,
      mp: freshUser!.mp,
      mpMax: freshUser!.mpMax,
      currentRoom: freshUser!.currentRoom,
      isActive: freshUser!.isActive,
      xp: freshUser!.xp,
      cp: freshUser!.cp,
      tp: freshUser!.tp,
      sp: freshUser!.sp,
      currency: freshUser!.currency,
      physicalTraining: freshUser!.physicalTraining,
      mentalTraining: freshUser!.mentalTraining,
      str: freshUser!.str,
      dex: freshUser!.dex,
      mag: freshUser!.mag,
      def: freshUser!.def,
      strMod: freshUser!.strMod,
      dexMod: freshUser!.dexMod,
      magMod: freshUser!.magMod,
      defMod: freshUser!.defMod,
      uIcon: freshUser!.uIcon,
      uIconColor: freshUser!.uIconColor ?? DEFAULT_AVATAR_COLOR,
      clicks: freshUser!.clicks,
      deaths: freshUser!.deaths,
      chest1: freshUser!.chest1,
      ...projectSpellState(freshUser),
      ...projectMapState(freshUser),
    })

    return NextResponse.json(authResponse)
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Login failed'),
      { status: 500 }
    )
  }
}
