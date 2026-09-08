'use client'

/**
 * The status strip: everything running on the player right now, as chips.
 *
 * The original's HUD drew a row of small "buffBox" tags — `regen +3`,
 * `tea +5 regen / 87`, `ironskin +12`, `coffee +10 all stats / 40`, `wings /
 * 12`, `[ poison: -3 HP ]`. This module derives that row from the client's
 * projection of the User row (`player.buffs`, `player.spells`) and the
 * equipped set, with the same shared formulas the server ticks with
 * (game-data/regen.js, buff-service), so the chip says what the next click
 * will do. Nothing here decides anything.
 */
import type { InventoryItem, Player } from '@/lib/game-state'

const regen = require('@/lib/game-data/regen') as {
  sumGearRegen: (metadatas: unknown[]) => { hp: number; mp: number }
  regenSummary: (sources: { gear?: { hp: number; mp: number } | null; buffs?: Record<string, number> | null }) => RegenSummary
  describeRegen: (regen: { hpMin?: number; hpMax?: number; hp?: number; mp?: number }) => string
}
const { STAT_BUFF_FIELDS, BUFF_LABELS } = require('@/lib/game-engine/services/buff-service') as {
  STAT_BUFF_FIELDS: Record<string, { stats: string[]; amount: number }>
  BUFF_LABELS: Record<string, string>
}

export interface RegenSummary {
  gear: { hp: number; mp: number }
  tea: boolean
  regenerateAmount: number
  hpMin: number
  hpMax: number
  mp: number
  any: boolean
}

/** A semantic role for the chip's colour; the strip maps it to theme classes. */
export type StatusTone = 'hp' | 'mp' | 'stat' | 'ability' | 'poison' | 'ward' | 'aura'

export interface StatusChip {
  id: string
  /** Short name: "Regen", "Tea", "Iron Skin", "Poison". */
  label: string
  /** The number beside it: "+3 HP · +5 MP / click", "+12 block", "burns 3". */
  detail?: string
  /** Clicks left, for countdowns. Absent for standing effects. */
  clicks?: number
  tone: StatusTone
  /** The full sentence, for hover. */
  title: string
}

/** The regen declared by everything equipped, summed. */
export function equippedRegen(inventory: InventoryItem[]): { hp: number; mp: number } {
  return regen.sumGearRegen(inventory.filter((item) => item.isEquipped).map((item) => item.template.metadata))
}

/** Everything regenerating on the player right now, per click. */
export function playerRegen(player: Player | null | undefined, inventory: InventoryItem[]): RegenSummary {
  return regen.regenSummary({ gear: equippedRegen(inventory), buffs: player?.buffs ?? null })
}

/** "+3 HP · +5 MP / click" for a regen summary or an item's regen block; '' with none. */
export function describeRegen(value: { hpMin?: number; hpMax?: number; hp?: number; mp?: number } | null | undefined): string {
  return value ? regen.describeRegen(value) : ''
}

const STAT_LABEL: Record<string, string> = { str: 'STR', dex: 'DEX', mag: 'MAG', def: 'DEF' }

/**
 * The strip, in the order the eye wants it: what is hurting you, what is
 * protecting you, what is healing you, then the stat and ability buffs.
 */
