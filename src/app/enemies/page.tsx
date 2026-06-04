export const runtime = 'nodejs'

import { prisma } from '@/lib/prisma'
import EnemiesTable, { type EnemyRow } from './EnemiesTable'

export const metadata = {
  title: 'Bestiary — Light Gray RPG',
  description: 'Every enemy in Light Gray RPG, with their stats and drops.',
}

// Enemy data is the canonical source — imported live from the game-data module
// so this page never drifts out of date when enemies are added or edited.
type EnemyDropEntry = { itemSlug: string; chance: number }
type EnemyDrops = {
  main?: EnemyDropEntry[]
  always?: string[]
  firstKill?: string[]
}
type Enemy = {
  slug: string
  zone: string
  name: string
  icon: string
  level: number
  hp: number
  att: number
  def: number
  isAggressive: boolean
  isFriendly: boolean
  isFlying: boolean
  xpReward: number
  goldMin: number
  goldMax: number
  drops: EnemyDrops
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: Enemy[] }

// Display order for zones. Any zone not listed here is appended afterward,
// and enemies without a zone fall into "Unsorted" — so nothing ever disappears.
const ZONE_ORDER = ['Grassy Field', 'Spider Cave', 'Scorpion Pit', 'Bat Cave']

// Turn a slug like "padded-armor" into "Padded Armor" — only used as a
// fallback when a drop's item isn't found in the database.
function prettifySlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Collect all slugs from all three drop lists on one enemy.
function allDropSlugs(drops: EnemyDrops): string[] {
  return [
    ...(drops.main ?? []).map((d) => d.itemSlug),
    ...(drops.always ?? []),
    ...(drops.firstKill ?? []),
  ]
}

// Consolidate main drop entries by slug, summing their chances.
function consolidateMain(entries: EnemyDropEntry[]): { itemSlug: string; chance: number }[] {
  const map = new Map<string, number>()
  for (const e of entries) map.set(e.itemSlug, (map.get(e.itemSlug) ?? 0) + e.chance)
  return Array.from(map.entries()).map(([itemSlug, chance]) => ({ itemSlug, chance }))
}

export default async function EnemiesPage() {
  // Resolve drop item slugs to their canonical display names from the DB,
  // so renaming an item in the source updates the name shown here too.
  const dropSlugs = Array.from(new Set(ENEMIES.flatMap((e) => allDropSlugs(e.drops))))
  const items = dropSlugs.length
    ? await prisma.itemTemplate.findMany({
        where: { slug: { in: dropSlugs } },
        select: { slug: true, name: true },
      })
    : []
  const itemNameBySlug = new Map(items.map((i) => [i.slug, i.name]))

  function resolveName(slug: string) {
    return itemNameBySlug.get(slug) ?? prettifySlug(slug)
  }

  // Build serializable rows for the client table (drop names resolved here).
  // `order` preserves the source-file order — the default sort.
  const rows: EnemyRow[] = ENEMIES.map((e, i) => {
    const { main = [], always = [], firstKill = [] } = e.drops
    const drops: EnemyRow['drops'] = [
      ...always.map((slug) => ({ name: resolveName(slug), chance: 100, tag: 'always' as const })),
      ...firstKill.map((slug) => ({ name: resolveName(slug), chance: 100, tag: 'first-kill' as const })),
      ...consolidateMain(main).map((d) => ({
        name: resolveName(d.itemSlug),
        chance: Math.round(d.chance * 100),
      })),
    ]
    return {
      order: i,
      slug: e.slug,
      zone: e.zone || 'Unsorted',
      name: e.name,
      icon: e.icon,
      level: e.level,
      hp: e.hp,
      att: e.att,
      def: e.def,
      xp: e.xpReward,
      goldMin: e.goldMin,
      goldMax: e.goldMax,
      isAggressive: e.isAggressive,
      isFlying: e.isFlying,
      isFriendly: e.isFriendly,
      drops,
    }
  })

  // Ordered list of zones present in the data.
  const zones = Array.from(new Set(rows.map((r) => r.zone))).sort((a, b) => {
    const ia = ZONE_ORDER.indexOf(a)
    const ib = ZONE_ORDER.indexOf(b)
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  })

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Bestiary</h1>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length} enemies — pulled live from the game data.
          </p>
        </header>
        <EnemiesTable rows={rows} zones={zones} />
      </div>
    </div>
  )
}
