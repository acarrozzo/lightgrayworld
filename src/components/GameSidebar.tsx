'use client'

import { Player, useGameStore } from '@/lib/game-state'
import TabContainer, { TabConfig } from './TabContainer'
import { useMemo, useState } from 'react'
import AvatarSelectionModal from './AvatarSelectionModal'
import { DEFAULT_PLAYER_AVATAR, PlayerAvatar, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'

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

  const tabs: TabConfig[] = [
    {
      id: 'stats',
      label: 'Stats',
      icon: 'character',
      color: 'blue',
      content: (
        <div className="space-y-4 p-4">
          <div className="bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/50 border border-gray-800/70 rounded-3xl p-6 shadow-xl shadow-black/20 relative overflow-hidden">
            <div className="relative flex flex-row items-start gap-6">
              <div className="relative w-32 h-48 bg-gray-950/70 rounded-3xl border border-gray-800/80 flex items-center justify-center shadow-inner shadow-black/60 flex-shrink-0">
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
                <div className="space-y-1 text-left">
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

          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Core Points" value={player.cp ?? 0} />
            <StatBox label="Training Points" value={player.tp ?? 0} />
            <StatBox label="Skill Points" value={player.sp ?? 0} />
            <StatBox label="Gold" value={(player.currency ?? 0).toLocaleString()} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatBox label="PT" value={player.physicalTraining ?? 0} subtle />
            <StatBox label="MT" value={player.mentalTraining ?? 0} subtle />
          </div>
        </div>
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'inv',
      color: 'green',
      content: (
        <div className="space-y-4 p-4">
          <h3 className="text-lg font-semibold text-white">Inventory</h3>
          {(!inventory || inventory.length === 0) ? (
            <div className="text-gray-400 text-sm">
              Your inventory is empty.
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded bg-gray-800/40 px-3 py-2 gap-2"
                >
                  <div className="text-white text-sm font-medium">
                    {item.template.name}
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-gray-400 text-xs">x{item.quantity}</div>
                  )}
                  <button
                    className="px-2 py-1 text-xs bg-red-600/70 hover:bg-red-600 rounded text-white"
                    onClick={() =>
                      onAction?.({
                        type: 'drop_item',
                        data: { playerItemId: item.id, quantity: 1 },
                      })
                    }
                  >
                    Drop
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: 'attack',
      color: 'red',
      content: (
        <div className="space-y-4 p-4">
          <h3 className="text-lg font-semibold text-white">Skills & Spells</h3>
          <div className="text-gray-400 text-sm">
            No skills learned yet.
          </div>
        </div>
      ),
    },
    {
      id: 'quests',
      label: 'Quests',
      icon: 'inv',
      color: 'purple',
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
