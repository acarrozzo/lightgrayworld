'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EquipSlot } from '@prisma/client'
import Icon from '@/components/Icon'
import NotificationBadge from '@/components/NotificationBadge'
import type { InventoryItem } from '@/lib/game-state'
import { resolveItemIcon } from '@/lib/item-actions'
import { SLOT_CHIP_LABELS, renderRegen, type FilterTab, type SlotCategory } from '@/lib/inventory-categories'

/**
 * The eleven equipped slots — the original's Equipped list on the Char tab —
 * as a two-column grid with each item's name and stats, or as a strip of icon
 * squares where the bag below needs the height. Drawn by the Inv tab, where a
 * slot is the bag's filter: tapping one shows what fits it, and the selected
 * one is ringed. Nothing here equips or unequips on its own.
 */

const STAT_MOD_COLORS: Record<string, string> = {
  str: 'text-stat-str',
  dex: 'text-stat-dex',
  mag: 'text-stat-mag',
  def: 'text-stat-def',
}

/** "+50 STR, +5 MAG" in stat colours; a regen ring's "+3 HP / click" when that is all it has. */
export function renderStatMods(metadata: any): React.ReactNode {
  if (!metadata || typeof metadata !== 'object') return null
  const statMods = metadata.statMods ?? {}

  const statOrder = ['str', 'dex', 'mag', 'def'] as const
  const statLabels: Record<string, string> = { str: 'STR', dex: 'DEX', mag: 'MAG', def: 'DEF' }

  const parts: React.ReactNode[] = []
  for (const stat of statOrder) {
    const value = statMods[stat]
    if (typeof value === 'number' && value !== 0) {
      const sign = value > 0 ? '+' : ''
      const color = value > 0 ? STAT_MOD_COLORS[stat] : 'text-fg-disabled'
      if (parts.length > 0) parts.push(<span key={`${stat}-sep`} className="text-fg-muted">, </span>)
      parts.push(<span key={stat} className={color}>{sign}{value} {statLabels[stat]}</span>)
    }
  }
  // A regen ring has no stat line; its "+3 HP / click" is the whole point.
  for (const part of renderRegen(metadata)) {
    if (parts.length > 0) parts.push(<span key={`${(part as any).key}-sep`} className="text-fg-muted">, </span>)
    parts.push(part)
  }
  return parts.length > 0 ? <>{parts}</> : null
}

/** The bag filter that shows what fits one slot. */
export function filterForSlot(slot: EquipSlot): FilterTab {
  switch (slot) {
    case EquipSlot.MAIN_HAND: return 'main'
    case EquipSlot.OFF_HAND: return 'off'
    case EquipSlot.HEAD: return 'head'
    case EquipSlot.BODY: return 'body'
    case EquipSlot.HANDS: return 'hands'
    case EquipSlot.FEET: return 'feet'
    case EquipSlot.RING: return 'ring'
    case EquipSlot.NECK: return 'neck'
    case EquipSlot.MOUNT: return 'mount'
    case EquipSlot.ARTIFACT: return 'artifact'
    case EquipSlot.COMPANION: return 'companion'
    default: return 'all'
  }
}

/** The grid's order: hands first, then armour, then jewellery and companions. */
const GRID_SLOTS: EquipSlot[] = [
  EquipSlot.MAIN_HAND,
  EquipSlot.OFF_HAND,
  EquipSlot.HEAD,
  EquipSlot.BODY,
  EquipSlot.HANDS,
  EquipSlot.FEET,
  EquipSlot.RING,
  EquipSlot.NECK,
  EquipSlot.MOUNT,
  EquipSlot.ARTIFACT,
  EquipSlot.COMPANION,
]

