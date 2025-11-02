export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'

// Record a new action in the player's history
async function handleRecordAction(request: AuthenticatedRequest) {
  try {
    const { action, message, roomId, metadata } = await request.json()

    if (!action || !message) {
      return NextResponse.json(
        { message: 'Action and message are required' },
        { status: 400 }
      )
    }

    // Create action history record
    const actionRecord = await prisma.actionHistory.create({
      data: {
        userId: request.user.id,
        action,
        message,
        roomId: roomId || request.user.currentRoom,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })

    // Clean up old actions (keep last 100 per user)
    const userActionCount = await prisma.actionHistory.count({
      where: { userId: request.user.id }
    })

    if (userActionCount > 100) {
      const actionsToDelete = await prisma.actionHistory.findMany({
        where: { userId: request.user.id },
        orderBy: { timestamp: 'asc' },
        take: userActionCount - 100,
        select: { id: true }
      })

      if (actionsToDelete.length > 0) {
        await prisma.actionHistory.deleteMany({
          where: {
            id: { in: actionsToDelete.map(a => a.id) }
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      action: actionRecord
    })
  } catch (error) {
    console.error('Record action error:', error)
    return NextResponse.json(
      { message: 'Failed to record action' },
      { status: 500 }
    )
  }
}

// Get player's action history
async function handleGetActions(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = (page - 1) * limit

    const actions = await prisma.actionHistory.findMany({
      where: { userId: request.user.id },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    })

    const totalCount = await prisma.actionHistory.count({
      where: { userId: request.user.id }
    })

    return NextResponse.json({
      actions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Get actions error:', error)
    return NextResponse.json(
      { message: 'Failed to get actions' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(handleRecordAction)
export const GET = withAuth(handleGetActions)
