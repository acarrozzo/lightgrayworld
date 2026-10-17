import type { InventoryItem } from '@/lib/game-state'
import { getItemActions, summarizeConsumable } from '@/lib/item-actions'
import { consumableTone } from '@/lib/consumable-tone'
import type { EquipCompare } from '@/lib/inventory-categories'

/**
 * The one button an inventory row shows. Resolved from the item's state so the
 * bag, the shop's sell tab and any future item list agree on what "the obvious
 * thing to do" with an item is:
 *
 *   equipped gear      -> Unequip
 *   gear in the bag    -> Equip (disabled with a reason when the server would refuse)
 *   consumable / book  -> its verb, labelled by its effect ("+100 HP")
 *   anything else      -> nothing; the drawer carries Drop
 */
export type PrimaryItemAction =
  | { kind: 'unequip'; label: string }
  | { kind: 'equip'; label: string; disabled: boolean; reason: string | null }
  | { kind: 'use'; label: string; action: string; title: string; className?: string; icon?: string }

export function getPrimaryItemAction(
  item: InventoryItem,
  compare: EquipCompare | null,
  context: { activePet?: string | null } = {}
): PrimaryItemAction | null {
  if (item.isEquipped) {
    return { kind: 'unequip', label: 'Unequip' }
  }

  // A pet is company, not gear: along or at home, free either way. The
  // server's use_item path answers the same two verbs (room-state.js).
  if ((item.template.metadata as { pet?: unknown } | null)?.pet) {
    const along = context.activePet != null && context.activePet === item.template.slug
    return along
      ? { kind: 'use', label: 'Leave home', action: 'leave home', title: `${item.template.name} stays behind`, className: 'border border-line-strong/60 bg-transparent text-fg-secondary hover:bg-surface-hover shadow-none' }
      : { kind: 'use', label: 'Take along', action: 'take along', title: `${item.template.name} comes with you`, className: 'fill-accent' }
  }

  if (item.template.equipSlot) {
    const blockedBy = compare?.blockedBy ?? null
    return {
      kind: 'equip',
      label: 'Equip',
      disabled: blockedBy !== null,
      reason: blockedBy ? `Both hands are on the ${blockedBy.template.name}.` : null,
    }
  }

  const actions = item.template.slug
    ? getItemActions(item.template.slug, item.template.metadata as any)
    : []
  const first = actions[0]
  if (!first) return null

  // The verb wears the colour of what the item touches — the same fill the
  // deck's row uses — so the bag and the deck agree; a book or a key keeps
  // its own class.
  const summary = summarizeConsumable(item.template.metadata as never)
  const toneClass = summary && summary.group !== 'harm' ? consumableTone(summary).fill : undefined
  return {
    kind: 'use',
    label: first.effect ?? first.label,
    action: first.action,
    title: first.effect ? `${first.label} · ${first.effect}` : first.label,
    className: toneClass ?? first.className,
    icon: first.icon,
  }
}