interface EquipmentGridProps {
  inventory: InventoryItem[]
  /** `grid` names each item; `strip` is one icon square per slot. */
  density?: 'grid' | 'strip'
  /** The slot the bag is filtered to, if any. */
  selected?: FilterTab | null
  /** How many items you carry for each slot, shown on the slot: what tapping it will list. */
  counts?: Partial<Record<string, number>>
  /** New items per slot, as a dot. */
  newCounts?: Partial<Record<string, number>>
  onSelectSlot?: (filter: FilterTab) => void
  className?: string
}

export default function EquipmentGrid({ inventory, density = 'grid', selected = null, counts, newCounts, onSelectSlot, className = '' }: EquipmentGridProps) {
  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipSlot, InventoryItem>()
    inventory
      .filter((item) => item.isEquipped === true)
      .forEach((item) => {
        if (item.slot) map.set(item.slot as EquipSlot, item)
      })
    return map
  }, [inventory])

  // Slots whose item just changed — a manual equip, an auto-equip loadout —
  // flash for a moment so the eye finds what moved.
  const prevSlotItemsRef = useRef<Map<string, string | null> | null>(null)
  const [flashSlots, setFlashSlots] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    const now = new Map<string, string | null>()
    for (const slot of Object.values(EquipSlot)) now.set(slot, equippedBySlot.get(slot)?.id ?? null)
    const prev = prevSlotItemsRef.current
    prevSlotItemsRef.current = now
    if (!prev) return
    const changed = new Set<string>()
    for (const [slot, id] of now) if (prev.get(slot) !== id) changed.add(slot)
    if (changed.size === 0) return
    setFlashSlots(changed)
    const timer = setTimeout(() => setFlashSlots(new Set()), 1500)
    return () => clearTimeout(timer)
  }, [equippedBySlot])

  const mainHand = equippedBySlot.get(EquipSlot.MAIN_HAND)
  const twoHanded = mainHand && (mainHand.template.metadata as any)?.isTwoHanded ? mainHand : undefined

  return (
    <div className={`grid ${density === 'strip' ? 'grid-cols-6 gap-1' : 'grid-cols-2 gap-2'} ${className}`}>
      {GRID_SLOTS.map((slot) => {
        const Slot = density === 'strip' ? StripSlot : EquipmentSlot
        return (
          <Slot
            key={slot}
            slot={slot}
            flash={flashSlots.has(slot)}
            selected={selected === filterForSlot(slot)}
            count={counts?.[filterForSlot(slot)]}
            hasNew={(newCounts?.[filterForSlot(slot)] ?? 0) > 0}
            item={equippedBySlot.get(slot)}
            ghostItem={slot === EquipSlot.OFF_HAND ? twoHanded : undefined}
            onSelect={onSelectSlot ? () => onSelectSlot(filterForSlot(slot)) : undefined}
          />
        )
      })}
    </div>
  )
}

interface EquipmentSlotProps {
  slot: EquipSlot
  item?: InventoryItem
  /** A two-handed weapon shows through the off hand, greyed. */
  ghostItem?: InventoryItem
  /** The item here just changed: a short ring so the change is seen. */
  flash?: boolean
  /** The bag is filtered to this slot. */
  selected?: boolean
  count?: number
  hasNew?: boolean
  onSelect?: () => void
}

const FLASH = 'ring-2 ring-accent/70'
const SELECTED = 'ring-2 ring-line-focus'

