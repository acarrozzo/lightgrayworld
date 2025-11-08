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

async function handleGet(request: AuthenticatedRequest) {
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

  const url = new URL(request.url)
  const filters: Record<string, string> = {}
  const roomId = url.searchParams.get('roomId')
  const state = url.searchParams.get('state')
  const npcId = url.searchParams.get('npcId')
  const definitionId = url.searchParams.get('definitionId')
  const instanceId = url.searchParams.get('instanceId')

  if (roomId) filters.roomId = roomId
  if (state) filters.state = state.toUpperCase()
  if (npcId) filters.npcId = npcId
  if (definitionId) filters.definitionId = definitionId
  if (instanceId) filters.instanceId = instanceId

  const includeConfigs = url.searchParams.get('includeConfigs')

  const snapshots = await npcManager.listRuntimeStates(filters)
  const npcIds = Array.from(new Set(snapshots.map((snapshot) => snapshot.runtime.npcId)))

  let npcDetails: Record<string, any> = {}
  if (npcIds.length > 0) {
    const records = await prisma.nPC.findMany({
      where: {
        id: { in: npcIds },
      },
      select: {
        id: true,
        name: true,
        disposition: true,
        canBeAttacked: true,
        roomId: true,
        definitionId: true,
        type: true,
      },
    })
    npcDetails = Object.fromEntries(records.map((record) => [record.id, record]))
  }

  const items = snapshots.map(({ runtime, config, npc }) => ({
    instanceId: runtime.instanceId,
    npcId: runtime.npcId,
    definitionId: runtime.definitionId,
    roomId: runtime.currentRoom,
    state: runtime.state,
    hp: runtime.hp,
    hpMax: runtime.hpMax,
    targetId: runtime.targetId || null,
    metadata: runtime.metadata || {},
    cooldowns: runtime.cooldowns || {},
    threat: runtime.threat || [],
    config: config
      ? {
          npcId: config.npcId,
          roomKey: config.roomKey,
          maxAlive: config.maxAlive,
          respawnSeconds: config.respawnSeconds,
          leashDistance: config.leashDistance,
          leashTimeMs: config.leashTimeMs,
          persistent: config.persistent,
          services: config.metadata.services || [],
        }
      : null,
    npc: npcDetails[runtime.npcId] || npc || null,
  }))

  const response: Record<string, any> = {
    count: items.length,
    items,
  }

  if (includeConfigs && ['1', 'true', 'yes'].includes(includeConfigs.toLowerCase())) {
    response.configs = npcManager.getSpawnConfigsSummary()
  }

  return NextResponse.json(response)
}

export const GET = withAuth(handleGet)

