import type { InventoryItem } from '@/lib/game-state'
import { getItemActions } from '@/lib/item-actions'
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
  compare: EquipCompare | null
): PrimaryItemAction | null {
  if (item.isEquipped) {
    return { kind: 'unequip', label: 'Unequip' }
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

  return {
    kind: 'use',
    label: first.effect ?? first.label,
    action: first.action,
    title: first.effect ? `${first.label} · ${first.effect}` : first.label,
    className: first.className,
    icon: first.icon,
  }
}
