export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

async function handleGetMe(request: AuthenticatedRequest) {
  try {
    // User is already authenticated by middleware
    const user = request.user

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
      isActive: freshUser.isActive
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
