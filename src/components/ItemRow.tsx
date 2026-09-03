'use client'

import React, { type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import Icon from './Icon'
import type { InventoryItem } from '@/lib/game-state'
import { resolveItemIcon } from '@/lib/item-actions'
import {
  getCraftingKind,
  getStatMods,
  isTwoHanded,
  renderStatMods,
  STAT_KEYS,
  STAT_LABELS,
  type EquipCompare,
  type StatKey,
} from '@/lib/inventory-categories'
import { WeaponCategory } from '@prisma/client'

/* ------------------------------------------------------------------------- */
/* Small shared pieces                                                        */
/* ------------------------------------------------------------------------- */

const META = 'text-[11px] text-fg-muted'

/** Ghost button used for the drawer's secondary actions (Examine, Drop…, Cancel). */
export function GhostButton({
  children,
  onClick,
  tone = 'neutral',
  disabled = false,
  className = '',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'neutral' | 'danger' | 'success'
  disabled?: boolean
  className?: string
  title?: string
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-status-error/60 text-status-error hover:bg-status-error/10'
      : tone === 'success'
        ? 'border-status-success/50 text-status-success hover:bg-status-success/10'
        : 'border-line-strong/70 text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 min-h-[26px] text-[11px] font-semibold rounded-md border bg-transparent transition-colors duration-150 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${toneClass} ${className}`}
    >
      {children}
    </button>
  )
}

/** ▲2 DEF / ▼3 STR for a gear compare: green up, red down, no fill. Renders nothing when there is no change. */
export function DeltaChips({ deltas }: { deltas: Partial<Record<StatKey, number>> }) {
  const keys = STAT_KEYS.filter((key) => (deltas[key] ?? 0) !== 0)
  if (keys.length === 0) return null
  return (
    <>
      {keys.map((key) => {
        const value = deltas[key] ?? 0
        const up = value > 0
        return (
          <span
            key={key}
            className={`font-mono text-[10.5px] font-semibold tabular-nums whitespace-nowrap ${
              up ? 'text-status-success' : 'text-status-error'
            }`}
          >
            {up ? '▲' : '▼'}{Math.abs(value)} {STAT_LABELS[key]}
          </span>
        )
      })}
    </>
  )
}

/**
 * The row's compare box: what changes against the gear it would replace, in
 * a small container under the stat line. Nothing when the slot is empty (the
 * mods already are the change) or when the item is not gear. The drawer names
 * what is being replaced.
 */
function CompareLine({ compare }: { compare: EquipCompare }) {
  if (compare.replaces.length === 0) return null
  const hasDeltas = STAT_KEYS.some((key) => (compare.deltas[key] ?? 0) !== 0)
  return (
    <span className="self-start inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 px-1.5 py-0.5 rounded border border-line-strong/50 bg-surface-sunken/60 leading-tight">
      {hasDeltas ? <DeltaChips deltas={compare.deltas} /> : <span className="text-[10.5px] text-fg-muted">no change</span>}
    </span>
  )
}

function weaponMeta(item: InventoryItem): string | null {
  if (!item.template.weaponCategory) return null
  const kind = item.template.weaponCategory === WeaponCategory.RANGED ? 'Ranged' : 'Melee'
  return `${kind} · ${isTwoHanded(item) ? '2H' : '1H'}`
}

function consumableMeta(item: InventoryItem): string | null {
  const consumable = (item.template.metadata as any)?.consumable
  if (!consumable || typeof consumable !== 'object') return null
  const verb = String(consumable.verb || 'use')
  const label = verb.charAt(0).toUpperCase() + verb.slice(1)
  if (typeof consumable.stat === 'string') {
    const amount = Number(consumable.amount) || 0
    return `${label} · ${amount >= 0 ? 'restores' : 'drains'} ${consumable.stat.toUpperCase()}`
  }
  return label
}

/** The default second line of a row: mods for gear, effect for consumables, kind for the rest. */
function defaultSubline(item: InventoryItem, hasCompareLine: boolean): ReactNode {
  const mods = renderStatMods(item.template.metadata)
  if (mods) {
    const weapon = weaponMeta(item)
    return (
      <>
        <span className="font-bold text-xs">{mods}</span>
        {weapon && !hasCompareLine && <span className={META}>{weapon}</span>}
      </>
    )
  }
  const consumable = consumableMeta(item)
  if (consumable) return <span className={META}>{consumable}</span>
  const crafting = getCraftingKind(item)
  if (crafting) return <span className={META}>{crafting === 'tool' ? 'Tool' : 'Material'}</span>
  const weapon = weaponMeta(item)
  if (weapon) return <span className={META}>{weapon}</span>
  if (item.template.canDrop === false) return <span className={META}>{'Can\'t be dropped'}</span>
  return null
}

/* ------------------------------------------------------------------------- */
/* Row                                                                        */
/* ------------------------------------------------------------------------- */

export interface ItemRowProps {
  item: InventoryItem
  open: boolean
  onToggle: () => void
  /** Green rail and slot tag. */
  equipped?: boolean
  /** Text of the tag shown after the name when equipped. */
  equippedTag?: string
  /** Red dot on the icon and a faint wash: picked up since the bag was last opened. */
  isNew?: boolean
  /** Override the second line entirely. */
  subline?: ReactNode
  /** Gear compare; when it replaces something, a "vs …" line is added under the mods. */
  compare?: EquipCompare | null
  /** Small tag after the name ("own 2", "Equipped"). */
  nameTag?: ReactNode
  /** Trailing content: the primary button, a price, or both. */
  action?: ReactNode
  /** Inert rows (an equipped item on the sell tab, the off hand a two-hander would free). */
  muted?: boolean
}

/**
 * One line per item: icon, name, quantity, the stat line, and one primary
 * action in a fixed place. Tapping the text opens a drawer under the row (the
 * caller renders it; see ItemDrawer). The bag, the shop's buy tab and its sell
 * tab all use this so the three read as one list.
 */
export default function ItemRow({
  item,
  open,
  onToggle,
  equipped = false,
  equippedTag = 'Equipped',
  isNew = false,
  subline,
  compare = null,
  nameTag,
  action,
  muted = false,
}: ItemRowProps) {
  const icon = resolveItemIcon(item.template.metadata as { icon?: string } | null, item.template.slug || '')
  const hasCompareLine = Boolean(compare && compare.replaces.length > 0)
  const second = subline === undefined ? defaultSubline(item, hasCompareLine) : subline

  const frame = equipped
    ? 'border-status-success/50 border-l-[3px] border-l-status-success'
    : 'border-line-subtle/40'
  const surface = open ? 'bg-surface-raised/35' : isNew ? 'bg-status-error/5' : 'bg-surface-raised/20'

  return (
    <div
      className={`flex items-center gap-1.5 min-h-[48px] pl-2 pr-1.5 py-1 border transition-colors duration-150 ${frame} ${surface} ${
        open ? 'rounded-t-md border-b-transparent' : 'rounded-md hover:bg-surface-raised/35'
      } ${muted ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-left py-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <span className="relative w-[34px] h-[34px] flex items-center justify-center flex-shrink-0 text-fg-primary">
          {isNew && (
            <span className="absolute -left-0.5 -top-0.5 w-2 h-2 rounded-full bg-status-error border border-status-error/50 shadow-lg shadow-status-error/50 z-10" />
          )}
          <Icon name={icon} size={30} color="current" />
        </span>
        <span className="min-w-0 flex flex-col gap-px">
          <span className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-fg-bright truncate">{item.template.name}</span>
            {item.quantity > 1 && (
              <span className="text-[11px] font-bold leading-[16px] px-1.5 rounded-md text-resource-gold bg-resource-gold/15 border border-resource-gold/40 tabular-nums flex-shrink-0">
                ×{item.quantity}
              </span>
            )}
            {equipped && (
              <span className="text-[9px] font-semibold uppercase tracking-[0.08em] leading-[14px] px-1 rounded-sm border border-status-success/50 text-status-success flex-shrink-0">
                {equippedTag}
              </span>
            )}
            {nameTag}
          </span>
          {second && (
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-tight">
              {second}
            </span>
          )}
          {compare && <CompareLine compare={compare} />}
        </span>
      </button>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {action}
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? 'Hide details' : 'Show details'}
          className="w-5 h-8 flex items-center justify-center text-fg-muted hover:text-fg-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  )
}

/** Hairline between the equipped items pinned at the top of a section and the rest. */
export function EquippedDivider() {
  return <div role="separator" className="mx-2 my-1 border-t border-line-subtle/40" />
}

/** Small neutral tag after an item name ("own 2"). */
export function NameTag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' }) {
  return (
    <span
      className={`text-[9px] font-semibold uppercase tracking-[0.08em] leading-[14px] px-1 rounded-sm border flex-shrink-0 ${
        tone === 'success' ? 'border-status-success/50 text-status-success' : 'border-line-strong/60 text-fg-muted'
      }`}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/* Drawer                                                                     */
/* ------------------------------------------------------------------------- */

function CompareBlock({ compare }: { compare: EquipCompare }) {
  const hasDeltas = STAT_KEYS.some((key) => (compare.deltas[key] ?? 0) !== 0)
  const label = compare.replaces.length > 1 ? 'Replaces' : 'Equipped'
  const key = 'text-[10px] uppercase tracking-[0.08em] text-fg-muted whitespace-nowrap'
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1 items-center rounded-md border border-line-strong/50 px-2.5 py-2 text-[11.5px]">
      <span className={key}>{label}</span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {compare.replaces.length === 0 ? (
          <span className="text-fg-muted">Nothing in this slot</span>
        ) : (
          compare.replaces.map((replaced, index) => (
            <React.Fragment key={replaced.id}>
              {index > 0 && <span className="text-fg-muted">and</span>}
              <span className="text-fg-bright font-semibold">{replaced.template.name}</span>
              {Object.keys(getStatMods(replaced)).length > 0 && (
                <span className="font-semibold">{renderStatMods(replaced.template.metadata)}</span>
              )}
            </React.Fragment>
          ))
        )}
      </span>
      <span className={key}>If equipped</span>
      <span className="flex flex-wrap items-center gap-1">
        {hasDeltas ? <DeltaChips deltas={compare.deltas} /> : <span className="text-fg-muted">No stat change</span>}
      </span>
      {compare.blockedBy && (
        <>
          <span className={key}>Blocked</span>
          <span className="text-status-error">Both hands are on the {compare.blockedBy.template.name}.</span>
        </>
      )}
    </div>
  )
}

export interface ItemDrawerProps {
  item: InventoryItem
  /** Continue the row's green rail. */
  equipped?: boolean
  compare?: EquipCompare | null
  /** Show "Worth Ng" from the template value. Off in the shop, which shows its own prices. */
  showWorth?: boolean
  /** Extra entries for the meta line. */
  meta?: ReactNode
  hint?: ReactNode
  /** Action buttons, laid out in a wrapping row. */
  children?: ReactNode
}

/**
 * The detail panel under an open ItemRow: description, weapon facts, worth,
 * the gear compare, and whatever actions the caller supplies.
 */
export function ItemDrawer({
  item,
  equipped = false,
  compare = null,
  showWorth = false,
  meta,
  hint,
  children,
}: ItemDrawerProps) {
  const weapon = weaponMeta(item)
  const attacksWith = item.template.weaponCategory
    ? item.template.weaponCategory === WeaponCategory.RANGED
      ? 'attacks with DEX'
      : 'attacks with STR'
    : null
  const ammo = (item.template.metadata as any)?.ammo
  const worth = item.template.value ?? 0
  const frame = equipped
    ? 'border-status-success/50 border-l-[3px] border-l-status-success'
    : 'border-line-subtle/40'
  const freed = compare?.freesOffHand ? compare.replaces[compare.replaces.length - 1] : null

  return (
    <div className={`-mt-px px-3 pt-2.5 pb-3 sm:pl-[52px] rounded-b-md border border-t-0 bg-surface-sunken/70 flex flex-col gap-2 text-xs ${frame}`}>
      {item.template.description && (
        <p className="text-fg-secondary leading-relaxed">{item.template.description}</p>
      )}
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${META}`}>
        {weapon && <span>{weapon}{attacksWith ? ` · ${attacksWith}` : ''}</span>}
        {typeof ammo === 'string' && <span>Uses {ammo}s</span>}
        {showWorth && worth > 0 && (
          <span>
            Worth <span className="text-resource-gold">{worth}g</span>
          </span>
        )}
        {meta}
      </div>
      {compare && <CompareBlock compare={compare} />}
      {freed && (
        <p className={`${META} italic`}>
          Two-handed: equipping frees your off hand. The {freed.template.name} goes back in the bag.
        </p>
      )}
      {hint && <p className={`${META} italic`}>{hint}</p>}
      {children && <div className="flex flex-wrap items-center gap-1.5">{children}</div>}
    </div>
  )
}
