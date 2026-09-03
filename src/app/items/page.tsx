export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import ItemsTable, { type ItemRow } from './ItemsTable'
import WorldToolNav from '@/components/WorldToolNav'
import { resolveItemIcon } from '@/lib/item-actions'

// Source data — where equipable items come from in the world. Required live so
// the column tracks any change to room loot or enemy drop tables.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ROOM_LOOT } = require('@/lib/game-engine/config/room-loot') as {
  ROOM_LOOT: { roomId: string; slug: string; quantity?: number }[]
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ENEMIES } = require('@/lib/game-data/enemies') as { ENEMIES: EnemySource[] }
// Chest loot tables (keyed by roomId → action) and the room-search loot tables
// — read live so the source column reflects any change to either.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CHEST_LOOT, REPEATABLE_CHEST_LOOT, ROOM_ACTIONS } = require('@/lib/game-engine/room-action-handlers') as {
  CHEST_LOOT: Record<string, Record<string, ChestLoot>>
  REPEATABLE_CHEST_LOOT: RepeatableChest[]
  ROOM_ACTIONS: Record<string, Record<string, RoomActionEntry>>
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SEARCH_LOOT_TABLES } = require('@/lib/game-engine/room-state') as {
  SEARCH_LOOT_TABLES: Record<string, SearchTable>
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QUESTS = require('@/lib/game-data/quests.json') as Record<string, QuestDef>

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
  MOUNT: 'Mount',
  ARTIFACT: 'Artifact',
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
  'Mount',
  'Artifact',
  'Consumable',
  'Crafting',
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
  if (meta.crafting?.kind) return 'Crafting'
  return 'Misc'
}

type ItemMetadata = {
  icon?: string
  isTwoHanded?: boolean
  statMods?: { str?: number; dex?: number; mag?: number; def?: number }
  crafting?: { kind?: 'tool' | 'material' }
}

// --- Enemy drop source shapes (mirrors the Bestiary's resolution) -----------
type QtyShape = { qty?: number; min?: number; max?: number }
type EnemyDropEntry = { itemSlug: string; chance: number } & QtyShape
type AlwaysDrop = string | ({ itemSlug: string } & QtyShape)
type EnemyDrops = { main?: EnemyDropEntry[]; always?: AlwaysDrop[]; firstKill?: string[] }
type EnemySource = { name: string; drops: EnemyDrops }

// --- Quest / chest / search source shapes -----------------------------------
type QuestReward = { type: string; itemSlug?: string; quantity?: number }
type QuestDef = { title: string; rewards?: QuestReward[] }
type ChestItem = { itemSlug: string; quantity?: number }
type ChestLoot = { label: string; items: ChestItem[]; randomItems?: ChestItem[] }
// A repeatable chest rolls one entry out of each of its pools per open, and a
// pool entry may declare a quantity range instead of a fixed count.
type RepeatablePoolEntry = ChestItem & { quantityMin?: number; quantityMax?: number }
type RepeatableChest = { roomId: string; action: string; label: string; pools?: RepeatablePoolEntry[][] }
// Search entries grant an item, currency, or nothing. We only index item grants;
// quantity may be fixed (`quantity`) or a range (`minQty`/`maxQty`).
type SearchEffect = {
  type: string
  itemSlug?: string
  quantity?: number
  minQty?: number
  maxQty?: number
}
type SearchTable = { entries: { effect?: SearchEffect }[] }

// --- Gather (timed room resource) source shapes -----------------------------
// A room action is a structured gather def, a plain message string, or a custom
// handler function. Only the structured form (a cooldown + grantItem effect) is
// a gatherable resource; the rest are narrowed out at runtime.
type GatherEffect = { type: string; itemSlug?: string; quantity?: number }
type GatherActionDef = { isGather?: boolean; cooldownMs?: number; maxHeld?: number; toolRequired?: string; toolRequiredAny?: string[]; effects?: GatherEffect[] }
type RoomActionEntry = string | GatherActionDef | ((...args: never[]) => unknown)

// Render a cooldown interval as a compact label ("5m", "30m", "1h", "1h30m").
function formatCooldown(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 60) return `${totalMin}m`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  return mins === 0 ? `${hours}h` : `${hours}h${mins}m`
}

// Human-readable quantity suffix ("" for 1, " ×2" fixed, " ×1-3" range).
function qtyLabel(entry: QtyShape): string {
  if (entry.min != null || entry.max != null) {
    const min = entry.min ?? 1
    const max = entry.max ?? min
    return min === max ? (max > 1 ? ` ×${max}` : '') : ` ×${min}-${max}`
  }
  const qty = entry.qty ?? 1
  return qty > 1 ? ` ×${qty}` : ''
}

