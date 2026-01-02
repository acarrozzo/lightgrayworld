'use client'

import { Player, useGameStore, InventoryItem } from '@/lib/game-state'
import TabContainer, { TabConfig } from './TabContainer'
import { useMemo, useState, useEffect, useRef } from 'react'
import AvatarSelectionModal from './AvatarSelectionModal'
import StatAllocationModal from './StatAllocationModal'
import { DEFAULT_PLAYER_AVATAR, PlayerAvatar, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import Icon from './Icon'
import { ItemType, EquipSlot } from '@prisma/client'
import InventoryDisplay from './InventoryDisplay'

interface GameSidebarProps {
  player: Player
  onClose?: () => void
  onAction?: (action: string | { type: string; data?: any }) => void
}

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

  const tabs: TabConfig[] = [
    {
      id: 'stats',
      label: player.username || 'Stats',
      icon: 'character',
      color: 'purple',
      content: (
        <div className="space-y-4">
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
              <StatDisplay
                label="STR"
                core={player.str ?? 0}
                mod={player.strMod ?? 0}
              />
              <StatDisplay
                label="DEX"
                core={player.dex ?? 0}
                mod={player.dexMod ?? 0}
              />
              <StatDisplay
                label="MAG"
                core={player.mag ?? 0}
                mod={player.magMod ?? 0}
              />
              <StatDisplay
                label="DEF"
                core={player.def ?? 0}
                mod={player.defMod ?? 0}
              />
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
        <InventoryDisplay
          inventory={inventory}
          onAction={onAction}
          newItemIds={newItemIds}
          showNewItems={true}
        />
      ),
    },
    {
      id: 'quests',
      label: 'Quests',
      icon: 'trophy',
      color: 'gold',
      content: (
        <div className="space-y-4">
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

interface StatDisplayProps {
  label: string
  core: number
  mod: number
}

function StatDisplay({ label, core, mod }: StatDisplayProps) {
  const effective = core + mod
  
  return (
    <div className="rounded-2xl border border-gray-800/80 bg-gray-900/80 px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-semibold text-white mt-1">{effective}</p>
      <p className="text-xs text-gray-500 mt-0.5">{core}</p>
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
    const modText = formatStatMods(item.template.metadata)
    
    return (
      <button
        onClick={() => onUnequip(item.id)}
        className="rounded-lg border border-gray-800/80 bg-gray-900/80 px-3 py-2 text-left hover:bg-gray-800/80 transition-colors"
      >
        <p className="text-xs uppercase tracking-wide text-gray-400">{slotName}</p>
        <p className="text-sm font-medium text-white mt-0.5 truncate">{item.template.name}</p>
        {modText && (
          <p className="text-blue-400 text-xs mt-0.5">{modText}</p>
        )}
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
