export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { cachedWorldToolData } from '@/lib/world-tool/cached'
import Icon from '@/components/Icon'
import AnchorTarget from '@/components/world-tool/AnchorTarget'
import { EntityLink } from '@/components/world-tool/EntityLink'
import { enemyHref, itemHref, roomHref } from '@/components/world-tool/hrefs'
import { Section, Tag } from '@/components/world-tool/ui'

export const metadata = {
  title: 'Travelers — Light Gray World Tool',
  description:
    'The NPCs and creatures that move between rooms: where each roams or the loop it walks, how fast, what it says and what it sells.',
}

type Stop = { roomId: string; via: string; dwellMs: number; region: string }
type Traveler = {
  id: string
  kind: string
  name: string
  title?: string
  description: string
  icon: string
  enemySlug?: string
  respawnMs?: number
  movement:
    | { type: 'wander'; rooms: string[]; everyMs: [number, number] }
    | { type: 'route'; stops: Stop[] }
  actions: { action: string; label: string }[]
  shop?: { name: string; stock: string[]; extraByRegion?: Record<string, string[]> }
  lines: Record<string, unknown>
}

const { TRAVELERS, routePeriodMs } = require('@/lib/game-data/travelers') as {
  TRAVELERS: Traveler[]
  routePeriodMs: (t: Traveler) => number
}
const { getEnemy } = require('@/lib/game-data/enemies') as {
  getEnemy: (slug: string) => { name: string; level: number; hp: number; att: number; def: number } | null
}

const REGION_LABEL: Record<string, string> = {
  grassyField: 'Grassy Field',
  forest: 'Forest',
  redTown: 'Red Town',
  rockyFlats: 'Rocky Flats',
}

const minutes = (ms: number) => {
  const m = ms / 60000
  return Number.isInteger(m) ? `${m} min` : `${m.toFixed(1)} min`
}

// Room names and stock names come from the database; the registry only knows ids.
const loadTravelerData = cachedWorldToolData('travelers', () => {
  const roomIds = new Set<string>()
  const slugs = new Set<string>()
  for (const t of TRAVELERS) {
    if (t.movement.type === 'wander') t.movement.rooms.forEach((r) => roomIds.add(r))
    else t.movement.stops.forEach((s) => roomIds.add(s.roomId))
    t.shop?.stock.forEach((s) => slugs.add(s))
    Object.values(t.shop?.extraByRegion ?? {}).flat().forEach((s) => slugs.add(s))
  }
  return Promise.all([
    prisma.room.findMany({ where: { roomId: { in: Array.from(roomIds) } }, select: { roomId: true, name: true } }),
    prisma.itemTemplate.findMany({ where: { slug: { in: Array.from(slugs) } }, select: { slug: true, name: true, value: true } }),
  ])
})

/** Every line of dialogue a traveler carries, flattened with where it applies. */
function collectLines(lines: Record<string, unknown>, roomName: Map<string, string>) {
  const out: { where: string; lines: string[] }[] = []
  for (const [key, value] of Object.entries(lines)) {
    if (Array.isArray(value)) {
      out.push({ where: key, lines: value as string[] })
    } else if (value && typeof value === 'object') {
      for (const [sub, list] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(list)) {
          out.push({ where: `${key} · ${roomName.get(sub) ?? sub}`, lines: list as string[] })
        } else if (list && typeof list === 'object') {
          for (const [leaf, inner] of Object.entries(list as Record<string, string[]>)) {
            out.push({ where: `${key} · toward ${roomName.get(leaf) ?? leaf}`, lines: inner })
          }
        }
      }
    }
  }
  return out
}