// Normalize an `always` entry to its slug plus a quantity suffix.
function normalizeAlways(entry: AlwaysDrop): { slug: string; qtyLabel: string } {
  if (typeof entry === 'string') return { slug: entry, qtyLabel: '' }
  return { slug: entry.itemSlug, qtyLabel: qtyLabel(entry) }
}

// Consolidate main drop entries by slug, summing their chances.
function consolidateMain(entries: EnemyDropEntry[]): { itemSlug: string; chance: number; qtyLabel: string }[] {
  const map = new Map<string, { chance: number; qtyLabel: string }>()
  for (const e of entries) {
    const prev = map.get(e.itemSlug)
    map.set(e.itemSlug, { chance: (prev?.chance ?? 0) + e.chance, qtyLabel: prev?.qtyLabel || qtyLabel(e) })
  }
  return Array.from(map.entries()).map(([itemSlug, v]) => ({ itemSlug, ...v }))
}

// Build a slug → sources map from room loot and enemy drop tables. `roomNames`
// resolves a roomId to its friendly name. An item slug only appears here if
// something in the world places or drops it.
function buildSourceMap(roomNames: Map<string, string>): Map<string, ItemRow['sources']> {
  const sources = new Map<string, ItemRow['sources']>()
  const ensure = (slug: string) => {
    let s = sources.get(slug)
    if (!s) {
      s = { rooms: [], enemies: [], quests: [], chests: [], searches: [], gathers: [] }
      sources.set(slug, s)
    }
    return s
  }

  // Rooms — consolidate duplicate roomId/slug entries by summing quantity.
  const roomQty = new Map<string, { roomId: string; quantity: number }>()
  for (const entry of ROOM_LOOT) {
    const key = `${entry.slug}|${entry.roomId}`
    const prev = roomQty.get(key)
    roomQty.set(key, { roomId: entry.roomId, quantity: (prev?.quantity ?? 0) + (entry.quantity ?? 1) })
  }
  for (const [key, { roomId, quantity }] of roomQty) {
    const slug = key.split('|')[0]
    const name = roomNames.get(roomId) ?? `Room ${roomId}`
    ensure(slug).rooms.push({ label: quantity > 1 ? `${name} ×${quantity}` : name })
  }

  // Enemies — firstKill, always, then weighted main rolls (as a percentage).
  for (const enemy of ENEMIES) {
    const { main = [], always = [], firstKill = [] } = enemy.drops ?? {}
    for (const slug of firstKill) {
      ensure(slug).enemies.push({ name: enemy.name, label: 'first-kill' })
    }
    for (const a of always) {
      const { slug, qtyLabel } = normalizeAlways(a)
      ensure(slug).enemies.push({ name: enemy.name, label: `100%${qtyLabel}` })
    }
    for (const d of consolidateMain(main)) {
      ensure(d.itemSlug).enemies.push({ name: enemy.name, label: `${Math.round(d.chance * 100)}%${d.qtyLabel}` })
    }
  }

  // Fixed-quantity suffix ("" for 1, " ×3" otherwise).
  const fixedQty = (qty?: number) => (qty && qty > 1 ? ` ×${qty}` : '')

  // Quests — item rewards. The quest title is the friendly source label.
  for (const quest of Object.values(QUESTS)) {
    for (const reward of quest.rewards ?? []) {
      if (reward.type !== 'item' || !reward.itemSlug) continue
      ensure(reward.itemSlug).quests.push({ label: `${quest.title}${fixedQty(reward.quantity)}` })
    }
  }

  // Chests — every item in each chest's loot table, plus anything in its random
  // bonus pool (one of which is rolled per open) so those items still show a source.
  for (const roomChests of Object.values(CHEST_LOOT)) {
    for (const chest of Object.values(roomChests)) {
      for (const item of chest.items ?? []) {
        ensure(item.itemSlug).chests.push({ label: `${chest.label}${fixedQty(item.quantity)}` })
      }
      for (const item of chest.randomItems ?? []) {
        ensure(item.itemSlug).chests.push({ label: `${chest.label} (random)` })
      }
    }
  }

  // Repeatable chests — one entry is rolled per pool on every open, so every
  // entry is a real source. Labelled "(1 of N)" when its pool has alternatives.
  for (const chest of REPEATABLE_CHEST_LOOT) {
    for (const pool of chest.pools ?? []) {
      for (const entry of pool) {
        const qty =
          entry.quantityMin != null && entry.quantityMax != null
            ? ` ×${entry.quantityMin}-${entry.quantityMax}`
            : fixedQty(entry.quantity)
        const odds = pool.length > 1 ? ` (1 of ${pool.length})` : ''
        ensure(entry.itemSlug).chests.push({ label: `${chest.label}${qty}${odds}` })
      }
    }
  }

  // Room search — distinct item slugs per loot table, labelled by room name.
  // Quantity ranges aren't shown (search odds are only roughly knowable).
  for (const [roomId, table] of Object.entries(SEARCH_LOOT_TABLES)) {
    const name = roomNames.get(roomId) ?? `Room ${roomId}`
    const seen = new Set<string>()
    for (const entry of table.entries ?? []) {
      const slug = entry.effect?.itemSlug
      if (!slug || entry.effect?.type !== 'grantItem' || seen.has(slug)) continue
      seen.add(slug)
      ensure(slug).searches.push({ label: name })
    }
  }

  // Gather actions — room resource collection (sand, dirt, stone, wheat, wood…).
  // A gatherable resource is any structured room action flagged `isGather` with
  // a grantItem effect; the label notes quantity, then what limits the node —
  // a cooldown, or a held cap for nodes that have no timer (Jack's tree) — and
  // any tool gate.
  for (const [roomId, actions] of Object.entries(ROOM_ACTIONS)) {
    const name = roomNames.get(roomId) ?? `Room ${roomId}`
    // A room can host the same node more than once (the two-tree Forest rooms):
    // collapse identical nodes into one row carrying a ×N, so the page shows the
    // room's real throughput instead of a duplicated line.
    const nodes = new Map<string, { itemSlug: string; suffix: string; count: number }>()
    for (const def of Object.values(actions)) {
      if (!def || typeof def !== 'object') continue
      if (!def.isGather && !def.cooldownMs) continue
      const grant = def.effects?.find((e) => e.type === 'grantItem' && e.itemSlug)
      if (!grant?.itemSlug) continue
      // A gate is either one named tool or a set of interchangeable tiers
      // (plain / iron hatchet); list every tool that opens it.
      const tools = def.toolRequired ? [def.toolRequired] : (def.toolRequiredAny ?? [])
      const tool = tools.length > 0 ? ` · ${tools.join(' or ')}` : ''
      const limit = def.cooldownMs
        ? ` · ${formatCooldown(def.cooldownMs)}`
        : def.maxHeld != null
          ? ` · max ${def.maxHeld} held`
          : ''
      const suffix = `${fixedQty(grant.quantity)}${limit}${tool}`
      const key = `${grant.itemSlug}|${suffix}`
      const existing = nodes.get(key)
      if (existing) existing.count += 1
      else nodes.set(key, { itemSlug: grant.itemSlug, suffix, count: 1 })
    }
    for (const { itemSlug, suffix, count } of nodes.values()) {
      ensure(itemSlug).gathers.push({ label: `${name}${count > 1 ? ` ×${count}` : ''}${suffix}` })
    }
  }

  return sources
}

