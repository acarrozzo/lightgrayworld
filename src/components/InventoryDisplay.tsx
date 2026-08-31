'use client'

import { InventoryItem } from '@/lib/game-state'
import { useMemo, useState, useEffect } from 'react'
import InventoryDropButton from './InventoryDropButton'
import NotificationBadge from './NotificationBadge'
import ItemCardShell from './ItemCardShell'
import StatSortControl from './StatSortControl'
import { getItemActions } from '@/lib/item-actions'
import Icon from './Icon'
import { ItemType, EquipSlot, WeaponCategory } from '@prisma/client'
import { getItemDisplayOrder } from '@/lib/inventory-utils'
import {
  type FilterTab,
  type ItemCategory,
  type SortStat,
  getItemCategory,
  getCraftingKind,
  sortItems,
  INVENTORY_TABS,
  CATEGORY_DISPLAY_ORDER,
} from '@/lib/inventory-categories'

interface InventoryDisplayProps {
  inventory: InventoryItem[]
  onAction?: (action: string | { type: string; data?: any }) => void
  newItemIds?: Set<string>
  onClearNewItem?: (itemId: string) => void
  showNewItems?: boolean
  showHeading?: boolean
  tabsPadding?: boolean
  initialFilter?: FilterTab
}

type WeaponTypeFilter = 'all' | 'melee' | 'ranged'
type HandednessFilter = 'all' | '1h' | '2h'

// Crafting items are shown in fixed subsections (materials first, then tools)
// rather than via filter chips, so we render these in a stable order.
const CRAFTING_SUBSECTIONS: Array<{ kind: 'material' | 'tool'; label: string }> = [
  { kind: 'material', label: 'Materials' },
  { kind: 'tool', label: 'Tools' },
]