/** One slot as an icon square: what is worn, or a dashed blank. The name is in the tooltip and at the top of the list it filters. */
function StripSlot({ slot, item, ghostItem, flash = false, selected = false, count, hasNew = false, onSelect }: EquipmentSlotProps) {
  const label = SLOT_CHIP_LABELS[filterForSlot(slot) as SlotCategory] ?? slot.replace(/_/g, ' ')
  const shown = item ?? ghostItem
  const icon = shown ? resolveItemIcon(shown.template.metadata as { icon?: string } | null, shown.template.slug ?? '') : null
  const worn = item ? `${label}: ${item.template.name}` : ghostItem ? `${label}: taken by ${ghostItem.template.name}` : `${label}: empty`
  const title = count !== undefined ? `${worn} · ${count} in your bag` : worn
  return (
    <button
      type="button"
      onClick={() => onSelect?.()}
      aria-pressed={selected}
      aria-label={title}
      title={title}
      className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 transition-all duration-500 hover:bg-surface-raised/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        item ? 'border-line-subtle/80 bg-surface-panel/80' : 'border-dashed border-line-subtle/70 bg-surface-panel/40'
      } ${selected ? SELECTED : flash ? FLASH : ''}`}
    >
      <NotificationBadge value={hasNew} className="absolute -left-1 -top-1 z-10" />
      {count !== undefined && count > 0 && (
        <span className="absolute right-1 top-0.5 text-[8px] font-medium tabular-nums leading-none text-fg-muted" aria-hidden="true">{count}</span>
      )}
      {icon ? (
        <Icon name={icon} size={18} className={`text-fg-primary ${item ? '' : 'opacity-35'}`} />
      ) : (
        <span className="h-[18px] text-[10px] leading-[18px] text-fg-muted" aria-hidden="true">–</span>
      )}
      <span className="w-full truncate text-center text-[8px] uppercase tracking-wide text-fg-secondary">{label}</span>
    </button>
  )
}

function EquipmentSlot({ slot, item, ghostItem, flash = false, selected = false, count, hasNew = false, onSelect }: EquipmentSlotProps) {
  const slotName = slot.replace(/_/g, ' ')
  const tally = count !== undefined && count > 0 && <span className="ml-1 font-normal normal-case tracking-normal text-fg-muted tabular-nums">· {count}</span>
  const newDot = <NotificationBadge value={hasNew} className="absolute -left-1 -top-1 z-10" />
  const flashClass = selected ? SELECTED : flash ? FLASH : ''

  if (item) {
    const mods = renderStatMods(item.template.metadata)
    const icon = resolveItemIcon(item.template.metadata as { icon?: string } | null, item.template.slug ?? '')

    return (
      <button
        type="button"
        onClick={() => onSelect?.()}
        aria-pressed={selected}
        className={`relative rounded-lg border border-line-subtle/80 bg-surface-panel/80 px-3 py-2 text-left hover:bg-surface-raised/80 transition-all duration-500 flex items-center gap-2 ${flashClass}`}
      >
        {newDot}
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover/40 border border-line-strong/30">
          <Icon name={icon} size={22} className="text-fg-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}{tally}</p>
          <p className="text-sm font-medium text-fg-bright truncate">{item.template.name}</p>
          {mods && <p className="text-xs">{mods}</p>}
        </div>
      </button>
    )
  }

  if (ghostItem) {
    const ghostMods = renderStatMods(ghostItem.template.metadata)
    const ghostIcon = resolveItemIcon(ghostItem.template.metadata as { icon?: string } | null, ghostItem.template.slug ?? '')

    return (
      <div className={`rounded-lg border border-line-subtle/80 bg-surface-panel/80 px-3 py-2 cursor-default select-none transition-all duration-500 ${flashClass}`}>
        <div className="flex items-center gap-2 opacity-35">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover/40 border border-line-strong/30">
            <Icon name={ghostIcon} size={22} className="text-fg-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}</p>
            <p className="text-sm font-medium text-fg-bright truncate">{ghostItem.template.name}</p>
            {ghostMods && <p className="text-xs">{ghostMods}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.()}
        aria-pressed={selected}
      className={`relative rounded-lg border border-line-subtle/70 bg-surface-panel/60 px-3 py-2 text-left hover:bg-surface-raised/60 hover:border-line-subtle transition-all duration-500 cursor-pointer ${flashClass}`}
    >
      {newDot}
      <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}{tally}</p>
      <p className="text-sm text-fg-muted mt-0.5">- - -</p>
    </button>
  )
}