export default async function TravelersPage() {
  const [rooms, templates] = await loadTravelerData()
  const roomName = new Map(rooms.map((r) => [r.roomId, r.name]))
  const item = new Map(templates.map((t) => [t.slug, t]))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <AnchorTarget />
      <h1 className="text-2xl font-bold text-fg-bright">Travelers</h1>
      <p className="mt-1 text-sm text-fg-muted">
        The original game had nobody who walked. These do. A <em>wanderer</em> picks an adjacent room of its range on its own
        clock and forgets where it was on a server restart; a <em>route</em> traveler walks a fixed loop anchored to the clock,
        so every server agrees where it is. Everyone in a room sees the same traveler.
      </p>

      <div className="mt-6 space-y-8">
        {TRAVELERS.map((t) => {
          const enemy = t.enemySlug ? getEnemy(t.enemySlug) : null
          const dialogue = collectLines(t.lines, roomName)
          return (
            <section key={t.id} id={t.id} data-anchor={t.id} className="rounded-lg border border-line-subtle bg-surface-panel p-4">
              <div className="flex items-start gap-3">
                <Icon name={t.icon} size={44} className="shrink-0 text-fg-bright" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-fg-bright">
                      {t.name}
                      {t.title ? <span className="text-fg-muted font-normal"> {t.title}</span> : null}
                    </h2>
                    <Tag>{t.kind}</Tag>
                    <Tag>{t.movement.type === 'route' ? 'route' : 'wanders'}</Tag>
                    {enemy && <Tag className="border-action-attack/40 text-enemy-hostile">fightable</Tag>}
                    {t.shop && <Tag className="border-resource-gold/40 text-resource-gold">shop</Tag>}
                  </div>
                  <p className="mt-1 text-sm text-fg-secondary">{t.description}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <Section title="Movement">
                  {t.movement.type === 'wander' ? (
                    <div className="text-sm text-fg-secondary">
                      <p>
                        Moves to a neighbouring room every {minutes(t.movement.everyMs[0])} to {minutes(t.movement.everyMs[1])}.
                        {t.respawnMs ? ` Killed, it is gone for ${minutes(t.respawnMs)} and comes back somewhere in its range.` : ''}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {t.movement.rooms.map((r) => (
                          <li key={r}>
                            <EntityLink href={roomHref(r)}>
                              <span className="text-xs">#{r} {roomName.get(r) ?? ''}</span>
                            </EntityLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-sm text-fg-secondary">
                      <p>
                        One loop every {minutes(routePeriodMs(t))}, anchored to the clock. Stops are listed in walking order with how
                        long the cart rests at each.
                      </p>
                      <ol className="mt-2 space-y-0.5 text-xs">
                        {t.movement.stops.map((s, i) => (
                          <li key={`${s.roomId}-${i}`} className="flex items-center gap-2">
                            <span className="w-5 text-right text-fg-disabled">{i + 1}.</span>
                            <EntityLink href={roomHref(s.roomId)}>
                              <span>#{s.roomId} {roomName.get(s.roomId) ?? ''}</span>
                            </EntityLink>
                            <span className="text-fg-disabled">via {s.via}</span>
                            <span className="ml-auto text-fg-muted">{minutes(s.dwellMs)}</span>
                            <span className="w-24 text-right text-fg-disabled">{REGION_LABEL[s.region] ?? s.region}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Section>

                <div className="space-y-6">
                  <Section title="Actions">
                    <ul className="flex flex-wrap gap-1.5">
                      {t.actions.map((a) => (
                        <li key={a.action}>
                          <Tag>{a.label} · {a.action}</Tag>
                        </li>
                      ))}
                      {enemy && (
                        <li>
                          <Tag className="border-action-attack/40 text-enemy-hostile">Attack · start_battle</Tag>
                        </li>
                      )}
                    </ul>
                  </Section>

                  {enemy && (
                    <Section title="As an enemy">
                      <p className="text-sm text-fg-secondary">
                        <EntityLink href={enemyHref(t.enemySlug!)}>{enemy.name}</EntityLink>
                        {' '}· Lv {enemy.level} · HP {enemy.hp} · ATT {enemy.att} · DEF {enemy.def}. Fought per player; a kill takes the
                        shared {t.name.toLowerCase()} away for everyone until it respawns.
                      </p>
                    </Section>
                  )}

                  {t.shop && (
                    <Section title={t.shop.name}>
                      <p className="text-xs text-fg-muted">Always on the cart:</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {t.shop.stock.map((slug) => (
                          <li key={slug}>
                            <EntityLink href={itemHref(slug)}>
                              <span className="text-xs">{item.get(slug)?.name ?? slug}{item.get(slug) ? ` · ${item.get(slug)!.value}g` : ''}</span>
                            </EntityLink>
                          </li>
                        ))}
                      </ul>
                      {t.shop.extraByRegion && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(t.shop.extraByRegion).map(([region, slugs]) => (
                            <p key={region} className="text-xs text-fg-secondary">
                              <span className="text-fg-muted">{REGION_LABEL[region] ?? region}:</span>{' '}
                              {slugs.map((slug, i) => (
                                <span key={slug}>
                                  {i > 0 ? ', ' : ''}
                                  <EntityLink href={itemHref(slug)}>{item.get(slug)?.name ?? slug}</EntityLink>
                                </span>
                              ))}
                            </p>
                          ))}
                        </div>
                      )}
                    </Section>
                  )}
                </div>
              </div>

              {dialogue.length > 0 && (
                <div className="mt-6">
                  <Section title="Lines">
                    <div className="space-y-3">
                      {dialogue.map((group) => (
                        <div key={group.where}>
                          <div className="text-[11px] uppercase tracking-wide text-fg-muted">{group.where}</div>
                          <ul className="mt-1 space-y-0.5 text-sm text-fg-secondary">
                            {group.lines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
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