export default function InventoryDisplay({
  inventory,
  onAction,
  newItemIds = new Set<string>(),
  onClearNewItem,
  showNewItems = true,
  showHeading = true,
  tabsPadding = true,
  initialFilter,
}: InventoryDisplayProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>(initialFilter || 'all')
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponTypeFilter>('all')
  const [handednessFilter, setHandednessFilter] = useState<HandednessFilter>('all')
  const [sortStat, setSortStat] = useState<SortStat>('none')

  // Sync activeTab with initialFilter prop changes
  useEffect(() => {
    if (initialFilter !== undefined) {
      setActiveTab(initialFilter)
    }
  }, [initialFilter])

  // Reset sub-filters when leaving main tab
  useEffect(() => {
    if (activeTab !== 'main') {
      setWeaponTypeFilter('all')
      setHandednessFilter('all')
    }
  }, [activeTab])

  // Get item display order map (memoized)
  const itemOrderMap = useMemo(() => getItemDisplayOrder(), [])

  // Filter and sort items based on active tab
  const filteredItems = useMemo(() => {
    if (!inventory || inventory.length === 0) {
      return []
    }

    let filtered: InventoryItem[] = []

    switch (activeTab) {
      case 'all':
        filtered = [...inventory]
        break
      case 'main':
        filtered = inventory.filter(item => {
          if (item.template.equipSlot !== EquipSlot.MAIN_HAND) return false
          if (weaponTypeFilter === 'melee' && item.template.weaponCategory !== WeaponCategory.MELEE) return false
          if (weaponTypeFilter === 'ranged' && item.template.weaponCategory !== WeaponCategory.RANGED) return false
          const isTwoHanded = (item.template.metadata as any)?.isTwoHanded === true
          if (handednessFilter === '1h' && isTwoHanded) return false
          if (handednessFilter === '2h' && !isTwoHanded) return false
          return true
        })
        break
      case 'off':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.OFF_HAND)
        break
      case 'head':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.HEAD)
        break
      case 'body':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.BODY)
        break
      case 'hands':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.HANDS)
        break
      case 'feet':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.FEET)
        break
      case 'mount':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.MOUNT)
        break
      case 'ring':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.RING)
        break
      case 'neck':
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.NECK)
        break
      case 'consumables':
        filtered = inventory.filter(item => item.template.type === ItemType.CONSUMABLE)
        break
      case 'crafting':
        filtered = inventory.filter(item => getCraftingKind(item) !== null)
        break
      case 'misc':
        filtered = inventory.filter(item => getItemCategory(item) === 'misc')
        break
    }

    return sortItems(filtered, sortStat, itemOrderMap)
  }, [inventory, activeTab, weaponTypeFilter, handednessFilter, sortStat, itemOrderMap])

  // Group items by category when 'all' tab is selected
  const groupedItems = useMemo(() => {
    if (activeTab !== 'all' || !inventory || inventory.length === 0) {
      return null
    }

    // Derived from CATEGORY_DISPLAY_ORDER so a new category (e.g. mount) can
    // never end up missing a bucket here.
    const groups = Object.fromEntries(
      CATEGORY_DISPLAY_ORDER.map((category) => [category, [] as InventoryItem[]])
    ) as Record<ItemCategory, InventoryItem[]>

    for (const item of inventory) {
      groups[getItemCategory(item)].push(item)
    }

    for (const category of CATEGORY_DISPLAY_ORDER) {
      groups[category] = sortItems(groups[category], sortStat, itemOrderMap)
    }

    return groups
  }, [inventory, activeTab, sortStat, itemOrderMap])

  // Calculate item counts for each category
  const categoryCounts = useMemo(() => {
    if (!inventory || inventory.length === 0) {
      return {
        all: 0,
        main: 0,
        off: 0,
        head: 0,
        body: 0,
        hands: 0,
        feet: 0,
        ring: 0,
        neck: 0,
        mount: 0,
        consumables: 0,
        crafting: 0,
        misc: 0,
      }
    }

    const counts = {
      all: inventory.length,
      main: 0,
      off: 0,
      head: 0,
      body: 0,
      hands: 0,
      feet: 0,
      ring: 0,
      neck: 0,
      mount: 0,
      consumables: 0,
      crafting: 0,
      misc: 0,
    }

    for (const item of inventory) {
      counts[getItemCategory(item)]++
    }

    return counts
  }, [inventory])

  // Count new items per category so the filter buttons can surface a numbered
  // badge mirroring the per-item indicator and the main INV tab badge.
  const newItemCountsByCategory = useMemo(() => {
    const counts: Partial<Record<ItemCategory, number>> = {}
    if (!showNewItems || !newItemIds || newItemIds.size === 0) {
      return counts
    }

    for (const item of inventory) {
      if (!newItemIds.has(item.id)) continue
      const category = getItemCategory(item)
      counts[category] = (counts[category] || 0) + 1
    }

    return counts
  }, [inventory, newItemIds, showNewItems])

  const tabs = INVENTORY_TABS

  // Action footer for an inventory item card (equip/unequip/use + value/drop).
  // Defined once and reused for both the grouped and flat layouts.
  const renderItemFooter = (item: InventoryItem) => {
    const itemActions = item.template.slug
      ? getItemActions(item.template.slug, item.template.metadata as any)
      : []
    const itemValue = item.template.value ?? 0

    return (
      // One wrapping row: action buttons flow and wrap; the value + drop group is
      // pushed right with ml-auto and drops to its own line on narrow cards.
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {/* Equipped status tag + Unequip button - show if item is equipped */}
        {item.isEquipped && (
          <>
            <span className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded-full bg-green-500/15 text-green-300 border border-green-400/40 flex-shrink-0">
              Equipped
            </span>
            <button
              onClick={() => {
                onClearNewItem?.(item.id)
                onAction?.({ type: 'unequip_item', data: { playerItemId: item.id } })
              }}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md"
            >
              <Icon name="arrow-down" size={12} color="current" />
              <span>Unequip</span>
            </button>
          </>
        )}
        {/* Equip button - show if item has equipSlot and is not already equipped */}
        {item.template.equipSlot !== null && !item.isEquipped && (
          <button
            onClick={() => {
              onClearNewItem?.(item.id)
              onAction?.({ type: 'equip_item', data: { playerItemId: item.id } })
            }}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600/80 hover:bg-blue-600 rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md"
          >
            <Icon name="arrow-up" size={12} color="current" />
            <span>Equip</span>
          </button>
        )}
        {itemActions.map((itemAction) => (
          <button
            key={itemAction.action}
            onClick={() => {
              onClearNewItem?.(item.id)
              onAction?.({
                type: 'use_item',
                data: { playerItemId: item.id, action: itemAction.action },
              })
            }}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold text-white transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md ${
              itemAction.className || 'bg-indigo-600/80 hover:bg-indigo-600'
            }`}
            title={itemAction.label}
          >
            {itemAction.icon && <Icon name={itemAction.icon} size={12} color="current" />}
            <span>{itemAction.label}</span>
          </button>
        ))}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          {itemValue > 0 && (
            <span className="text-xs text-gray-400/70 font-medium">{itemValue}</span>
          )}
          <InventoryDropButton
            item={item}
            onDrop={(quantity) => {
              onClearNewItem?.(item.id)
              onAction?.({ type: 'drop_item', data: { playerItemId: item.id, quantity } })
            }}
            onExamine={() => {
              onClearNewItem?.(item.id)
              onAction?.({ type: 'examine_player_item', data: { playerItemId: item.id } })
            }}
            onItemAction={(action) => {
              onClearNewItem?.(item.id)
              onAction?.({ type: 'use_item', data: { playerItemId: item.id, action } })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="@container space-y-4 p-4 sm:p-6">
      {showHeading && <h3 className="text-lg font-semibold text-white">Inventory</h3>}
      
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap pt-1 pb-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const count = categoryCounts[tab.id]
          const newItemCount = tab.id === 'all' ? 0 : (newItemCountsByCategory[tab.id] || 0)
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-500/70 hover:bg-blue-500 text-white border border-blue-400/50'
                  : 'bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 border border-gray-700/50 hover:border-gray-600/50'
              }`}
            >
              <NotificationBadge value={newItemCount} className="absolute -left-1 -top-1 z-10" />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`text-[10px] font-normal ${
                  isActive ? 'text-white/60' : 'text-gray-400/60'
                }`}>
                  ({count})
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Stat sort — hidden for crafting items, which aren't stat-bearing gear */}
      {activeTab !== 'crafting' && (
        <StatSortControl value={sortStat} onChange={setSortStat} />
      )}

      {/* Main hand sub-filters */}
      {activeTab === 'main' && (
        <div className="flex gap-4 flex-wrap pb-1">
          <div className="flex gap-1.5">
            {(['all', 'melee', 'ranged'] as WeaponTypeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setWeaponTypeFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 ${
                  weaponTypeFilter === f
                    ? 'bg-violet-600/70 hover:bg-violet-600 text-white border border-violet-500/50'
                    : 'bg-gray-800/50 hover:bg-gray-800/70 text-gray-400 border border-gray-700/50 hover:border-gray-600/50'
                }`}
              >
                {f === 'all' ? 'All Types' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['all', '1h', '2h'] as HandednessFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setHandednessFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 ${
                  handednessFilter === f
                    ? 'bg-amber-600/70 hover:bg-amber-600 text-white border border-amber-500/50'
                    : 'bg-gray-800/50 hover:bg-gray-800/70 text-gray-400 border border-gray-700/50 hover:border-gray-600/50'
                }`}
              >
                {f === 'all' ? 'All Hands' : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtered Items */}
      {(!inventory || inventory.length === 0) ? (
        <div className="text-gray-400 text-sm">
          Your inventory is empty.
        </div>
      ) : activeTab === 'all' && groupedItems ? (
        // Show grouped items with category headers
        <div className="space-y-4">
          {tabs.slice(1).filter((tab) => {
            const categoryItems = groupedItems[tab.id as keyof typeof groupedItems] || []
            return categoryItems.length > 0
          }).map((tab) => {
            const categoryItems = groupedItems[tab.id as keyof typeof groupedItems] || []

            return (
              <div key={tab.id} className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-300 px-2">
                  {tab.label.charAt(0).toUpperCase() + tab.label.slice(1)} ({categoryItems.length})
                </h4>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  {categoryItems.map((item) => (
                    <ItemCardShell
                      key={item.id}
                      item={item}
                      highlighted={item.isEquipped}
                      newBadge={showNewItems && newItemIds.has(item.id)}
                      footer={renderItemFooter(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-gray-400 text-sm">
          No items in this category.
        </div>
      ) : activeTab === 'crafting' ? (
        // Crafting items grouped into Materials, then Tools subsections
        <div className="space-y-4">
          {CRAFTING_SUBSECTIONS.map(({ kind, label }) => {
            const sectionItems = filteredItems.filter((item) => getCraftingKind(item) === kind)
            if (sectionItems.length === 0) return null
            return (
              <div key={kind} className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-300 px-2">
                  {label} ({sectionItems.length})
                </h4>
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  {sectionItems.map((item) => (
                    <ItemCardShell
                      key={item.id}
                      item={item}
                      highlighted={item.isEquipped}
                      newBadge={showNewItems && newItemIds.has(item.id)}
                      footer={renderItemFooter(item)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Show flat list for specific category tabs
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {filteredItems.map((item) => (
            <ItemCardShell
              key={item.id}
              item={item}
              highlighted={item.isEquipped}
              newBadge={showNewItems && newItemIds.has(item.id)}
              footer={renderItemFooter(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
