'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Users } from 'lucide-react'
import Icon from './Icon'
import { resolveItemIcon } from '@/lib/item-actions'
import { formatTimeAgo } from '@/components/player/PlayerRow'
import { useGameStore } from '@/lib/game-state'
import type { RoomItemView, SupplyView } from '@/lib/types/room'

/**
 * The "Items here" strip: what the room hands this player for free (the spare
 * hatchet, the guard's arrow crate — per player, from config/room-supplies.js)
 * and what other players have left on the ground (shared piles).
 *
 * One pill per thing, wrapping in the same shape as the room's action buttons,
 * because a take is one click and a pill is what one click looks like here.
 * Colour carries the state — green free to take, blue left by someone else,
 * a grey outline for what you already have — and never carries it alone: the
 * settled ones wear a check, and the shared ones wear the two-figures mark and
 * name their dropper on hover and in the pick-up menu.
 *
 * The counts are re-derived from the live bag rather than trusted from the
 * server's snapshot, which only ever arrives with the room payload and with a
 * take of its own. Drinking one of the five teas has to put the pill back to
 * green immediately: the room's line is "come back if you run low", not "come
 * back through the door", and `takeSupply` has never gated on re-entry.
 *
 * A supply you have already taken is not deleted. The original's promise is
 * "come back here for another one if you lose it", so it stays as a ghost you
 * can still click (the refusal is `noTurn`, and it is the line that makes the
 * promise). It just stops shouting: taken on this visit it sits where it was,
 * and from the next visit on it folds into one "N taken" chip.
 */

interface SupplyShelfProps {
  supplies: SupplyView[]
  items: RoomItemView[]
  /** Resets the taken-on-this-visit ghosts when the player walks somewhere else. */
  roomId?: string
  currentUsername?: string | null
  /** The row currently mid-action, by key ("supply:<id>" / "pickup-<id>" / "examine-<id>"). */
  busyKey: string | null
  onTake: (supply: SupplyView) => void
  onPickup: (item: RoomItemView, quantity: number) => void
  onExamine: (item: RoomItemView) => void
  /** Lets the parent pin an action flyout to the pill that was clicked. */
  registerRow: (key: string, el: HTMLElement | null) => void
}

/** Everything the room's line allows is already in the bag. */
function isSettled(supply: SupplyView): boolean {
  return supply.held >= supply.cap
}

export default function SupplyShelf({
  supplies,
  items,
  roomId,
  currentUsername,
  busyKey,
  onTake,
  onPickup,
  onExamine,
  registerRow,
}: SupplyShelfProps) {
  // Taken since walking in. Seeing the pill you just clicked go grey in place
  // is the confirmation; folding it away immediately would look like a bug.
  const [takenHere, setTakenHere] = useState<ReadonlySet<string>>(() => new Set())
  const [showTaken, setShowTaken] = useState(false)

  useEffect(() => {
    setTakenHere(new Set())
    setShowTaken(false)
  }, [roomId])

  // What the player is holding right now, by slug. The bag updates on every
  // mutation — drinking, dropping, selling, crafting — while `supplies` only
  // refreshes on arrival and on a take, so this is what keeps a pill honest.
  const inventory = useGameStore((state) => state.inventory)
  const heldBySlug = useMemo(() => {
    const held = new Map<string, number>()
    for (const item of inventory) {
      const slug = item.template?.slug
      if (!slug) continue
      held.set(slug, (held.get(slug) ?? 0) + (item.quantity ?? 0))
    }
    return held
  }, [inventory])

  // Mirrors availableFor() in services/room-supply-service.js: up to the room's
  // line, never past the bag. The server re-checks both on the take itself, so
  // a bag the client has wrong costs a polite refusal, never a bad grant.
  const liveSupplies = useMemo(() => {
    // A bag with nothing in it is more likely one that has not hydrated yet
    // than a player carrying nothing, so the server's snapshot stands until it
    // fills. Past that, absent from the bag means none held — which is the
    // whole point: drop your last hatchet and the room offers one again.
    if (inventory.length === 0) return supplies
    return supplies.map((supply) => {
      const held = heldBySlug.get(supply.slug) ?? 0
      if (held === supply.held) return supply
      const bagMax = supply.bagMax ?? Infinity
      return {
        ...supply,
        held,
        available: Math.max(0, Math.min(supply.cap - held, bagMax - held)),
      }
    })
  }, [supplies, heldBySlug, inventory.length])

  // Settled before this visit — the ones that fold behind the chip.
  const foldedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const supply of liveSupplies) {
      if (isSettled(supply) && !takenHere.has(supply.id)) ids.add(supply.id)
    }
    return ids
  }, [liveSupplies, takenHere])

  if (supplies.length === 0 && items.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {liveSupplies.map((supply) =>
        !showTaken && foldedIds.has(supply.id) ? null : (
          <span key={supply.id} ref={(el) => registerRow(supply.id, el)} className="inline-flex">
            <SupplyPill
              supply={supply}
              busy={busyKey === `supply:${supply.id}`}
              onTake={() => {
                // Only a real take earns a ghost. Clicking one that is already
                // settled just replays its line.
                if (!isSettled(supply)) {
                  setTakenHere((prev) => new Set(prev).add(supply.id))
                }
                onTake(supply)
              }}
            />
          </span>
        )
      )}

      {foldedIds.size > 0 && (
        <button
          type="button"
          onClick={() => setShowTaken((open) => !open)}
          aria-expanded={showTaken}
          title={
            showTaken
              ? 'Hide what you already have'
              : 'You already have these. The room still offers them if you lose one.'
          }
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-fg-disabled ring-1 ring-inset ring-line-strong/50 transition-colors hover:text-fg-secondary hover:ring-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-line-focus"
        >
          <Check size={12} className="shrink-0" />
          {foldedIds.size} taken
          <ChevronDown size={11} className={`shrink-0 transition-transform ${showTaken ? 'rotate-180' : ''}`} />
        </button>
      )}

      {items.map((item) => (
        <span key={item.id} ref={(el) => registerRow(item.id, el)} className="inline-flex">
          <DroppedPill
            item={item}
            currentUsername={currentUsername}
            busy={busyKey === `pickup-${item.id}` || busyKey === `examine-${item.id}`}
            onPickup={(qty) => onPickup(item, qty)}
            onExamine={() => onExamine(item)}
          />
        </span>
      ))}
    </div>
  )
}

