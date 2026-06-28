import React from 'react'
import { InventoryItem } from '@/lib/game-state'
import { ItemType, EquipSlot } from '@prisma/client'
import { getItemOrderIndex } from '@/lib/inventory-utils'

/**
 * Shared category + stat-display helpers used by the inventory and the shop's
 * sell tab so both stay visually and behaviorally in sync.
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
  | 'consumables'
  | 'crafting'
  | 'misc'

export type ItemCategory = Exclude<FilterTab, 'all'>

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
  { id: 'consumables', label: 'consumables' },
  { id: 'crafting', label: 'crafting' },
  { id: 'misc', label: 'misc' },
]

/** Category render order when showing everything grouped. */
export const CATEGORY_DISPLAY_ORDER: ItemCategory[] = INVENTORY_TABS.slice(1).map(
  (tab) => tab.id as ItemCategory
)

export type SortStat = 'none' | 'str' | 'dex' | 'mag' | 'def'

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

/**
 * Return a sorted copy of `items`. When `sortStat` is a stat, sort by that stat;
 * otherwise fall back to the canonical item display order, then name.
 */
export function sortItems(
  items: InventoryItem[],
  sortStat: SortStat,
  itemOrderMap: Map<string, number>
): InventoryItem[] {
  const sorted = [...items]
  if (sortStat !== 'none') {
    sorted.sort((a, b) => statSortComparator(a, b, sortStat))
  } else {
    sorted.sort((a, b) => {
      const orderA = getItemOrderIndex(a.template.slug, itemOrderMap)
      const orderB = getItemOrderIndex(b.template.slug, itemOrderMap)
      if (orderA === orderB) return a.template.name.localeCompare(b.template.name)
      return orderA - orderB
    })
  }
  return sorted
}

export const STAT_MOD_COLORS: Record<string, string> = {
  str: 'text-red-400',
  dex: 'text-emerald-400',
  mag: 'text-sky-400',
  def: 'text-amber-400',
}

/**
 * Format stat modifiers from item metadata as colored spans.
 * Returns null if no mods or invalid metadata.
 * Example: "+5 STR, +2 MAG" or "+1 STR, -5 MAG"
 */
export function renderStatMods(metadata: any): React.ReactNode {
  if (!metadata || typeof metadata !== 'object') return null
  const statMods = metadata.statMods
  if (!statMods || typeof statMods !== 'object') return null

  const statOrder = ['str', 'dex', 'mag', 'def'] as const
  const statLabels: Record<string, string> = { str: 'STR', dex: 'DEX', mag: 'MAG', def: 'DEF' }

  const parts: React.ReactNode[] = []
  for (const stat of statOrder) {
    const value = statMods[stat]
    if (typeof value === 'number' && value !== 0) {
      const sign = value > 0 ? '+' : ''
      const color = value > 0 ? STAT_MOD_COLORS[stat] : 'text-red-800'
      if (parts.length > 0) parts.push(<span key={`${stat}-sep`} className="text-gray-500">, </span>)
      parts.push(<span key={stat} className={color}>{sign}{value} {statLabels[stat]}</span>)
    }
  }
  return parts.length > 0 ? <>{parts}</> : null
}
