'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '@/components/Icon'
import { formatVital, previewPct, vitalOverflow, vitalPct, vitalState } from '@/lib/vitals'

/**
 * The one vitals bar.
 *
 * Every HP, MP, XP and enemy-health bar in the game is this component at one
 * of four sizes, so a bar reads the same in the header, the battle HUD, the
 * Char tab, a party chip and a stranger's profile:
 *
 *   hair   3px   rail chips, member rows, player rows        number beside
 *   thin   6px   phone header, member card, room enemy        number beside
 *   mid   10px   battle MP, profile, Char tab                 number inside
 *   fat   16px   desktop header, battle HUD, full screen      number inside
 *
 * What travels with the bar at every size from thin up: the damage drain
 * (the part just lost stays lit for a moment, gold on a health bar as the
 * original's yellow was, so a hit reads as a hit and never as a gain), the
 * heal ghost (what a hovered restorer would add), the gain float ("+3" rising
 * off the bar when regen lands) and the over-max "+8" in the bar's own colour,
 * a cap on the bar's full end. Your own HP pulses from a tenth.
 *
 * Colour is the kind's resource role and nothing else — `resource.hp`,
 * `resource.mp`, `resource.xp`, `resource.foe` — unless the caller is the
 * party rail, whose HP is coloured by the member's state on purpose.
 */

export type VitalKind = 'hp' | 'mp' | 'xp' | 'foe'
export type VitalSize = 'hair' | 'thin' | 'mid' | 'fat'
export type VitalNumber = 'inside' | 'beside' | 'none'

const TRACK: Record<VitalSize, string> = {
  hair: 'h-[3px]',
  thin: 'h-1.5',
  mid: 'h-2.5',
  fat: 'h-4',
}

/** The number's size: inside the bar it is held to the track, beside it to the row. */
const NUMBER_TEXT: Record<VitalSize, string> = {
  hair: 'text-[8px]',
  thin: 'text-[9px]',
  mid: 'text-[8px]',
  fat: 'text-[10px]',
}

const FILL: Record<VitalKind, string> = {
  hp: 'bg-gradient-to-r from-fill-resource-hp to-resource-hp',
  mp: 'bg-gradient-to-r from-fill-resource-mp to-resource-mp',
  xp: 'bg-gradient-to-r from-fill-resource-xp to-resource-xp',
  foe: 'bg-gradient-to-r from-fill-resource-foe to-resource-foe',
}

/** The gain float and the ghost wear the kind's flat colour. */
const FLAT: Record<VitalKind, string> = {
  hp: 'bg-resource-hp',
  mp: 'bg-resource-mp',
  xp: 'bg-resource-xp',
  foe: 'bg-resource-foe',
}

const TEXT: Record<VitalKind, string> = {
  hp: 'text-resource-hp',
  mp: 'text-resource-mp',
  xp: 'text-resource-xp',
  foe: 'text-resource-foe',
}

/** The over-max cap: the kind's colour on a dark plate, so it reads against the full fill it sits on. */
const OVER_CAP: Record<VitalKind, string> = {
  hp: 'text-resource-hp border-resource-hp/60',
  mp: 'text-resource-mp border-resource-mp/60',
  xp: 'text-resource-xp border-resource-xp/60',
  foe: 'text-resource-foe border-resource-foe/60',
}

/** How long the lost part stays lit. */
const DRAIN_MS = 700

/**
 * The lost part: gold on a health bar, yours or the enemy's, as the original's
 * yellow was; a pale wash of the bar's own tone on MP and XP.
 */
const DRAIN: Record<VitalKind, string> = {
  hp: 'var(--resource-gold)',
  foe: 'var(--resource-gold)',
  mp: 'color-mix(in srgb, var(--resource-mp) 45%, var(--fg-bright))',
  xp: 'color-mix(in srgb, var(--resource-xp) 45%, var(--fg-bright))',
}

