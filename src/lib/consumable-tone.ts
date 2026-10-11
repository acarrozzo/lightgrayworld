import type { ConsumableSummary } from '@/lib/item-actions'

/**
 * A consumable's colour, as the semantic roles the theme already defines:
 * what the thing touches. The icon, the left rail, the effect text and the
 * verb all wear it, so a Strength Potion reads as STR at a glance in the bag,
 * in the shop, in the battle deck and in the Actions tab alike.
 */
export const CONSUMABLE_TONES = {
  hp: { text: 'text-resource-hp', fill: 'fill-resource-hp', rail: 'border-l-resource-hp' },
  mp: { text: 'text-resource-mp', fill: 'fill-resource-mp', rail: 'border-l-resource-mp' },
  both: { text: 'text-hue-purple', fill: 'fill-hue-purple', rail: 'border-l-hue-purple' },
  str: { text: 'text-stat-str', fill: 'fill-stat-str', rail: 'border-l-stat-str' },
  dex: { text: 'text-stat-dex', fill: 'fill-stat-dex', rail: 'border-l-stat-dex' },
  mag: { text: 'text-stat-mag', fill: 'fill-stat-mag', rail: 'border-l-stat-mag' },
  def: { text: 'text-stat-def', fill: 'fill-stat-def', rail: 'border-l-stat-def' },
  all: { text: 'text-resource-gold', fill: 'fill-resource-gold', rail: 'border-l-resource-gold' },
  ability: { text: 'text-hue-sky', fill: 'fill-hue-sky', rail: 'border-l-hue-sky' },
  ward: { text: 'text-hue-green', fill: 'fill-hue-green', rail: 'border-l-hue-green' },
  neutral: { text: 'text-fg-bright', fill: 'fill-accent', rail: 'border-l-line-strong' },
} as const

export type ConsumableTone = (typeof CONSUMABLE_TONES)[keyof typeof CONSUMABLE_TONES]

/** Which of those a buff countdown belongs to, by the column it ticks down. */
const BUFF_TONE: Record<string, keyof typeof CONSUMABLE_TONES> = {
  buffStrClicks: 'str',
  buffDexClicks: 'dex',
  buffMagClicks: 'mag',
  buffDefClicks: 'def',
  buffCoffeeClicks: 'all',
  buffGloryClicks: 'all',
  // Tea restores HP *and* MP a click, so it belongs to the dual family with
  // the potions that fill both — purple, not one vital's colour.
  buffTeaClicks: 'both',
  regenerateClicks: 'hp',
  ironSkinClicks: 'def',
  poisonImmuneClicks: 'ward',
  wings: 'ability',
  gills: 'ability',
}

/** What this consumable is coloured by: what it restores, or the buff it grants. */
export function consumableTone(summary: ConsumableSummary): ConsumableTone {
  if (summary.group === 'hp') return CONSUMABLE_TONES.hp
  if (summary.group === 'mp') return CONSUMABLE_TONES.mp
  if (summary.group === 'both') return CONSUMABLE_TONES.both
  const buff = summary.buffs[0]
  // Coffee and Glory lift everything; they read as an aura, not as one stat.
  if (buff && Object.keys(buff.bonus).length >= 3) return CONSUMABLE_TONES.all
  return CONSUMABLE_TONES[BUFF_TONE[buff?.field ?? ''] ?? 'neutral']
}
