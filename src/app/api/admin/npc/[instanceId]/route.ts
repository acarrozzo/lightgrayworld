export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth, AuthenticatedRequest } from '@/lib/middleware'
import { prisma } from '@/lib/prisma'
import { isAdminUser } from '@/lib/admin-utils'

function getNpcManager() {
  const engine = (globalThis as any)?.gameEngine
  if (!engine || !engine.npcManager) {
    return null
  }
  return engine.npcManager
}

async function handleGet(request: AuthenticatedRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!isAdminUser(request.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { instanceId } = await params

  const npcManager = getNpcManager()
  if (!npcManager) {
    return NextResponse.json(
      { message: 'NPC manager not initialized' },
      { status: 503 }
    )
  }

  const snapshot = await npcManager.getRuntimeSnapshot(instanceId)
  if (!snapshot) {
    return NextResponse.json({ message: 'NPC instance not found' }, { status: 404 })
  }

  const npcRecord = await prisma.nPC.findUnique({
    where: { id: snapshot.runtime.npcId },
    select: {
      id: true,
      name: true,
      description: true,
      disposition: true,
      canBeAttacked: true,
      roomId: true,
      definitionId: true,
      type: true,
    },
  })

  return NextResponse.json({
    instanceId: snapshot.runtime.instanceId,
    runtime: snapshot.runtime,
    config: snapshot.config,
    npc: npcRecord || snapshot.npc || null,
  })
}

async function handlePost(request: AuthenticatedRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!isAdminUser(request.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { instanceId } = await params

  const npcManager = getNpcManager()
  if (!npcManager) {
    return NextResponse.json(
      { message: 'NPC manager not initialized' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.action !== 'string') {
    return NextResponse.json({ message: 'action is required' }, { status: 400 })
  }

  const action = body.action.toLowerCase()
  let result: any = null

  try {
    switch (action) {
      case 'freeze':
        await npcManager.setFrozen(instanceId, true)
        result = { frozen: true }
        break
      case 'unfreeze':
        await npcManager.setFrozen(instanceId, false)
        result = { frozen: false }
        break
      case 'despawn':
        result = await npcManager.despawnInstance(instanceId, {
          scheduleRespawn: Boolean(body.scheduleRespawn),
        })
        break
      case 'return_home':
        await npcManager.forceReturnHome(instanceId)
        result = { returning: true }
        break
      case 'move': {
        if (!body.toRoomId || typeof body.toRoomId !== 'string') {
          return NextResponse.json(
            { message: 'toRoomId is required for move action' },
            { status: 400 }
          )
        }
        result = await npcManager.moveInstanceTo(instanceId, body.toRoomId)
        break
      }
      default:
        return NextResponse.json({ message: `Unknown action "${action}"` }, { status: 400 })
    }
  } catch (error) {
    console.error('[AdminNPC] Action failed', error)
    return NextResponse.json(
      { message: (error as Error).message || 'Failed to process action' },
      { status: (error as any)?.statusCode || 500 }
    )
  }

  const snapshot = await npcManager.getRuntimeSnapshot(instanceId)

  return NextResponse.json({
    success: true,
    action,
    result,
    snapshot,
  })
}

export const GET = withAuth(handleGet)
export const POST = withAuth(handlePost)

