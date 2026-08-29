/**
 * Resolving what a player has equipped, in one place.
 *
 * Equipment lives in two coexisting systems: the legacy `Equipment` relation (string
 * slots) and equipped `PlayerItem` rows (preferred — see CLAUDE.md). Every surface
 * that shows another player's gear has to merge the two the same way, and until now
 * three of them (the roster route, the public-profile route, and the world-tool
 * players page) each had their own copy of the merge. They are now all this function.
 *
 * Rule: a PlayerItem row wins for any slot it covers; the Equipment string is the
 * fallback; the documented empty marker is the last resort.
 */

/** Empty-slot markers, and the default bare-handed weapon. */
export const EQUIPMENT_SLOT_DEFAULTS: Record<string, string> = {
  rightHand: 'fists',
  leftHand: '- - -',
  head: '- - -',
  body: '- - -',
  hands: '- - -',
  feet: '- - -',
  ring1: '- - -',
  ring2: '- - -',
  neck: '- - -',
  artifact: '- - -',
  tech: '- - -',
  companion: '- - -',
  pet: '- - -',
  mount: '- - -',
  robot: '- - -',
  aura: '- - -',
}

/** PlayerItem.slot -> legacy Equipment key. Slots absent here have no modern equivalent yet. */
export const PLAYER_ITEM_SLOT_MAP: Record<string, string> = {
  MAIN_HAND: 'rightHand',
  OFF_HAND: 'leftHand',
  HEAD: 'head',
  BODY: 'body',
  HANDS: 'hands',
  FEET: 'feet',
  RING: 'ring1',
  NECK: 'neck',
}

/** Human labels for each slot, in the order gear should be displayed. */
export const EQUIPMENT_SLOT_LABELS: Record<string, string> = {
  rightHand: 'Main Hand',
  leftHand: 'Off Hand',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  feet: 'Feet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  neck: 'Neck',
  artifact: 'Artifact',
  tech: 'Tech',
  companion: 'Companion',
  pet: 'Pet',
  mount: 'Mount',
  robot: 'Robot',
  aura: 'Aura',
}

export interface ResolvedEquipmentItem {
  name: string
  slug?: string
  icon?: string
}

export interface EquipmentSource {
  equipment?: Record<string, string> | null
  PlayerItem?: Array<{
    slot: string | null
    ItemTemplate: { name: string; slug?: string; metadata?: unknown } | null
  }> | null
}

/**
 * Merge both equipment systems into one slot -> item map. Every slot in
 * EQUIPMENT_SLOT_DEFAULTS is always present, so callers can index without guarding.
 */
export function resolveEquipment(user: EquipmentSource): Record<string, ResolvedEquipmentItem> {
  const resolved: Record<string, ResolvedEquipmentItem> = {}

  for (const [slot, fallback] of Object.entries(EQUIPMENT_SLOT_DEFAULTS)) {
    const legacyValue = user.equipment?.[slot]
    resolved[slot] = { name: legacyValue || fallback }
  }

  for (const equipped of user.PlayerItem ?? []) {
    if (!equipped.slot || !equipped.ItemTemplate) continue
    const mappedSlot = PLAYER_ITEM_SLOT_MAP[equipped.slot]
    if (!mappedSlot) continue
    const metadata = equipped.ItemTemplate.metadata as { icon?: string } | null
    resolved[mappedSlot] = {
      name: equipped.ItemTemplate.name,
      slug: equipped.ItemTemplate.slug,
      icon: metadata?.icon,
    }
  }

  return resolved
}

/** Flat name-per-slot view, for callers that only render text. */
export function resolveEquipmentNames(user: EquipmentSource): Record<string, string> {
  const resolved = resolveEquipment(user)
  return Object.fromEntries(Object.entries(resolved).map(([slot, item]) => [slot, item.name]))
}

/** True when a slot holds something other than its empty marker. */
export function isSlotFilled(slot: string, name: string): boolean {
  if (!name || !name.trim()) return false
  return name !== EQUIPMENT_SLOT_DEFAULTS[slot]
}

/** Only the slots actually holding gear, in display order. */
export function listEquippedSlots(
  user: EquipmentSource
): Array<{ slot: string; label: string; item: ResolvedEquipmentItem }> {
  const resolved = resolveEquipment(user)
  return Object.keys(EQUIPMENT_SLOT_LABELS)
    .filter((slot) => isSlotFilled(slot, resolved[slot]?.name ?? ''))
    .map((slot) => ({ slot, label: EQUIPMENT_SLOT_LABELS[slot], item: resolved[slot] }))
}
