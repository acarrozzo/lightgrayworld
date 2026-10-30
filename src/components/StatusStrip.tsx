'use client'

import type { StatusChip, StatusTone } from '@/lib/status-effects'

/**
 * Chip colours by role: what hurts, what wards, what heals, what boosts.
 *
 * `vitals` is purple because it is neither HP nor MP alone: anything that moves
 * both — tea, a regen covering both bars — wears the same colour as the potions
 * that fill both, rather than picking a side.
 *
 * Shared with the mini badges (EffectBadges) so a chip and its badge are the
 * same colour wherever they appear.
 */
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  hp: 'text-resource-hp border-resource-hp/40 bg-resource-hp/10',
  mp: 'text-resource-mp border-resource-mp/40 bg-resource-mp/10',
  vitals: 'text-hue-purple border-hue-purple/40 bg-hue-purple/10',
  str: 'text-stat-str border-stat-str/40 bg-stat-str/10',
  dex: 'text-stat-dex border-stat-dex/40 bg-stat-dex/10',
  mag: 'text-stat-mag border-stat-mag/40 bg-stat-mag/10',
  def: 'text-stat-def border-stat-def/40 bg-stat-def/10',
  all: 'text-resource-gold border-resource-gold/40 bg-resource-gold/10',
  ability: 'text-hue-sky border-hue-sky/40 bg-hue-sky/10',
  poison: 'text-hue-green border-hue-green/50 bg-hue-green/10',
  ward: 'text-stat-def border-stat-def/40 bg-stat-def/10',
  aura: 'text-resource-gold border-resource-gold/40 bg-resource-gold/10',
}

/** The same roles as a filled button, for a chip's own verb (the Effects popover's Again). */
export const STATUS_TONE_FILLS: Record<StatusTone, string> = {
  hp: 'fill-resource-hp',
  mp: 'fill-resource-mp',
  vitals: 'fill-hue-purple',
  str: 'fill-stat-str',
  dex: 'fill-stat-dex',
  mag: 'fill-stat-mag',
  def: 'fill-stat-def',
  all: 'fill-resource-gold',
  ability: 'fill-hue-sky',
  poison: 'fill-hue-green',
  ward: 'fill-stat-def',
  aura: 'fill-resource-gold',
}

/** The last-clicks warning: the chip or badge breathes until the effect goes. */
export const EXPIRING_CLASS = 'motion-safe:animate-pulse'

/**
 * The original's row of buffBox tags: `regen +3`, `tea / 87`, `ironskin +12`,
 * `[ poison ]`. One small chip per running effect, the countdown at its end.
 * Lives in the character panel; the header only floats the per-click gain.
 * A chip in its last clicks pulses, the warning before the "ran out" line.
 */
export default function StatusStrip({ chips, className }: { chips: StatusChip[]; className?: string }) {
  if (chips.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ''}`} aria-label="Active effects">
      {chips.map((chip) => (
        <span
          key={chip.id}
          title={chip.title}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] leading-4 font-semibold whitespace-nowrap cursor-help ${STATUS_TONE_CLASSES[chip.tone]} ${chip.expiring ? EXPIRING_CLASS : ''}`}
        >
          <span>{chip.label}</span>
          {chip.detail && <span className="font-normal opacity-90 tabular-nums">{chip.detail}</span>}
          {typeof chip.clicks === 'number' && (
            <span className="font-normal text-fg-muted tabular-nums">/ {chip.clicks}</span>
          )}
        </span>
      ))}
    </div>
  )
}
