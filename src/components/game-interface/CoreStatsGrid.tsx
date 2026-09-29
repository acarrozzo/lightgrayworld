'use client'

import { describeStat, type StatBreakdown } from '@/lib/effective-stats'

/**
 * STR · DEX · MAG · DEF as four small tiles, each with its total over its
 * core value and any buff or skill on top. The character panel's Core Stats
 * row and the Gear layer both draw this, so the numbers a player dresses
 * against are the same numbers wherever they look.
 */

export interface CoreStats {
  str: StatBreakdown
  dex: StatBreakdown
  mag: StatBreakdown
  def: StatBreakdown
}

interface StatDisplayProps {
  label: string
  stat: StatBreakdown
  compact?: boolean
  color?: string
}

export function StatDisplay({ label, stat, compact = false, color }: StatDisplayProps) {
  return (
    <div
      className={`rounded-xl border border-line-subtle/40 bg-surface-panel/60 text-center ${compact ? 'px-2 py-1.5' : 'px-4 py-3'}`}
      title={describeStat(label, stat)}
    >
      <p className={`text-xs uppercase tracking-wide leading-none ${color ?? 'text-fg-secondary'}`}>{label}</p>
      <p className={`font-bold ${color ?? 'text-fg-bright'} ${compact ? 'text-lg mt-0.5' : 'text-2xl mt-1'}`}>{stat.total}</p>
      <p className="text-xs text-fg-muted leading-none tabular-nums">
        {stat.core}
        {stat.buff > 0 && <span className="text-fg-disabled"> · +{stat.buff} buff</span>}
        {stat.skill > 0 && <span className="text-fg-disabled"> · +{stat.skill} skill</span>}
      </p>
    </div>
  )
}

export default function CoreStatsGrid({ stats, className = '' }: { stats: CoreStats; className?: string }) {
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${className}`}>
      <StatDisplay label="STR" stat={stats.str} compact color="text-stat-str" />
      <StatDisplay label="DEX" stat={stats.dex} compact color="text-stat-dex" />
      <StatDisplay label="MAG" stat={stats.mag} compact color="text-stat-mag" />
      <StatDisplay label="DEF" stat={stats.def} compact color="text-stat-def" />
    </div>
  )
}
