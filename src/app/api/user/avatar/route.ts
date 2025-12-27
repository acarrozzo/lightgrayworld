export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import {
  PLAYER_AVATARS,
  AVATAR_COLORS,
  DEFAULT_AVATAR_COLOR,
  isValidPlayerAvatar,
} from '@/lib/constants/avatars'

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
  uIcon: true,
  uIconColor: true,
} as const

export const PUT = withAuth(async (request) => {
  try {
    const { avatar, color } = await request.json()

    if (typeof avatar !== 'string' || !isValidPlayerAvatar(avatar)) {
      return NextResponse.json(
        { message: 'Invalid avatar selection' },
        { status: 400 }
      )
    }

    const colorValue =
      typeof color === 'string' && AVATAR_COLORS.some((c) => c.value === color)
        ? color
        : DEFAULT_AVATAR_COLOR

    const updatedPlayer = await prisma.user.update({
      where: { id: request.user.id },
      data: { uIcon: avatar, uIconColor: colorValue },
      select: selectPlayerFields,
    })

    return NextResponse.json({ player: updatedPlayer })
  } catch (error) {
    console.error('Failed to update avatar:', error)
    return NextResponse.json(
      { message: 'Failed to update avatar' },
      { status: 500 }
    )
  }
})

