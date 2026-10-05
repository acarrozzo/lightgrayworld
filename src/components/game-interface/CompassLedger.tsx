'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { DANGER_TONE_CLASS, dangerVerdict, formatGold } from '@/lib/danger-verdict'

/**
 * The compass corners, brought back from the original nav band.
 *
 * The original printed a block of small lines in the top-left of its nav:
 * danger verdict, points with links to spend them, the equipped weapon with a
 * link to the bag, gold. Those links were there because the places were far
 * away. Every one of them is a badged tab now, so the corner keeps only what
 * is worth a glance while walking: what is in your hand, what is in your
 * purse, and a single lit line when there are points waiting to be spent.
 * The room's number and its danger are in the room card's title, not here.
 * On phones the strip has no corners to
 * spare, so the same lines sit behind one small button and open as a flyout.
 *
 * Every link is navigation only. Nothing here fires a game action.
 */

export interface LedgerActions {
  /** Core or Training points to spend: the Char page, where the controls are. */
  onOpenPoints?: () => void
  /** Skill points to spend: whichever book is open to this character. Absent until a teacher is met. */
  onOpenSp?: () => void
  /** Absent until the Inv tab has been earned. */
  onOpenInventory?: (filter?: FilterTab, openItemId?: string) => void
}

interface LedgerRoom {
  roomId?: string
  dangerLevel?: number | null
  isSafe?: boolean | null
}

interface LedgerProps extends LedgerActions {
  room: LedgerRoom | null
  player: Player | null
  inventory?: InventoryItem[]
}

const LINK =
  'text-fg-secondary hover:text-fg-bright hover:underline underline-offset-2 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm disabled:text-fg-muted disabled:no-underline'

/** A quiet text link with a trailing chevron. The chevron is the only decoration. */
function Link({ onClick, children, title }: { onClick?: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={LINK} title={title}>
      {children}
      <span className="text-fg-muted"> ›</span>
    </button>
  )
}

/** The item equipped in one slot, if any. `slot` is the durable answer; the template's slot is the fallback for older rows. */
function equippedIn(inventory: InventoryItem[] | undefined, slot: 'MAIN_HAND'): InventoryItem | undefined {
  return inventory?.find((item) => item.isEquipped && (item.slot ?? item.template.equipSlot) === slot)
}

function ItemName({ item, empty }: { item?: InventoryItem; empty: string }) {
  return (
    <span className={`inline-block max-w-[9.5rem] truncate align-bottom ${item ? 'text-fg-primary' : 'text-fg-muted'}`} title={item?.template.name}>
      {item?.template.name ?? empty}
    </span>
  )
}

/** "danger 9 · HIGH". The word in its rung's colour; the number always beside it. */
export function DangerLine({ room, player }: { room: LedgerRoom | null; player: Player | null }) {
  if (!room) return null
  const verdict = dangerVerdict(room.dangerLevel, room.isSafe, player?.level)
  return (
    <span title={`Danger level ${verdict.level} against your level ${player?.level ?? '?'}`}>
      <span className="text-fg-muted">danger</span>{' '}
      <span className="text-fg-primary tabular-nums">{verdict.level}</span>
      <span className="text-fg-muted"> · </span>
      <span className={`font-semibold ${DANGER_TONE_CLASS[verdict.tone]}`}>{verdict.label}</span>
    </span>
  )
}

/** Top-left of the D-pad: the weapon in hand, gold, and one lit line when there are points to spend. */
export function QuickLinksCorner({ player, inventory, onOpenPoints, onOpenSp, onOpenInventory }: LedgerProps) {
  if (!player) return null
  const weapon = equippedIn(inventory, 'MAIN_HAND')
  const toSpend = (player.cp ?? 0) + (player.tp ?? 0)
  const sp = player.sp ?? 0
  return (
    <div className="flex flex-col gap-0.5 text-[11px] leading-4 whitespace-nowrap">
      {/* The weapon is its own link: the name is the thing you would tap. */}
      {onOpenInventory ? (
        <button
          type="button"
          onClick={() => onOpenInventory('main')}
          title="Your weapons, in the Inv tab"
          className="text-left rounded-sm hover:underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus"
        >
          <ItemName item={weapon} empty="Bare hands" />
          <span className="text-fg-muted"> ›</span>
        </button>
      ) : (
        <ItemName item={weapon} empty="Bare hands" />
      )}
      <div>
        <span className="text-resource-gold font-semibold tabular-nums">{formatGold(player.currency)}</span>
        <span className="text-fg-muted"> gold</span>
      </div>
      {/* Unspent points are the one thing here that should not wait. */}
      {toSpend > 0 && (
        <button
          type="button"
          onClick={onOpenPoints}
          disabled={!onOpenPoints}
          title="Spend your Core and Training points on the Char page"
          className="relative mt-0.5 inline-flex w-fit items-center gap-1 rounded-full fill-accent px-2 py-px font-bold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping-slow" aria-hidden="true" />
          <span className="relative">
            {toSpend} {toSpend === 1 ? 'point' : 'points'} to spend ›
          </span>
        </button>
      )}
      {sp > 0 && onOpenSp && (
        <Link onClick={onOpenSp} title="Spend skill points in your book">
          <span className="text-stat-mag font-semibold tabular-nums">{sp} SP</span>
        </Link>
      )}
    </div>
  )
}

/**
 * The phone version: a small button at the strip's top-left that opens the
 * whole ledger as a flyout. Closes on a tap outside, Escape, any link, or a
 * room change, so it never lingers over the next room's D-pad.
 */
export function LedgerFlyout({ room, player, inventory, onOpenPoints, onOpenSp, onOpenInventory }: LedgerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const roomId = room?.roomId

  useEffect(() => {
    setIsOpen(false)
  }, [roomId])

  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  if (!room || !player) return null

  // Every link closes the flyout before it navigates.
  const closeThen = <T extends unknown[]>(fn?: (...args: T) => void) =>
    fn
      ? (...args: T) => {
          setIsOpen(false)
          fn(...args)
        }
      : undefined

  return (
    <div ref={rootRef} className="absolute top-2 left-2 z-20">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label="Quick facts: your weapon, gold and points"
        title="Quick facts"
        className={`flex h-8 w-8 items-center justify-center rounded-md border border-line-strong/70 bg-surface-panel/85 shadow-sm backdrop-blur-sm transition-colors hover:bg-surface-raised/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus text-fg-secondary`}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Quick facts"
          className="absolute top-9 left-0 min-w-[11rem] rounded-lg border border-line-strong bg-surface-overlay p-3 shadow-xl shadow-black/40 flex flex-col gap-2"
        >
          <QuickLinksCorner
            room={room}
            player={player}
            inventory={inventory}
            onOpenPoints={closeThen(onOpenPoints)}
            onOpenSp={closeThen(onOpenSp)}
            onOpenInventory={closeThen(onOpenInventory)}
          />
        </div>
      )}
    </div>
  )
}
