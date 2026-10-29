'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import Icon from '@/components/Icon'
import { EXPIRING_CLASS, STATUS_TONE_CLASSES } from '@/components/StatusStrip'
import type { StatusChip } from '@/lib/status-effects'

/**
 * The running effects as the duel wears them: one small tile per effect, the
 * glyph and one number — the clicks left, the pool for Magic Armor, the HP a
 * click for regen. The original's buffBox row sat in the same place, under
 * your stats in the battle box; this is that row at a size six effects fit
 * on one line of a phone card. The full chip is the hover text. A tile in
 * its last clicks pulses.
 *
 * The strip excludes Magic Armor by default: the duel gives the pool its own
 * pill on the name line (MagicArmorPill), and nothing is said twice.
 */
export function EffectBadges({ chips, exclude = ['magic-armor'], className = '' }: { chips: StatusChip[]; exclude?: string[]; className?: string }) {
  const shown = chips.filter((chip) => !exclude.includes(chip.id))
  if (shown.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`} aria-label="Effects running on you">
      {shown.map((chip) => (
        <EffectBadge key={chip.id} chip={chip} />
      ))}
    </div>
  )
}

export function EffectBadge({ chip }: { chip: StatusChip }) {
  return (
    <span
      title={chip.title}
      aria-label={chip.title}
      className={`inline-flex h-4 items-center gap-0.5 rounded border px-1 text-[9px] font-extrabold leading-none tabular-nums cursor-help ${STATUS_TONE_CLASSES[chip.tone]} ${chip.expiring ? EXPIRING_CLASS : ''}`}
    >
      <Icon name={chip.icon} size={10} className="shrink-0" />
      {chip.badge && <span>{chip.badge}</span>}
    </span>
  )
}

/**
 * The badge row folded up: one chip in the stat row with the count of effects
 * running, which opens and closes the row. Green with poison in the count,
 * breathing when any effect is in its last clicks, so the folded row still
 * says the two things that matter mid-fight. The same idea as the Explore
 * tab's Effects button, at the duel's size.
 */
export function EffectsToggle({ chips, open, onToggle, className = '' }: { chips: StatusChip[]; open: boolean; onToggle: () => void; className?: string }) {
  if (chips.length === 0) return null
  const poisoned = chips.some((chip) => chip.tone === 'poison')
  const expiring = chips.some((chip) => chip.expiring)
  const label = `${chips.length} effect${chips.length === 1 ? '' : 's'} running on you${poisoned ? ', including poison' : ''}${expiring ? ', one about to run out' : ''}`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${label}. ${open ? 'Hide' : 'Show'} them`}
      title={`${label}. ${open ? 'Hide' : 'Show'}`}
      className={`inline-flex h-4 shrink-0 items-center gap-0.5 rounded border px-1 text-[9px] font-extrabold leading-none tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        poisoned ? STATUS_TONE_CLASSES.poison : STATUS_TONE_CLASSES.vitals
      } ${open ? '' : 'opacity-80'} ${expiring ? EXPIRING_CLASS : ''} ${className}`}
    >
      <Sparkles size={9} aria-hidden="true" />
      <span>{chips.length}</span>
      <ChevronDown size={9} aria-hidden="true" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

/** How long the shatter plays before the pill is gone. Matches the wardShatter keyframes. */
const SHATTER_MS = 600

/**
 * Magic Armor's pool as a shield pill: the glyph and what is left. Worn on
 * the duel's name line and after the header's HP bar, the one place the
 * original always showed its red "+N" box. On the hit that spends the last
 * point the pill rings once and drops out (wardShatter, in VitalBarKeyframes);
 * a recast brings it straight back.
 */
export function MagicArmorPill({ amount, className = '' }: { amount: number; className?: string }) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const prev = useRef(value)
  const [shattering, setShattering] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (value === 0 && prev.current > 0) {
      setShattering(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setShattering(false), SHATTER_MS)
    } else if (value > 0 && shattering) {
      setShattering(false)
    }
    prev.current = value
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // `shattering` is read, not a trigger: a recast mid-animation cancels it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (value <= 0 && !shattering) return null
  const title = shattering
    ? 'Your Magic Armor shatters.'
    : `Magic Armor: the next ${value} damage is absorbed before it reaches your HP. It wears off as it is hit.`
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex h-4 shrink-0 items-center gap-0.5 rounded border px-1 text-[10px] font-extrabold leading-none tabular-nums ${STATUS_TONE_CLASSES.ward} ${className}`}
      style={shattering ? { animation: `wardShatter ${SHATTER_MS}ms ease-out forwards` } : undefined}
    >
      <Icon name="magicarmor" size={10} className="shrink-0" />
      <span>{shattering ? 0 : value}</span>
    </span>
  )
}

/**
 * HP or MP over the max — a fountain's or a feast's overcharge — as a gold
 * pill beside the Magic Armor pill on the duel's name line. The two are the
 * same kind of thing, a buffer that goes before the bar does: a hit spends
 * Magic Armor first, then the overcharge (it is the top of the bar), then the
 * HP under the max. Regen never refills an overcharge.
 */
export function OverflowPill({ kind, amount, className = '' }: { kind: 'hp' | 'mp'; amount: number; className?: string }) {
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  if (value <= 0) return null
  const title =
    kind === 'hp'
      ? `${value} HP over your max. A hit spends Magic Armor first, then this, then the HP under your max. Regen does not refill it.`
      : `${value} MP over your max. Casting spends it first; regen does not refill it.`
  return (
    <span
      title={title}
      aria-label={title}
      className={`inline-flex h-4 shrink-0 items-center gap-0.5 rounded border px-1 text-[10px] font-extrabold leading-none tabular-nums ${STATUS_TONE_CLASSES.aura} ${className}`}
    >
      <span>+{value}</span>
      <span className="text-[8px] font-bold opacity-80">{kind.toUpperCase()}</span>
    </span>
  )
}
