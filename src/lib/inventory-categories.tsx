import React from 'react'
import { InventoryItem } from '@/lib/game-state'
import { ItemType, EquipSlot } from '@prisma/client'
import { getItemOrderIndex } from '@/lib/inventory-utils'

/**
 * Shared category, filter, sort, stat-display and gear-compare helpers used by
 * the inventory panel and the shop so both stay visually and behaviorally in
 * sync. Everything here is pure presentation over the inventory payload the
 * server already sends; none of it decides an outcome.
 */

export type FilterTab =
  | 'all'
  | 'main'
  | 'off'
  | 'head'
  | 'body'
  | 'hands'
  | 'feet'
  | 'ring'
  | 'neck'
  | 'mount'
  | 'consumables'
  | 'crafting'
  | 'misc'

export type ItemCategory = Exclude<FilterTab, 'all'>
export type SlotCategory = 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'ring' | 'neck' | 'mount'

/** Top-level filter groups. The nine equipment slots collapse into "gear" (shown as Equipment). */
export type FilterGroup = 'gear' | 'consumables' | 'crafting' | 'misc'
export type SlotFilter = 'all' | SlotCategory

/** What the filter bar is showing: a group, and within gear, one slot or all. */
export interface ItemFilterView {
  group: FilterGroup
  slot: SlotFilter
}

/** Sub-grouping for crafting items, tagged via metadata.crafting.kind. */
export type CraftingKind = 'tool' | 'material'

/**
 * Return the crafting sub-kind for an item, or null if it isn't a crafting item.
 * Single source of truth for the crafting category + its tool/material split.
 */
export function getCraftingKind(item: InventoryItem): CraftingKind | null {
  const kind = (item.template.metadata as any)?.crafting?.kind
  return kind === 'tool' || kind === 'material' ? kind : null
}

/**
 * Classify an inventory item into its filter category. Single source of truth
 * for category grouping, counts, and new-item indicators.
 */
export function getItemCategory(item: InventoryItem): ItemCategory {
  switch (item.template.equipSlot) {
    case EquipSlot.MAIN_HAND: return 'main'
    case EquipSlot.OFF_HAND: return 'off'
    case EquipSlot.HEAD: return 'head'
    case EquipSlot.BODY: return 'body'
    case EquipSlot.HANDS: return 'hands'
    case EquipSlot.FEET: return 'feet'
    case EquipSlot.RING: return 'ring'
    case EquipSlot.NECK: return 'neck'
    case EquipSlot.MOUNT: return 'mount'
  }
  if (item.template.type === ItemType.CONSUMABLE) return 'consumables'
  if (getCraftingKind(item)) return 'crafting'
  return 'misc'
}

/** Filter tabs in display order. The first entry ('all') is the catch-all. */
export const INVENTORY_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'main', label: 'main hand' },
  { id: 'off', label: 'off hand' },
  { id: 'head', label: 'head' },
  { id: 'body', label: 'body' },
  { id: 'hands', label: 'hands' },
  { id: 'feet', label: 'feet' },
  { id: 'ring', label: 'ring' },
  { id: 'neck', label: 'neck' },
  { id: 'mount', label: 'mount' },
  { id: 'consumables', label: 'consumables' },
  { id: 'crafting', label: 'crafting' },
  { id: 'misc', label: 'misc' },
]

/** Category render order when showing everything grouped. */
export const CATEGORY_DISPLAY_ORDER: ItemCategory[] = INVENTORY_TABS.slice(1).map(
  (tab) => tab.id as ItemCategory
)

/** Equipment slots in the order the character panel lays them out. */
export const SLOT_CATEGORIES: SlotCategory[] = [
  'main', 'off', 'head', 'body', 'hands', 'feet', 'ring', 'neck', 'mount',
]

/** Section headers for grouped views. */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  main: 'Main hand',
  off: 'Off hand',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
  neck: 'Neck',
  mount: 'Mount',
  consumables: 'Consumables',
  crafting: 'Crafting',
  misc: 'Misc',
}

/** Short labels for the slot chip row under "Gear". */
export const SLOT_CHIP_LABELS: Record<SlotCategory, string> = {
  main: 'Main',
  off: 'Off',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  feet: 'Feet',
  ring: 'Ring',
  neck: 'Neck',
  mount: 'Mount',
}

export const FILTER_GROUPS: Array<{ id: FilterGroup; label: string }> = [
  { id: 'gear', label: 'Equipment' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'misc', label: 'Misc' },
]

// Crafting items are shown in fixed subsections (materials first, then tools)
// rather than via filter chips, so both the bag and the shop render them in a
// stable order.
export const CRAFTING_SUBSECTIONS: Array<{ kind: CraftingKind; label: string }> = [
  { kind: 'material', label: 'Materials' },
  { kind: 'tool', label: 'Tools' },
]

export function isSlotCategory(category: ItemCategory): category is SlotCategory {
  return (SLOT_CATEGORIES as string[]).includes(category)
}

