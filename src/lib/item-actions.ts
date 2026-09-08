import { IconMappings } from '@/lib/icon-mappings'

export function resolveItemIcon(metadata: { icon?: string } | null | undefined, slug: string): string {
  if (metadata?.icon) {
    const iconName = metadata.icon
    if (IconMappings[iconName as keyof typeof IconMappings]) return iconName
    const equipmentIcon = `equipment-${iconName}`
    if (IconMappings[equipmentIcon as keyof typeof IconMappings]) return equipmentIcon
  }
  if (slug) {
    const normalizedSlug = slug.replace(/[-\s]/g, '').toLowerCase()
    if (IconMappings[slug as keyof typeof IconMappings]) return slug
    if (IconMappings[normalizedSlug as keyof typeof IconMappings]) return normalizedSlug
    const equipmentSlug = `equipment-${slug}`
    if (IconMappings[equipmentSlug as keyof typeof IconMappings]) return equipmentSlug
    const equipmentNormalized = `equipment-${normalizedSlug}`
    if (IconMappings[equipmentNormalized as keyof typeof IconMappings]) return equipmentNormalized
  }
  return 'inv'
}

export interface ItemAction {
  action: string
  label: string
  icon?: string
  className?: string
  effect?: string
}

/**
 * Static action definitions for NON-consumable items. Consumables are NOT listed
 * here — their action/label/effect are derived from the item's
 * `metadata.consumable` block (the single source of truth seeded in seed.ts);
 * see getItemActions / buildConsumableAction below.
 */
export const ITEM_ACTIONS: Record<string, ItemAction[]> = {
  'welcome-book': [
    { action: 'read book', label: 'Read Book', icon: 'book', className: 'bg-resource-mp/70 hover:bg-resource-mp' },
  ],
}

// Pure presentation for consumables, keyed by slug. Gameplay facts (verb, stat,
// amount) come from metadata.consumable — only styling lives here.
const CONSUMABLE_STYLING: Record<string, { icon: string; className: string }> = {
  'flower': { icon: 'flower', className: 'bg-resource-gold/70 hover:bg-resource-gold' },
  'redberry': { icon: 'redberry', className: 'bg-status-error/70 hover:bg-status-error' },
  'blueberry': { icon: 'blueberry', className: 'bg-resource-mp/70 hover:bg-resource-mp' },
  'raw-meat': { icon: 'uncooked-meat', className: 'bg-resource-hp/70 hover:bg-resource-hp' },
  'cooked-meat': { icon: 'cooked-meat', className: 'bg-resource-gold/70 hover:bg-resource-gold' },
  'red-potion': { icon: 'red-potion', className: 'bg-status-error/70 hover:bg-status-error' },
  'blue-potion': { icon: 'blue-potion', className: 'bg-resource-mp/70 hover:bg-resource-mp' },
}

interface ConsumableMeta {
  stat?: string
  amount?: number
  stats?: { stat?: string; amount?: number }[]
  buff?: { field?: string; clicks?: number }
  buffs?: { field?: string; clicks?: number }[]
  verb?: string
}

/**
 * What a consumable is for, as the battle deck and the bag group them. `harm`
 * is anything that costs a stat (the Flower); `other` is a consumable with no
 * stat or buff behind it — a modal-only curiosity.
 */
export type ConsumableGroup = 'hp' | 'mp' | 'both' | 'buff' | 'harm' | 'other'

export type CoreStatKey = 'str' | 'dex' | 'mag' | 'def'

export interface ConsumableBuff {
  field: string
  clicks: number
  /** The buff's name: "Strength", "Wings". */
  label: string
  /** What it does, as a chip: "+20 STR", "Wings". */
  short: string
  /** Flat core-stat bonus while it runs; empty for abilities like wings. */
  bonus: Partial<Record<CoreStatKey, number>>
}

export interface ConsumableSummary {
  /** The seeded verb, lower case: "drink". */
  verb: string
  /** The verb as a button reads it: "Drink". */
  label: string
  /** Signed HP change; 0 when the item leaves HP alone. */
  hp: number
  /** Signed MP change; 0 when the item leaves MP alone. */
  mp: number
  buffs: ConsumableBuff[]
  group: ConsumableGroup
  /** One-line effect: "+100 HP", "+200 HP · +200 MP", "+20 STR · 100 clicks". */
  effect: string
}

