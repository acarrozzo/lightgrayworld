export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'

async function handleGetKillList(request: AuthenticatedRequest) {
  try {
    const kills = await prisma.killList.findMany({
      where: { userId: request.user.id },
      orderBy: { kills: 'desc' },
      select: {
        id: true,
        monster: true,
        kills: true,
      },
    })
    return NextResponse.json({ success: true, kills })
  } catch (error) {
    console.error('Get kill list error:', error)
    return NextResponse.json({ success: false, error: 'Failed to get kill list' }, { status: 500 })
  }
}

export const GET = withAuth(handleGetKillList)
