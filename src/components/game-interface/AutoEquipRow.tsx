'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Info, SlidersHorizontal } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import type { StatKey } from '@/lib/effective-stats'
import {
  AUTO_EQUIP_MODES,
  previewAutoEquip,
  previewRows,
  useAutoEquipSkipNegatives,
  type AutoEquipMode,
  type AutoEquipModeDef,
  type AutoEquipPreview,
} from '@/lib/auto-equip'

interface AutoEquipRowProps {
  disabled: boolean
  onAction?: (action: { type: string; data?: any }) => void
}

const CHIP =
  'px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors duration-200 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

/** How long a press stays "in flight" if no inventory ever comes back (a refused action, a dropped socket). */
const PENDING_TIMEOUT_MS = 4000

const FLYOUT =
  'pointer-events-none absolute left-0 top-full z-30 mt-1 max-w-[calc(100vw-2rem)] rounded-md border border-line-subtle bg-surface-raised p-2.5 text-[11px] leading-snug text-fg-secondary shadow-lg'

const STAT_TONE: Record<StatKey, string> = { str: 'text-stat-str', dex: 'text-stat-dex', mag: 'text-stat-mag', def: 'text-stat-def' }

const changeTone = (delta: number) => (delta > 0 ? 'text-status-success' : delta < 0 ? 'text-status-error' : 'text-fg-muted')

/**
 * What a chip would do, while it is hovered or focused: each stat it moves,
 * from where it is to where it would land, the one it is named for first.
 * Gains green, losses red, as the gear compare reads.
 */
function PreviewFlyout({ mode, preview }: { mode: AutoEquipModeDef; preview: AutoEquipPreview }) {
  return (
    <div id="auto-equip-preview" role="tooltip" className={`${FLYOUT} w-56`}>
      <p className="text-fg-primary">{mode.title}</p>
      {preview.changed ? (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 tabular-nums">
            {previewRows(preview).map((row) => (
              <Fragment key={row.stat}>
                <dt className={`text-[10px] font-semibold uppercase tracking-wide ${STAT_TONE[row.stat]}`}>{row.stat}</dt>
                <dd className="text-xs text-fg-bright">
                  {row.from}
                  <span className="text-fg-muted"> → </span>
                  <span className={`font-bold ${changeTone(row.delta)}`}>{row.to}</span>
                </dd>
                <dd className={`text-right text-xs font-bold ${changeTone(row.delta)}`}>
                  {row.delta > 0 ? '+' : row.delta < 0 ? '−' : ''}
                  {Math.abs(row.delta)}
                </dd>
              </Fragment>
            ))}
          </dl>
          <p className="mt-2 text-fg-muted">
            {preview.swaps} slot{preview.swaps === 1 ? '' : 's'} change
          </p>
        </>
      ) : (
        <p className="mt-1 text-fg-muted">
          Already wearing your best: {preview.stat.toUpperCase()} {preview.after}
        </p>
      )}
    </div>
  )
}

/**
 * MAX 1H · 2H · DEX · MAG · DEF — one tap dresses the player in their best gear for
 * that stat, the way the original's stats-quick row did. The slider button
 * opens the one option: skip items that carry a negative stat.
 *
 * A press is one server action; the chips lock until the server's answer
 * lands (the inventory it sends back replaces the store's array, changed or
 * not), so a second tap during the round trip cannot queue a second turn.
 *
 * Hovering or focusing a chip opens a flyout with what it would do — each
 * stat it moves, from and to — and that flyout is the only place it shows:
 * the chips, the stat line and the header stay as they are. Touch, with no
 * hover, just presses.
 */
export default function AutoEquipRow({ disabled, onAction }: AutoEquipRowProps) {
  const inventory = useGameStore((state) => state.inventory)
  const player = useGameStore((state) => state.player)
  const [skipNegatives, setSkipNegatives] = useAutoEquipSkipNegatives()
  const [open, setOpen] = useState(false)
  // The "what does MAX do" note: shown on hover or focus, and on a tap where there is no hover.
  const [infoOpen, setInfoOpen] = useState(false)
  const [pending, setPending] = useState<AutoEquipMode | null>(null)
  const [hovered, setHovered] = useState<AutoEquipModeDef | null>(null)
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

  // Every mode planned against what is owned now, for the flyout.
  const previews = useMemo(() => {
    const byMode = {} as Record<AutoEquipMode, AutoEquipPreview>
    for (const mode of AUTO_EQUIP_MODES) byMode[mode.id] = previewAutoEquip(player, inventory, mode.id, skipNegatives)
    return byMode
  }, [player, inventory, skipNegatives])

  const showPreview = (mode: AutoEquipModeDef | null) => setHovered(mode)
  // A mouse only: a finger's tap is a press, not a look.
  const onPointerEnter = (mode: AutoEquipModeDef) => (event: PointerEvent) => {
    if (event.pointerType === 'mouse') showPreview(mode)
  }

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
    showPreview(null)
    inventoryAtPressRef.current = inventory
    setPending(mode)
    onAction?.({ type: 'auto_equip', data: { mode, skipNegatives } })
  }

  const locked = disabled || pending !== null

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Max</span>
      <button
        type="button"
        onClick={() => setInfoOpen((prev) => !prev)}
        onMouseEnter={() => setInfoOpen(true)}
        onMouseLeave={() => setInfoOpen(false)}
        onFocus={() => setInfoOpen(true)}
        onBlur={() => setInfoOpen(false)}
        aria-label="What the MAX buttons do"
        aria-expanded={infoOpen}
        aria-describedby={infoOpen ? 'auto-equip-info' : undefined}
        className="-ml-1 rounded-full p-0.5 text-fg-muted/70 transition-colors hover:text-fg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Info size={12} aria-hidden="true" />
      </button>
      {infoOpen && (
        <div
          id="auto-equip-info"
          role="tooltip"
          className={`${FLYOUT} w-64`}
        >
          <p className="text-fg-primary">One tap puts on the best gear you own for that stat.</p>
          <ul className="mt-1.5 space-y-0.5">
            {AUTO_EQUIP_MODES.map((mode) => (
              <li key={mode.id}>
                <span className="font-semibold text-fg-primary">{mode.label}</span> · {mode.title}
              </li>
            ))}
          </ul>
        </div>
      )}
      {hovered && !pending && !infoOpen && !open && <PreviewFlyout mode={hovered} preview={previews[hovered.id]} />}
      {AUTO_EQUIP_MODES.map((mode) => {
        const inFlight = pending === mode.id
        return (
          <button
            key={mode.id}
            type="button"
            disabled={locked}
            aria-busy={inFlight}
            aria-describedby={hovered?.id === mode.id ? 'auto-equip-preview' : undefined}
            onClick={() => run(mode.id)}
            onPointerEnter={onPointerEnter(mode)}
            onPointerLeave={() => showPreview(null)}
            onFocus={() => showPreview(mode)}
            onBlur={() => showPreview(null)}
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
