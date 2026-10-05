'use client'

import { useState } from 'react'
import { describeStat, type StatBreakdown } from '@/lib/effective-stats'

/**
 * STR · DEX · MAG · DEF, as four small tiles or as one line. The character
 * panel and the Inv tab both draw this, so the numbers a player dresses
 * against are the same numbers wherever they look.
 *
 * Each number is a button: pressing it opens the sum behind it — core, gear,
 * buffs and skills, each named, adding up to the total combat rolls with.
 */

type StatKey = 'str' | 'dex' | 'mag' | 'def'

export interface CoreStats {
  str: StatBreakdown
  dex: StatBreakdown
  mag: StatBreakdown
  def: StatBreakdown
}

/** What the totals would become if the item being looked at were put on (or taken off). */
export type StatPreview = Partial<Record<StatKey, number>>

const STATS: Array<{ key: StatKey; code: string; name: string; color: string; does: (total: number) => string }> = [
  { key: 'str', code: 'STR', name: 'Strength', color: 'text-stat-str', does: (n) => `Your melee attack rolls 0 to ${n}.` },
  { key: 'dex', code: 'DEX', name: 'Dexterity', color: 'text-stat-dex', does: (n) => `Your ranged attack rolls 0 to ${n}, and you block ranged hits with 0 to ${n}.` },
  { key: 'mag', code: 'MAG', name: 'Magic', color: 'text-stat-mag', does: (n) => `Your spells are cast at ${n} power, and you block magic hits with 0 to ${n}.` },
  { key: 'def', code: 'DEF', name: 'Defense', color: 'text-stat-def', does: (n) => `You block melee hits with 0 to ${n}.` },
]

// Every part of the sum, in the order it is added, whether or not it is zero:
// a zero is an answer too ("no buff is running").
const PARTS: Array<{ key: 'core' | 'gear' | 'buff' | 'skill'; label: string; from: string }> = [
  { key: 'core', label: 'Core', from: 'Raised with Core Points' },
  { key: 'gear', label: 'Gear', from: 'Everything you are wearing' },
  { key: 'buff', label: 'Buffs', from: 'Running effects and auras' },
  { key: 'skill', label: 'Skills', from: 'Passive skills for what is in hand' },
]

/** "→ 755" beside a total, green for a gain and red for a loss. Nothing when the total would not move. */
function Becomes({ from, to }: { from: number; to?: number }) {
  if (to === undefined || to === from) return null
  return (
    <span className={`font-bold tabular-nums ${to > from ? 'text-status-success' : 'text-status-error'}`}>
      <span className="text-fg-muted" aria-hidden="true"> → </span>
      <span className="sr-only"> becomes </span>
      {to}
    </span>
  )
}

/** The sum behind one stat: its name, what it does, and each part with where it comes from. */
function Breakdown({ statKey, stat, id }: { statKey: StatKey; stat: StatBreakdown; id: string }) {
  const def = STATS.find((entry) => entry.key === statKey)!
  return (
    <div id={id} role="region" aria-label={`${def.name} breakdown`} className="rounded-lg border border-line-subtle/60 bg-surface-canvas/40 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <h5 className={`text-xs font-bold uppercase tracking-wide ${def.color}`}>{def.name}</h5>
        <span className={`text-base font-bold tabular-nums ${def.color}`}>{stat.total}</span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-fg-secondary">{def.does(stat.total)}</p>
      <dl className="mt-1.5 divide-y divide-line-subtle/30 text-[11px]">
        {PARTS.map((part) => {
          const value = stat[part.key]
          return (
            <div key={part.key} className="flex items-baseline gap-2 py-1">
              <dt className="w-10 flex-shrink-0 font-semibold text-fg-primary">{part.label}</dt>
              <dd className="min-w-0 flex-1 truncate text-fg-muted">{part.from}</dd>
              <dd className={`flex-shrink-0 font-semibold tabular-nums ${value === 0 ? 'text-fg-disabled' : value < 0 ? 'text-status-error' : 'text-fg-bright'}`}>
                {part.key === 'core' ? value : `${value >= 0 ? '+' : ''}${value}`}
              </dd>
            </div>
          )
        })}
        <div className="flex items-baseline gap-2 py-1">
          <dt className="flex-1 font-bold text-fg-primary">Total</dt>
          <dd className={`font-bold tabular-nums ${def.color}`}>{stat.total}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Which stat's breakdown is open; pressing the same number again closes it. */
function useOpenStat() {
  const [open, setOpen] = useState<StatKey | null>(null)
  return [open, (key: StatKey) => setOpen((prev) => (prev === key ? null : key))] as const
}

/** The four numbers on one line, for the Inv tab's column and sheet where the list needs the height. */
export function CoreStatsLine({ stats, preview, className = '' }: { stats: CoreStats; preview?: StatPreview | null; className?: string }) {
  const [open, toggle] = useOpenStat()
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
        {STATS.map(({ key, code, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            aria-expanded={open === key}
            aria-controls="core-stat-line-breakdown"
            title={`${describeStat(code, stats[key])} — press for the breakdown`}
            className={`-mx-0.5 flex items-baseline gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface-raised/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${open === key ? 'bg-surface-raised/70' : ''}`}
          >
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${color}`}>{code}</span>
            <span className="text-sm font-bold text-fg-bright">{stats[key].total}</span>
            <Becomes from={stats[key].total} to={preview?.[key]} />
          </button>
        ))}
      </div>
      {open && <Breakdown id="core-stat-line-breakdown" statKey={open} stat={stats[open]} />}
    </div>
  )
}

export default function CoreStatsGrid({ stats, preview, className = '' }: { stats: CoreStats; preview?: StatPreview | null; className?: string }) {
  const [open, toggle] = useOpenStat()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="grid grid-cols-4 gap-1.5">
        {STATS.map(({ key, code, color }) => {
          const stat = stats[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-expanded={open === key}
              aria-controls="core-stat-grid-breakdown"
              title={`${describeStat(code, stat)} — press for the breakdown`}
              className={`rounded-xl border px-2 py-1.5 text-center transition-colors hover:border-line-strong hover:bg-surface-raised/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                open === key ? 'border-line-strong bg-surface-raised/60' : 'border-line-subtle/40 bg-surface-panel/60'
              }`}
            >
              <span className={`block text-xs uppercase tracking-wide leading-none ${color}`}>{code}</span>
              <span className={`mt-0.5 block text-lg font-bold ${color}`}>
                {stat.total}
                <span className="text-sm"><Becomes from={stat.total} to={preview?.[key]} /></span>
              </span>
              <span className="block text-xs leading-none text-fg-muted tabular-nums">
                {stat.core}
                {stat.buff > 0 && <span className="text-fg-disabled"> · +{stat.buff} buff</span>}
                {stat.skill > 0 && <span className="text-fg-disabled"> · +{stat.skill} skill</span>}
              </span>
            </button>
          )
        })}
      </div>
      {open && <Breakdown id="core-stat-grid-breakdown" statKey={open} stat={stats[open]} />}
    </div>
  )
}