/** The top-level group an item belongs to. */
export function getItemGroup(item: InventoryItem): FilterGroup {
  const category = getItemCategory(item)
  return isSlotCategory(category) ? 'gear' : category
}

/** Items in a group, from per-category counts. */
export function countForGroup(counts: Partial<Record<ItemCategory, number>>, group: FilterGroup): number {
  if (group === 'gear') return SLOT_CATEGORIES.reduce((total, slot) => total + (counts[slot] ?? 0), 0)
  return counts[group] ?? 0
}

/**
 * Translate a legacy filter tab (what the character panel's slot buttons still
 * pass) into the two-tier view. A slot opens Equipment filtered to that slot;
 * anything unspecified lands on Equipment.
 */
export function filterTabToView(tab?: FilterTab): ItemFilterView {
  if (!tab || tab === 'all') return { group: 'gear', slot: 'all' }
  if (isSlotCategory(tab)) return { group: 'gear', slot: tab }
  return { group: tab, slot: 'all' }
}

export interface ItemSection {
  key: string
  /** Null when the view is a single flat list that needs no header. */
  title: string | null
  items: InventoryItem[]
}

/**
 * Turn per-category item lists into the sections a view renders. Shared by the
 * bag and the shop so grouping and headers cannot drift between them. Empty
 * sections are dropped.
 */
