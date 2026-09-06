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
  title: 'Shops — Light Gray World Tool',
  description:
    'Every shop in Light Gray RPG, with the room it stands in, its stock, prices and any membership it requires.',
}

const { SHOPS, shopRequiresMembership } = require('@/lib/game-data/shops') as {
  SHOPS: Record<string, ShopDef>
  shopRequiresMembership?: (roomId: string) => boolean
}

type ShopDef = { name: string; stock: string[]; membership?: string }

export default async function ShopsPage() {
  const roomIds = Object.keys(SHOPS)
  const stockSlugs = Array.from(new Set(Object.values(SHOPS).flatMap((s) => s.stock ?? [])))

  // Prices and names come from the item templates, not the shop table — the
  // shop only says what it carries, so a value change never has to be mirrored.
  const [rooms, templates] = await Promise.all([
    prisma.room.findMany({
      where: { roomId: { in: roomIds } },
      select: { roomId: true, name: true },
    }),
    stockSlugs.length
      ? prisma.itemTemplate.findMany({
          where: { slug: { in: stockSlugs } },
          select: { slug: true, name: true, value: true, metadata: true },
        })
      : Promise.resolve([]),
  ])

  const roomName = new Map(rooms.map((r) => [r.roomId, r.name]))
  const bySlug = new Map(templates.map((t) => [t.slug, t]))

  const requiresMembership = (roomId: string) => {
    try {
      return shopRequiresMembership?.(roomId) ?? false
    } catch {
      return false
    }
  }

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="shops" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Shops</h1>
          <p className="mt-1 max-w-4xl text-sm text-fg-secondary">
            {roomIds.length} shops. Stock comes from the shop table; names, icons and prices are
            read live from the item templates, so a repriced item is repriced here too.
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-2">
          {roomIds.map((roomId) => {
            const shop = SHOPS[roomId]
            const gated = requiresMembership(roomId)
            return (
              <section
                key={roomId}
                className="overflow-hidden rounded-lg border border-line-subtle bg-surface-panel/30"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-panel/70 px-3 py-2">
                  <span className="font-semibold text-fg-bright">{shop.name}</span>
                  {gated && <Tag className="border-mood-arcane/60 text-mood-arcane">members</Tag>}
                  <EntityLink
                    href={roomHref(roomId)}
                    title={`Room ${roomId} in the World Atlas`}
                    className="ml-auto font-mono text-xs"
                  >
                    #{roomId} {roomName.get(roomId) ?? ''}
                  </EntityLink>
                </div>

                {(shop.stock ?? []).length === 0 ? (
                  <p className="px-3 py-3 text-sm italic text-fg-disabled">Sells nothing yet.</p>
                ) : (
                  <ul className="divide-y divide-line-subtle/60">
                    {shop.stock.map((slug) => {
                      const t = bySlug.get(slug)
                      const meta = (t?.metadata as { icon?: string } | null) ?? null
                      return (
                        <li key={slug} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                          <Icon name={resolveItemIcon(meta, slug)} size={18} />
                          <EntityLink href={itemHref(slug)}>{t?.name ?? slug}</EntityLink>
                          <span className="ml-auto tabular-nums text-resource-gold">
                            {t ? t.value.toLocaleString() : '—'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