export function statusChips(player: Player | null | undefined, inventory: InventoryItem[]): StatusChip[] {
  if (!player) return []
  const buffs = player.buffs ?? {}
  const clicksOf = (field: string) => Math.max(0, Number(buffs[field] ?? 0))
  const chips: StatusChip[] = []

  const poison = clicksOf('poisonClicks')
  if (poison > 0) {
    // Each click the counter drops by one and burns for what is left.
    const next = poison - 1
    chips.push({
      id: 'poison',
      label: 'Poison',
      detail: next > 0 ? `burns ${next}` : 'fading',
      clicks: poison,
      tone: 'poison',
      title: `Poisoned: next click burns ${next} HP, then ${Math.max(0, next - 1)}, until it is gone. An antidote cures it.`,
    })
  }
  const immune = clicksOf('poisonImmuneClicks')
  if (immune > 0) {
    chips.push({ id: 'poison-immune', label: 'Immune', detail: 'to poison', clicks: immune, tone: 'ward', title: `Immune to poison for ${immune} more clicks.` })
  }

  const armor = Math.max(0, Number(buffs.magicArmorAmount ?? 0))
  if (armor > 0) {
    chips.push({ id: 'magic-armor', label: 'Magic Armor', detail: `absorbs ${armor}`, tone: 'ward', title: `Magic Armor: the next ${armor} damage is absorbed before it reaches your HP. It wears off as it is hit.` })
  }
  const ironSkinClicks = clicksOf('ironSkinClicks')
  const ironSkin = Math.max(0, Number(buffs.ironSkinAmount ?? 0))
  if (ironSkinClicks > 0 && ironSkin > 0) {
    chips.push({ id: 'iron-skin', label: 'Iron Skin', detail: `+${ironSkin} DEF`, clicks: ironSkinClicks, tone: 'ward', title: `Iron Skin: +${ironSkin} DEF for ${ironSkinClicks} more clicks.` })
  }

  const summary = playerRegen(player, inventory)
  if (summary.any) {
    const text = describeRegen(summary)
    const parts: string[] = []
    if (summary.gear.hp > 0 || summary.gear.mp > 0) parts.push(`gear ${describeRegen(summary.gear).replace(' / click', '')}`)
    if (summary.tea) parts.push('tea +5 HP +5 MP')
    if (summary.regenerateAmount > 0) parts.push(`Regenerate +${summary.regenerateAmount} HP`)
    chips.push({
      id: 'regen',
      label: 'Regen',
      detail: text.replace(' / click', ''),
      tone: summary.hpMax > 0 ? 'hp' : 'mp',
      title: `Every click restores ${text.replace(' / click', '')}, up to your max (${parts.join(', ')}). MP regen skips the click you cast a spell on.`,
    })
  }
  const tea = clicksOf('buffTeaClicks')
  if (tea > 0) chips.push({ id: 'tea', label: 'Tea', clicks: tea, tone: 'hp', title: `Tea: +5 HP and +5 MP regen a click for ${tea} more clicks.` })
  const regenerate = clicksOf('regenerateClicks')
  if (regenerate > 0) chips.push({ id: 'regenerate', label: 'Regenerate', detail: `+${summary.regenerateAmount} HP`, clicks: regenerate, tone: 'hp', title: `Regenerate: +${summary.regenerateAmount} HP every click for ${regenerate} more clicks.` })

  for (const [field, { stats, amount }] of Object.entries(STAT_BUFF_FIELDS)) {
    const clicks = clicksOf(field)
    if (clicks <= 0) continue
    const label = BUFF_LABELS[field] ?? field
    const detail = stats.length === 4 ? `+${amount} all` : `+${amount} ${stats.map((s) => STAT_LABEL[s] ?? s).join(' ')}`
    chips.push({ id: field, label, detail, clicks, tone: 'stat', title: `${label}: ${detail} stats for ${clicks} more clicks.` })
  }

  const wings = clicksOf('wings')
  if (wings > 0) chips.push({ id: 'wings', label: 'Wings', clicks: wings, tone: 'ability', title: `Wings: you can fly for ${wings} more clicks.` })
  const gills = clicksOf('gills')
  if (gills > 0) chips.push({ id: 'gills', label: 'Gills', clicks: gills, tone: 'ability', title: `Gills: you can breathe water for ${gills} more clicks.` })

  if (Number(buffs.silverAura ?? 0) > 0) {
    chips.push({ id: 'silver-aura', label: 'Silver Aura', detail: '+20 all', tone: 'aura', title: 'Silver Aura: +20 to STR, DEX, MAG and DEF, always.' })
  }

  return chips
}
