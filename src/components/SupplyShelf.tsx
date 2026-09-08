'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Icon from './Icon'
import { resolveItemIcon } from '@/lib/item-actions'
import { formatTimeAgo } from '@/components/player/PlayerRow'
import type { RoomItemView, SupplyView } from '@/lib/types/room'

/**
 * The "Items here" strip: what the room hands this player for free (the spare
 * hatchet, the guard's arrow crate — per player, from config/room-supplies.js)
 * and what other players have left on the ground (shared piles).
 *
 * Supplies are rows that say what a take will do — "Take 38", "Full",
 * "Have it" — so the room's line ("one each", "up to 50") never surprises
 * anyone. Dropped piles wear a blue rail and name who left them, so a shared
 * pile is never mistaken for a room supply.
 */

interface SupplyShelfProps {
  supplies: SupplyView[]
  items: RoomItemView[]
  currentUsername?: string | null
  /** The row currently mid-action, by key ("supply:<id>" / "pickup-<id>" / "examine-<id>"). */
  busyKey: string | null
  onTake: (supply: SupplyView) => void
  onPickup: (item: RoomItemView, quantity: number) => void
  onExamine: (item: RoomItemView) => void
  /** Lets the parent pin an action flyout to the row that was clicked. */
  registerRow: (key: string, el: HTMLElement | null) => void
}

