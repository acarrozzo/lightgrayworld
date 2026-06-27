'use client'

import type { SortStat } from '@/lib/inventory-categories'

interface StatSortControlProps {
  value: SortStat
  onChange: (sort: SortStat) => void
}

const ACTIVE_CLASSES: Record<SortStat, string> = {
  none: 'bg-gray-600/80 hover:bg-gray-600 text-white border-gray-500/50',
  str: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/40',
  dex: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/40',
  mag: 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border-sky-500/40',
  def: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/40',
}

const INACTIVE_TEXT_CLASSES: Record<string, string> = {
  str: 'text-red-400/50',
  dex: 'text-emerald-400/50',
  mag: 'text-sky-400/50',
  def: 'text-amber-400/50',
}

/** Shared STR/DEX/MAG/DEF sort selector used by the inventory and the shop. */
export default function StatSortControl({ value, onChange }: StatSortControlProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-gray-500 uppercase tracking-wide flex-shrink-0">Sort</span>
      {(['none', 'str', 'dex', 'mag', 'def'] as SortStat[]).map((s) => {
        const isActive = value === s
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 border ${
              isActive
                ? ACTIVE_CLASSES[s]
                : `bg-gray-800/50 hover:bg-gray-800/70 border-gray-700/50 hover:border-gray-600/50 ${
                    s === 'none' ? 'text-gray-400' : INACTIVE_TEXT_CLASSES[s]
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
