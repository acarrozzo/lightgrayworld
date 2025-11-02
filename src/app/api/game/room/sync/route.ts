export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { COMMON_ERRORS, validateRequiredFields } from '@/lib/error-handling'

async function handleSyncRoom(request: AuthenticatedRequest) {
  try {
    const body = await request.json()
    const validation = validateRequiredFields(body, ['roomId'])

    if (!validation.isValid) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR(
          `Missing fields: ${validation.missingFields.join(', ')}`
        ),
        { status: 400 }
      )
    }

    const { roomId } = body

    if (typeof roomId !== 'string' || !roomId.trim()) {
      return NextResponse.json(
        COMMON_ERRORS.VALIDATION_ERROR('roomId must be a non-empty string'),
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id: request.user.id },
      data: { currentRoom: roomId.trim() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Room sync error:', error)
    return NextResponse.json(
      COMMON_ERRORS.INTERNAL_ERROR('Failed to sync room'),
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleSyncRoom)

