'use client'

import { Player, useGameStore, InventoryItem } from '@/lib/game-state'
import TabContainer, { TabConfig } from './TabContainer'
import { useMemo, useState, useEffect, useRef } from 'react'
import AvatarSelectionModal from './AvatarSelectionModal'
import StatAllocationModal from './StatAllocationModal'
import { DEFAULT_PLAYER_AVATAR, PlayerAvatar, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import InventoryDropButton from './InventoryDropButton'
import { getItemActions } from '@/lib/item-actions'
import Icon from './Icon'
import { ItemType, EquipSlot } from '@prisma/client'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  getItemDisplayOrder,
  getCategoryDisplayName,
  CATEGORY_ORDER,
  getItemOrderIndex,
} from '@/lib/inventory-utils'

interface GameSidebarProps {
  player: Player
  onClose?: () => void
  onAction?: (action: string | { type: string; data?: any }) => void
}

export default function GameSidebar({ player, onClose, onAction }: GameSidebarProps) {
  const inventory = useGameStore((state) => state.inventory)
  const setPlayer = useGameStore((state) => state.setPlayer)
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const isLoggedIn = useGameStore((state) => state.isLoggedIn)
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isStatModalOpen, setStatModalOpen] = useState(false)
  const [newItemsCount, setNewItemsCount] = useState(0)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('stats')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ItemType>>(new Set())
  const previousInventoryRef = useRef<typeof inventory>([])
  const isInitialMountRef = useRef(true)
  const wasInventoryTabOpenRef = useRef(false) // Will be updated by useEffect

  const hpPercent = useMemo(() => {
    if (!player.hpMax) return 0
    return Math.min(100, Math.max(0, (player.hp / Math.max(player.hpMax, 1)) * 100))
  }, [player.hp, player.hpMax])

  const mpPercent = useMemo(() => {
    if (!player.mpMax) return 0
    return Math.min(100, Math.max(0, (player.mp / Math.max(player.mpMax, 1)) * 100))
  }, [player.mp, player.mpMax])

  const xpTarget = useMemo(() => {
    const nextLevel = Math.max(player.level + 1, 1)
    return nextLevel * nextLevel * 100
  }, [player.level])

  const xpCurrent = player.xp ?? 0
  const xpProgress = Math.min(100, Math.max(0, (xpCurrent / Math.max(xpTarget, 1)) * 100))
  const xpNeeded = Math.max(0, xpTarget - xpCurrent)
  const avatarKey = player.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = player.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatarSvg = useColoredAvatar(avatarKey, avatarColor)

  // Group equipped items by slot
  const equippedBySlot = useMemo(() => {
    const map = new Map<EquipSlot | null, typeof inventory[0]>()
    inventory
      .filter((item) => item.isEquipped === true)
      .forEach((item) => {
        if (item.slot) {
          map.set(item.slot as EquipSlot, item)
        }
      })
    return map
  }, [inventory])

  // Track inventory changes to detect new items
  useEffect(() => {
    // Skip on initial mount to avoid showing badge on load
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      previousInventoryRef.current = inventory
      return
    }

    const previousInventory = previousInventoryRef.current
    const currentInventory = inventory

    // Check if this is initial load (previous is empty, current has items)
    // This handles the case where inventory loads asynchronously after component mount
    const isInitialLoad = previousInventory.length === 0 && currentInventory.length > 0

    if (isInitialLoad) {
      // Just set the baseline without triggering badge
      previousInventoryRef.current = currentInventory
      return
    }

    // Check if inventory has new items (new item IDs or increased quantities)
    const previousItemIds = new Set(previousInventory.map(item => item.id))
    const previousItemQuantities = new Map(
      previousInventory.map(item => [item.id, item.quantity])
    )

    const newlyAddedItemIds = new Set<string>()
    let newItemsAddedCount = 0

    // Check for new item IDs and quantity increases
    for (const item of currentInventory) {
      if (!previousItemIds.has(item.id)) {
        // Completely new item
        newlyAddedItemIds.add(item.id)
        newItemsAddedCount += item.quantity
      } else {
        // Check if quantity increased (new items of same type)
        const previousQty = previousItemQuantities.get(item.id) || 0
        if (item.quantity > previousQty) {
          const quantityIncrease = item.quantity - previousQty
          newlyAddedItemIds.add(item.id)
          newItemsAddedCount += quantityIncrease
        }
      }
    }

    // Only update badge and new items if new items were added AND inventory tab is not active
    if (newItemsAddedCount > 0 && activeTab !== 'inventory') {
      setNewItemsCount(prev => prev + newItemsAddedCount)
      setNewItemIds(prev => {
        const updated = new Set(prev)
        newlyAddedItemIds.forEach(id => updated.add(id))
        return updated
      })
    }

    // Update previous inventory reference
    previousInventoryRef.current = inventory
  }, [inventory, activeTab])

  // Track when inventory tab opens/closes to clear new items indicators
  useEffect(() => {
    const isInventoryTabOpen = activeTab === 'inventory'
    const wasOpen = wasInventoryTabOpenRef.current

    // When inventory tab opens, clear the badge count
    if (!wasOpen && isInventoryTabOpen) {
      setNewItemsCount(0)
    }

    // When inventory tab closes (was open, now closed), clear red dots on items
    if (wasOpen && !isInventoryTabOpen) {
      setNewItemIds(new Set())
    }

    wasInventoryTabOpenRef.current = isInventoryTabOpen
  }, [activeTab])

  // Handle tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
  }

  const handleAvatarUpdate = async (avatar: PlayerAvatar, color: string) => {
    if (!isLoggedIn || !player.id) {
      setAvatarModalOpen(false)
      return
    }

    try {
      setIsSavingAvatar(true)
      const response = await fetch('/api/user/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ avatar, color }),
      })

      if (!response.ok) {
        throw new Error('Failed to update avatar')
      }

      const data = await response.json()
      if (data?.player) {
        setPlayer(data.player)
      } else {
        setPlayer({ ...player, uIcon: avatar, uIconColor: color })
      }
      setAvatarModalOpen(false)
    } catch (error) {
      console.error('Avatar update failed:', error)
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleStatAllocated = (updatedPlayer: Player) => {
    setPlayer(updatedPlayer)
  }

  // Get item display order map (memoized)
  const itemOrderMap = useMemo(() => getItemDisplayOrder(), [])

  // Group and sort inventory items by category
  const categorizedInventory = useMemo(() => {
    if (!inventory || inventory.length === 0) {
      return new Map<ItemType, typeof inventory>()
    }

    // Group items by type
    const grouped = new Map<ItemType, typeof inventory>()
    
    for (const item of inventory) {
      const itemType = (item.template.type as ItemType) || ItemType.MISC
      if (!grouped.has(itemType)) {
        grouped.set(itemType, [])
      }
      grouped.get(itemType)!.push(item)
    }

    // Sort items within each category by seed.ts order
    for (const [type, items] of grouped.entries()) {
      items.sort((a, b) => {
        const orderA = getItemOrderIndex(a.template.slug, itemOrderMap)
        const orderB = getItemOrderIndex(b.template.slug, itemOrderMap)
        
        // If both have same order (or both missing), sort alphabetically by name
        if (orderA === orderB) {
          return a.template.name.localeCompare(b.template.name)
        }
        
        return orderA - orderB
      })
    }

    return grouped
  }, [inventory, itemOrderMap])

  // Toggle category collapse state
  const toggleCategory = (category: ItemType) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const tabs: TabConfig[] = [
    {
      id: 'stats',
      label: player.username || 'Stats',
      icon: 'character',
      color: 'purple',
      content: (
        <div className="space-y-4 p-4">
          <div className="">
            <div className="relative flex flex-row items-start gap-6">
              <div className="relative w-36 h-52 bg-gray-950/70 rounded-3xl border border-gray-800/80 flex items-center justify-center shadow-inner shadow-black/60 flex-shrink-0">
                {coloredAvatarSvg ? (
                  <div
                    className="w-28 h-44"
                    dangerouslySetInnerHTML={{ __html: coloredAvatarSvg }}
                  />
                ) : (
                  <div className="text-gray-500 text-sm">Loading avatar...</div>
                )}
                <button
                  type="button"
                  className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-indigo-600/80 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 transition-all"
                  onClick={() => setAvatarModalOpen(true)}
                  disabled={!isLoggedIn}
                >
                  {isLoggedIn ? 'Edit' : 'Login to edit'}
                </button>
              </div>

              <div className="flex-1 w-full space-y-3">
                <div className="space-y-0 text-left">
                  <div className="text-xs uppercase tracking-[0.3em] text-indigo-300/80">lvl {player.level}</div>
                  <h3 className="text-2xl font-semibold text-white">{player.username}</h3>
                  <p className="text-sm text-gray-400">Room: {player.currentRoom || '???'}</p>
                </div>

                <div className="space-y-3">
                  <StatBar
                    label="HP"
                    value={`${player.hp}/${player.hpMax}`}
                    percentage={hpPercent}
                    gradient="from-rose-500 via-red-500 to-rose-600"
                  />
                  <StatBar
                    label="MP"
                    value={`${player.mp}/${player.mpMax}`}
                    percentage={mpPercent}
                    gradient="from-sky-500 via-blue-500 to-indigo-500"
                  />
                  <StatBar
                    label="XP"
                    value={`${xpCurrent.toLocaleString()} need ${xpNeeded.toLocaleString()}`}
                    percentage={xpProgress}
                    gradient="from-amber-400 via-yellow-400 to-orange-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Core Points" value={player.cp ?? 0} />
            <StatBox label="Training Points" value={player.tp ?? 0} />
            <StatBox label="Skill Points" value={player.sp ?? 0} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatBox label="PT" value={player.physicalTraining ?? 0} subtle />
            <StatBox label="MT" value={player.mentalTraining ?? 0} subtle />
          </div>

          <div>
            <StatBox label="Gold" value={(player.currency ?? 0).toLocaleString()} />
          </div>

          {/* Equipment Display */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Equipment</h4>
            <div className="grid grid-cols-2 gap-2">
              {/* Row 1: MAIN_HAND, OFF_HAND */}
              <EquipmentSlot
                slot={EquipSlot.MAIN_HAND}
                item={equippedBySlot.get(EquipSlot.MAIN_HAND)}
                onUnequip={(playerItemId) =>
                  onAction?.({
                    type: 'unequip_item',
                    data: { playerItemId },
                  })
                }
              />
              <EquipmentSlot
                slot={EquipSlot.OFF_HAND}
                item={equippedBySlot.get(EquipSlot.OFF_HAND)}
                onUnequip={(playerItemId) =>
                  onAction?.({
                    type: 'unequip_item',
                    data: { playerItemId },
                  })
                }
              />
              {/* Row 2: HEAD, BODY */}
              <EquipmentSlot
                slot={EquipSlot.HEAD}
                item={equippedBySlot.get(EquipSlot.HEAD)}
                onUnequip={(playerItemId) =>
                  onAction?.({
                    type: 'unequip_item',
                    data: { playerItemId },
                  })
                }
              />
              <EquipmentSlot
                slot={EquipSlot.BODY}
                item={equippedBySlot.get(EquipSlot.BODY)}
                onUnequip={(playerItemId) =>
                  onAction?.({
                    type: 'unequip_item',
                    data: { playerItemId },
                  })
                }
              />
              {/* Row 3: HANDS, FEET */}
              <EquipmentSlot
                slot={EquipSlot.HANDS}
                item={equippedBySlot.get(EquipSlot.HANDS)}
                onUnequip={(playerItemId) =>
                  onAction?.({
                    type: 'unequip_item',
                    data: { playerItemId },
                  })
                }
              />
              <EquipmentSlot
                slot={EquipSlot.FEET}
                item={equippedBySlot.get(EquipSlot.FEET)}
                onUnequip={(playerItemId) =>
                  onAction?.({
                    type: 'unequip_item',
                    data: { playerItemId },
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Core Stats</h4>
              {(player.cp ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setStatModalOpen(true)}
                  disabled={!isLoggedIn}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600/80 hover:bg-indigo-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 rounded-lg transition-colors"
                >
                  Spend Core Points ({player.cp ?? 0})
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="STR" value={player.str ?? 0} />
              <StatBox label="DEX" value={player.dex ?? 0} />
              <StatBox label="MAG" value={player.mag ?? 0} />
              <StatBox label="DEF" value={player.def ?? 0} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'inv',
      color: 'green',
      badge: newItemsCount > 0 ? newItemsCount : undefined,
      content: (
        <div className="space-y-4 p-4">
          <h3 className="text-lg font-semibold text-white">Inventory</h3>
          {(!inventory || inventory.length === 0) ? (
            <div className="text-gray-400 text-sm">
              Your inventory is empty.
            </div>
          ) : (
            <div className="space-y-3">
              {CATEGORY_ORDER.map((categoryType) => {
                const categoryItems = categorizedInventory.get(categoryType) || []
                const isCollapsed = collapsedCategories.has(categoryType)
                const categoryName = getCategoryDisplayName(categoryType)
                
                return (
                  <div key={categoryType} className="space-y-2">
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(categoryType)}
                      className="w-full flex items-center justify-between px-2 py-2 hover:bg-gray-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight size={16} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={16} className="text-gray-400" />
                        )}
                        <span className="text-sm font-semibold text-gray-300">
                          {categoryName} ({categoryItems.length})
                        </span>
                      </div>
                    </button>
                    
                    {/* Category Items */}
                    {!isCollapsed && categoryItems.length > 0 && (
                      <div className="space-y-2">
                        {categoryItems.map((item) => {
                          const isNewItem = newItemIds.has(item.id)
                          const itemActions = item.template.slug ? getItemActions(item.template.slug) : []
                          const itemValue = item.template.value ?? 0
                          // Try to get icon from metadata, fallback to slug, or use a default
                          const metadata = item.template.metadata as { icon?: string } | null
                          const itemIcon = metadata?.icon || item.template.slug || 'inv'
                          
                          return (
                            <div
                              key={item.id}
                              className="relative rounded-md border border-gray-700/30 bg-gray-800/20 px-2.5 py-2.5 hover:bg-gray-800/40 hover:border-gray-700/50 hover:shadow-sm transition-all duration-200 flex gap-2"
                            >
                              {isNewItem && (
                                <span className="absolute left-1 top-1 w-1.5 h-1.5 bg-red-500 rounded-full z-10"></span>
                              )}
                              
                              {/* Item icon on the left */}
                              <div className="flex-shrink-0 pt-0.5">
                                <Icon
                                  name={itemIcon}
                                  size={32}
                                  color="current"
                                  className="text-gray-600"
                                />
                              </div>
                              
                              {/* Content area */}
                              <div className="flex-1 min-w-0">
                                {/* Top row: Item name with quantity */}
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className={`text-white text-sm font-medium truncate min-w-0 ${isNewItem ? 'pl-2' : ''}`}>
                                    {item.template.name}
                                  </div>
                                  {item.quantity > 1 && (
                                    <span className="text-gray-200 text-xs font-medium border border-gray-700/50 bg-gray-700/50 px-1.5 py-0.5 rounded flex-shrink-0">
                                      x{item.quantity}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Description */}
                                {item.template.description && (
                                  <div className="text-gray-500 text-xs mb-1.5 line-clamp-2">
                                    {item.template.description}
                                  </div>
                                )}
                                
                                {/* Equip Slot */}
                                {item.template.equipSlot && (
                                  <div className="text-blue-400 text-xs mb-1.5">
                                    Equips to: {item.template.equipSlot.replace(/_/g, ' ')}
                                  </div>
                                )}
                                
                                {/* Bottom row: Action buttons on left, value and drop/examine button on right */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {/* Equip button - show if item has equipSlot and is not already equipped */}
                                    {item.template.equipSlot !== null && !item.isEquipped && (
                                      <button
                                        onClick={() =>
                                          onAction?.({
                                            type: 'equip_item',
                                            data: { playerItemId: item.id },
                                          })
                                        }
                                        className="px-2 py-1 text-xs font-medium text-white bg-blue-600/70 hover:bg-blue-600 rounded transition-colors flex items-center gap-1 flex-shrink-0"
                                      >
                                        <Icon name="equipment-shortsword" size={12} color="current" />
                                        <span className="hidden sm:inline">Equip</span>
                                      </button>
                                    )}
                                    {itemActions.map((itemAction) => (
                                      <button
                                        key={itemAction.action}
                                        onClick={() =>
                                          onAction?.({
                                            type: 'use_item',
                                            data: { playerItemId: item.id, action: itemAction.action },
                                          })
                                        }
                                        className={`px-2.5 py-2 rounded text-xs text-white transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                                          itemAction.className || 'bg-indigo-600/70 hover:bg-indigo-600'
                                        }`}
                                        title={itemAction.label}
                                      >
                                        {itemAction.icon && (
                                          <Icon
                                            name={itemAction.icon}
                                            size={14}
                                            color="current"
                                          />
                                        )}
                                        <span className="hidden sm:inline">{itemAction.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {itemValue > 0 && (
                                      <span className="text-[10px] text-gray-500/60">
                                        {itemValue}
                                      </span>
                                    )}
                                    <InventoryDropButton
                                      item={item}
                                      onDrop={(quantity) =>
                                        onAction?.({
                                          type: 'drop_item',
                                          data: { playerItemId: item.id, quantity },
                                        })
                                      }
                                      onExamine={() =>
                                        onAction?.({
                                          type: 'examine_player_item',
                                          data: { playerItemId: item.id },
                                        })
                                      }
                                      onItemAction={(action) =>
                                        onAction?.({
                                          type: 'use_item',
                                          data: { playerItemId: item.id, action },
                                        })
                                      }
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
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'quests',
      label: 'Quests',
      icon: 'trophy',
      color: 'gold',
      content: (
        <div className="space-y-4 p-4">
          <h3 className="text-lg font-semibold text-white">Quests</h3>
          <div className="text-gray-400 text-sm">
            No active quests.
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      <TabContainer
        tabs={tabs}
        defaultTab="stats"
        onClose={onClose}
        onTabChange={handleTabChange}
        closeButtonPlacement="separate"
        closeButtonBreakpoint="xl"
        contentClassName="p-4"
      />

      <AvatarSelectionModal
        isOpen={isAvatarModalOpen}
        currentAvatar={avatarKey}
        currentColor={avatarColor}
        isSaving={isSavingAvatar}
        onClose={() => (isSavingAvatar ? null : setAvatarModalOpen(false))}
        onSelectAvatar={handleAvatarUpdate}
      />
      <StatAllocationModal
        isOpen={isStatModalOpen}
        player={player}
        onClose={() => setStatModalOpen(false)}
        onStatAllocated={handleStatAllocated}
      />
    </>
  )
}

interface StatBarProps {
  label: string
  value: string
  percentage: number
  gradient: string
}

function StatBar({ label, value, percentage, gradient }: StatBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-white font-medium">{value}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-800/80 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface StatBoxProps {
  label: string
  value: number | string
  subtle?: boolean
}

function StatBox({ label, value, subtle = false }: StatBoxProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-center ${subtle ? 'border-gray-800/70 bg-gray-900/60' : 'border-gray-800/80 bg-gray-900/80'}`}>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-white mt-1">{value}</p>
    </div>
  )
}

interface EquipmentSlotProps {
  slot: EquipSlot
  item?: InventoryItem
  onUnequip: (playerItemId: string) => void
}

function EquipmentSlot({ slot, item, onUnequip }: EquipmentSlotProps) {
  const slotName = slot.replace(/_/g, ' ')
  
  if (item) {
    return (
      <button
        onClick={() => onUnequip(item.id)}
        className="rounded-lg border border-gray-800/80 bg-gray-900/80 px-3 py-2 text-left hover:bg-gray-800/80 transition-colors"
      >
        <p className="text-xs uppercase tracking-wide text-gray-400">{slotName}</p>
        <p className="text-sm font-medium text-white mt-0.5 truncate">{item.template.name}</p>
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-gray-800/70 bg-gray-900/60 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-gray-400">{slotName}</p>
      <p className="text-sm text-gray-500 mt-0.5">- - -</p>
    </div>
  )
}
