'use client'

import { InventoryItem } from '@/lib/game-state'
import { useMemo, useState, useEffect } from 'react'
import InventoryDropButton from './InventoryDropButton'
import { getItemActions, resolveItemIcon } from '@/lib/item-actions'
import Icon from './Icon'
import { ItemType, EquipSlot } from '@prisma/client'
import {
  getItemDisplayOrder,
  getItemOrderIndex,
} from '@/lib/inventory-utils'

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

type FilterTab = 'all' | 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'consumables' | 'misc'

/**
 * Format stat modifiers from item metadata as a comma-separated string.
 * Returns empty string if no mods or invalid metadata.
 * Example: "+5 STR, +2 MAG" or "+1 STR, -5 MAG"
 */
function formatStatMods(metadata: any): string {
  if (!metadata || typeof metadata !== 'object') {
    return ''
  }

  const statMods = metadata.statMods
  if (!statMods || typeof statMods !== 'object') {
    return ''
  }

  const parts: string[] = []
  const statOrder = ['str', 'dex', 'mag', 'def'] as const
  const statLabels: Record<string, string> = {
    str: 'STR',
    dex: 'DEX',
    mag: 'MAG',
    def: 'DEF',
  }

  for (const stat of statOrder) {
    const value = statMods[stat]
    if (typeof value === 'number' && value !== 0) {
      const sign = value > 0 ? '+' : ''
      parts.push(`${sign}${value} ${statLabels[stat]}`)
    }
  }

  return parts.join(', ')
}

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

  // Sync activeTab with initialFilter prop changes
  useEffect(() => {
    if (initialFilter !== undefined) {
      setActiveTab(initialFilter)
    }
  }, [initialFilter])

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
        filtered = inventory.filter(item => item.template.equipSlot === EquipSlot.MAIN_HAND)
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
      case 'consumables':
        filtered = inventory.filter(item => item.template.type === ItemType.CONSUMABLE)
        break
      case 'misc':
        filtered = inventory.filter(item => item.template.type === ItemType.MISC)
        break
    }

    // Sort items by seed.ts order
    filtered.sort((a, b) => {
      const orderA = getItemOrderIndex(a.template.slug, itemOrderMap)
      const orderB = getItemOrderIndex(b.template.slug, itemOrderMap)
      
      // If both have same order (or both missing), sort alphabetically by name
      if (orderA === orderB) {
        return a.template.name.localeCompare(b.template.name)
      }
      
      return orderA - orderB
    })

    return filtered
  }, [inventory, activeTab, itemOrderMap])

  // Group items by category when 'all' tab is selected
  const groupedItems = useMemo(() => {
    if (activeTab !== 'all' || !inventory || inventory.length === 0) {
      return null
    }

    const groups: Record<string, InventoryItem[]> = {
      main: [],
      off: [],
      head: [],
      body: [],
      hands: [],
      feet: [],
      consumables: [],
      misc: [],
    }

    for (const item of inventory) {
      if (item.template.equipSlot === EquipSlot.MAIN_HAND) {
        groups.main.push(item)
      } else if (item.template.equipSlot === EquipSlot.OFF_HAND) {
        groups.off.push(item)
      } else if (item.template.equipSlot === EquipSlot.HEAD) {
        groups.head.push(item)
      } else if (item.template.equipSlot === EquipSlot.BODY) {
        groups.body.push(item)
      } else if (item.template.equipSlot === EquipSlot.HANDS) {
        groups.hands.push(item)
      } else if (item.template.equipSlot === EquipSlot.FEET) {
        groups.feet.push(item)
      } else if (item.template.type === ItemType.CONSUMABLE) {
        groups.consumables.push(item)
      } else {
        groups.misc.push(item)
      }
    }

    // Sort items within each group
    const categoryOrder: FilterTab[] = ['main', 'off', 'head', 'body', 'hands', 'feet', 'consumables', 'misc']
    for (const category of categoryOrder) {
      groups[category].sort((a, b) => {
        const orderA = getItemOrderIndex(a.template.slug, itemOrderMap)
        const orderB = getItemOrderIndex(b.template.slug, itemOrderMap)
        
        if (orderA === orderB) {
          return a.template.name.localeCompare(b.template.name)
        }
        
        return orderA - orderB
      })
    }

    return groups
  }, [inventory, activeTab, itemOrderMap])

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
        consumables: 0,
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
      consumables: 0,
      misc: 0,
    }

    for (const item of inventory) {
      if (item.template.equipSlot === EquipSlot.MAIN_HAND) {
        counts.main++
      } else if (item.template.equipSlot === EquipSlot.OFF_HAND) {
        counts.off++
      } else if (item.template.equipSlot === EquipSlot.HEAD) {
        counts.head++
      } else if (item.template.equipSlot === EquipSlot.BODY) {
        counts.body++
      } else if (item.template.equipSlot === EquipSlot.HANDS) {
        counts.hands++
      } else if (item.template.equipSlot === EquipSlot.FEET) {
        counts.feet++
      } else if (item.template.type === ItemType.CONSUMABLE) {
        counts.consumables++
      } else {
        counts.misc++
      }
    }

    return counts
  }, [inventory])

  const tabs: Array<{ id: FilterTab; label: string }> = [
    { id: 'all', label: 'ALL' },
    { id: 'main', label: 'main' },
    { id: 'off', label: 'off' },
    { id: 'head', label: 'head' },
    { id: 'body', label: 'body' },
    { id: 'hands', label: 'hands' },
    { id: 'feet', label: 'feet' },
    { id: 'consumables', label: 'consumables' },
    { id: 'misc', label: 'misc' },
  ]

  return (
    <div className="@container space-y-4 p-4 sm:p-6">
      {showHeading && <h3 className="text-lg font-semibold text-white">Inventory</h3>}
      
      {/* Filter Tabs */}
      <div className={`flex gap-2 flex-wrap overflow-x-auto pb-2}`}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const count = categoryCounts[tab.id]
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-500/70 hover:bg-blue-500 text-white border border-blue-400/50'
                  : 'bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 border border-gray-700/50 hover:border-gray-600/50'
              }`}
            >
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
                <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
                  {categoryItems.map((item) => {
                      const isNewItem = showNewItems && newItemIds.has(item.id)
                      const itemActions = item.template.slug ? getItemActions(item.template.slug) : []
                      const itemValue = item.template.value ?? 0
                      // Resolve icon with fallback logic
                      const metadata = item.template.metadata as { icon?: string } | null
                      const itemIcon = resolveItemIcon(metadata, item.template.slug || '')
                      
                      return (
                        <div
                          key={item.id}
                          className={`relative rounded-lg border px-4 py-3 shadow-md hover:shadow-lg transition-all duration-200 flex gap-3 ${
                            item.isEquipped
                              ? 'border-green-500/70 bg-gradient-to-br from-green-900/30 via-green-800/20 to-green-900/20 hover:from-green-900/40 hover:via-green-800/30 hover:to-green-900/30 hover:border-green-500/90 shadow-green-500/10'
                              : 'border-gray-700/40 bg-gray-800/30 hover:bg-gray-800/50 hover:border-gray-700/60 backdrop-blur-sm'
                          }`}
                        >
                          {isNewItem && (
                            <span className="absolute left-2 top-2 w-2 h-2 bg-red-500 rounded-full z-10 shadow-lg shadow-red-500/50 border border-red-400/50"></span>
                          )}
                          {item.isEquipped && (
                            <span className="absolute right-2 top-2 px-2 py-1 bg-gradient-to-r from-green-500/90 to-green-600/90 text-white text-[10px] font-bold rounded-md shadow-lg shadow-green-500/30 z-10 border border-green-400/50">
                              EQUIPPED
                            </span>
                          )}
                          
                          {/* Item icon on the left */}
                          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700/30 border border-gray-600/30">
                            <Icon
                              name={itemIcon}
                              size={32}
                              color="current"
                              className="text-gray-300"
                            />
                          </div>
                          
                          {/* Content area */}
                          <div className="flex-1 min-w-0">
                            {/* Top row: Item name with quantity */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`text-white text-sm font-semibold truncate min-w-0 ${isNewItem ? 'pl-2' : ''}`}>
                                {item.template.name}
                              </div>
                              {item.quantity > 1 && (
                                <span className="text-gray-200 text-xs font-semibold border border-gray-600/50 bg-gray-700/60 px-1.5 py-0.5 rounded-md flex-shrink-0 shadow-sm">
                                  x{item.quantity}
                                </span>
                              )}
                            </div>
                            
                            {/* Stat mods */}
                            {(() => {
                              const modText = formatStatMods(item.template.metadata)
                              return modText ? (
                                <div className="text-blue-400 text-sm font-bold mb-1">
                                  {modText}
                                </div>
                              ) : null
                            })()}
                            
                            {/* Description */}
                            {item.template.description && (
                              <div className="text-gray-400 text-xs mb-2 line-clamp-2 leading-relaxed">
                                {item.template.description}
                              </div>
                            )}
                            
                            {/* Bottom row: Action buttons on left, value and drop/examine button on right */}
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                                {/* Unequip button - show if item is equipped */}
                                {item.isEquipped && (
                                  <button
                                    onClick={() => {
                                      onClearNewItem?.(item.id)
                                      onAction?.({
                                        type: 'unequip_item',
                                        data: { playerItemId: item.id },
                                      })
                                    }}
                                    className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md"
                                  >
                                    <Icon name="equipment-shortsword" size={12} color="current" />
                                    <span className="hidden sm:inline">Unequip</span>
                                  </button>
                                )}
                                {/* Equip button - show if item has equipSlot and is not already equipped */}
                                {item.template.equipSlot !== null && !item.isEquipped && (
                                  <button
                                    onClick={() => {
                                      onClearNewItem?.(item.id)
                                      onAction?.({
                                        type: 'equip_item',
                                        data: { playerItemId: item.id },
                                      })
                                    }}
                                    className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600/80 hover:bg-blue-600 rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md"
                                  >
                                    <Icon name="equipment-shortsword" size={12} color="current" />
                                    <span className="hidden sm:inline">Equip</span>
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
                                    {itemAction.icon && (
                                      <Icon
                                        name={itemAction.icon}
                                        size={12}
                                        color="current"
                                      />
                                    )}
                                    <span className="hidden sm:inline">{itemAction.label}</span>
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {itemValue > 0 && (
                                  <span className="text-xs text-gray-400/70 font-medium">
                                    {itemValue}
                                  </span>
                                )}
                                <InventoryDropButton
                                  item={item}
                                  onDrop={(quantity) => {
                                    onClearNewItem?.(item.id)
                                    onAction?.({
                                      type: 'drop_item',
                                      data: { playerItemId: item.id, quantity },
                                    })
                                  }}
                                  onExamine={() => {
                                    onClearNewItem?.(item.id)
                                    onAction?.({
                                      type: 'examine_player_item',
                                      data: { playerItemId: item.id },
                                    })
                                  }}
                                  onItemAction={(action) => {
                                    onClearNewItem?.(item.id)
                                    onAction?.({
                                      type: 'use_item',
                                      data: { playerItemId: item.id, action },
                                    })
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-gray-400 text-sm">
          No items in this category.
        </div>
      ) : (
        // Show flat list for specific category tabs
        <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const isNewItem = showNewItems && newItemIds.has(item.id)
            const itemActions = item.template.slug ? getItemActions(item.template.slug) : []
            const itemValue = item.template.value ?? 0
            // Resolve icon with fallback logic
            const metadata = item.template.metadata as { icon?: string } | null
            const itemIcon = resolveItemIcon(metadata, item.template.slug || '')
            
            return (
              <div
                key={item.id}
                className={`relative rounded-lg border px-4 py-3 shadow-md hover:shadow-lg transition-all duration-200 flex gap-3 ${
                  item.isEquipped
                    ? 'border-green-500/70 bg-gradient-to-br from-green-900/30 via-green-800/20 to-green-900/20 hover:from-green-900/40 hover:via-green-800/30 hover:to-green-900/30 hover:border-green-500/90 shadow-green-500/10'
                    : 'border-gray-700/40 bg-gray-800/30 hover:bg-gray-800/50 hover:border-gray-700/60 backdrop-blur-sm'
                }`}
              >
                {isNewItem && (
                  <span className="absolute left-1 top-1 w-1.5 h-1.5 bg-red-500 rounded-full z-10"></span>
                )}
                {item.isEquipped && (
                  <span className="absolute right-2 top-2 px-2 py-1 bg-gradient-to-r from-green-500/90 to-green-600/90 text-white text-[10px] font-bold rounded-md shadow-lg shadow-green-500/30 z-10 border border-green-400/50">
                    EQUIPPED
                  </span>
                )}
                
                {/* Item icon on the left */}
                <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700/30 border border-gray-600/30">
                  <Icon
                    name={itemIcon}
                    size={32}
                    color="current"
                    className="text-gray-300"
                  />
                </div>
                
                {/* Content area */}
                <div className="flex-1 min-w-0">
                  {/* Top row: Item name with quantity */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`text-white text-sm font-semibold truncate min-w-0 ${isNewItem ? 'pl-2' : ''}`}>
                      {item.template.name}
                    </div>
                    {item.quantity > 1 && (
                      <span className="text-gray-200 text-xs font-semibold border border-gray-600/50 bg-gray-700/60 px-1.5 py-0.5 rounded-md flex-shrink-0 shadow-sm">
                        x{item.quantity}
                      </span>
                    )}
                  </div>
                  
                  {/* Stat mods */}
                  {(() => {
                    const modText = formatStatMods(item.template.metadata)
                    return modText ? (
                      <div className="text-blue-400 text-sm font-bold mb-1">
                        {modText}
                      </div>
                    ) : null
                  })()}
                  
                  {/* Description */}
                  {item.template.description && (
                    <div className="text-gray-400 text-xs mb-2 line-clamp-2 leading-relaxed">
                      {item.template.description}
                    </div>
                  )}
                  
                  {/* Bottom row: Action buttons on left, value and drop/examine button on right */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                      {/* Unequip button - show if item is equipped */}
                      {item.isEquipped && (
                        <button
                          onClick={() => {
                            onClearNewItem?.(item.id)
                            onAction?.({
                              type: 'unequip_item',
                              data: { playerItemId: item.id },
                            })
                          }}
                          className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md"
                        >
                          <Icon name="equipment-shortsword" size={12} color="current" />
                          <span className="hidden sm:inline">Unequip</span>
                        </button>
                      )}
                      {/* Equip button - show if item has equipSlot and is not already equipped */}
                      {item.template.equipSlot !== null && !item.isEquipped && (
                        <button
                          onClick={() => {
                            onClearNewItem?.(item.id)
                            onAction?.({
                              type: 'equip_item',
                              data: { playerItemId: item.id },
                            })
                          }}
                          className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600/80 hover:bg-blue-600 rounded-md transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 shadow-sm hover:shadow-md"
                        >
                          <Icon name="equipment-shortsword" size={12} color="current" />
                          <span className="hidden sm:inline">Equip</span>
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
                          {itemAction.icon && (
                            <Icon
                              name={itemAction.icon}
                              size={12}
                              color="current"
                            />
                          )}
                          <span className="hidden sm:inline">{itemAction.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {itemValue > 0 && (
                        <span className="text-xs text-gray-400/70 font-medium">
                          {itemValue}
                        </span>
                      )}
                      <InventoryDropButton
                        item={item}
                        onDrop={(quantity) => {
                          onClearNewItem?.(item.id)
                          onAction?.({
                            type: 'drop_item',
                            data: { playerItemId: item.id, quantity },
                          })
                        }}
                        onExamine={() => {
                          onClearNewItem?.(item.id)
                          onAction?.({
                            type: 'examine_player_item',
                            data: { playerItemId: item.id },
                          })
                        }}
                        onItemAction={(action) => {
                          onClearNewItem?.(item.id)
                          onAction?.({
                            type: 'use_item',
                            data: { playerItemId: item.id, action },
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
