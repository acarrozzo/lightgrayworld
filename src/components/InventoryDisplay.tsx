'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
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
  CATEGORY_LABELS,
  compareToEquipped,
  countForGroup,
  filterTabToView,
  getItemCategory,
  isTwoHanded,
  sortEquippedFirst,
  sortItems,
} from '@/lib/inventory-categories'
import ItemFilterBar from './ItemFilterBar'
import StatSortControl from './StatSortControl'
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
  /**
   * The filter, owned by the caller: the Inv tab drives it from its equipment
   * slots. Left out, the bag keeps its own, seeded by `initialFilter`.
   */
  view?: ItemFilterView
  onViewChange?: (view: ItemFilterView) => void
  /** The caller draws the group filter itself (the Inv tab's header). */
  hideGroups?: boolean
  /** Leave out the search box: the Inv tab holds it back until the bag is big enough to need one. */
  hideSearch?: boolean
  /** The caller draws the slot filter itself. */
  hideSlots?: boolean
  /** The root's padding; the Inv tab's layer supplies its own. */
  className?: string
  /** The item whose drawer is open, or null: the Inv tab previews its effect on the stats. */
  onOpenItemChange?: (item: InventoryItem | null) => void
  /** One item to open and scroll to on arrival — the character panel's rows deep-link here. */
  initialOpenId?: string | null
  /**
   * Supplied only while the player stands at a crafting table: the Crafting
   * group grows an "Open Crafting" button, as the original bag had.
   */
  onOpenCrafting?: () => void
}

type WeaponTypeFilter = 'all' | 'melee' | 'ranged'
type HandednessFilter = 'all' | '1h' | '2h'

const PRIMARY =
  'px-2.5 min-h-[30px] rounded-md text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md'
const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted px-0.5 mt-1'
const STAT_WORDS = ['str', 'dex', 'mag', 'def'] as const

/**
 * Whether an item answers one search word: part of its name, the name of its
 * slot or group ("ring", "crafting"), or a stat it raises ("dex").
 */
function matchesWord(item: InventoryItem, word: string): boolean {
  if (item.template.name.toLowerCase().includes(word)) return true
  const category = getItemCategory(item)
  if (CATEGORY_LABELS[category]?.toLowerCase().includes(word)) return true
  const statMods = (item.template.metadata as any)?.statMods
  return STAT_WORDS.some((stat) => stat === word && typeof statMods?.[stat] === 'number' && statMods[stat] > 0)
}