export function buildSections(
  groups: Map<ItemCategory, InventoryItem[]>,
  view: ItemFilterView
): ItemSection[] {
  const get = (category: ItemCategory) => groups.get(category) ?? []
  const section = (category: ItemCategory, title: string | null): ItemSection => ({
    key: category,
    title,
    items: get(category),
  })

  switch (view.group) {
    case 'gear':
      if (view.slot === 'all') {
        return SLOT_CATEGORIES
          .map((category) => section(category, CATEGORY_LABELS[category]))
          .filter((s) => s.items.length > 0)
      }
      return [section(view.slot, CATEGORY_LABELS[view.slot])].filter((s) => s.items.length > 0)
    case 'crafting': {
      const items = get('crafting')
      return CRAFTING_SUBSECTIONS
        .map(({ kind, label }) => ({
          key: kind,
          title: label,
          items: items.filter((item) => getCraftingKind(item) === kind),
        }))
        .filter((s) => s.items.length > 0)
    }
    default:
      return [section(view.group, null)].filter((s) => s.items.length > 0)
  }
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

/**
 * 'none' is the default: equipment by stat power, everything else in classic
 * order. 'classic' is the original game's INV order for every category.
 */
export type SortStat = 'none' | 'classic' | 'str' | 'dex' | 'mag' | 'def'

/** Sort items with a positive value of `stat` first, descending; ties stable. */
export function statSortComparator(a: InventoryItem, b: InventoryItem, stat: string): number {
  const aVal = (a.template.metadata as any)?.statMods?.[stat] ?? 0
  const bVal = (b.template.metadata as any)?.statMods?.[stat] ?? 0
  const aPositive = aVal > 0
  const bPositive = bVal > 0
  if (aPositive && !bPositive) return -1
  if (!aPositive && bPositive) return 1
  if (!aPositive && !bPositive) return 0
  return bVal - aVal
}

/** Net stat total of an item's modifiers: the "stat power" equipment sorts by. */
export function getStatPower(item: Pick<InventoryItem, 'template'>): number {
  const mods = getStatMods(item)
  return STAT_KEYS.reduce((total, key) => total + (mods[key] ?? 0), 0)
}

/** Classic order (the original game's INV tab), then name for anything unlisted. */
function classicComparator(a: InventoryItem, b: InventoryItem, itemOrderMap: Map<string, number>): number {
  const orderA = getItemOrderIndex(a.template.slug, itemOrderMap)
  const orderB = getItemOrderIndex(b.template.slug, itemOrderMap)
  if (orderA !== orderB) return orderA - orderB
  return a.template.name.localeCompare(b.template.name)
}

/**
 * Return a sorted copy of `items`.
 *
 * - 'none' (Default): equipment categories by stat power, highest first, then
 *   classic order; every other category in classic order.
 * - 'classic': classic order for everything.
 * - a stat: items with a positive value of that stat first, highest first; the
 *   rest follow in the default order.
 *
 * `category` tells the default which rule applies; without it, classic order.
 */
export function sortItems(
  items: InventoryItem[],
  sortStat: SortStat,
  itemOrderMap: Map<string, number>,
  category?: ItemCategory
): InventoryItem[] {
  const classic = (a: InventoryItem, b: InventoryItem) => classicComparator(a, b, itemOrderMap)
  const byDefault = (a: InventoryItem, b: InventoryItem) => {
    if (category && isSlotCategory(category)) {
      const power = getStatPower(b) - getStatPower(a)
      if (power !== 0) return power
    }
    return classic(a, b)
  }
  const sorted = [...items]
  if (sortStat === 'classic') {
    sorted.sort(classic)
  } else if (sortStat === 'none') {
    sorted.sort(byDefault)
  } else {
    sorted.sort((a, b) => statSortComparator(a, b, sortStat) || byDefault(a, b))
  }
  return sorted
}

/** Stable partition: whatever is equipped floats to the top of its list. */
export function sortEquippedFirst(items: InventoryItem[]): InventoryItem[] {
  return [...items.filter((item) => item.isEquipped), ...items.filter((item) => !item.isEquipped)]
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export type StatKey = 'str' | 'dex' | 'mag' | 'def'
export const STAT_KEYS: readonly StatKey[] = ['str', 'dex', 'mag', 'def']
export const STAT_LABELS: Record<StatKey, string> = { str: 'STR', dex: 'DEX', mag: 'MAG', def: 'DEF' }

/** Same roles the character panel's Core Stats use, so a +4 STR reads the same everywhere. */
export const STAT_MOD_COLORS: Record<StatKey, string> = {
  str: 'text-stat-str',
  dex: 'text-stat-dex',
  mag: 'text-stat-mag',
  def: 'text-stat-def',
}

/** Non-zero stat modifiers on an item template, or an empty object. */
export function getStatMods(item: Pick<InventoryItem, 'template'>): Partial<Record<StatKey, number>> {
  const statMods = (item.template.metadata as any)?.statMods
  if (!statMods || typeof statMods !== 'object') return {}
  const mods: Partial<Record<StatKey, number>> = {}
  for (const key of STAT_KEYS) {
    const value = statMods[key]
    if (typeof value === 'number' && value !== 0) mods[key] = value
  }
  return mods
}

export function isTwoHanded(item: Pick<InventoryItem, 'template'>): boolean {
  return (item.template.metadata as any)?.isTwoHanded === true
}

/**
 * Format stat modifiers from item metadata as colored spans.
 * Returns null if no mods or invalid metadata.
 * Example: "+5 STR, +2 MAG" or "+1 STR, -5 MAG"
 */
export function renderStatMods(metadata: any): React.ReactNode {
  const mods = getStatMods({ template: { metadata } } as any)
  const parts: React.ReactNode[] = []
  for (const stat of STAT_KEYS) {
    const value = mods[stat]
    if (typeof value !== 'number') continue
    const sign = value > 0 ? '+' : ''
    const color = value > 0 ? STAT_MOD_COLORS[stat] : 'text-status-error'
    if (parts.length > 0) parts.push(<span key={`${stat}-sep`} className="text-fg-muted">, </span>)
    parts.push(<span key={stat} className={color}>{sign}{value} {STAT_LABELS[stat]}</span>)
  }
  return parts.length > 0 ? <>{parts}</> : null
}

// ---------------------------------------------------------------------------
// Gear compare
// ---------------------------------------------------------------------------

export interface EquipCompare {
  /** Items the server would unequip if this one were equipped. */
  replaces: InventoryItem[]
  /** Net change per stat, non-zero entries only. */
  deltas: Partial<Record<StatKey, number>>
  /** Nothing is equipped in this item's own slot. */
  slotEmpty: boolean
  /** Set when the server would refuse: an off-hand item while a two-hander is wielded. */
  blockedBy: InventoryItem | null
  /** A two-hander that would send the current off-hand item back to the bag. */
  freesOffHand: boolean
}

/**
 * What changes if `item` is equipped, measured against what is equipped now.
 * Mirrors equipment-service.js: equipping fills the item's slot, a two-handed
 * main-hand item also empties the off hand, and an off-hand item is refused
 * while a two-hander is wielded. Returns null for non-gear and for items that
 * are already equipped.
 */
export function compareToEquipped(item: InventoryItem, inventory: InventoryItem[]): EquipCompare | null {
  const slot = item.template.equipSlot
  if (!slot || item.isEquipped) return null

  const equippedIn = (target: EquipSlot): InventoryItem | null =>
    inventory.find((other) => other.isEquipped && other.slot === target && other.id !== item.id) ?? null

  const current = equippedIn(slot)
  const replaces: InventoryItem[] = current ? [current] : []
  let freesOffHand = false
  if (slot === EquipSlot.MAIN_HAND && isTwoHanded(item)) {
    const offHand = equippedIn(EquipSlot.OFF_HAND)
    if (offHand) {
      replaces.push(offHand)
      freesOffHand = true
    }
  }

  let blockedBy: InventoryItem | null = null
  if (slot === EquipSlot.OFF_HAND) {
    const mainHand = equippedIn(EquipSlot.MAIN_HAND)
    if (mainHand && isTwoHanded(mainHand)) blockedBy = mainHand
  }

  const mine = getStatMods(item)
  const deltas: Partial<Record<StatKey, number>> = {}
  for (const key of STAT_KEYS) {
    const losing = replaces.reduce((sum, replaced) => sum + (getStatMods(replaced)[key] ?? 0), 0)
    const delta = (mine[key] ?? 0) - losing
    if (delta !== 0) deltas[key] = delta
  }

  return { replaces, deltas, slotEmpty: !current, blockedBy, freesOffHand }
}
