'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EquipSlot } from '@prisma/client'
import Icon from '@/components/Icon'
import type { InventoryItem } from '@/lib/game-state'
import { resolveItemIcon } from '@/lib/item-actions'
import { renderRegen, type FilterTab } from '@/lib/inventory-categories'

/**
 * The eleven equipped slots as a two-column grid — the original's Equipped
 * list on the Char tab. Drawn by the character panel and by the Gear layer
 * beside the D-pad, so it lives here once. Tapping a slot opens the bag
 * filtered to it; nothing here equips or unequips on its own.
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
  onSwitchToInventory?: (filter: FilterTab) => void
  className?: string
}

export default function EquipmentGrid({ inventory, onSwitchToInventory, className = '' }: EquipmentGridProps) {
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
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {GRID_SLOTS.map((slot) => (
        <EquipmentSlot
          key={slot}
          slot={slot}
          flash={flashSlots.has(slot)}
          item={equippedBySlot.get(slot)}
          ghostItem={slot === EquipSlot.OFF_HAND ? twoHanded : undefined}
          onSwitchToInventory={onSwitchToInventory ? () => onSwitchToInventory(filterForSlot(slot)) : undefined}
        />
      ))}
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
  onSwitchToInventory?: () => void
}

const FLASH = 'ring-2 ring-accent/70'

function EquipmentSlot({ slot, item, ghostItem, flash = false, onSwitchToInventory }: EquipmentSlotProps) {
  const slotName = slot.replace(/_/g, ' ')
  const flashClass = flash ? FLASH : ''

  if (item) {
    const mods = renderStatMods(item.template.metadata)
    const icon = resolveItemIcon(item.template.metadata as { icon?: string } | null, item.template.slug ?? '')

    return (
      <button
        type="button"
        onClick={() => onSwitchToInventory?.()}
        className={`rounded-lg border border-line-subtle/80 bg-surface-panel/80 px-3 py-2 text-left hover:bg-surface-raised/80 transition-all duration-500 flex items-center gap-2 ${flashClass}`}
      >
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover/40 border border-line-strong/30">
          <Icon name={icon} size={22} className="text-fg-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}</p>
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
      onClick={() => onSwitchToInventory?.()}
      className={`rounded-lg border border-line-subtle/70 bg-surface-panel/60 px-3 py-2 text-left hover:bg-surface-raised/60 hover:border-line-subtle transition-all duration-500 cursor-pointer ${flashClass}`}
    >
      <p className="text-xs uppercase tracking-wide text-fg-secondary">{slotName}</p>
      <p className="text-sm text-fg-muted mt-0.5">- - -</p>
    </button>
  )
}
