export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { cachedWorldToolData } from '@/lib/world-tool/cached'
import Icon from '@/components/Icon'
import AnchorTarget from '@/components/world-tool/AnchorTarget'
import { EntityLink } from '@/components/world-tool/EntityLink'
import { itemHref, questHref, roomHref } from '@/components/world-tool/hrefs'
import { Section, Tag } from '@/components/world-tool/ui'

export const metadata = {
  title: 'Pets — Light Gray World Tool',
  description:
    'The collectible creatures a player carries for the company: where each comes from, and every line it says and where.',
}

type Pet = {
  slug: string
  name: string
  icon: string
  description: string
  source: { kind: 'quest' | 'chest' | 'drop'; questId?: string; roomId?: string; text: string }
  lines: { any: string[]; sheets?: Record<string, string[]>; rooms?: Record<string, string[]> }
}

const { PETS, PET_LINE_CHANCE, PLACED_LINE_CHANCE } = require('@/lib/game-data/pets') as {
  PETS: Pet[]
  PET_LINE_CHANCE: number
  PLACED_LINE_CHANCE: number
}
const { MAP_SHEETS } = require('@/lib/game-data/world-map') as {
  MAP_SHEETS: { id: string; title: string }[]
}

const oneIn = (chance: number) => `1 in ${Math.round(1 / chance)}`

// Room names and the pet item itself come from the database; the registry only knows ids.
const loadPetData = cachedWorldToolData('pets', () => {
  const roomIds = new Set<string>()
  for (const pet of PETS) {
    if (pet.source.roomId) roomIds.add(pet.source.roomId)
    Object.keys(pet.lines.rooms ?? {}).forEach((r) => roomIds.add(r))
  }
  return Promise.all([
    prisma.room.findMany({ where: { roomId: { in: Array.from(roomIds) } }, select: { roomId: true, name: true } }),
    prisma.itemTemplate.findMany({ where: { slug: { in: PETS.map((p) => p.slug) } }, select: { slug: true, name: true } }),
  ])
})

export default async function PetsPage() {
  const [rooms, templates] = await loadPetData()
  const roomName = new Map(rooms.map((r) => [r.roomId, r.name]))
  const sheetTitle = new Map(MAP_SHEETS.map((s) => [s.id, s.title]))
  const seeded = new Set(templates.map((t) => t.slug))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <AnchorTarget />
      <h1 className="text-2xl font-bold text-fg-bright">Pets</h1>
      <p className="mt-1 text-sm text-fg-muted">
        The original&apos;s pets swung for 0–2 in a fight. These do not. A pet is a story you carry, never a number: it
        cannot swing, block, carry, find or buff. It is a bag item, one is along at a time (Take along, Leave home, free),
        it shows beside your name, and now and then it says something in the feed. Rare and placed: {oneIn(PET_LINE_CHANCE)}{' '}
        arrivals in an ordinary room, {oneIn(PLACED_LINE_CHANCE)} in a room or on a map sheet it has a line for, and no line
        repeats until the pet has said all its others.
      </p>

      <div className="mt-6 space-y-8">
        {PETS.map((pet) => {
          const placed: { where: string; href?: string; lines: string[] }[] = []
          for (const [roomId, lines] of Object.entries(pet.lines.rooms ?? {})) {
            placed.push({ where: `#${roomId} ${roomName.get(roomId) ?? ''}`.trim(), href: roomHref(roomId), lines })
          }
          for (const [sheetId, lines] of Object.entries(pet.lines.sheets ?? {})) {
            placed.push({ where: sheetTitle.get(sheetId) ?? sheetId, lines })
          }
          return (
            <section key={pet.slug} id={pet.slug} data-anchor={pet.slug} className="rounded-lg border border-line-subtle bg-surface-panel p-4">
              <div className="flex items-start gap-3">
                <Icon name={pet.icon} size={44} className="shrink-0 text-fg-bright" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-fg-bright">{pet.name}</h2>
                    <Tag>pet</Tag>
                    <Tag>{pet.source.kind}</Tag>
                    {!seeded.has(pet.slug) && <Tag className="border-status-error/40 text-status-error">not in the item table</Tag>}
                  </div>
                  <p className="mt-1 text-sm text-fg-secondary">{pet.description}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <Section title="Source">
                  <div className="text-sm text-fg-secondary">
                    <p>{pet.source.text}.</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {pet.source.questId && (
                        <li>
                          <EntityLink href={questHref(pet.source.questId)}>
                            <span className="text-xs">quest</span>
                          </EntityLink>
                        </li>
                      )}
                      {pet.source.roomId && (
                        <li>
                          <EntityLink href={roomHref(pet.source.roomId)}>
                            <span className="text-xs">#{pet.source.roomId} {roomName.get(pet.source.roomId) ?? ''}</span>
                          </EntityLink>
                        </li>
                      )}
                      <li>
                        <EntityLink href={itemHref(pet.slug)}>
                          <span className="text-xs">item</span>
                        </EntityLink>
                      </li>
                    </ul>
                  </div>
                </Section>
                <Section title="Anywhere">
                  <ul className="space-y-1 text-sm text-fg-secondary">
                    {pet.lines.any.map((line) => (
                      <li key={line} className="italic">{line}</li>
                    ))}
                  </ul>
                </Section>
              </div>

              {placed.length > 0 && (
                <div className="mt-4">
                  <Section title="Placed lines">
                    <dl className="grid gap-3 md:grid-cols-2">
                      {placed.map((group) => (
                        <div key={group.where} className="rounded border border-line-subtle/60 bg-surface-raised/40 p-2.5">
                          <dt className="text-xs uppercase tracking-[0.15em] text-fg-muted">
                            {group.href ? <EntityLink href={group.href}><span>{group.where}</span></EntityLink> : group.where}
                          </dt>
                          <dd className="mt-1 space-y-1 text-sm italic text-fg-secondary">
                            {group.lines.map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
