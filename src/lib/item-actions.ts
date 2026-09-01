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
  verb?: string
}

function buildConsumableAction(itemSlug: string, consumable: ConsumableMeta): ItemAction {
  const verb = (consumable.verb || 'use').toLowerCase()
  const label = verb.charAt(0).toUpperCase() + verb.slice(1)
  const amount = Number(consumable.amount) || 0
  const statLabel = (consumable.stat || 'hp').toUpperCase()
  const effect = amount >= 0 ? `+${amount} ${statLabel}` : `−${Math.abs(amount)} ${statLabel}`
  const styling = CONSUMABLE_STYLING[itemSlug] || {}
  return { action: verb, label, effect, ...styling }
}

/**
 * Get available actions for a specific item. Pass the item's template metadata
 * so consumable actions can be derived from `metadata.consumable`.
 */
export function getItemActions(itemSlug: string, metadata?: { consumable?: ConsumableMeta } | null): ItemAction[] {
  const consumable = metadata?.consumable
  if (consumable) {
    return [buildConsumableAction(itemSlug, consumable)]
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

