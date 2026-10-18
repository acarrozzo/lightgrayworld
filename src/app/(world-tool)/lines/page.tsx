export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { cachedWorldToolData } from '@/lib/world-tool/cached'
import AnchorTarget from '@/components/world-tool/AnchorTarget'
import LinesBrowser, { type LineSetRow } from './LinesBrowser'

export const metadata = {
  title: 'Lines — Light Gray World Tool',
  description:
    'Every spoken line outside the quest flow: who says it, in which room, from which set, and what has to be done before it can be heard.',
}

type LineSet = Omit<LineSetRow, 'roomName' | 'gateTitle'>

const { listLineSets } = require('@/lib/game-data/lines') as { listLineSets: () => LineSet[] }
const { QUESTS } = require('@/lib/game-data/quest-registry') as { QUESTS: Record<string, { title: string }> }

const loadRoomNames = cachedWorldToolData('lines-rooms', () => {
  const roomIds = Array.from(new Set(listLineSets().map((s) => s.roomId)))
  return prisma.room.findMany({ where: { roomId: { in: roomIds } }, select: { roomId: true, name: true } })
})

export default async function LinesPage() {
  const rooms = await loadRoomNames()
  const roomName = new Map(rooms.map((r) => [r.roomId, r.name]))
  const sets: LineSetRow[] = listLineSets().map((s) => ({
    ...s,
    roomName: roomName.get(s.roomId) ?? '',
    gateTitle: s.gate ? QUESTS[s.gate]?.title ?? null : null,
  }))
  const total = sets.reduce((n, s) => n + s.lines.length, 0)
  const roomCount = new Set(sets.map((s) => s.roomId)).size

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <AnchorTarget />
      <h1 className="text-2xl font-bold text-fg-bright">Lines</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Everything the world says outside the quest flow. Each press of a Chat, talk or Listen In button serves the set&apos;s
        next line in order, shown in yellow in the room until the next one, and written to the feed as a{' '}
        <span className="font-mono">line</span> event with its speaker and a source tag (<span className="font-mono">room · speaker · set #n</span>,
        the same numbering as below) when the line-sources setting is on. Keepers speak from their shop&apos;s talk button, a
        crowd from Listen In, and a quest giver&apos;s idle lines and asides from Talk and from Chat. {total} lines in {sets.length} sets
        across {roomCount} rooms.
      </p>

      <div className="mt-6">
        <Suspense fallback={<p className="py-6 text-center text-sm text-fg-muted">Loading lines…</p>}>
          <LinesBrowser sets={sets} />
        </Suspense>
      </div>
    </div>
  )
}
