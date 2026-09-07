'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { DANGER_TONE_CLASS, dangerVerdict, formatGold, type DangerTone } from '@/lib/danger-verdict'

/**
 * The compass corners, brought back from the original nav band.
 *
 * The original printed a block of small lines in the top-left of its nav:
 * danger verdict, points with links to spend them, the equipped weapon with a
 * link to the bag, gold. That block is split across two corners here so the
 * ring stays clear: danger and room top-right, everything you own or can spend
 * bottom-left. On phones the strip has no corners to spare, so the same lines
 * sit behind one small button at its top-left and open as a flyout.
 *
 * Every link is navigation only. Nothing here fires a game action; spending
 * points, swapping gear, and learning skills stay where they already live.
 */

export interface LedgerActions {
  onOpenTraining?: () => void
  onOpenStats?: () => void
  onOpenBook?: (tab: 'skills' | 'spells') => void
  onOpenInventory?: (filter?: FilterTab) => void
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
  'text-fg-secondary hover:text-fg-bright border-b border-dotted border-fg-disabled hover:border-fg-secondary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus rounded-sm'

function Link({ onClick, children, title }: { onClick?: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`${LINK} disabled:border-transparent disabled:text-fg-muted`} title={title}>
      {children} ›
    </button>
  )
}

/** The item equipped in one slot, if any. `slot` is the durable answer; the template's slot is the fallback for older rows. */
function equippedIn(inventory: InventoryItem[] | undefined, slot: 'MAIN_HAND'): InventoryItem | undefined {
  return inventory?.find((item) => item.isEquipped && (item.slot ?? item.template.equipSlot) === slot)
}

/** A point count in its colour, muted at zero. */
function Points({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span>
      <span className="text-fg-muted">{label}</span>{' '}
      <span className={`font-semibold tabular-nums ${value > 0 ? tone : 'text-fg-muted'}`}>{value}</span>
    </span>
  )
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

/** Top-right of the D-pad: danger and room. */
export function DangerCorner({ room, player, align = 'right' }: { room: LedgerRoom | null; player: Player | null; align?: 'left' | 'right' }) {
  if (!room) return null
  return (
    <div className={`text-[11px] leading-[15px] ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div>
        <DangerLine room={room} player={player} />
      </div>
      <div className="text-fg-muted">
        room <span className="text-fg-secondary">{room.roomId}</span>
      </div>
    </div>
  )
}

/** Bottom-left of the D-pad: points with where to spend them, the weapon with where to change it, gold. */
export function QuickLinksCorner({ player, inventory, onOpenTraining, onOpenStats, onOpenBook, onOpenInventory }: LedgerProps) {
  if (!player) return null
  const weapon = equippedIn(inventory, 'MAIN_HAND')
  return (
    <div className="text-[11px] leading-[15px] whitespace-nowrap">
      <div>
        <Points label="TP" value={player.tp ?? 0} tone="text-accent" />
        <span className="text-fg-muted"> · </span>
        <Link onClick={onOpenTraining} title="Spend training points">Training</Link>
      </div>
      <div>
        <Points label="CP" value={player.cp ?? 0} tone="text-hue-purple" />
        <span className="text-fg-muted"> · </span>
        <Link onClick={onOpenStats} title="Spend core stat points">Stats</Link>
      </div>
      <div>
        <Points label="SP" value={player.sp ?? 0} tone="text-stat-mag" />
        <span className="text-fg-muted"> · </span>
        <Link onClick={onOpenBook ? () => onOpenBook('skills') : undefined} title="Open the skills book">Skills</Link>{' '}
        <Link onClick={onOpenBook ? () => onOpenBook('spells') : undefined} title="Open the spells book">Spells</Link>
      </div>
      <div>
        <ItemName item={weapon} empty="Bare hands" />
        <span className="text-fg-muted"> · </span>
        <Link onClick={onOpenInventory ? () => onOpenInventory('main') : undefined} title="Weapons in your bag">Weapons</Link>
      </div>
      <div>
        <span className="text-resource-gold font-semibold tabular-nums">{formatGold(player.currency)}</span>
        <span className="text-fg-muted"> gold</span>
      </div>
    </div>
  )
}

/** The button's icon takes the rung's colour so danger reads before the flyout opens. DEADLY's fill is for text, so it maps to plain error red here. */
const BUTTON_TONE_CLASS: Record<DangerTone, string> = {
  ...DANGER_TONE_CLASS,
  deadly: 'text-status-error',
}

/**
 * The phone version: a small button at the strip's top-left that opens the
 * whole ledger as a flyout. Closes on a tap outside, Escape, any link, or a
 * room change, so it never lingers over the next room's D-pad.
 */
export function LedgerFlyout({ room, player, inventory, onOpenTraining, onOpenStats, onOpenBook, onOpenInventory }: LedgerProps) {
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

  const verdict = dangerVerdict(room.dangerLevel, room.isSafe, player.level)
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
        aria-label={`Quick facts — danger ${verdict.level}, ${verdict.label}`}
        title="Quick facts"
        className={`flex h-8 w-8 items-center justify-center rounded-md border border-line-strong/70 bg-surface-panel/85 shadow-sm backdrop-blur-sm transition-colors hover:bg-surface-raised/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${BUTTON_TONE_CLASS[verdict.tone]}`}
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label="Quick facts"
          className="absolute top-9 left-0 min-w-[11rem] rounded-lg border border-line-strong bg-surface-overlay p-3 shadow-xl shadow-black/40 flex flex-col gap-2"
        >
          <DangerCorner room={room} player={player} align="left" />
          <div className="border-t border-line-subtle/40" />
          <QuickLinksCorner
            room={room}
            player={player}
            inventory={inventory}
            onOpenTraining={closeThen(onOpenTraining)}
            onOpenStats={closeThen(onOpenStats)}
            onOpenBook={closeThen(onOpenBook)}
            onOpenInventory={closeThen(onOpenInventory)}
          />
        </div>
      )}
    </div>
  )
}
