'use client'

import type { SortStat } from '@/lib/inventory-categories'

interface StatSortControlProps {
  value: SortStat
  onChange: (sort: SortStat) => void
}

const ACTIVE_CLASSES: Record<SortStat, string> = {
  none: 'fill-surface-selected border-line-strong/50',
  str: 'bg-status-error/20 hover:bg-status-error/30 text-status-error border-status-error/40',
  dex: 'bg-status-success/20 hover:bg-status-success/30 text-status-success border-status-success/40',
  mag: 'bg-status-info/20 hover:bg-status-info/30 text-status-info border-status-info/40',
  def: 'bg-resource-gold/20 hover:bg-resource-gold/30 text-resource-gold border-resource-gold/40',
}

const INACTIVE_TEXT_CLASSES: Record<string, string> = {
  str: 'text-status-error/50',
  dex: 'text-status-success/50',
  mag: 'text-status-info/50',
  def: 'text-resource-gold/50',
}

/** Shared STR/DEX/MAG/DEF sort selector used by the inventory and the shop. */
export default function StatSortControl({ value, onChange }: StatSortControlProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-fg-muted uppercase tracking-wide flex-shrink-0">Sort</span>
      {(['none', 'str', 'dex', 'mag', 'def'] as SortStat[]).map((s) => {
        const isActive = value === s
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 border ${
              isActive
                ? ACTIVE_CLASSES[s]
                : `bg-surface-raised/50 hover:bg-surface-raised/70 border-line-subtle/50 hover:border-line-strong/50 ${
                    s === 'none' ? 'text-fg-secondary' : INACTIVE_TEXT_CLASSES[s]
                  }`
            }`}
          >
            {s === 'none' ? '—' : s.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