/** Kept in step with the pick-up menu's `min-w`, which is what has to fit. */
const MENU_WIDTH_PX = 178

/** Shared by both pills so a supply and a dropped pile sit on the same baseline. */
const PILL = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-all duration-200 disabled:cursor-not-allowed'

/** What the room says once you are at its line — the promise that brings you back. */
function settledText(supply: SupplyView): string {
  if (supply.mode === 'topUp') return `You have all ${supply.cap}. Come back if you run low.`
  return supply.cap === 1
    ? 'You have this. Come back for another if you lose it.'
    : `You have all ${supply.cap}. Come back if you lose one.`
}

/** The room's line, in the words it would use if it could talk. */
function ruleText(supply: SupplyView): string {
  if (supply.mode === 'topUp') return `Free — tops you up to ${supply.cap}.`
  return supply.cap === 1
    ? 'Yours to keep — one each. Come back for another if you lose it.'
    : `Yours to keep — ${supply.cap} each.`
}

function SupplyPill({ supply, busy, onTake }: { supply: SupplyView; busy: boolean; onTake: () => void }) {
  const settled = isSettled(supply)
  // Below the room's line but nothing would fit: it is the bag that refuses,
  // not the room, and the two want different words.
  const bagFull = !settled && supply.available <= 0

  // A count only earns its place on a stack. "Hatchet 1/1" says nothing the
  // check mark does not.
  const count = supply.cap > 1 ? `${Math.min(supply.held, supply.cap)}/${supply.cap}` : null
  // Rooms with a verb of their own ("Fish") say it here rather than on the face,
  // which keeps every pill reading as the thing rather than the sentence.
  const verb = supply.takeLabel && supply.takeLabel !== 'Take' ? `${supply.takeLabel}. ` : ''
  const description = supply.description?.trim()

  const title = settled
    ? settledText(supply)
    : bagFull
      ? `Your bag holds ${supply.bagMax}.`
      : [`${verb}${ruleText(supply)}`, description].filter(Boolean).join('\n\n')

  // Outlines are rings, not borders: a border would make these pills a pixel
  // taller than the filled ones they wrap beside.
  const tone = settled
    ? 'ring-1 ring-inset ring-line-strong/50 text-fg-disabled hover:ring-line-strong hover:text-fg-secondary'
    : bagFull
      ? 'ring-1 ring-inset ring-status-warning/50 text-status-warning'
      : 'fill-status-success shadow-sm'

  // The name still leads so voice control can still say "click Training Sword".
  const stateLabel = settled
    ? `${supply.name}, you already have this`
    : bagFull
      ? `${supply.name}, your bag is full`
      : undefined

  return (
    <button
      type="button"
      data-action-button
      onClick={onTake}
      disabled={busy}
      title={title}
      aria-label={stateLabel}
      className={`${PILL} rounded-lg active:scale-[0.97] ${tone} ${busy ? 'cursor-wait opacity-60' : ''}`}
    >
      {settled ? (
        <Check size={13} className="shrink-0" />
      ) : (
        <Icon
          name={resolveItemIcon(supply.metadata as { icon?: string } | null, supply.slug)}
          size={14}
          color="current"
        />
      )}
      <span className="max-w-[13rem] truncate">{supply.name}</span>
      {count && <span className="font-mono tabular-nums opacity-80">{count}</span>}
    </button>
  )
}

