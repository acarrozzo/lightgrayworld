export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import WorldToolNav from '@/components/WorldToolNav'
import Icon from '@/components/Icon'
import { EntityLink } from '@/components/world-tool/EntityLink'
import { itemHref, roomHref } from '@/components/world-tool/hrefs'
import { Tag } from '@/components/world-tool/ui'
import { resolveItemIcon } from '@/lib/item-actions'

export const metadata = {
  title: 'Chests — Light Gray World Tool',
  description:
    'Every chest in Light Gray RPG — the one-time gold chests and the repeatable ones — with their loot tables, odds and rooms.',
}

const { CHEST_LOOT, REPEATABLE_CHEST_LOOT } = require('@/lib/game-engine/room-action-handlers') as {
  CHEST_LOOT: Record<string, Record<string, ChestLoot>>
  REPEATABLE_CHEST_LOOT: RepeatableChest[]
}
const { GOLD_CHEST_FLAG_BY_ROOM } = require('@/lib/game-data/gold-chests') as {
  GOLD_CHEST_FLAG_BY_ROOM: Record<string, string>
}

type ChestItem = { itemSlug: string; quantity?: number; highlighted?: boolean }
type ChestLoot = { label: string; xp?: number; items?: ChestItem[]; randomItems?: ChestItem[] }
type PoolEntry = ChestItem & { quantityMin?: number; quantityMax?: number }
type RepeatableChest = { roomId: string; action: string; label: string; pools?: PoolEntry[][] }

export default async function ChestsPage() {
  const oneTime = Object.entries(CHEST_LOOT).flatMap(([roomId, actions]) =>
    Object.entries(actions).map(([action, chest]) => ({ roomId, action, chest }))
  )

  // Filtered: a couple of pool entries carry no itemSlug, and an undefined
  // inside a Prisma `in` array is a validation error rather than a no-op.
  const slugs = Array.from(
    new Set([
      ...oneTime.flatMap(({ chest }) => [
        ...(chest.items ?? []).map((i) => i.itemSlug),
        ...(chest.randomItems ?? []).map((i) => i.itemSlug),
      ]),
      ...REPEATABLE_CHEST_LOOT.flatMap((c) =>
        (c.pools ?? []).flat().map((e) => e.itemSlug)
      ),
    ].filter((s): s is string => typeof s === 'string' && s.length > 0))
  )

  const roomIds = Array.from(
    new Set([...oneTime.map((c) => c.roomId), ...REPEATABLE_CHEST_LOOT.map((c) => c.roomId)])
  )

  const [templates, rooms] = await Promise.all([
    slugs.length
      ? prisma.itemTemplate.findMany({
          where: { slug: { in: slugs } },
          select: { slug: true, name: true, metadata: true },
        })
      : Promise.resolve([]),
    prisma.room.findMany({ where: { roomId: { in: roomIds } }, select: { roomId: true, name: true } }),
  ])
  const bySlug = new Map(templates.map((t) => [t.slug, t]))
  const roomName = new Map(rooms.map((r) => [r.roomId, r.name]))

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="chests" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Chests</h1>
          <p className="mt-1 max-w-4xl text-sm text-fg-secondary">
            {oneTime.length} one-time gold chests and {REPEATABLE_CHEST_LOOT.length} repeatable
            chests. A gold chest can be opened once per character and is remembered by a flag on
            the player row; a repeatable chest rolls one entry from each of its pools every time
            it is opened.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-fg-bright">Gold chests — once per character</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {oneTime.map(({ roomId, action, chest }) => (
              <article
                key={`${roomId}:${action}`}
                className="overflow-hidden rounded-lg border border-line-subtle bg-surface-panel/30"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-panel/70 px-3 py-2">
                  <span className="font-semibold text-fg-bright">{chest.label}</span>
                  {GOLD_CHEST_FLAG_BY_ROOM[roomId] && (
                    <Tag>{GOLD_CHEST_FLAG_BY_ROOM[roomId]}</Tag>
                  )}
                  {chest.xp != null && (
                    <span className="text-xs text-status-success">{chest.xp} XP</span>
                  )}
                  <EntityLink href={roomHref(roomId)} className="ml-auto font-mono text-xs">
                    #{roomId} {roomName.get(roomId) ?? ''}
                  </EntityLink>
                </div>
                <div className="px-3 py-2">
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-fg-disabled">
                    Command: <span className="font-mono text-fg-muted">{action}</span>
                  </p>
                  <LootList items={chest.items ?? []} bySlug={bySlug} />
                  {(chest.randomItems ?? []).length > 0 && (
                    <>
                      <p className="mb-1 mt-2 text-[10px] uppercase tracking-wide text-fg-disabled">
                        Plus one at random
                      </p>
                      <LootList items={chest.randomItems ?? []} bySlug={bySlug} />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-fg-bright">Repeatable chests</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {REPEATABLE_CHEST_LOOT.map((chest) => (
              <article
                key={`${chest.roomId}:${chest.action}`}
                className="overflow-hidden rounded-lg border border-line-subtle bg-surface-panel/30"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-panel/70 px-3 py-2">
                  <span className="font-semibold text-fg-bright">{chest.label}</span>
                  <EntityLink href={roomHref(chest.roomId)} className="ml-auto font-mono text-xs">
                    #{chest.roomId} {roomName.get(chest.roomId) ?? ''}
                  </EntityLink>
                </div>
                <div className="space-y-2 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-fg-disabled">
                    Command: <span className="font-mono text-fg-muted">{chest.action}</span>
                  </p>
                  {(chest.pools ?? []).map((pool, i) => (
                    <div key={i}>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-fg-disabled">
                        Pool {i + 1} — one of {pool.length}
                      </p>
                      <LootList items={pool} bySlug={bySlug} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function LootList({
  items,
  bySlug,
}: {
  items: (ChestItem & { quantityMin?: number; quantityMax?: number })[]
  bySlug: Map<string, { slug: string; name: string; metadata: unknown }>
}) {
  if (items.length === 0) return <p className="text-xs italic text-fg-disabled">Nothing.</p>
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {items.map((it, i) => {
        const t = bySlug.get(it.itemSlug)
        const meta = (t?.metadata as { icon?: string } | null) ?? null
        const qty =
          it.quantityMin != null && it.quantityMax != null
            ? `×${it.quantityMin}-${it.quantityMax}`
            : (it.quantity ?? 1) > 1
              ? `×${it.quantity}`
              : ''
        return (
          <li key={`${it.itemSlug}:${i}`} className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon name={resolveItemIcon(meta, it.itemSlug)} size={16} />
            <EntityLink
              href={itemHref(it.itemSlug)}
              className={it.highlighted ? 'font-semibold' : ''}
            >
              {t?.name ?? it.itemSlug}
            </EntityLink>
            {qty && <span className="text-xs text-fg-muted">{qty}</span>}
          </li>
        )
      })}
    </ul>
  )
}
