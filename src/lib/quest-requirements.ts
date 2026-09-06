import type { InventoryItem, KillEntry, Player, QuestProgressRow } from '@/lib/game-state'
import { getFaction } from '@/lib/game-data/factions'
import { factionStanding, getGiver } from '@/lib/game-data/quest-registry'

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
  items?: { itemSlug: string; quantity?: number }[]
  quantity?: number
  count?: number
  displayName?: string
  slot?: string
  notDefault?: boolean
  enemySlug?: string
  enemySlugs?: string[]
  minLevel?: number
  flag?: string
  factionId?: string
  factionIds?: string[]
  giverId?: string
  questId?: string
}

export type RequirementContext = {
  inventory: InventoryItem[]
  killList: KillEntry[]
  player: Player | null
  /** Quest rows, for requirements that read other quests or faction standing. */
  quests?: QuestProgressRow[]
  giversMet?: string[]
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
  ctx: RequirementContext
): RequirementProgress {
  const { inventory, killList, player } = ctx
  const quests = ctx.quests ?? []
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

  if (req.type === 'killCountGroup') {
    // One line per family: kills across every slug in the group are summed, so
    // "10 Goblins" counts goblins, goblin bandits, hob goblins and the chief.
    const total = req.count ?? 1
    const slugs = req.enemySlugs ?? []
    const current = killList
      .filter((k) => slugs.includes(k.monster))
      .reduce((sum, k) => sum + k.kills, 0)
    return {
      ...base,
      key: `kill-group-${index}`,
      met: current >= total,
      current: Math.min(current, total),
      total,
      label: `${req.displayName ?? 'Enemies'} defeated`,
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

  if (req.type === 'hasAnyItem') {
    // Satisfied by any one entry. Progress reads off whichever entry the player
    // is furthest along on, so a partial stack of one option still shows movement.
    const entries = req.items ?? []
    let best = { current: 0, total: 1 }
    for (const entry of entries) {
      const total = entry.quantity ?? 1
      const current = inventory
        .filter((i) => i.template.slug === entry.itemSlug)
        .reduce((sum, i) => sum + i.quantity, 0)
      if (current >= total) {
        best = { current: total, total }
        break
      }
      if (current / total > best.current / best.total) best = { current, total }
    }
    return {
      ...base,
      key: `any-item-${index}`,
      met: entries.length > 0 && best.current >= best.total,
      current: Math.min(best.current, best.total),
      total: best.total,
      label: req.displayName ?? 'Any one of a set of items',
      countable: false,
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

  if (req.type === 'memberOf') {
    const faction = getFaction(req.factionId ?? '')
    const membershipQuest = faction?.membershipQuest
    const met = !!membershipQuest && quests.some((q) => q.questId === membershipQuest && q.completed)
    return {
      ...base,
      key: `member-${req.factionId}-${index}`,
      met,
      current: met ? 1 : 0,
      total: 1,
      label: `Member of the ${faction?.name ?? humanizeSlug(req.factionId ?? '')}`,
      countable: false,
    }
  }

  if (req.type === 'giverMet') {
    const met = (ctx.giversMet ?? []).includes(req.giverId ?? '')
    return {
      ...base,
      key: `met-${req.giverId}-${index}`,
      met,
      current: met ? 1 : 0,
      total: 1,
      label: `Met ${getGiver(req.giverId ?? '')?.spokenName ?? humanizeSlug(req.giverId ?? '')}`,
      countable: false,
    }
  }

  if (req.type === 'questCompleted') {
    const met = quests.some((q) => q.questId === req.questId && q.completed)
    return {
      ...base,
      key: `quest-${req.questId}-${index}`,
      met,
      current: met ? 1 : 0,
      total: 1,
      label: req.displayName ?? humanizeSlug(req.questId ?? ''),
      countable: false,
    }
  }

  if (req.type === 'factionsComplete') {
    // The Pillar's capstones: every quest across the named factions, as one
    // done/total line. A faction with no quests yet keeps the line unmet.
    const standings = (req.factionIds ?? [])
      .map((id) => factionStanding(id, quests))
      .filter((s): s is NonNullable<typeof s> => !!s)
    const done = standings.reduce((sum, s) => sum + s.done, 0)
    const total = standings.reduce((sum, s) => sum + s.total, 0)
    const met = standings.length > 0 && standings.every((s) => s.complete)
    const names = standings.map((s) => (s.total === 0 ? `${s.name} (not yet open)` : s.name)).join(', ')
    return {
      ...base,
      key: `factions-${index}`,
      met,
      current: Math.min(done, Math.max(total, 1)),
      total: Math.max(total, 1),
      label: `Every quest in ${names}`,
      countable: total > 0,
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
