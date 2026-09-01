/**
 * Tab identity colours.
 *
 * A tab's colour distinguishes it; it does not mean anything. That makes this
 * the textbook use for the decorative `hue.*` roles rather than a semantic one —
 * the Quests tab is "the gold one", not "the reward one", and nothing should
 * break if a theme decides gold and amber swap places.
 *
 * The `TabColor` names are the historical vocabulary from when these were
 * Tailwind palettes. They are kept because tab configs across the app already
 * use them; each now resolves to a theme hue instead of a fixed colour.
 *
 * Every class string below is written out in full rather than assembled from a
 * hue name. Tailwind discovers utilities by scanning source text, so a class
 * built as `text-${hue}` is never generated — the same defect that made the old
 * `text-${room.iconColor}` room colours silently fail.
 */

export type TabColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'gold'
  | 'red'
  | 'sky'
  | 'gray'
  | 'violet'
  | 'pink'

/** Icon colour, active and resting. Resting is the same hue held back. */
const ICON_CLASSES: Record<TabColor, { active: string; resting: string }> = {
  blue: { active: 'text-hue-blue', resting: 'text-hue-blue/70' },
  green: { active: 'text-hue-green', resting: 'text-hue-green/70' },
  purple: { active: 'text-hue-purple', resting: 'text-hue-purple/70' },
  gold: { active: 'text-hue-gold', resting: 'text-hue-gold/70' },
  red: { active: 'text-hue-red', resting: 'text-hue-red/70' },
  sky: { active: 'text-hue-sky', resting: 'text-hue-sky/70' },
  gray: { active: 'text-hue-gray', resting: 'text-hue-gray/70' },
  violet: { active: 'text-hue-violet', resting: 'text-hue-violet/70' },
  pink: { active: 'text-hue-pink', resting: 'text-hue-pink/70' },
}

/** Border, fill and text for an active tab button. */
const ACTIVE_BUTTON_CLASSES: Record<TabColor, string> = {
  blue: 'border-1 border-hue-blue/80 hover:border-hue-blue bg-hue-blue/10 hover:bg-hue-blue/20 text-hue-blue',
  green: 'border-1 border-hue-green/80 hover:border-hue-green bg-hue-green/10 hover:bg-hue-green/20 text-hue-green',
  purple: 'border-1 border-hue-purple/80 hover:border-hue-purple bg-hue-purple/10 hover:bg-hue-purple/20 text-hue-purple',
  gold: 'border-1 border-hue-gold/80 hover:border-hue-gold bg-hue-gold/10 hover:bg-hue-gold/20 text-hue-gold',
  red: 'border-1 border-hue-red/80 hover:border-hue-red bg-hue-red/10 hover:bg-hue-red/20 text-hue-red',
  sky: 'border-1 border-hue-sky/80 hover:border-hue-sky bg-hue-sky/10 hover:bg-hue-sky/20 text-hue-sky',
  gray: 'border-1 border-hue-gray/80 hover:border-hue-gray bg-hue-gray/10 hover:bg-hue-gray/20 text-hue-gray',
  violet: 'border-1 border-hue-violet/80 hover:border-hue-violet bg-hue-violet/10 hover:bg-hue-violet/20 text-hue-violet',
  pink: 'border-1 border-hue-pink/80 hover:border-hue-pink bg-hue-pink/10 hover:bg-hue-pink/20 text-hue-pink',
}

const RESTING_BUTTON_CLASSES =
  'border border-line-subtle hover:border-line-strong bg-transparent hover:bg-surface-hover text-fg-secondary hover:text-fg-primary'

function normalize(color: TabColor | string | undefined): TabColor {
  return color && color in ICON_CLASSES ? (color as TabColor) : 'blue'
}

export function getTabIconColorClass(
  color: TabColor | string | undefined,
  isActive: boolean
): string {
  const entry = ICON_CLASSES[normalize(color)]
  return isActive ? entry.active : entry.resting
}

export function getTabButtonColorClasses(
  color: TabColor | string | undefined,
  isActive: boolean
): string {
  return isActive ? ACTIVE_BUTTON_CLASSES[normalize(color)] : RESTING_BUTTON_CLASSES
}
