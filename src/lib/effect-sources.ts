/**
 * What puts an effect back on you, and where that lives.
 *
 * Each status chip names its User column. This maps a column to the spell
 * that starts it and the consumables that do, and picks the one to point at:
 * the spell when it is learned, since it costs MP rather than an item, else a
 * consumable in the bag. Glory (a place's blessing) and Silver Aura (always
 * on) have nothing that renews them, so they get no link.
 *
 * One lookup serves three surfaces: the "Running on you" chips link to their
 * source, an expiring chip offers Again, and a "wears off" feed line links to
 * what would put it back. Nothing here decides anything; the server refuses a
 * cast or a use exactly as it would from the Actions tab.
 */
import type { InventoryItem, Player } from '@/lib/game-state'
import type { FeedLink } from '@/lib/feed-links'
import { getItemActions, summarizeConsumable } from '@/lib/item-actions'
import { castBlockedReason, getCastableSpells, type CastSituation, type SpellbookEntry } from '@/lib/spellbook'
import type { StatusChip } from '@/lib/status-effects'

/** The spell that starts each countdown. Poison's own column points at its cure. */
const FIELD_SPELLS: Record<string, string> = {
  regenerateClicks: 'regenerate',
  ironSkinClicks: 'iron-skin',
  magicArmorAmount: 'magic-armor',
  wings: 'wings',
  gills: 'gills',
  poisonClicks: 'antidote',
  poisonImmuneClicks: 'antidote',
}

export type EffectSource =
  | { kind: 'spell'; entry: SpellbookEntry }
  | { kind: 'item'; item: InventoryItem; action: string }

type ConsumableMetadata = Parameters<typeof summarizeConsumable>[0]

/** Does using this item start (or cure, for poison) the effect in `field`? */
function itemRenews(item: InventoryItem, field: string): boolean {
  if (item.template.type !== 'CONSUMABLE' || item.quantity <= 0) return false
  const metadata = item.template.metadata as ConsumableMetadata
  if (field === 'poisonClicks') return metadata?.consumable?.cure === 'poison'
  return summarizeConsumable(metadata)?.buffs.some((buff) => buff.field === field) ?? false
}

/** What would put the effect in `field` back on you: a learned spell first, else an item you carry. */
export function effectSource(field: string, player: Player | null | undefined, inventory: InventoryItem[]): EffectSource | null {
  const spellId = FIELD_SPELLS[field]
  const spell = spellId ? getCastableSpells(player).find((entry) => entry.def.id === spellId) : undefined
  if (spell) return { kind: 'spell', entry: spell }
  for (const item of inventory) {
    if (!itemRenews(item, field)) continue
    const action = getItemActions(item.template.slug, item.template.metadata as ConsumableMetadata)[0]?.action
    if (action) return { kind: 'item', item, action }
  }
  return null
}

/** Where a source lives: its row in the Actions tab, ringed. */
export function effectSourceLink(source: EffectSource): FeedLink {
  return source.kind === 'spell'
    ? { tab: 'actions', sub: 'spells', anchor: `spell:${source.entry.def.id}` }
    : { tab: 'actions', sub: 'items', anchor: `item:${source.item.id}` }
}

/** The link a "wears off" line carries: to what would put it back, or none. */
export function expiredEffectLink(field: string, player: Player | null | undefined, inventory: InventoryItem[]): FeedLink | null {
  // Poison running out is good news; there is nothing to go and renew.
  if (field === 'poisonClicks') return null
  const source = effectSource(field, player, inventory)
  return source ? effectSourceLink(source) : null
}

export interface Renewal {
  source: EffectSource
  /** "30 MP", or the stack left: "×3". */
  cost: string
  /** The sentence for hover and screen readers. */
  title: string
}

/**
 * What an expiring chip's Again does, or null when it has none. Only a chip
 * in its last clicks (the same moment it starts to pulse), never poison, and
 * only when the source would not be refused: Iron Skin's "Already up" means
 * the server will not cast a second one while the first stands, so it gets no
 * Again. A countdown renewed this way takes the longer of the two
 * (buff-service), so nothing is lost by renewing early.
 */
export function renewal(chip: StatusChip, source: EffectSource | null, situation: CastSituation): Renewal | null {
  if (!source || !chip.expiring || chip.field === 'poisonClicks') return null
  if (source.kind === 'spell') {
    if (castBlockedReason(source.entry, situation)) return null
    return {
      source,
      cost: `${source.entry.castCost} MP`,
      title: `Cast ${source.entry.def.name} again for ${source.entry.castCost} MP`,
    }
  }
  const verb = summarizeConsumable(source.item.template.metadata as ConsumableMetadata)?.label ?? 'Use'
  return {
    source,
    cost: `×${source.item.quantity}`,
    title: `${verb} another ${source.item.template.name} (${source.item.quantity} left)`,
  }
}

/**
 * Where a refusal points, out of a fight: "Not enough MP" at the MP ladder
 * (or the HP & MP rows, when those are all the bag has), and an empty quiver
 * at the weapons in the bag to swap to. Null for every other refusal, when the
 * bag holds nothing that would help, and in a fight, where the rows stay inert.
 */
export function refusalLink(
  reason: string | null | undefined,
  { inBattle, inventory, ammoLabel }: { inBattle: boolean; inventory: InventoryItem[]; ammoLabel?: string | null }
): FeedLink | null {
  if (!reason || inBattle) return null
  if (reason === 'Not enough MP') {
    let both = false
    for (const item of inventory) {
      if (item.template.type !== 'CONSUMABLE' || item.quantity <= 0) continue
      const summary = summarizeConsumable(item.template.metadata as ConsumableMetadata)
      if (summary?.group === 'mp') return { tab: 'actions', sub: 'items', anchor: 'mp' }
      if (summary?.group === 'both') both = true
    }
    return both ? { tab: 'actions', sub: 'items', anchor: 'both' } : null
  }
  if (ammoLabel && reason === `No ${ammoLabel}`) return { tab: 'inv', sub: 'main' }
  return null
}