/**
 * A pile someone dropped. Blue and marked with the two-figures glyph, because
 * "anyone can take this" is a different promise from the room's own shelf, and
 * a colour on its own is not allowed to be the one carrying it.
 *
 * Click takes one; the caret keeps the choices the old item button had —
 * one, half, all, examine.
 */
function DroppedPill({
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
  const [open, setOpen] = useState(false)
  // Pills wrap, so a dropped pile can sit anywhere across the row. Opening the
  // menu leftward from a pill near the right edge would put it outside the room
  // column, which clips: its `overflow-y: auto` makes overflow-x `auto` too.
  const [alignRight, setAlignRight] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  useEffect(() => {
    const root = rootRef.current
    if (!open || !root) return
    // Whatever actually clips, rather than a guess at which ancestor it is.
    let clip: HTMLElement | null = root.parentElement
    while (clip && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement
    const edge = (clip ?? document.documentElement).getBoundingClientRect().right
    setAlignRight(root.getBoundingClientRect().left + MENU_WIDTH_PX > edge - 8)
  }, [open])

  const by = item.droppedBy
    ? item.droppedBy === currentUsername
      ? 'You left this here'
      : `${item.droppedBy} left this here`
    : 'Left here'
  const at = item.droppedAt ? Date.parse(item.droppedAt) : NaN
  const when = Number.isFinite(at) ? ` · ${formatTimeAgo(at)}` : ''
  const title = `${by}${when} — anyone here can take it.`

  const choose = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  const menuItem =
    'w-full px-3 py-2 text-left text-sm text-fg-bright hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <div className="inline-flex items-stretch transition-transform duration-200 active:scale-[0.97]">
        <button
          type="button"
          data-action-button
          onClick={() => onPickup(1)}
          disabled={busy}
          title={title}
          className={`${PILL} rounded-l-lg fill-status-info shadow-sm ${busy ? 'cursor-wait opacity-60' : ''}`}
        >
          <Users size={11} className="shrink-0 opacity-90" />
          <Icon
            name={resolveItemIcon(item.template.metadata as { icon?: string } | null, item.template.slug)}
            size={14}
            color="current"
          />
          <span className="max-w-[11rem] truncate">{item.template.name}</span>
          {item.quantity > 1 && <span className="font-mono tabular-nums opacity-90">×{item.quantity}</span>}
        </button>
        <button
          type="button"
          data-action-button
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`More options for ${item.template.name}`}
          className="inline-flex items-center rounded-r-lg border-l border-fg-bright/25 fill-status-info px-1.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          className={`absolute ${alignRight ? 'right-0' : 'left-0'} top-full z-50 mt-1 min-w-[178px] overflow-hidden rounded-md border border-line-subtle bg-surface-raised shadow-lg`}
        >
          <div className="border-b border-line-subtle px-3 py-2 text-[11px] text-fg-muted">
            {by}
            {when}
          </div>
          <div className="py-1">
            <button role="menuitem" className={menuItem} onClick={() => choose(() => onPickup(1))}>
              Pick up 1
            </button>
            {item.quantity > 1 && (
              <>
                <button
                  role="menuitem"
                  className={menuItem}
                  onClick={() => choose(() => onPickup(Math.ceil(item.quantity / 2)))}
                >
                  Pick up half
                </button>
                <button role="menuitem" className={menuItem} onClick={() => choose(() => onPickup(item.quantity))}>
                  Pick up all
                </button>
              </>
            )}
            <div className="my-1 border-t border-line-subtle" />
            <button role="menuitem" className={menuItem} onClick={() => choose(onExamine)}>
              Examine
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
