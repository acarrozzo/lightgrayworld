'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InventoryItem } from '@/lib/game-state'
import { WeaponCategory } from '@prisma/client'
import { getItemDisplayOrder } from '@/lib/inventory-utils'
import { getSellValue } from '@/lib/shop-pricing'
import { getPrimaryItemAction, type PrimaryItemAction } from '@/lib/item-primary-action'
import { useGearCompareSetting } from '@/lib/use-gear-compare'
import {
  type FilterTab,
  type ItemCategory,
  type ItemFilterView,
  type SortStat,
  FILTER_GROUPS,
  buildSections,
  compareToEquipped,
  countForGroup,
  filterTabToView,
  getItemCategory,
  isTwoHanded,
  sortEquippedFirst,
  sortItems,
} from '@/lib/inventory-categories'
import ItemFilterBar from './ItemFilterBar'
import ItemRow, { EquippedDivider, GhostButton, ItemDrawer } from './ItemRow'
import Icon from './Icon'

interface InventoryDisplayProps {
  inventory: InventoryItem[]
  onAction?: (action: string | { type: string; data?: any }) => void
  newItemIds?: Set<string>
  onClearNewItem?: (itemId: string) => void
  showNewItems?: boolean
  showHeading?: boolean
  initialFilter?: FilterTab
}

type WeaponTypeFilter = 'all' | 'melee' | 'ranged'
type HandednessFilter = 'all' | '1h' | '2h'

const PRIMARY =
  'px-2.5 min-h-[30px] rounded-md text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md'
const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted px-0.5 mt-1'
const SUB_CHIP = 'px-2.5 py-1 text-[11px] font-medium rounded border transition-all duration-200'
const SUB_CHIP_IDLE =
  'bg-surface-raised/50 hover:bg-surface-raised/70 text-fg-secondary border-line-subtle/50 hover:border-line-strong/50'

/** Inline quantity strip that replaces the one-tap Drop: 1 / half / all, or cancel. */
function DropStrip({
  item,
  onDrop,
  onCancel,
}: {
  item: InventoryItem
  onDrop: (quantity: number) => void
  onCancel: () => void
}) {
  const quantity = item.quantity
  const half = Math.ceil(quantity / 2)
  return (
    <div className="flex flex-wrap items-center gap-1.5 w-full rounded-md border border-dashed border-status-error/40 bg-status-error/5 px-2 py-1.5">
      <span className="text-[11px] font-semibold text-status-error mr-0.5">Drop</span>
      <GhostButton tone="danger" onClick={() => onDrop(1)}>
        {quantity > 1 ? '1' : `1 ${item.template.name}`}
      </GhostButton>
      {half > 1 && half < quantity && (
        <GhostButton tone="danger" onClick={() => onDrop(half)}>Half · {half}</GhostButton>
      )}
      {quantity > 1 && (
        <GhostButton tone="danger" onClick={() => onDrop(quantity)}>All · {quantity}</GhostButton>
      )}
      <GhostButton onClick={onCancel} className="ml-auto">Cancel</GhostButton>
    </div>
  )
}

