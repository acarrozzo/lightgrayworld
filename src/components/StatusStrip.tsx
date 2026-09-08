'use client'

import type { StatusChip, StatusTone } from '@/lib/status-effects'

/** Chip colours by role: what hurts, what wards, what heals, what boosts. */
const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  hp: 'text-resource-hp border-resource-hp/40 bg-resource-hp/10',
  mp: 'text-resource-mp border-resource-mp/40 bg-resource-mp/10',
  stat: 'text-combat-heal border-combat-heal/40 bg-combat-heal/10',
  ability: 'text-hue-sky border-hue-sky/40 bg-hue-sky/10',
  poison: 'text-hue-green border-hue-green/50 bg-hue-green/10',
  ward: 'text-stat-def border-stat-def/40 bg-stat-def/10',
  aura: 'text-resource-gold border-resource-gold/40 bg-resource-gold/10',
}

/**
 * The original's row of buffBox tags: `regen +3`, `tea / 87`, `ironskin +12`,
 * `[ poison ]`. One small chip per running effect, the countdown at its end.
 * Lives in the character panel; the header only floats the per-click gain.
 */
export default function StatusStrip({ chips, className }: { chips: StatusChip[]; className?: string }) {
  if (chips.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ''}`} aria-label="Active effects">
      {chips.map((chip) => (
        <span
          key={chip.id}
          title={chip.title}
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] leading-4 font-semibold whitespace-nowrap cursor-help ${STATUS_TONE_CLASSES[chip.tone]}`}
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
