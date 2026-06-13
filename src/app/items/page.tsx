export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import ItemsTable, { type ItemRow } from './ItemsTable'
import WikiNav from '@/components/WikiNav'
import { resolveItemIcon } from '@/lib/item-actions'

export const metadata = {
  title: 'Item Compendium — Light Gray RPG',
  description: 'Every item in Light Gray RPG, with their stats, value, and properties.',
}

// Item data is the canonical source — read live from the database so this page
// never drifts out of date when items are added or edited.

// Map each equip slot to a friendly group label. Items are bucketed by their
// equip slot; consumables and misc items get their own buckets.
const SLOT_LABELS: Record<string, string> = {
  MAIN_HAND: 'Main Hand',
  OFF_HAND: 'Off Hand',
  HEAD: 'Head',
  BODY: 'Body',
  HANDS: 'Hands',
  FEET: 'Feet',
  RING: 'Ring',
  NECK: 'Neck',
}

// Display order for groups. Any group not listed here is appended afterward,
// so nothing ever disappears. Weapons are split by type (1H / 2H / Ranged)
// rather than lumped under a single "Main Hand" slot.
const GROUP_ORDER = [
  '1H',
  '2H',
  'Ranged',
  'Off Hand',
  'Head',
  'Body',
  'Hands',
  'Feet',
  'Ring',
  'Neck',
  'Consumable',
  'Misc',
]

// Decide which display group an item belongs to. Anything with a weaponCategory
// is a weapon: RANGED → "Ranged", otherwise 1H/2H based on the two-handed flag.
function groupFor(
  item: { type: string; equipSlot: string | null; weaponCategory: string | null },
  meta: ItemMetadata
): string {
  if (item.weaponCategory === 'RANGED') return 'Ranged'
  if (item.weaponCategory === 'MELEE') return meta.isTwoHanded ? '2H' : '1H'
  if (item.type === 'CONSUMABLE') return 'Consumable'
  if (item.equipSlot && SLOT_LABELS[item.equipSlot]) return SLOT_LABELS[item.equipSlot]
  return 'Misc'
}

type ItemMetadata = {
  icon?: string
  isTwoHanded?: boolean
  statMods?: { str?: number; dex?: number; mag?: number; def?: number }
}

export default async function ItemsPage() {
  const items = await prisma.itemTemplate.findMany({
    orderBy: { id: 'asc' },
    select: {
      slug: true,
      name: true,
      type: true,
      value: true,
      maxStack: true,
      maxPerPlayer: true,
      canSell: true,
      canDrop: true,
      equipSlot: true,
      weaponCategory: true,
      metadata: true,
    },
  })

  const rows: ItemRow[] = items.map((item, i) => {
    const meta = (item.metadata ?? {}) as ItemMetadata
    const stats = meta.statMods ?? {}
    const group = groupFor(item, meta)
    const isWeapon = group === '1H' || group === '2H' || group === 'Ranged'
    return {
      order: i,
      slug: item.slug,
      name: item.name,
      // Resolve icons the same way the inventory UI does: prefer metadata.icon,
      // then fall back to slug-based sprite lookup (e.g. `equipment-${slug}`),
      // finally a generic icon. Without this, items lacking metadata.icon show
      // a blank placeholder even though a matching sprite exists.
      icon: resolveItemIcon(meta, item.slug),
      group,
      type: item.type,
      weaponType: isWeapon ? group : null,
      value: item.value,
      str: stats.str ?? 0,
      dex: stats.dex ?? 0,
      mag: stats.mag ?? 0,
      def: stats.def ?? 0,
      maxStack: item.maxStack,
      maxPerPlayer: item.maxPerPlayer ?? null,
      canSell: item.canSell,
      canDrop: item.canDrop,
    }
  })

  // Ordered list of groups present in the data.
  const groups = Array.from(new Set(rows.map((r) => r.group))).sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a)
    const ib = GROUP_ORDER.indexOf(b)
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib)
  })

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <WikiNav active="items" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-100">Item Compendium</h1>
          <p className="mt-1 text-sm text-gray-400">
            {rows.length} items — pulled live from the game data.
          </p>
        </header>
        <ItemsTable rows={rows} groups={groups} />
      </div>
    </div>
  )
}
