export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import PerksTable, { type PerkRow, type PerkEnemyRow } from './PerksTable'

export const metadata = {
  title: 'Enemy Perks — Light Gray World Tool',
  description:
    'Every enemy perk: its rule, how often it fires, how to answer it, and which enemies carry it.',
}

type CatalogPerk = Omit<PerkRow, 'order' | 'groupLabel' | 'carriers'>
type Trait = { id: string; label: string }
type Enemy = { slug: string; name: string; icon: string; level: number; zone: string; hp: number; att: number; def: number }

// The page is a projection of the definitions combat reads: the catalog names
// each kind of perk, and every carrier is found by asking each enemy for its
// own trait tags — the same call the battle HUD makes.
const { getEnemyTraits, getEnemyPerkCatalog, PERK_GROUPS } = require('@/lib/game-data/enemy-traits') as {
  getEnemyTraits: (enemy: Enemy) => Trait[]
  getEnemyPerkCatalog: () => CatalogPerk[]
  PERK_GROUPS: { id: string; label: string; blurb: string }[]
}
const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: Enemy[] }

/** What varies per carrier, when something does: "50%", "Triple Hit". */
function carrierNote(perkId: string, label: string): string {
  if (perkId === 'extra-hits') return label
  return label.match(/\d+%/)?.[0] ?? ''
}

export default function EnemyPerksPage() {
  const catalog = getEnemyPerkCatalog()
  const groupLabel = new Map(PERK_GROUPS.map((g) => [g.id, g.label]))
  const perkName = new Map(catalog.map((p) => [p.id, p.name]))

  const carriers = new Map<string, PerkRow['carriers']>()
  const enemies: PerkEnemyRow[] = []
  const zones: string[] = []
  for (const e of ENEMIES) {
    const traits = getEnemyTraits(e)
    const zone = e.zone || 'Unsorted'
    if (!zones.includes(zone)) zones.push(zone)
    for (const t of traits) {
      const list = carriers.get(t.id) ?? []
      list.push({ slug: e.slug, name: e.name, level: e.level, zone, note: carrierNote(t.id, t.label) })
      carriers.set(t.id, list)
    }
    enemies.push({
      slug: e.slug,
      name: e.name,
      icon: e.icon,
      level: e.level,
      zone,
      hp: e.hp,
      att: e.att,
      def: e.def,
      perks: traits.map((t) => ({ id: t.id, label: t.label, name: perkName.get(t.id) ?? t.label })),
    })
  }

  const perks: PerkRow[] = catalog.map((p, order) => ({
    ...p,
    order,
    groupLabel: groupLabel.get(p.group) ?? p.group,
    carriers: (carriers.get(p.id) ?? []).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fg-bright">Enemy Perks</h1>
        <p className="mt-1 max-w-3xl text-sm text-fg-secondary">
          {perks.length} perks across {enemies.filter((e) => e.perks.length > 0).length} of {ENEMIES.length} enemies — pulled live from the game data. An
          ordinary attack is the enemy&rsquo;s roll minus your block roll, floored at zero; every perk changes one side
          of that line.
        </p>
      </header>
      <PerksTable perks={perks} enemies={enemies} zones={zones} groups={PERK_GROUPS} />
    </div>
  )
}
