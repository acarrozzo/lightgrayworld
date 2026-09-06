'use client'

import type { ReactNode } from 'react'
import NotificationBadge from './NotificationBadge'
import StatSortControl from './StatSortControl'
import {
  FILTER_GROUPS,
  SLOT_CATEGORIES,
  SLOT_CHIP_LABELS,
  countForGroup,
  type ItemCategory,
  type ItemFilterView,
  type SortStat,
} from '@/lib/inventory-categories'

interface ItemFilterBarProps {
  /** Item count per category. */
  counts: Partial<Record<ItemCategory, number>>
  /** New-item count per category, surfaced as badges on group and slot chips. */
  newCounts?: Partial<Record<ItemCategory, number>>
  view: ItemFilterView
  onChange: (view: ItemFilterView) => void
  /** Shop mode: leave out groups and slots with nothing in them. */
  hideEmpty?: boolean
  sort?: SortStat
  onSortChange?: (sort: SortStat) => void
  /** Gear-compare switch, shown inside the sort flyout when supplied. */
  compareEnabled?: boolean
  onCompareChange?: (enabled: boolean) => void
  /** Rendered as a further row under the slot chips (e.g. melee/ranged). */
  children?: ReactNode
}

export const CHIP =
  'relative px-2.5 py-1 text-[11px] font-medium rounded border transition-all duration-200 whitespace-nowrap flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed'
export const CHIP_IDLE = 'fill-surface-raised border-line-subtle/50 hover:border-line-strong/50'
export const CHIP_GROUP_ON = 'fill-resource-mp border-resource-mp/50'
export const CHIP_SLOT_ON = 'fill-stat-mag border-stat-mag/50'

/**
 * Two-tier filter strip: Equipment / Consumables / Crafting / Misc on one row,
 * and under Equipment the nine slots on a second row. Tapping the active slot
 * again, or the Equipment chip, goes back to every slot. Shared by the bag and
 * the shop.
 */
export default function ItemFilterBar({
  counts,
  newCounts,
  view,
  onChange,
  hideEmpty = false,
  sort,
  onSortChange,
  compareEnabled,
  onCompareChange,
  children,
}: ItemFilterBarProps) {
  const groupNew = (group: ItemFilterView['group']): number => {
    if (group === 'gear') return SLOT_CATEGORIES.reduce((total, slot) => total + (newCounts?.[slot] ?? 0), 0)
    return newCounts?.[group] ?? 0
  }

  const groups = FILTER_GROUPS.filter((group) => !hideEmpty || countForGroup(counts, group.id) > 0)
  // With a single populated group the row would only restate the list; skip it.
  const showGroups = groups.length > 1
  const slots = SLOT_CATEGORIES.filter((slot) => !hideEmpty || (counts[slot] ?? 0) > 0)
  const showSlots = view.group === 'gear' && slots.length > 1
  const showSort = sort !== undefined && onSortChange !== undefined

  if (!showGroups && !showSlots && !showSort && !children) return null

  const renderCount = (count: number, active: boolean) =>
    count > 0 ? (
      <span className={`text-[10px] font-normal ${active ? 'text-fg-bright/60' : 'text-fg-secondary/60'}`}>{count}</span>
    ) : null

  return (
    <div className="flex flex-col gap-2">
      {(showGroups || showSort) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showGroups &&
            groups.map((group) => {
              const active = view.group === group.id
              const count = countForGroup(counts, group.id)
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0}
                  onClick={() => onChange({ group: group.id, slot: 'all' })}
                  className={`${CHIP} ${active ? CHIP_GROUP_ON : CHIP_IDLE}`}
                >
                  <NotificationBadge value={groupNew(group.id)} className="absolute -left-1 -top-1 z-10" />
                  <span>{group.label}</span>
                  {renderCount(count, active)}
                </button>
              )
            })}
          {showSort && (
            <StatSortControl
              value={sort}
              onChange={onSortChange}
              compareEnabled={compareEnabled}
              onCompareChange={onCompareChange}
              className="ml-auto"
            />
          )}
        </div>
      )}

      {showSlots && (
        <div className="flex flex-wrap items-center gap-1.5">
          {slots.map((slot) => {
            const active = view.slot === slot
            const count = counts[slot] ?? 0
            return (
              <button
                key={slot}
                type="button"
                aria-pressed={active}
                disabled={count === 0}
                onClick={() => onChange({ group: 'gear', slot: active ? 'all' : slot })}
                className={`${CHIP} ${active ? CHIP_SLOT_ON : CHIP_IDLE}`}
              >
                <NotificationBadge value={newCounts?.[slot] ?? 0} className="absolute -left-1 -top-1 z-10" />
                <span>{SLOT_CHIP_LABELS[slot]}</span>
                {renderCount(count, active)}
              </button>
            )
          })}
        </div>
      )}

      {children}
    </div>
  )
}
