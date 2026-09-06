export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import WorldToolNav from '@/components/WorldToolNav'
import RoomDescCompare, { type CompareRow, type SideData } from './RoomDescCompare'
import legacyData from '@/lib/game-data/legacy-rooms.json'

export const metadata = {
  title: 'Room Desc — Light Gray World Tool',
  description:
    "Every room's title, description, actions and exits in the original game beside the recreation, so drift is visible while porting.",
}

// The engine is CommonJS, so its room-action table is reached by require the
// same way the World Atlas reaches it.
const { ROOM_ACTIONS } = require('@/lib/game-engine/room-action-handlers') as {
  ROOM_ACTIONS: Record<string, Record<string, unknown>>
}

type LegacyRoom = {
  roomId: string
  title: string | null
  subtitle: string | null
  description: string
  actions: { command: string; label: string }[]
  exits: string[]
  links: { target: string; label: string }[]
  icon: string | null
  dangerLevel: number | null
  source: string
}

const DIRECTIONS = [
  'north', 'northeast', 'east', 'southeast', 'south',
  'southwest', 'west', 'northwest', 'up', 'down',
] as const

/**
 * Comparison normalisation, deliberately shallow.
 *
 * Only case and whitespace are ignored. It would be easy to also strip
 * punctuation, or fuzzy-match "rest" against "rest at wizard fire", and every
 * one of those would quietly hide the drift this page exists to show. A room
 * reads "same" only when the two versions really say the same thing.
 */
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const sameList = (a: string[], b: string[]) => {
  const x = [...new Set(a.map(norm))].sort()
  const y = [...new Set(b.map(norm))].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

export default async function RoomDescPage() {
  const rooms = await prisma.room.findMany({ orderBy: { roomId: 'asc' } })

  const legacyRooms = (legacyData as { rooms: LegacyRoom[] }).rooms
  const legacyById = new Map(legacyRooms.map((r) => [r.roomId, r]))

  const currentById = new Map<string, SideData>()
  for (const room of rooms) {
    const exits = DIRECTIONS.filter((d) => (room as Record<string, unknown>)[d])
    currentById.set(room.roomId, {
      title: room.name,
      subtitle: room.subtitle || null,
      description: room.description || '',
      // The recreation's hand-authored room interactions. Generic verbs the
      // engine offers everywhere (look, search, rest by a fire) are not in this
      // table, so they show up as flags rather than as actions.
      actions: Object.keys(ROOM_ACTIONS[room.roomId] ?? {}).map((command) => ({
        command,
        label: command,
      })),
      exits: [...exits],
      links: [],
      icon: room.icon || null,
      dangerLevel: room.dangerLevel,
      flags: [
        room.isSafe ? 'safe' : null,
        room.hasSearch ? 'searchable' : null,
        room.hasFire ? 'fire' : null,
      ].filter((f): f is string => !!f),
      note: room.region || null,
    })
  }

  const allIds = [...new Set([...legacyById.keys(), ...currentById.keys()])].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )

  const rows: CompareRow[] = allIds.map((roomId) => {
    const l = legacyById.get(roomId)
    const c = currentById.get(roomId)

    const legacy: SideData | null = l
      ? {
          title: l.title,
          subtitle: l.subtitle,
          description: l.description,
          actions: l.actions,
          exits: l.exits,
          links: l.links,
          icon: l.icon,
          dangerLevel: l.dangerLevel,
          flags: [],
          note: l.source,
        }
      : null

    if (!legacy) return { roomId, status: 'new-only', legacy: null, current: c!, diff: {} }
    if (!c) return { roomId, status: 'not-ported', legacy, current: null, diff: {} }

    const diff = {
      title: norm(legacy.title) !== norm(c.title),
      subtitle: norm(legacy.subtitle) !== norm(c.subtitle),
      description: norm(legacy.description) !== norm(c.description),
      actions: !sameList(
        legacy.actions.map((a) => a.command),
        c.actions.map((a) => a.command)
      ),
      exits: !sameList(legacy.exits, c.exits),
    }
    const differs = Object.values(diff).some(Boolean)
    return { roomId, status: differs ? 'differs' : 'same', legacy, current: c, diff }
  })

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="room-desc" />
      <div className="mx-auto max-w-[110rem] px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Room Desc</h1>
          <p className="mt-1 max-w-4xl text-sm text-fg-secondary">
            Every room in the original game beside its counterpart in the recreation — title,
            subtitle, description, actions and exits, field by field. {legacyRooms.length} rooms in
            the original, {rooms.length} in the new game. A field is marked changed only when the
            two genuinely differ; case and spacing are ignored, nothing else is.
          </p>
          <p className="mt-2 max-w-4xl text-xs text-fg-muted">
            The original&rsquo;s side is a snapshot in{' '}
            <code className="text-fg-secondary">src/lib/game-data/legacy-rooms.json</code>, scraped
            from the reference game by{' '}
            <code className="text-fg-secondary">npm run generate-legacy-rooms</code>. The reference
            itself is never read at runtime and never modified. The new game&rsquo;s side is live
            from the database and the engine&rsquo;s room-action table, so it moves as you port.
          </p>
        </header>
        <RoomDescCompare rows={rows} />
      </div>
    </div>
  )
}