export interface VitalBarProps {
  current: number
  max: number
  kind: VitalKind
  size?: VitalSize
  /** Fill from the right: the enemy's side of a fight. The number, if beside, sits on the left. */
  rtl?: boolean
  /**
   * Your own bar: it pulses when critical. A teammate's or an enemy's does
   * not — the party says "hurt" in its badge, and an enemy running low is
   * good news.
   */
  self?: boolean
  /** The fill class, when the caller colours the bar itself (the party rail's state colouring). */
  fillClass?: string
  /** A hovered restorer's full amount; the part that lands ghosts onto the bar. */
  preview?: number
  /** Where the number goes. By default inside a mid or fat bar, beside a hair or thin one. */
  number?: VitalNumber
  /** Written before the number — "HP" — where nothing beside the bar names it. */
  label?: string
  /** Something to say after the number: the heal preview's "+20", say. */
  extra?: ReactNode
  /**
   * What a click restores, as the regenerate glyph and the number after the
   * value ("80 / 100 ⟳4"). One treatment for the header, the duel and the
   * Char tab, so regen is read the same wherever the bar is.
   */
  regen?: { amount: number; title: string } | null
  /**
   * What the last turn took or gave: a signed amount after the regen mark,
   * "−8" in the damage tone or "+12" in the heal tone. The duel's bars show
   * the hit that just landed and the MP the cast just spent.
   */
  delta?: { amount: number; title?: string } | null
  /**
   * Draw the over-max "+8" in the bar's colour: a cap on the bar's full end
   * when the number is inside, after the number when it is beside.
   */
  overflow?: boolean
  /** A gain that just landed, floated off the bar. A new `gainKey` replays it. */
  gain?: number | null
  gainKey?: number
  /** Seeds the previous fill so a drain shows on the first render: an enemy starts at 100. */
  initialPct?: number
  /** The drain is on from thin up; a caller can turn it off. */
  drain?: boolean
  /** The outer element's classes: width, flex share. */
  className?: string
  title?: string
}