export default function SupplyShelf({
  supplies,
  items,
  currentUsername,
  busyKey,
  onTake,
  onPickup,
  onExamine,
  registerRow,
}: SupplyShelfProps) {
  if (supplies.length === 0 && items.length === 0) return null

  return (
    <div className="mt-4">
      <div className="text-sm text-fg-primary mb-2">
        Items here
        {supplies.length > 0 && <span className="ml-2 text-xs text-fg-muted">free to take</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        {supplies.map((supply) => (
          <div key={supply.id} ref={(el) => registerRow(supply.id, el)}>
            <SupplyRow supply={supply} busy={busyKey === `supply:${supply.id}`} onTake={() => onTake(supply)} />
          </div>
        ))}
        {items.map((item) => (
          <div key={item.id} ref={(el) => registerRow(item.id, el)}>
            <DroppedRow
              item={item}
              currentUsername={currentUsername}
              busy={busyKey === `pickup-${item.id}` || busyKey === `examine-${item.id}`}
              onPickup={(qty) => onPickup(item, qty)}
              onExamine={() => onExamine(item)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const ROW_CLASS =
  'grid grid-cols-[18px_minmax(0,1fr)_auto_auto] items-center gap-2.5 rounded-lg bg-surface-sunken px-2.5 py-1.5'

function ruleLabel(supply: SupplyView): string {
  return supply.mode === 'take' ? (supply.cap === 1 ? 'one each' : `${supply.cap} each`) : `up to ${supply.cap} each`
}

function SupplyRow({ supply, busy, onTake }: { supply: SupplyView; busy: boolean; onTake: () => void }) {
  // Tapping the name opens the item's description under it — the examine the
  // old item button offered, without a round trip: the shelf already knows.
  const [examined, setExamined] = useState(false)
  const description = supply.description?.trim() || null

  const atLine = supply.held >= supply.cap
  // The bag, not the room, is what stops the take: below the line but nothing
  // would fit. After the cap pass this only happens for training gear.
  const bagFull = !atLine && supply.available <= 0
  const disabled = busy || atLine || bagFull

  const count = bagFull
    ? `bag holds ${supply.bagMax}`
    : supply.mode === 'take'
      ? supply.held === 0
        ? 'none yet'
        : `you ${Math.min(supply.held, supply.cap)} / ${supply.cap}`
      : `you ${supply.held} / ${supply.cap}`

  const label = bagFull
    ? 'Bag full'
    : atLine
      ? supply.mode === 'take'
        ? 'Have it'
        : 'Full'
      : supply.mode === 'take' && supply.cap === 1
        ? supply.takeLabel
        : supply.takeLabel === 'Take'
          ? `Take ${supply.available}`
          // A verb of its own ("Fish") reads wrong with a number after it.
          : supply.takeLabel

  return (
    <div className={ROW_CLASS}>
      <Icon name={resolveItemIcon(supply.metadata as { icon?: string } | null, supply.slug)} size={18} color="current" />
      <div className="min-w-0">
        {description ? (
          <button
            type="button"
            onClick={() => setExamined((v) => !v)}
            aria-expanded={examined}
            title={examined ? 'Hide description' : 'Examine'}
            className="block max-w-full truncate text-left text-sm text-fg-bright underline decoration-dotted decoration-line-strong underline-offset-2 hover:decoration-fg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-line-focus rounded-sm"
          >
            {supply.name}
          </button>
        ) : (
          <div className="truncate text-sm text-fg-bright">{supply.name}</div>
        )}
        <div className="text-[11px] text-fg-muted">{ruleLabel(supply)}</div>
        {examined && description && (
          <div className="mt-1 whitespace-normal text-xs italic text-fg-secondary">{description}</div>
        )}
      </div>
      <span className={`text-[11px] tabular-nums font-mono whitespace-nowrap ${atLine || bagFull ? 'text-status-success' : 'text-fg-secondary'}`}>
        {count}
      </span>
      <button
        data-action-button
        onClick={onTake}
        disabled={disabled}
        className={`rounded-md px-2.5 py-1 text-xs fill-status-success transition-all active:scale-[0.97] disabled:cursor-not-allowed ${
          atLine || bagFull ? 'opacity-50' : ''
        } ${busy ? 'cursor-wait opacity-60' : ''}`}
      >
        {label}
      </button>
    </div>
  )
}

function DroppedRow({
  item,
  currentUsername,
  busy,
  onPickup,
  onExamine,
}: {
  item: RoomItemView
  currentUsername?: string | null
  busy: boolean
  onPickup: (quantity: number) => void
  onExamine: () => void
}) {
  const by = item.droppedBy
    ? item.droppedBy === currentUsername
      ? 'left by you'
      : `left by ${item.droppedBy}`
    : 'left here'
  const at = item.droppedAt ? Date.parse(item.droppedAt) : NaN
  const when = Number.isFinite(at) ? ` · ${formatTimeAgo(at)}` : ''

  return (
    <div className={`${ROW_CLASS} border-l-[3px] border-status-info`}>
      <Icon name={resolveItemIcon(item.template.metadata as { icon?: string } | null, item.template.slug)} size={18} color="current" />
      <div className="min-w-0">
        <div className="truncate text-sm text-fg-bright">
          {item.template.name}
          {item.quantity > 1 && <span className="ml-1 text-status-success">×{item.quantity}</span>}
        </div>
        <div className="text-[11px] text-fg-muted">
          {by}
          {when}
        </div>
      </div>
      <span className="text-[11px] font-mono text-fg-secondary">shared</span>
      <PickupMenu quantity={item.quantity} disabled={busy} onPickup={onPickup} onExamine={onExamine} />
    </div>
  )
}

/**
 * "Pick up ▾": one, half, all, examine. The same choices the old item button
 * offered, without repeating the item's name on the button.
 */
function PickupMenu({
  quantity,
  disabled,
  onPickup,
  onExamine,
}: {
  quantity: number
  disabled: boolean
  onPickup: (quantity: number) => void
  onExamine: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const choose = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const itemClass =
    'w-full px-3 py-2 text-left text-sm text-fg-bright hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="relative" ref={rootRef}>
      <button
        data-action-button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-md bg-surface-raised px-2.5 py-1 text-xs text-fg-bright transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        Pick up
        <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[150px] overflow-hidden rounded-md border border-line-subtle bg-surface-raised shadow-lg"
        >
          <div className="py-1">
            <button role="menuitem" className={itemClass} onClick={() => choose(() => onPickup(1))}>
              Pick up 1
            </button>
            {quantity > 1 && (
              <>
                <button role="menuitem" className={itemClass} onClick={() => choose(() => onPickup(Math.ceil(quantity / 2)))}>
                  Pick up half
                </button>
                <button role="menuitem" className={itemClass} onClick={() => choose(() => onPickup(quantity))}>
                  Pick up all
                </button>
              </>
            )}
            <div className="my-1 border-t border-line-subtle" />
            <button role="menuitem" className={itemClass} onClick={() => choose(onExamine)}>
              Examine
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