export default async function ItemsPage() {
  const items = await prisma.itemTemplate.findMany({
    orderBy: { id: 'asc' },
    select: {
      slug: true,
      name: true,
      type: true,
      value: true,
      max: true,
      canSell: true,
      canDrop: true,
      equipSlot: true,
      weaponCategory: true,
      metadata: true,
    },
  })

  // Resolve roomId → friendly name so room sources read nicely.
  const dbRooms = await prisma.room.findMany({ select: { roomId: true, name: true } })
  const roomNames = new Map(dbRooms.map((r) => [r.roomId, r.name]))
  const sourceMap = buildSourceMap(roomNames)

  const rows: ItemRow[] = items.map((item, i) => {
    const meta = (item.metadata ?? {}) as ItemMetadata
    const stats = meta.statMods ?? {}
    const group = groupFor(item, meta)
    const isWeapon = group === '1H' || group === '2H' || group === 'Ranged'
    // Equipable = wields a weapon category or occupies an equip slot.
    const equipable = item.weaponCategory != null || item.equipSlot != null
    // Sources resolve for every item now — consumables and misc can come from
    // quests, chests, and room searches, not just weapons/armor.
    return {
      order: i,
      slug: item.slug,
      name: item.name,
      equipable,
      sources: sourceMap.get(item.slug) ?? { rooms: [], enemies: [], quests: [], chests: [], searches: [], gathers: [] },
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
      max: item.max,
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
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="items" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Item Compendium</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {rows.length} items — pulled live from the game data.
          </p>
        </header>
        <ItemsTable rows={rows} groups={groups} />
      </div>
    </div>
  )
}
