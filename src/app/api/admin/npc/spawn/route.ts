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

async function handlePost(request: AuthenticatedRequest) {
  if (!isAdminUser(request.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const npcManager = getNpcManager()
  if (!npcManager) {
    return NextResponse.json(
      { message: 'NPC manager not initialized' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.npcId !== 'string') {
    return NextResponse.json({ message: 'npcId is required' }, { status: 400 })
  }

  const npcRecord = await prisma.nPC.findUnique({
    where: { id: body.npcId },
    select: { id: true, name: true },
  })
  if (!npcRecord) {
    return NextResponse.json({ message: 'NPC definition not found' }, { status: 404 })
  }

  const count = Math.max(1, Math.min(5, Number(body.count) || 1))
  const spawned: Array<{ instanceId: string; snapshot: any }> = []

  for (let i = 0; i < count; i += 1) {
    try {
      const instanceId = await npcManager.forceSpawn(body.npcId)
      if (!instanceId) continue
      const snapshot = await npcManager.getRuntimeSnapshot(instanceId)
      spawned.push({
        instanceId,
        snapshot,
      })
    } catch (error) {
      console.error('[AdminNPC] Failed to spawn NPC', error)
      return NextResponse.json(
        { message: (error as Error).message || 'Failed to spawn NPC' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    success: true,
    npcId: body.npcId,
    count: spawned.length,
    spawned,
  })
}

export const POST = withAuth(handlePost)