// Presentation for the buff countdowns, mirroring the server's buff-service
// (BUFF_LABELS and STAT_BUFF_FIELDS). Amounts here are display copy only —
// the server decides what a running buff is worth.
const ALL_STATS = (amount: number): Partial<Record<CoreStatKey, number>> => ({ str: amount, dex: amount, mag: amount, def: amount })
const BUFF_PRESENTATION: Record<string, { label: string; short: string; bonus: Partial<Record<CoreStatKey, number>> }> = {
  wings: { label: 'Wings', short: 'Wings', bonus: {} },
  gills: { label: 'Gills', short: 'Gills', bonus: {} },
  buffStrClicks: { label: 'Strength', short: '+20 STR', bonus: { str: 20 } },
  buffDexClicks: { label: 'Dexterity', short: '+20 DEX', bonus: { dex: 20 } },
  buffMagClicks: { label: 'Magic', short: '+20 MAG', bonus: { mag: 20 } },
  buffDefClicks: { label: 'Defense', short: '+20 DEF', bonus: { def: 20 } },
  buffCoffeeClicks: { label: 'Coffee', short: '+10 all stats', bonus: ALL_STATS(10) },
  buffGloryClicks: { label: 'Glory', short: '+30 all stats', bonus: ALL_STATS(30) },
}

function signed(amount: number, stat: string): string {
  return amount >= 0 ? `+${amount} ${stat}` : `−${Math.abs(amount)} ${stat}`
}

/**
 * Read a consumable's `metadata.consumable` block into one shape, whichever of
 * the seeded forms it takes: `{ stat, amount }`, `stats: [...]`, `buff: {...}`
 * or `buffs: [...]`. The same reading the server's handleConsume does, so the
 * label a button wears matches what using it will do.
 */
export function summarizeConsumable(metadata?: { consumable?: ConsumableMeta } | null): ConsumableSummary | null {
  const consumable = metadata?.consumable
  if (!consumable || typeof consumable !== 'object') return null

  const verb = String(consumable.verb || 'use').toLowerCase()
  const label = verb.charAt(0).toUpperCase() + verb.slice(1)

  const statEntries = Array.isArray(consumable.stats)
    ? consumable.stats
    : consumable.stat || consumable.amount
      ? [{ stat: consumable.stat, amount: consumable.amount }]
      : []
  let hp = 0
  let mp = 0
  for (const entry of statEntries) {
    const amount = Number(entry?.amount) || 0
    if (entry?.stat === 'mp') mp += amount
    else hp += amount
  }

  const buffEntries = Array.isArray(consumable.buffs)
    ? consumable.buffs
    : consumable.buff
      ? [consumable.buff]
      : []
  const buffs: ConsumableBuff[] = []
  for (const entry of buffEntries) {
    const field = typeof entry?.field === 'string' ? entry.field : null
    if (!field) continue
    const shown = BUFF_PRESENTATION[field] ?? { label: field, short: field, bonus: {} }
    buffs.push({ field, clicks: Number(entry?.clicks) || 0, ...shown })
  }

  const group: ConsumableGroup =
    hp < 0 || mp < 0 ? 'harm'
    : hp > 0 && mp > 0 ? 'both'
    : hp > 0 ? 'hp'
    : mp > 0 ? 'mp'
    : buffs.length > 0 ? 'buff'
    : 'other'

  const parts: string[] = []
  if (hp !== 0) parts.push(signed(hp, 'HP'))
  if (mp !== 0) parts.push(signed(mp, 'MP'))
  for (const buff of buffs) parts.push(buff.clicks > 0 ? `${buff.short} · ${buff.clicks} clicks` : buff.short)

  return { verb, label, hp, mp, buffs, group, effect: parts.join(' · ') }
}

function buildConsumableAction(itemSlug: string, summary: ConsumableSummary): ItemAction {
  const styling = CONSUMABLE_STYLING[itemSlug] || {}
  return { action: summary.verb, label: summary.label, effect: summary.effect || undefined, ...styling }
}

/**
 * Get available actions for a specific item. Pass the item's template metadata
 * so consumable actions can be derived from `metadata.consumable`.
 */
export function getItemActions(itemSlug: string, metadata?: { consumable?: ConsumableMeta } | null): ItemAction[] {
  const summary = summarizeConsumable(metadata)
  if (summary) {
    return [buildConsumableAction(itemSlug, summary)]
  }
  return ITEM_ACTIONS[itemSlug] || []
}

/**
 * Check if an action is available for a specific item
 */
export function isActionAvailableForItem(
  itemSlug: string,
  action: string,
  metadata?: { consumable?: ConsumableMeta } | null
): boolean {
  const actions = getItemActions(itemSlug, metadata)
  return actions.some((a) => a.action.toLowerCase() === action.toLowerCase())
}

