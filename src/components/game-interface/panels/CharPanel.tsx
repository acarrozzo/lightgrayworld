'use client'

import { Player, useGameStore, InventoryItem } from '@/lib/game-state'
import React, { useMemo, useState } from 'react'
import AvatarSelectionModal from '@/components/AvatarSelectionModal'
import StatAllocationModal from '@/components/StatAllocationModal'
import { DEFAULT_PLAYER_AVATAR, PlayerAvatar, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { EquipSlot } from '@prisma/client'

type FilterTab = 'all' | 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'consumables' | 'misc'

interface CharPanelProps {
  player: Player
  onAction?: (action: string | { type: string; data?: any }) => void
  onSwitchToInventory?: (filter?: FilterTab) => void
  onClose?: () => void
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

export default function CharPanel({ player, onAction, onSwitchToInventory, onClose }: CharPanelProps) {
  const inventory = useGameStore((state) => state.inventory)
  const setPlayer = useGameStore((state) => state.setPlayer)
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const isLoggedIn = useGameStore((state) => state.isLoggedIn)
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false)
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isStatModalOpen, setStatModalOpen] = useState(false)

  const hpPercent = useMemo(() => {
    if (!player.hpMax) return 0
    return Math.min(100, Math.max(0, (player.hp / Math.max(player.hpMax, 1)) * 100))
  }, [player.hp, player.hpMax])

  const mpPercent = useMemo(() => {
    if (!player.mpMax) return 0
    return Math.min(100, Math.max(0, (player.mp / Math.max(player.mpMax, 1)) * 100))
  }, [player.mp, player.mpMax])

  const { xpInLevel, xpRange, xpPct } = useMemo(() => {
    const level = player.level ?? 1
    const xpFromLevel = (level ** 3) * 2
    const xpForLevel = ((level + 1) ** 3) * 2
    const xpInLevel = Math.max(0, (player.xp ?? 0) - xpFromLevel)
    const xpRange = xpForLevel - xpFromLevel
    const xpPct = Math.min(100, Math.floor((xpInLevel / Math.max(xpRange, 1)) * 100))
    return { xpInLevel, xpRange, xpPct }
  }, [player.level, player.xp])
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

  // Map EquipSlot to FilterTab
  const getFilterForSlot = (slot: EquipSlot): FilterTab => {
    switch (slot) {
      case EquipSlot.MAIN_HAND:
        return 'main'
      case EquipSlot.OFF_HAND:
        return 'off'
      case EquipSlot.HEAD:
        return 'head'
      case EquipSlot.BODY:
        return 'body'
      case EquipSlot.HANDS:
        return 'hands'
      case EquipSlot.FEET:
        return 'feet'
      default:
        return 'all'
    }
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

  return (
    <>
      <div className="relative w-full h-full">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
            title="Close"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
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
                      value={<span className="text-white">{player.hp}/{player.hpMax}</span>}
                      percentage={hpPercent}
                      gradient="from-rose-500 via-red-500 to-rose-600"
                    />
                    <StatBar
                      label="MP"
                      value={<span className="text-white">{player.mp}/{player.mpMax}</span>}
                      percentage={mpPercent}
                      gradient="from-sky-500 via-blue-500 to-indigo-500"
                    />
                    <StatBar
                      label="XP"
                      value={<><span className="text-gray-400">{player.xp ?? 0}</span> <span className="text-green-400">{xpPct}%</span></>}
                      percentage={xpPct}
                      gradient="from-green-500 via-emerald-500 to-green-600"
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

            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Clicks" value={(player.clicks ?? 0).toLocaleString()} subtle />
              <StatBox label="Deaths" value={(player.deaths ?? 0).toLocaleString()} subtle />
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
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.MAIN_HAND))}
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
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.OFF_HAND))}
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
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.HEAD))}
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
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.BODY))}
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
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.HANDS))}
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
                  onSwitchToInventory={() => onSwitchToInventory?.(getFilterForSlot(EquipSlot.FEET))}
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
        </div>
      </div>

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
  value: React.ReactNode
  percentage: number
  gradient: string
}

function StatBar({ label, value, percentage, gradient }: StatBarProps) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
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
  onSwitchToInventory?: () => void
}

function EquipmentSlot({ slot, item, onUnequip, onSwitchToInventory }: EquipmentSlotProps) {
  const slotName = slot.replace(/_/g, ' ')
  
  if (item) {
    const modText = formatStatMods(item.template.metadata)
    
    return (
      <button
        onClick={() => onSwitchToInventory?.()}
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
    <button
      onClick={() => onSwitchToInventory?.()}
      className="rounded-lg border border-gray-800/70 bg-gray-900/60 px-3 py-2 text-left hover:bg-gray-800/60 hover:border-gray-700/70 transition-colors cursor-pointer"
    >
      <p className="text-xs uppercase tracking-wide text-gray-400">{slotName}</p>
      <p className="text-sm text-gray-500 mt-0.5">- - -</p>
    </button>
  )
}