export default function VitalBar({
  current,
  max,
  kind,
  size = 'thin',
  rtl = false,
  self = false,
  fillClass,
  preview = 0,
  number,
  label,
  extra,
  regen,
  delta,
  overflow = true,
  gain,
  gainKey,
  initialPct,
  drain,
  className = '',
  title,
}: VitalBarProps) {
  const pct = vitalPct(current, max)
  const ghostPct = previewPct(current, max, preview)
  const state = vitalState(current, max)
  const over = vitalOverflow(current, max)
  const showDrain = drain ?? size !== 'hair'

  // The drain: when the fill drops, remember where it fell from and let that
  // go after a moment. Only a new drop restarts the moment: the regen tick
  // that lands just after a hit nudges the fill up, and once that cancelled
  // the fade the gold stayed for good. The lit part runs from the fill to
  // where it fell from, so a gain eats into it rather than sliding it along.
  // Seeded so an enemy's bar can show the opening blow.
  const prevPct = useRef(initialPct ?? pct)
  const [drainState, setDrainState] = useState(() => ({
    from: showDrain && initialPct != null && initialPct > pct ? initialPct : 0,
    drop: 0,
  }))
  useEffect(() => {
    if (showDrain && pct < prevPct.current) {
      const from = prevPct.current
      setDrainState((d) => ({ from: Math.max(d.from, from), drop: d.drop + 1 }))
    }
    prevPct.current = pct
  }, [pct, showDrain])
  const draining = drainState.from > 0
  useEffect(() => {
    if (!draining) return
    const timer = setTimeout(() => setDrainState((d) => ({ ...d, from: 0 })), DRAIN_MS)
    return () => clearTimeout(timer)
  }, [drainState.drop, draining])
  const drainPct = showDrain ? Math.max(0, drainState.from - pct) : 0

  const placement: VitalNumber = number ?? (size === 'mid' || size === 'fat' ? 'inside' : 'beside')
  const fill = fillClass ?? FILL[kind]
  const pulse = self && kind === 'hp' && state === 'critical' ? 'motion-safe:animate-pulse' : ''
  const value = formatVital(current, max)
  const name = label ?? (kind === 'foe' ? 'Enemy HP' : kind.toUpperCase())
  const hint = title ?? `${name} ${value}${over > 0 ? ` +${over}` : ''}`
  // The overcharge is a buffer over the max: a hit spends Magic Armor, then
  // this, then the HP under it; a cast spends MP over the max first. Regen
  // never refills it.
  const showOver = overflow && over > 0
  const overTitle =
    kind === 'mp' ? `${over} MP over the max. A cast spends it first; regen does not refill it.`
    : kind === 'hp' ? `${over} HP over the max. A hit spends Magic Armor first, then this, then the HP under the max. Regen does not refill it.`
    : `${over} over the max.`

  // The marks after the number — or before it on a right-to-left bar, so
  // they sit on the open side and the value stays against the edge.
  const marks = (
    <>
      {showOver && placement !== 'inside' && <span className={TEXT[kind]} title={overTitle}>+{over}</span>}
      {regen && regen.amount > 0 && (
        <span className="inline-flex items-center gap-px opacity-75" title={regen.title}>
          <Icon name="regenerate" size={size === 'fat' ? 9 : 8} className="shrink-0" />
          {regen.amount}
        </span>
      )}
      {delta && delta.amount !== 0 && (
        <span className={delta.amount < 0 ? 'text-combat-damage' : 'text-combat-heal'} title={delta.title}>
          {delta.amount < 0 ? '−' : '+'}{Math.abs(delta.amount)}
        </span>
      )}
      {extra}
    </>
  )
  const numberNode = placement === 'none' ? null : (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap leading-none font-semibold tabular-nums ${NUMBER_TEXT[size]}`}>
      {rtl && marks}
      {label && <span className={placement === 'inside' ? '' : 'text-fg-muted'}>{label}</span>}
      <span>{value}</span>
      {!rtl && marks}
    </span>
  )

  const track = (
    <span
      className={`relative block overflow-hidden rounded-full bg-surface-raised/80 ${TRACK[size]} ${size === 'hair' ? '' : 'shadow-[inset_0_1px_3px_var(--shadow)]'} ${placement === 'beside' ? 'min-w-0 flex-1' : className}`}
      title={placement === 'beside' ? undefined : hint}
    >
      {drainPct > 0 && (
        <span
          className="absolute top-0 h-full rounded-full transition-all duration-500"
          style={{
            ...(rtl ? { right: `${pct}%` } : { left: `${pct}%` }),
            width: `${drainPct}%`,
            background: DRAIN[kind],
          }}
          aria-hidden="true"
        />
      )}
      <span
        className={`absolute top-0 h-full rounded-full transition-[width] duration-300 ease-out ${fill} ${pulse} ${rtl ? 'right-0' : 'left-0'}`}
        style={{ width: `${pct}%` }}
      />
      {ghostPct > 0 && (
        <span
          className={`absolute top-0 h-full rounded-r-full opacity-50 animate-pulse ${FLAT[kind]}`}
          style={{ left: `${pct}%`, width: `${Math.min(100 - pct, ghostPct)}%` }}
          aria-hidden="true"
        />
      )}
      {placement === 'inside' && (
        <span className={`absolute inset-0 flex items-center gap-1 label-over-fill ${rtl ? 'flex-row-reverse pr-2' : 'pl-2'}`}>
          <span className="min-w-0 overflow-hidden">{numberNode}</span>
          {/* Over the max, the "+8" rides the bar's full end, where the fill would go on if it could. */}
          {showOver && (
            <span
              className={`flex shrink-0 self-stretch items-center rounded-full border bg-surface-canvas/90 px-1.5 font-extrabold leading-none tabular-nums [text-shadow:none] ${NUMBER_TEXT[size]} ${OVER_CAP[kind]} ${rtl ? 'mr-auto' : 'ml-auto'}`}
              title={overTitle}
            >
              +{over}
            </span>
          )}
        </span>
      )}
      {gain != null && gain > 0 && (
        <span
          key={gainKey}
          className={`absolute -top-3 right-0 text-[10px] font-bold leading-none pointer-events-none tabular-nums ${TEXT[kind]}`}
          style={{ animation: 'vitalFloat 2.5s forwards' }}
          aria-hidden="true"
        >
          +{gain}
        </span>
      )}
    </span>
  )

  if (placement !== 'beside') return track

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={hint}>
      {rtl ? (
        <>
          <span className="shrink-0 text-fg-secondary">{numberNode}</span>
          {track}
        </>
      ) : (
        <>
          {track}
          <span className="shrink-0 text-fg-secondary">{numberNode}</span>
        </>
      )}
    </span>
  )
}

/**
 * The keyframes the gain float runs on. Rendered once by the game shell; a
 * bar outside it (a World Tool page, a test) simply has no float.
 */
export function VitalBarKeyframes() {
  return (
    <style>{`
      @keyframes vitalFloat {
        0%   { opacity: 1; transform: translateY(0px); }
        60%  { opacity: 1; transform: translateY(-6px); }
        100% { opacity: 0; transform: translateY(-12px); }
      }
      @keyframes wardShatter {
        0%   { opacity: 1; transform: scale(1);    box-shadow: 0 0 0 0 color-mix(in srgb, var(--stat-def) 90%, transparent); }
        35%  { opacity: 1; transform: scale(1.12); box-shadow: 0 0 0 7px transparent; }
        100% { opacity: 0; transform: scale(0.85); box-shadow: 0 0 0 7px transparent; }
      }
    `}</style>
  )
}
