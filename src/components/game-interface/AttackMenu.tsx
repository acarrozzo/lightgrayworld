'use client'

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import Icon from '@/components/Icon'
import { RefusalLink } from '@/components/EntryRow'
import type { InventoryItem } from '@/lib/game-state'
import { rangeText, type AttackMenuRow } from '@/lib/action-deck'
import { refusalLink } from '@/lib/effect-sources'
import { followFeedLink } from '@/lib/feed-links'
import { skillTone } from '@/lib/skillbook'
import { spellTone } from '@/lib/spellbook'
import { LevelTag } from './AbilityRows'

interface AttackMenuProps {
  /** buildAttackMenu's rows: the swing first, then the strikes, then the attack spells. */
  rows: AttackMenuRow[]
  /** The swing rolls DEX, not STR, and wears its colour. */
  isRanged: boolean
  inBattle: boolean
  mp: number
  mpMax: number
  /** For where a refusal leads (lib/effect-sources `refusalLink`). */
  inventory: InventoryItem[]
  ammoLabel?: string | null
  /** Held while an action resolves. */
  disabled?: boolean
  onFire: (row: AttackMenuRow) => void
  onClose: () => void
  className?: string
}

/**
 * The menu under Attack's chevron in Explore: everything that hits, one tap
 * each. Its rows are the Actions tab's in short — the name, the level, what it
 * rolls before the enemy blocks, the MP — and a refused one stays in its place,
 * dimmed, with the deck's own reason. Opening it costs nothing; a row sends
 * exactly what the Actions tab sends, so the server's rules are unchanged.
 * Out of a fight a strike or attack spell opens one, or hunts in a room that
 * rolls, the same as Attack.
 */
export default function AttackMenu({
  rows,
  isRanged,
  inBattle,
  mp,
  mpMax,
  inventory,
  ammoLabel,
  disabled = false,
  onFire,
  onClose,
  className = '',
}: AttackMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // The first live row takes focus, so the keyboard can start at once. A
  // mouse that opened the menu never sees the ring.
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true })
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])
    if (items.length === 0) return
    event.preventDefault()
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (at + 1) % items.length
      : (at - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const fixFor = (reason: string | null) => {
    const link = refusalLink(reason, { inBattle, inventory, ammoLabel })
    return link
      ? () => {
          onClose()
          followFeedLink(link)
        }
      : undefined
  }

  const strikes = rows.filter((row) => row.kind === 'strike')
  const spells = rows.filter((row) => row.kind === 'spell')
  const swing = rows.find((row) => row.kind === 'attack')

  const renderRow = (row: AttackMenuRow) => {
    const toneText =
      row.kind === 'attack' ? (isRanged ? 'text-stat-dex' : 'text-stat-str')
      : row.kind === 'strike' ? skillTone(row.hue ?? 'gray').text
      : spellTone(row.hue ?? 'gray').text
    const detail =
      row.kind === 'attack'
        ? `${row.weapon}${row.range ? ` · hits ${rangeText(row.range.lo, row.range.hi)}` : ''}`
        : row.range ? `hits ${rangeText(row.range.lo, row.range.hi)}${row.leaves ? ` + ${row.leaves}` : ''}` : ''
    const body = (
      <>
        <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-surface-sunken ${toneText}`}>
          <Icon name={row.icon} size={16} color="current" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12.5px] font-semibold text-fg-primary">{row.name}</span>
          {/* The level sits under the name, so a long name keeps the width a refusal leaves it. */}
          <span className="flex min-w-0 items-center gap-1.5">
            {row.level !== null && row.maxLevel !== null && <LevelTag level={row.level} maxLevel={row.maxLevel} />}
            {detail && <span className="truncate text-[10px] tabular-nums text-fg-muted">{detail}</span>}
          </span>
        </span>
      </>
    )
    const cost = row.cost !== null ? <span className="text-[11px] font-bold tabular-nums text-resource-mp whitespace-nowrap">{row.cost} MP</span> : null

    if (row.reason) {
      const fix = fixFor(row.reason)
      return (
        <div key={`${row.kind}:${row.id}`} role="menuitem" aria-disabled="true" className="flex min-h-10 items-center gap-2 rounded-md px-2 py-1">
          <span className="flex min-w-0 flex-1 items-center gap-2 opacity-50">{body}</span>
          {fix ? (
            <RefusalLink reason={row.reason} onClick={fix} />
          ) : (
            <span className="text-[10px] text-fg-muted whitespace-nowrap">{row.reason}</span>
          )}
        </div>
      )
    }
    return (
      <button
        key={`${row.kind}:${row.id}`}
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={() => onFire(row)}
        title={row.kind === 'attack' ? `Attack with ${row.weapon}` : `${row.kind === 'spell' ? 'Cast' : 'Use'} ${row.name}${row.cost !== null ? ` for ${row.cost} MP` : ''}`}
        className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-raised focus:outline-none focus-visible:bg-surface-raised focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-wait disabled:opacity-60"
      >
        {body}
        {cost}
      </button>
    )
  }

  const heading = (label: string) => (
    <span className="px-2 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-fg-muted" role="presentation">
      {label}
    </span>
  )

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Attack options"
      onKeyDown={onKeyDown}
      className={`absolute bottom-full z-30 mb-1.5 flex max-h-[min(70vh,28rem)] w-[min(17rem,calc(100vw-1.5rem))] flex-col overflow-y-auto overscroll-contain rounded-xl border border-line-strong bg-surface-overlay p-1.5 text-left shadow-xl shadow-black/40 ${className}`}
    >
      {swing && renderRow(swing)}
      {strikes.length > 0 && heading('Strikes')}
      {strikes.map(renderRow)}
      {spells.length > 0 && heading('Spells')}
      {spells.map(renderRow)}
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-line-subtle px-2 pt-1.5 text-[11px]">
        <span className="tabular-nums text-fg-muted">
          {/* Over the cap reads as the header does: full, plus the gold extra. */}
          {Math.min(mp, mpMax)} / {mpMax} MP
          {mp > mpMax && <span className="ml-1 font-semibold text-resource-gold">+{mp - mpMax}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            onClose()
            followFeedLink({ tab: 'actions', sub: 'attack' })
          }}
          className="inline-flex items-center gap-0.5 rounded font-semibold text-fg-secondary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          All actions
          <ChevronRight size={12} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
