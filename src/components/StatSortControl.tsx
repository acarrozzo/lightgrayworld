'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SortStat } from '@/lib/inventory-categories'

interface StatSortControlProps {
  value: SortStat
  onChange: (sort: SortStat) => void
  /** When both are given, the flyout also carries the "compare with equipped" switch. */
  compareEnabled?: boolean
  onCompareChange?: (enabled: boolean) => void
  className?: string
}

const OPTIONS: Array<{ id: SortStat; label: string; active: string; idle: string }> = [
  { id: 'none', label: 'Default', active: 'fill-surface-selected border-line-strong/50', idle: 'text-fg-secondary' },
  { id: 'classic', label: 'Classic', active: 'fill-surface-selected border-line-strong/50', idle: 'text-fg-secondary' },
  { id: 'str', label: 'STR', active: 'bg-stat-str/25 hover:bg-stat-str/35 text-stat-str border-stat-str/50', idle: 'text-stat-str/60' },
  { id: 'dex', label: 'DEX', active: 'bg-stat-dex/25 hover:bg-stat-dex/35 text-stat-dex border-stat-dex/50', idle: 'text-stat-dex/60' },
  { id: 'mag', label: 'MAG', active: 'bg-stat-mag/25 hover:bg-stat-mag/35 text-stat-mag border-stat-mag/50', idle: 'text-stat-mag/60' },
  { id: 'def', label: 'DEF', active: 'bg-stat-def/25 hover:bg-stat-def/35 text-stat-def border-stat-def/50', idle: 'text-stat-def/60' },
]

/**
 * One chip that opens the sort choice: Default (equipment by stat power, the
 * rest in classic order), Classic (the original game's INV order), or one of
 * STR/DEX/MAG/DEF. Shared by the inventory and the shop so the filter strip
 * stays one row.
 */
export default function StatSortControl({
  value,
  onChange,
  compareEnabled = false,
  onCompareChange,
  className = '',
}: StatSortControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const current = OPTIONS.find((option) => option.id === value) ?? OPTIONS[0]
  const isSorted = value !== 'none'

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors duration-200 flex items-center gap-1 whitespace-nowrap ${
          isSorted
            ? current.active
            : 'bg-surface-raised/50 hover:bg-surface-raised/70 text-fg-secondary border-line-subtle/50 hover:border-line-strong/50'
        }`}
      >
        <span>{isSorted ? `Sort: ${current.label}` : 'Sort'}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 flex flex-col gap-1 p-1 rounded-md bg-surface-raised border border-line-subtle shadow-lg">
          <div role="listbox" aria-label="Sort by stat" className="flex gap-1">
          {OPTIONS.map((option) => {
            const isActive = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(option.id)
                  setOpen(false)
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors duration-200 whitespace-nowrap ${
                  isActive
                    ? option.active
                    : `bg-transparent hover:bg-surface-hover/50 border-transparent ${option.idle}`
                }`}
              >
                {option.label}
              </button>
            )
          })}
          </div>
          {onCompareChange && (
            <label className="flex items-center gap-2 px-2 py-1 border-t border-line-subtle/60 text-[11px] text-fg-secondary cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={compareEnabled}
                onChange={(event) => onCompareChange(event.target.checked)}
                className="accent-status-success"
              />
              Compare with equipped gear
            </label>
          )}
        </div>
      )}
    </div>
  )
}
