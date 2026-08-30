import type { InventoryItem, KillEntry, Player } from '@/lib/game-state'

/**
 * Shared client-side evaluation of `quests.json` requirements.
 *
 * The server is still the authority on whether a quest can be turned in; this
 * exists so every surface that *previews* that answer (the NPC card in the room,
 * the quest journal) reads the same requirement the same way. Before this, each
 * surface re-implemented a subset of the types — the journal only understood
 * `hasItem`/`killCount`, so an "Equip a Weapon" quest never looked ready.
 */

export type QuestRequirement = {
  type: string
  itemSlug?: string
  quantity?: number
  count?: number
  displayName?: string
  slot?: string
  notDefault?: boolean
  enemySlug?: string
  minLevel?: number
  flag?: string
}

export type RequirementContext = {
  inventory: InventoryItem[]
  killList: KillEntry[]
  player: Player | null
}

export type RequirementProgress = {
  /** Stable key for React lists. */
  key: string
  met: boolean
  current: number
  total: number
  label: string
  /**
   * Whether `current/total` is a real tally worth showing. Booleans (a flag, an
   * equipped slot, a level gate) are 0/1 internally, which reads as noise.
   */
  countable: boolean
}

/** "training-helmet" -> "Training Helmet". Fallback when no nicer name exists. */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Display name for an item-collection requirement. The client has no item
 * catalog, so resolve in order of fidelity: an explicit `displayName` on the
 * requirement (author override, same convention as killCount), then the name
 * from a copy the player already owns, then a humanized slug. Works for any
 * item without per-quest data.
 */
export function resolveItemLabel(
  slug: string,
  displayName: string | undefined,
  inventory: InventoryItem[]
): string {
  if (displayName) return displayName
  const owned = inventory.find((i) => i.template.slug === slug)
  return owned?.template.name ?? humanizeSlug(slug)
}

/**
 * Intro "talk to the NPC" quests carry a `level: 0` requirement purely so their
 * data shape matches every other quest. Showing "Reach level 0" as an objective
 * would be noise, so those are hidden from the requirement display (they are
 * still evaluated — they are trivially met).
 */
export function isTrivialRequirement(req: QuestRequirement): boolean {
  return req.type === 'level' && (req.minLevel ?? 0) <= 0
}

export function getRequirementProgress(
  req: QuestRequirement,
  index: number,
  { inventory, killList, player }: RequirementContext
): RequirementProgress {
  const base = { key: `${req.type}-${index}` }

  if (req.type === 'level') {
    const min = req.minLevel ?? 0
    const level = player?.level ?? 0
    return {
      ...base,
      met: level >= min,
      current: level,
      total: min,
      label: `Reach level ${min}`,
      countable: false,
    }
  }

  if (req.type === 'killCount') {
    const total = req.count ?? 1
    const current = killList.find((k) => k.monster === req.enemySlug)?.kills ?? 0
    return {
      ...base,
      key: `kill-${req.enemySlug}-${index}`,
      met: current >= total,
      current: Math.min(current, total),
      total,
      label: `${req.displayName ?? humanizeSlug(req.enemySlug ?? '')} defeated`,
      countable: true,
    }
  }

  if (req.type === 'hasItem') {
    const total = req.quantity ?? 1
    const current = inventory
      .filter((i) => i.template.slug === req.itemSlug)
      .reduce((sum, i) => sum + i.quantity, 0)
    return {
      ...base,
      key: `item-${req.itemSlug}-${index}`,
      met: current >= total,
      current: Math.min(current, total),
      total,
      label: resolveItemLabel(req.itemSlug ?? '', req.displayName, inventory),
      countable: true,
    }
  }

  if (req.type === 'hasEquippedInSlot') {
    const equipped = inventory.find((i) => i.isEquipped && i.slot === req.slot)
    // `notDefault` means a real item must fill the slot; without it the slot's
    // default counts and the requirement is informational only.
    const met = req.notDefault ? !!equipped : true
    return {
      ...base,
      met,
      current: met ? 1 : 0,
      total: 1,
      label: `${humanizeSlug(req.slot ?? '')} equipped`,
      countable: false,
    }
  }

  if (req.type === 'hasFlag') {
    const met = req.flag ? !!(player as unknown as Record<string, unknown>)?.[req.flag] : false
    return {
      ...base,
      key: `flag-${req.flag}-${index}`,
      met,
      current: met ? 1 : 0,
      total: 1,
      label: req.displayName ?? humanizeSlug(req.flag ?? ''),
      countable: false,
    }
  }

  // Unknown type: never claim it's met — the server would refuse the turn-in
  // anyway, and a stuck-looking requirement is better than a dead Turn In button.
  return { ...base, met: false, current: 0, total: 1, label: humanizeSlug(req.type), countable: false }
}

/** Requirement progress for display: trivial placeholders are dropped. */
export function getVisibleRequirementProgress(
  requirements: QuestRequirement[] | undefined,
  ctx: RequirementContext
): RequirementProgress[] {
  return (requirements ?? [])
    .map((req, i) => ({ req, i }))
    .filter(({ req }) => !isTrivialRequirement(req))
    .map(({ req, i }) => getRequirementProgress(req, i, ctx))
}

/** True when every requirement (including hidden placeholders) is satisfied. */
export function areRequirementsMet(
  requirements: QuestRequirement[] | undefined,
  ctx: RequirementContext
): boolean {
  const reqs = requirements ?? []
  if (reqs.length === 0) return true
  return reqs.every((req, i) => getRequirementProgress(req, i, ctx).met)
}