export default function InventoryDisplay({
  inventory,
  onAction,
  newItemIds = new Set<string>(),
  onClearNewItem,
  showNewItems = true,
  showHeading = true,
  initialFilter,
}: InventoryDisplayProps) {
  const [view, setView] = useState<ItemFilterView>(() => filterTabToView(initialFilter))
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponTypeFilter>('all')
  const [handednessFilter, setHandednessFilter] = useState<HandednessFilter>('all')
  const [sortStat, setSortStat] = useState<SortStat>('none')
  // One drawer open at a time. A stale id (item dropped or sold) simply matches nothing.
  const [openId, setOpenId] = useState<string | null>(null)
  const [dropOpen, setDropOpen] = useState(false)
  const [compareEnabled, setCompareEnabled] = useGearCompareSetting()

  // The character panel's slot buttons deep-link into Equipment › slot.
  useEffect(() => {
    if (initialFilter !== undefined) setView(filterTabToView(initialFilter))
  }, [initialFilter])

  useEffect(() => {
    setDropOpen(false)
  }, [openId])

  const itemOrderMap = useMemo(() => getItemDisplayOrder(), [])

  // Per-category lists, sorted, with equipped gear pinned to the top.
  const byCategory = useMemo(() => {
    const groups = new Map<ItemCategory, InventoryItem[]>()
    for (const item of inventory) {
      const category = getItemCategory(item)
      const list = groups.get(category) ?? []
      list.push(item)
      groups.set(category, list)
    }
    for (const [category, list] of groups) {
      groups.set(category, sortEquippedFirst(sortItems(list, sortStat, itemOrderMap, category)))
    }
    return groups
  }, [inventory, sortStat, itemOrderMap])

  const counts = useMemo(() => {
    const result: Partial<Record<ItemCategory, number>> = {}
    for (const [category, list] of byCategory) result[category] = list.length
    return result
  }, [byCategory])

  const newCounts = useMemo(() => {
    const result: Partial<Record<ItemCategory, number>> = {}
    if (!showNewItems || newItemIds.size === 0) return result
    for (const item of inventory) {
      if (!newItemIds.has(item.id)) continue
      const category = getItemCategory(item)
      result[category] = (result[category] ?? 0) + 1
    }
    return result
  }, [inventory, newItemIds, showNewItems])

  // If the chosen group has nothing in it (a fresh character with no gear, the
  // last potion drunk), show the first group that does rather than an empty list.
  const effectiveView = useMemo<ItemFilterView>(() => {
    if (inventory.length === 0 || countForGroup(counts, view.group) > 0) return view
    const first = FILTER_GROUPS.find((group) => countForGroup(counts, group.id) > 0)
    return first ? { group: first.id, slot: 'all' } : view
  }, [view, counts, inventory.length])

  const showMainHandFilters = effectiveView.group === 'gear' && effectiveView.slot === 'main'

  // Main-hand sub-filters only mean something in the main-hand view.
  useEffect(() => {
    if (!showMainHandFilters) {
      setWeaponTypeFilter('all')
      setHandednessFilter('all')
    }
  }, [showMainHandFilters])

  const groupsForView = useMemo(() => {
    if (!showMainHandFilters) return byCategory
    const filtered = new Map(byCategory)
    filtered.set(
      'main',
      (byCategory.get('main') ?? []).filter((item) => {
        if (weaponTypeFilter === 'melee' && item.template.weaponCategory !== WeaponCategory.MELEE) return false
        if (weaponTypeFilter === 'ranged' && item.template.weaponCategory !== WeaponCategory.RANGED) return false
        const twoHanded = isTwoHanded(item)
        if (handednessFilter === '1h' && twoHanded) return false
        if (handednessFilter === '2h' && !twoHanded) return false
        return true
      })
    )
    return filtered
  }, [byCategory, showMainHandFilters, weaponTypeFilter, handednessFilter])

  const toggleOpen = (item: InventoryItem) => {
    onClearNewItem?.(item.id)
    setOpenId((prev) => (prev === item.id ? null : item.id))
  }

  const act = (item: InventoryItem, payload: { type: string; data?: any }) => {
    onClearNewItem?.(item.id)
    onAction?.(payload)
  }

  const renderPrimary = (item: InventoryItem, primary: PrimaryItemAction | null): ReactNode => {
    if (!primary) return null
    switch (primary.kind) {
      case 'unequip':
        return (
          <button
            type="button"
            onClick={() => act(item, { type: 'unequip_item', data: { playerItemId: item.id } })}
            className={`${PRIMARY} border border-status-error/60 text-status-error bg-transparent hover:bg-status-error/10 shadow-none`}
          >
            {primary.label}
          </button>
        )
      case 'equip':
        return (
          <button
            type="button"
            onClick={() => act(item, { type: 'equip_item', data: { playerItemId: item.id } })}
            disabled={primary.disabled}
            title={primary.reason ?? undefined}
            className={`${PRIMARY} fill-resource-mp disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none`}
          >
            {primary.label}
          </button>
        )
      case 'use':
        return (
          <button
            type="button"
            onClick={() => act(item, { type: 'use_item', data: { playerItemId: item.id, action: primary.action } })}
            title={primary.title}
            className={`${PRIMARY} text-fg-bright ${primary.className || 'fill-accent'}`}
          >
            {primary.icon && <Icon name={primary.icon} size={12} color="current" />}
            <span>{primary.label}</span>
          </button>
        )
    }
  }

  const renderItem = (item: InventoryItem): ReactNode => {
    // The compare always feeds the Equip button (it knows when the server would
    // refuse); whether it is shown is the player's setting.
    const compare = compareToEquipped(item, inventory)
    const shownCompare = compareEnabled ? compare : null
    const primary = getPrimaryItemAction(item, compare)
    const open = openId === item.id
    const canDrop = item.template.canDrop !== false
    const sellValue = getSellValue(item.template.value ?? 0)

    let hint: ReactNode = null
    if (item.isEquipped && canDrop) hint = 'Unequip to drop.'
    else if (!canDrop) hint = "This can't be dropped."
    else if (primary?.kind === 'equip' && primary.reason) hint = primary.reason

    const droppable = canDrop && !item.isEquipped

    return (
      <div key={item.id} className="flex flex-col">
        <ItemRow
          item={item}
          open={open}
          onToggle={() => toggleOpen(item)}
          equipped={item.isEquipped}
          isNew={showNewItems && newItemIds.has(item.id)}
          compare={shownCompare}
          action={renderPrimary(item, primary)}
        />
        {open && (
          <ItemDrawer
            item={item}
            equipped={item.isEquipped}
            compare={shownCompare}
            showWorth
            meta={sellValue > 0 ? <span>Sells for {sellValue}g</span> : undefined}
            hint={hint}
          >
            {droppable && !dropOpen && (
              <GhostButton tone="danger" onClick={() => setDropOpen(true)}>Drop…</GhostButton>
            )}
            {droppable && dropOpen && (
              <DropStrip
                item={item}
                onDrop={(quantity) => {
                  setDropOpen(false)
                  act(item, { type: 'drop_item', data: { playerItemId: item.id, quantity } })
                }}
                onCancel={() => setDropOpen(false)}
              />
            )}
          </ItemDrawer>
        )}
      </div>
    )
  }

  const renderContent = (): ReactNode => {
    if (inventory.length === 0) {
      return <p className="text-sm text-fg-secondary">Your inventory is empty.</p>
    }
    const sections = buildSections(groupsForView, effectiveView)
    if (sections.length === 0) {
      return <p className="text-sm text-fg-secondary">Nothing here yet.</p>
    }
    return sections.map((section) => (
      <div key={section.key} className="flex flex-col gap-1.5">
        {section.title && (
          <h4 className={SECTION_TITLE}>
            {section.title} · {section.items.length}
          </h4>
        )}
        {section.items.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 && !item.isEquipped && section.items[index - 1].isEquipped && <EquippedDivider />}
            {renderItem(item)}
          </Fragment>
        ))}
      </div>
    ))
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5">
      {showHeading && <h3 className="text-lg font-semibold text-fg-bright">Inventory</h3>}

      <ItemFilterBar
        counts={counts}
        newCounts={newCounts}
        view={effectiveView}
        onChange={setView}
        sort={effectiveView.group === 'crafting' ? undefined : sortStat}
        onSortChange={effectiveView.group === 'crafting' ? undefined : setSortStat}
        compareEnabled={compareEnabled}
        onCompareChange={setCompareEnabled}
      >
        {showMainHandFilters && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex gap-1.5">
              {(['all', 'melee', 'ranged'] as WeaponTypeFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={weaponTypeFilter === filter}
                  onClick={() => setWeaponTypeFilter(filter)}
                  className={`${SUB_CHIP} ${weaponTypeFilter === filter ? 'fill-stat-mag border-stat-mag/50' : SUB_CHIP_IDLE}`}
                >
                  {filter === 'all' ? 'All types' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['all', '1h', '2h'] as HandednessFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={handednessFilter === filter}
                  onClick={() => setHandednessFilter(filter)}
                  className={`${SUB_CHIP} ${handednessFilter === filter ? 'fill-resource-gold border-resource-gold/50' : SUB_CHIP_IDLE}`}
                >
                  {filter === 'all' ? 'All hands' : filter.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </ItemFilterBar>

      {renderContent()}
    </div>
  )
}
