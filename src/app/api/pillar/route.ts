export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware'
import { COMMON_ERRORS } from '@/lib/error-handling'

const { getPillarHolders } = require('@/lib/game-engine/services/pillar-service') as {
  getPillarHolders: () => Promise<Record<string, string[]>>
}
const { listPillarNames } = require('@/lib/game-data/quest-registry') as {
  listPillarNames: () => { questId: string | null; title: string; colorToken: string | null; waitsFor: string | null }[]
}

/**
 * The Grand Quest Pillar as a monument: its five names and who holds each.
 * Which names are the viewer's own is theirs to know from their quest rows;
 * this is the shared record, read once a minute per process.
 */
export const GET = withAuth(async () => {
  try {
    const holders = await getPillarHolders()
    const names = listPillarNames().map((name) => ({
      ...name,
      holders: name.questId ? holders[name.questId] ?? [] : [],
    }))
    return NextResponse.json({ success: true, names })
  } catch (error) {
    console.error('Pillar holders error:', error)
    return NextResponse.json(COMMON_ERRORS.INTERNAL_ERROR('Failed to read the Pillar'), { status: 500 })
  }
})