const SEGMENT = 'px-2.5 py-1 text-[11px] font-medium transition-colors duration-150'
const SEGMENT_IDLE = 'text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary'

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
  view: controlledView,
  onViewChange,
  hideGroups = false,
  hideSlots = false,
  hideSearch = false,
  className = 'p-4 sm:p-5',
  initialOpenId = null,
  onOpenItemChange,
  onOpenCrafting,
}: InventoryDisplayProps) {
  const [ownView, setOwnView] = useState<ItemFilterView>(() => filterTabToView(initialFilter))
  const view = controlledView ?? ownView
  const setView = onViewChange ?? setOwnView
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponTypeFilter>('all')
  const [handednessFilter, setHandednessFilter] = useState<HandednessFilter>('all')
  const [sortStat, setSortStat] = useState<SortStat>('none')
  // One drawer open at a time. A stale id (item dropped or sold) simply matches nothing.
  const [openId, setOpenId] = useState<string | null>(null)
  // Search looks through the whole bag, whatever the chips are set to.
  const [query, setQuery] = useState('')
  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query])
  const searching = words.length > 0
  const searchCount = useMemo(
    () => (words.length === 0 ? 0 : inventory.filter((item) => words.every((word) => matchesWord(item, word))).length),
    [inventory, words]
  )
  const [dropOpen, setDropOpen] = useState(false)
  const [compareEnabled, setCompareEnabled] = useGearCompareSetting()

  // The character panel's slot buttons deep-link into Equipment › slot.
  useEffect(() => {
    if (initialFilter !== undefined) setOwnView(filterTabToView(initialFilter))
  }, [initialFilter])

  // Its item rows deep-link one step further: open that item and bring it into
  // view. One frame late, so the list it belongs to has rendered.
  useEffect(() => {
    if (!initialOpenId) return
    setOpenId(initialOpenId)
    const frame = requestAnimationFrame(() => {
      document
        .querySelector(`[data-bag-item="${CSS.escape(initialOpenId)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [initialOpenId])

  useEffect(() => {
    setDropOpen(false)
  }, [openId])

  // A stale id (the item was dropped or sold) reports as nothing open.
  const openItem = useMemo(() => (openId ? inventory.find((item) => item.id === openId) ?? null : null), [openId, inventory])
  useEffect(() => {
    onOpenItemChange?.(openItem)
    // The caller's callback identity is not a reason to report again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItem])

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
            className={`${PRIMARY} ${primary.className || 'fill-accent'}`}
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
      <div key={item.id} data-bag-item={item.id} className="flex flex-col">
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
    let sections
    if (searching) {
      const found = new Map<ItemCategory, InventoryItem[]>()
      for (const [category, list] of byCategory) {
        found.set(category, list.filter((item) => words.every((word) => matchesWord(item, word))))
      }
      sections = FILTER_GROUPS.flatMap((group) =>
        buildSections(found, { group: group.id, slot: 'all' }).map((section) => ({ ...section, title: section.title ?? group.label }))
      )
    } else {
      sections = buildSections(groupsForView, effectiveView)
    }
    if (sections.length === 0) {
      return <p className="text-sm text-fg-secondary">{searching ? `Nothing in your bag matches “${query.trim()}”.` : 'Nothing here yet.'}</p>
    }
    const craftingHere = !searching && effectiveView.group === 'crafting' && onOpenCrafting
    return sections.map((section, sectionIndex) => (
      <div key={section.key} className="flex flex-col gap-1.5">
        {section.title && (
          <div className="flex items-center justify-between gap-2">
            <h4 className={SECTION_TITLE}>
              {section.title} · {section.items.length}
            </h4>
            {craftingHere && sectionIndex === 0 && (
              <GhostButton tone="success" onClick={onOpenCrafting}>
                Open Crafting
              </GhostButton>
            )}
          </div>
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
    <div className={`flex flex-col gap-3 ${className}`}>
      {showHeading && <h3 className="text-lg font-semibold text-fg-bright">Inventory</h3>}

      {/* One line: search, which reaches every group at once by name, slot or
          stat, with Sort beside it. */}
      <div className="flex items-center gap-2">
        {hideSearch ? (
          <span className="flex-1" />
        ) : (
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            id="bag-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Escape clears the search before it closes the layer.
              if (event.key === 'Escape' && query) {
                event.stopPropagation()
                event.nativeEvent.stopImmediatePropagation()
                setQuery('')
              }
            }}
            placeholder="Search: name, slot or stat"
            aria-label="Search your bag"
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-line-subtle/60 bg-surface-sunken pl-8 pr-8 text-xs text-fg-primary placeholder:text-fg-muted focus:border-line-focus focus:outline-none focus-visible:ring-1 focus-visible:ring-line-focus [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              title="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        )}
        {effectiveView.group !== 'crafting' && (
          <StatSortControl value={sortStat} onChange={setSortStat} compareEnabled={compareEnabled} onCompareChange={setCompareEnabled} className="flex-shrink-0" />
        )}
      </div>

      {searching ? (
        <p className="text-[11px] text-fg-muted">
          Looking through everything you carry · <span className="tabular-nums text-fg-secondary">{searchCount}</span> found
        </p>
      ) : (
        <ItemFilterBar counts={counts} newCounts={newCounts} view={effectiveView} onChange={setView} hideGroups={hideGroups} hideSlots={hideSlots}>
          {showMainHandFilters && (
            // Two narrowing switches for weapons. Each is off until pressed,
            // and pressing the lit half turns it off again.
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Narrow</span>
              <div className="flex overflow-hidden rounded-md border border-line-subtle/60">
                {(['melee', 'ranged'] as const).map((filter, index) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={weaponTypeFilter === filter}
                    onClick={() => setWeaponTypeFilter(weaponTypeFilter === filter ? 'all' : filter)}
                    className={`${SEGMENT} ${index > 0 ? 'border-l border-line-subtle/60' : ''} ${weaponTypeFilter === filter ? 'fill-stat-mag' : SEGMENT_IDLE}`}
                  >
                    {filter === 'melee' ? 'Melee' : 'Ranged'}
                  </button>
                ))}
              </div>
              <div className="flex overflow-hidden rounded-md border border-line-subtle/60">
                {(['1h', '2h'] as const).map((filter, index) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={handednessFilter === filter}
                    onClick={() => setHandednessFilter(handednessFilter === filter ? 'all' : filter)}
                    className={`${SEGMENT} ${index > 0 ? 'border-l border-line-subtle/60' : ''} ${handednessFilter === filter ? 'fill-resource-gold' : SEGMENT_IDLE}`}
                  >
                    {filter.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </ItemFilterBar>
      )}

      {renderContent()}
    </div>
  )
}
