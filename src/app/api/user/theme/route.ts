export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware'
import { DEFAULT_THEME_ID, isThemeId } from '@/lib/theme/themes'

/**
 * The signed-in player's terminal theme.
 *
 * Local storage carries the choice before sign-in and provides the immediate
 * pre-hydration value; this row is what makes it follow the account to another
 * device. The id is validated against the registry rather than stored blind, so
 * a removed or renamed theme degrades to the default instead of leaving the
 * page with no palette at all.
 */
export const GET = withAuth(async (request) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { theme: true },
    })

    const theme = isThemeId(user?.theme) ? user!.theme : DEFAULT_THEME_ID
    return NextResponse.json({ theme })
  } catch (error) {
    console.error('Failed to read theme:', error)
    return NextResponse.json({ message: 'Failed to read theme' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request) => {
  try {
    const { theme } = await request.json()

    if (!isThemeId(theme)) {
      return NextResponse.json({ message: 'Unknown theme' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: request.user.id },
      data: { theme },
      select: { id: true },
    })

    return NextResponse.json({ theme })
  } catch (error) {
    console.error('Failed to update theme:', error)
    return NextResponse.json({ message: 'Failed to update theme' }, { status: 500 })
  }
})
