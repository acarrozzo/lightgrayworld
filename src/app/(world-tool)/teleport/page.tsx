export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import WorldToolNav from '@/components/WorldToolNav'
import { EntityLink } from '@/components/world-tool/EntityLink'
import { roomHref } from '@/components/world-tool/hrefs'
import { Tag } from '@/components/world-tool/ui'

export const metadata = {
  title: 'Teleport — Light Gray World Tool',
  description:
    'The fast-travel network of Light Gray RPG — every teleport destination, what unlocks it, what it costs, and the region it belongs to.',
}

const { TELEPORT_MP_COST, TELEPORT_LOCATIONS } = require('@/lib/game-data/teleport-destinations') as {
  TELEPORT_MP_COST: number
  TELEPORT_LOCATIONS: TeleportLocation[]
}
const { ALL_REGIONS, MAP_SHEETS } = require('@/lib/game-data/world-map') as {
  ALL_REGIONS: { id: string; name: string }[]
  MAP_SHEETS: Record<string, { label?: string; name?: string; regionId?: string }>
}

type TeleportLocation = {
  roomId: string
  regionId: string
  discoveryId: string
  name: string
  description?: string
  alwaysOpen?: boolean
}

export default async function TeleportPage() {
  const roomIds = TELEPORT_LOCATIONS.map((l) => l.roomId)
  const rooms = await prisma.room.findMany({
    where: { roomId: { in: roomIds } },
    select: { roomId: true, name: true, region: true },
  })
  const roomById = new Map(rooms.map((r) => [r.roomId, r]))
  const regionName = new Map(ALL_REGIONS.map((r) => [r.id, r.name]))

  // Grouped by region, in the order the regions are declared, so the network
  // reads the way the world is laid out rather than the way the file happens
  // to be ordered.
  const byRegion = new Map<string, TeleportLocation[]>()
  for (const loc of TELEPORT_LOCATIONS) {
    if (!byRegion.has(loc.regionId)) byRegion.set(loc.regionId, [])
    byRegion.get(loc.regionId)!.push(loc)
  }
  const orderedRegions = [
    ...ALL_REGIONS.filter((r) => byRegion.has(r.id)).map((r) => r.id),
    ...Array.from(byRegion.keys()).filter((id) => !regionName.has(id)),
  ]

  const openCount = TELEPORT_LOCATIONS.filter((l) => l.alwaysOpen).length

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="teleport" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Teleport</h1>
          <p className="mt-1 max-w-4xl text-sm text-fg-secondary">
            {TELEPORT_LOCATIONS.length} destinations across {orderedRegions.length} regions, each
            costing {TELEPORT_MP_COST} MP. {openCount} are open from the start; the rest have to be
            discovered by arriving at them, which is what the discovery id records on the player.
          </p>
          <p className="mt-2 text-xs text-fg-muted">
            The world is drawn on {Object.keys(MAP_SHEETS).length} map sheets — see the{' '}
            <EntityLink href="/rooms">World Atlas</EntityLink> for the room-level graph.
          </p>
        </header>

        {orderedRegions.map((regionId) => {
          const locations = byRegion.get(regionId) ?? []
          return (
            <section key={regionId} className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-fg-bright">
                {regionName.get(regionId) ?? regionId}
                <span className="ml-2 text-xs font-normal text-fg-muted">{locations.length}</span>
              </h2>
              <div className="overflow-x-auto rounded border border-line-subtle/80 bg-surface-panel">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                      <th scope="col" className="px-3 py-2">Destination</th>
                      <th scope="col" className="px-3 py-2">Room</th>
                      <th scope="col" className="px-3 py-2">Arrival text</th>
                      <th scope="col" className="px-3 py-2">Unlocked by</th>
                      <th scope="col" className="px-3 py-2">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => {
                      const room = roomById.get(loc.roomId)
                      return (
                        <tr
                          key={loc.discoveryId}
                          className="border-b border-line-subtle/60 last:border-b-0"
                        >
                          <td className="px-3 py-2 font-medium text-fg-bright">{loc.name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <EntityLink href={roomHref(loc.roomId)} className="font-mono text-xs">
                              #{loc.roomId}
                            </EntityLink>
                            {room && <span className="ml-1.5 text-fg-secondary">{room.name}</span>}
                            {!room && (
                              <span className="ml-1.5 text-status-error" title="No such room in the database">
                                missing
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-fg-secondary">{loc.description ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-xs text-fg-muted">
                            {loc.discoveryId}
                          </td>
                          <td className="px-3 py-2">
                            {loc.alwaysOpen ? (
                              <Tag className="border-status-success/50 text-status-success">
                                always open
                              </Tag>
                            ) : (
                              <Tag>discover</Tag>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
