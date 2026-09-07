'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import { AUTO_EQUIP_MODES, useAutoEquipSkipNegatives, type AutoEquipMode } from '@/lib/auto-equip'

interface AutoEquipRowProps {
  disabled: boolean
  onAction?: (action: { type: string; data?: any }) => void
}

const CHIP =
  'px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors duration-200 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

/** How long a press stays "in flight" if no inventory ever comes back (a refused action, a dropped socket). */
const PENDING_TIMEOUT_MS = 4000

/**
 * MAX 1H · 2H · DEX · MAG · DEF — one tap dresses the player in their best gear for
 * that stat, the way the original's stats-quick row did. The slider button
 * opens the one option: skip items that carry a negative stat.
 *
 * A press is one server action; the chips lock until the server's answer
 * lands (the inventory it sends back replaces the store's array, changed or
 * not), so a second tap during the round trip cannot queue a second turn.
 */
export default function AutoEquipRow({ disabled, onAction }: AutoEquipRowProps) {
  const inventory = useGameStore((state) => state.inventory)
  const [skipNegatives, setSkipNegatives] = useAutoEquipSkipNegatives()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<AutoEquipMode | null>(null)
  const inventoryAtPressRef = useRef(inventory)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // The answer arrived: the store holds a different inventory array than the one at press time.
  useEffect(() => {
    if (pending && inventory !== inventoryAtPressRef.current) setPending(null)
  }, [inventory, pending])

  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(() => setPending(null), PENDING_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [pending])

  const run = (mode: AutoEquipMode) => {
    if (pending) return
    inventoryAtPressRef.current = inventory
    setPending(mode)
    onAction?.({ type: 'auto_equip', data: { mode, skipNegatives } })
  }

  const locked = disabled || pending !== null

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1.5">
      <span
        className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted"
        title="Auto-equip: put on your best gear for one stat in a single tap"
      >
        Max
      </span>
      {AUTO_EQUIP_MODES.map((mode) => {
        const inFlight = pending === mode.id
        return (
          <button
            key={mode.id}
            type="button"
            disabled={locked}
            aria-busy={inFlight}
            onClick={() => run(mode.id)}
            title={mode.title}
            className={`${CHIP} ${mode.className} ${inFlight ? 'animate-pulse !opacity-90' : ''}`}
          >
            {mode.label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Auto-equip options"
        title="Auto-equip options"
        className={`p-1 rounded border transition-colors duration-200 ${
          skipNegatives
            ? 'text-status-error border-status-error/50 bg-status-error/10'
            : 'text-fg-secondary border-line-subtle/50 hover:border-line-strong/50 hover:bg-surface-raised/50'
        }`}
      >
        <SlidersHorizontal size={12} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 p-1 rounded-md bg-surface-raised border border-line-subtle shadow-lg">
          <label className="flex items-center gap-2 px-2 py-1 text-[11px] text-fg-secondary cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={skipNegatives}
              onChange={(event) => setSkipNegatives(event.target.checked)}
              className="accent-status-error"
            />
            Skip items with a negative stat
          </label>
        </div>
      )}
    </div>
  )
}
