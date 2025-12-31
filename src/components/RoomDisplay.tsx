'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import { getRoomActions } from '@/lib/room-actions'
import { DEFAULT_AVATAR_COLOR, DEFAULT_PLAYER_AVATAR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import ItemDropdownButton from './ItemDropdownButton'
import Icon from './Icon'

interface RoomDisplayProps {
  room: any
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction?: (action: string | { type: string; data?: any }) => void | Promise<void>
  showHeader?: boolean
  className?: string
  showPlayers?: boolean
  worldTick?: {
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  }
  actionResult?: any
}

export default function RoomDisplay({
  room,
  onAction,
  roomPlayers = [],
  currentPlayerId,
  showHeader = true,
  className,
  showPlayers = true,
  worldTick,
  actionResult,
}: RoomDisplayProps) {
  const [isPerformingAction, setIsPerformingAction] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [remainingCap, setRemainingCap] = useState<number | null>(null)
  const [maxCap, setMaxCap] = useState<number | null>(null)
  const [fallbackSecondsUntilReset, setFallbackSecondsUntilReset] = useState<number | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const lastTickRef = useRef<number | null>(null)

  const otherUsers = useMemo(
    () => roomPlayers.filter((player) => player.id !== currentPlayerId),
    [roomPlayers, currentPlayerId]
  )

  const capConfig = useMemo(() => {
    if (!room?.roomId) return null
    if (room.roomId === '002') {
      return { action: 'pick redberry', maxPerTick: 5 }
    }
    if (room.roomId === '005') {
      return { action: 'pick blueberry', maxPerTick: 3 }
    }
    return null
  }, [room?.roomId])

  // Extract and pluralize item name from action (e.g., "pick redberry" -> "redberries")
  const getItemNamePlural = (action: string): string => {
    if (!action) return ''
    const itemName = action.replace(/^pick\s+/i, '')
    // Handle berry -> berries, otherwise just add 's'
    if (itemName.endsWith('berry')) {
      return itemName.replace(/berry$/, 'berries')
    }
    return `${itemName}s`
  }

  // Format time remaining: hours+minutes if >= 60min, minutes+seconds if < 60min
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return '0s'
    
    const totalMinutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      if (minutes > 0) {
        return `${hours}h ${minutes}m`
      }
      return `${hours}h`
    }
    
    if (totalMinutes > 0) {
      if (remainingSeconds > 0) {
        return `${totalMinutes}m ${remainingSeconds}s`
      }
      return `${totalMinutes}m`
    }
    
    return `${remainingSeconds}s`
  }

  // Set maxCap when capConfig changes
  useEffect(() => {
    if (capConfig) {
      setMaxCap(capConfig.maxPerTick)
    } else {
      setMaxCap(null)
      setRemainingCap(null)
    }
  }, [capConfig])

  // Track mount state to prevent hydration mismatches
  // Use useLayoutEffect for faster initialization on client
  useLayoutEffect(() => {
    setIsMounted(true)
  }, [])

  // Initialize countdown from room.worldTick if worldTick prop is not available
  useEffect(() => {
    if (!isMounted) return // Only run on client after mount
    if (worldTick?.nextTickAt) {
      // If we have worldTick prop, clear any room-based countdown
      return
    }
    
    const roomWorldTick = (room as any)?.worldTick
    if (!roomWorldTick || !roomWorldTick.nextTickAt) {
      // Clear countdown if no worldTick data available
      setCountdownSeconds(null)
      return
    }
    
    const updateCountdown = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((roomWorldTick.nextTickAt - now) / 1000))
      setCountdownSeconds(remaining)
    }
    
    // Update immediately
    updateCountdown()
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [room, worldTick, isMounted])

  // Consolidated state management for remainingCap with priority order:
  // 1. actionResult.data.remaining (highest priority - most recent from action execution)
  // 2. room.actionCaps[actionKey] (from API response)
  // 3. Reset to maxPerTick when world tick increments (only if we have confirmed tick data)
  // 4. null if no data available (show loading state)
  useEffect(() => {
    if (!capConfig) {
      setRemainingCap(null)
      return
    }

    const actionKey = capConfig.action

    // Priority 1: Action result (most recent, from action execution)
    if (actionResult?.action === actionKey && typeof actionResult?.data?.remaining === 'number') {
      setRemainingCap(actionResult.data.remaining)
      // Store secondsUntilReset from action result as fallback for countdown display
      const secondsUntilReset = actionResult.data.secondsUntilReset
      if (typeof secondsUntilReset === 'number') {
        setFallbackSecondsUntilReset(secondsUntilReset)
      }
      return
    }

    // Priority 2: API data from room.actionCaps
    const fetchedRemaining = (room as any)?.actionCaps?.[actionKey]
    if (typeof fetchedRemaining === 'number') {
      setRemainingCap(fetchedRemaining)
      return
    }

    // Priority 3: Tick reset (only if we have confirmed tick data and detect increment)
    // Only reset if we already have API data to avoid flicker when entering room
    if (worldTick && worldTick.tickNumber !== undefined) {
      if (lastTickRef.current !== null && worldTick.tickNumber !== lastTickRef.current) {
        // Tick has incremented
        // Only reset to maxPerTick if we have API data (room.actionCaps exists)
        // This prevents flicker when entering a room right after tick increment
        // If we don't have API data yet, wait for it rather than optimistically resetting
        if (typeof fetchedRemaining === 'number') {
          setRemainingCap(capConfig.maxPerTick)
        }
      }
      lastTickRef.current = worldTick.tickNumber
      return
    }

    // Priority 4: No data available - keep as null (will show loading state)
    // Don't set anything, let it remain null
  }, [capConfig, room, actionResult, worldTick])

  // Handle countdown timer from worldTick prop
  useEffect(() => {
    if (!isMounted) return // Only run on client after mount
    if (!worldTick || !worldTick.nextTickAt) return
    
    const updateCountdown = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((worldTick.nextTickAt - now) / 1000))
      setCountdownSeconds(remaining)
      // Clear fallback when we have real tick data
      setFallbackSecondsUntilReset(null)
    }
    
    // Update immediately
    updateCountdown()
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [worldTick, isMounted])

  // Update fallback countdown when worldTick is not available
  useEffect(() => {
    if (!isMounted) return // Only run on client after mount
    if (worldTick || fallbackSecondsUntilReset === null) return
    
    const updateFallback = () => {
      setFallbackSecondsUntilReset((prev) => {
        if (prev === null || prev <= 0) return null
        return Math.max(0, prev - 1)
      })
    }
    
    const interval = setInterval(updateFallback, 1000)
    return () => clearInterval(interval)
  }, [worldTick, fallbackSecondsUntilReset, isMounted])
  
  if (!room) {
    return (
      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
        <div className="text-gray-400">Loading room...</div>
      </div>
    )
  }

  const roomActions = getRoomActions(room.roomId)

  const handleAction = async (action: string) => {
    if (!onAction || isPerformingAction) return
    
    setIsPerformingAction(action)
    try {
      await onAction(action)
    } catch (error) {
      console.error('Room action error:', error)
    } finally {
      setIsPerformingAction(null)
    }
  }

  const shouldShowCap = Boolean(capConfig && maxCap)

  // Filter out berry actions from the main action buttons list
  const filteredRoomActions = useMemo(() => {
    if (!capConfig) return roomActions
    return roomActions.filter((actionItem) => actionItem.action !== capConfig.action)
  }, [roomActions, capConfig])

  // Get the berry action for the button inside the container
  const berryAction = useMemo(() => {
    if (!capConfig) return null
    return roomActions.find((actionItem) => actionItem.action === capConfig.action)
  }, [roomActions, capConfig])

  // Determine border color based on berry type
  const getBerryBorderColor = (): string => {
    if (!capConfig) return 'border-red-500/40'
    if (capConfig.action === 'pick redberry') return 'border-red-500/40'
    if (capConfig.action === 'pick blueberry') return 'border-blue-500/40'
    return 'border-red-500/40'
  }

  // Determine text color based on berry type
  const getBerryTextColor = (): string => {
    if (!capConfig) return 'text-red-200'
    if (capConfig.action === 'pick redberry') return 'text-red-200'
    if (capConfig.action === 'pick blueberry') return 'text-blue-200'
    return 'text-red-200'
  }

  // Determine spinner color based on berry type
  const getBerrySpinnerColor = (): string => {
    if (!capConfig) return 'text-red-500'
    if (capConfig.action === 'pick redberry') return 'text-red-500'
    if (capConfig.action === 'pick blueberry') return 'text-blue-500'
    return 'text-red-500'
  }

  const handlePickupItem = async (item: any, quantity: number = 1) => {
    if (!onAction || isPerformingAction) return

    const actionPayload = {
      type: 'pickup_item',
      data: {
        roomItemId: item.id,
        quantity,
      },
    }

    setIsPerformingAction(`pickup-${item.id}`)
    try {
      await onAction(actionPayload)
    } catch (error) {
      console.error('Room pickup error:', error)
    } finally {
      setIsPerformingAction(null)
    }
  }

  const handleExamineItem = async (item: any) => {
    if (!onAction || isPerformingAction) return

    const actionPayload = {
      type: 'examine_item',
      data: {
        roomItemId: item.id,
      },
    }

    setIsPerformingAction(`examine-${item.id}`)
    try {
      await onAction(actionPayload)
    } catch (error) {
      console.error('Room examine error:', error)
    } finally {
      setIsPerformingAction(null)
    }
  }

  const handleInspectPlayer = async (player: Player) => {
    if (!onAction || isPerformingAction) return

    const inspectAction = `look at ${player.username}`

    setIsPerformingAction(inspectAction)
    try {
      await onAction(inspectAction)
    } catch (error) {
      console.error('Room inspect error:', error)
    } finally {
      setIsPerformingAction(null)
    }
  }

  return (
    <div className={`roomboxActions ${className || ''}`}>
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">{room.subtitle}</div>
            <div className="text-xl font-semibold text-white">{room.name}</div>
          </div>
          <div className="text-xs text-gray-500">Room {room.roomId}</div>
        </div>
      )}

      {shouldShowCap && (
        <div className={`mt-3 relative flex items-center gap-3 p-3 rounded-md bg-gray-900/70 border ${getBerryBorderColor()}`}>
          {remainingCap === null ? (
            // Loading state: show centered spinner, hide content
            <div className="flex items-center justify-center w-full py-2">
              <Loader2 className={`h-6 w-6 animate-spin ${getBerrySpinnerColor()}`} />
            </div>
          ) : (
            // Normal state: show button and text
            <>
              {berryAction && (
                <button
                  onClick={() => handleAction(berryAction.action)}
                  disabled={isPerformingAction === berryAction.action}
                  className={`px-3 py-2 rounded-md text-sm text-white transition-colors flex-shrink-0 flex items-center gap-2 ${
                    isPerformingAction === berryAction.action
                      ? 'bg-gray-700 cursor-wait'
                      : berryAction.className || 'bg-indigo-600 hover:bg-indigo-500'
                  } ${remainingCap === 0 ? 'opacity-50' : ''}`}
                >
                  {berryAction.icon && <Icon name={berryAction.icon} size={16} color="current" />}
                  {berryAction.label}
                </button>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`text-sm ${getBerryTextColor()}`}>
                  Available {getItemNamePlural(capConfig?.action || '')}:{' '}
                  <span className="font-semibold text-white">
                    {remainingCap}/{maxCap ?? 0}
                  </span>
                </div>
                <div className="text-sm text-gray-300">
                  Refresh in:{' '}
                  <span className="font-semibold">
                    {(() => {
                      // Use countdown from worldTick (prop or room data) if available
                      if (countdownSeconds !== null) {
                        return formatTimeRemaining(countdownSeconds)
                      }
                      // Fall back to secondsUntilReset from action result (same as feed message)
                      if (fallbackSecondsUntilReset !== null) {
                        return formatTimeRemaining(fallbackSecondsUntilReset)
                      }
                      return '...'
                    })()}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {filteredRoomActions.map((actionItem) => {
          const isViewShop = actionItem.action === 'view shop'
          return (
            <button
              key={actionItem.action}
              onClick={() => handleAction(actionItem.action)}
              disabled={isPerformingAction === actionItem.action}
              className={`${
                isViewShop
                  ? 'px-4 py-3 rounded-md text-base font-semibold text-white transition-all flex items-center gap-2 border-2 border-amber-400/50 shadow-lg hover:shadow-xl'
                  : 'px-3 py-2 rounded-md text-sm text-white transition-colors flex items-center gap-2'
              } ${
                isPerformingAction === actionItem.action
                  ? 'bg-gray-700 cursor-wait'
                  : actionItem.className || 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {actionItem.icon && (
                <Icon
                  name={actionItem.icon}
                  size={isViewShop ? 20 : 16}
                  color="current"
                />
              )}
              {actionItem.label}
            </button>
          )
        })}
      </div>

      {room.items && room.items.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-300 mb-2">Items here:</div>
          <div className="flex flex-wrap gap-2">
            {room.items.map((item: any) => (
              <ItemDropdownButton
                key={item.id}
                item={item}
                onPickup={(quantity) => handlePickupItem(item, quantity)}
                onExamine={() => handleExamineItem(item)}
                disabled={
                  isPerformingAction === `pickup-${item.id}` ||
                  isPerformingAction === `examine-${item.id}`
                }
              />
            ))}
          </div>
        </div>
      )}

      {showPlayers && otherUsers.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-300 mb-2">Others here:</div>
          <div className="flex flex-wrap gap-3">
            {otherUsers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onInspect={() => handleInspectPlayer(player)}
                disabled={isPerformingAction === `look at ${player.username}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface PlayerCardProps {
  player: Player
  onInspect: () => void
  disabled?: boolean
}

function PlayerCard({ player, onInspect, disabled }: PlayerCardProps) {
  const avatarKey = player.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = player.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatar = useColoredAvatar(avatarKey, avatarColor)

  return (
    <button
      type="button"
      onClick={onInspect}
      disabled={disabled}
      className="group flex items-center gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-2.5 py-1.5 text-left text-white transition-all hover:border-violet-400 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden"
    >
      <div className="flex h-12 w-8 items-center justify-center">
        {coloredAvatar ? (
          <div
            className="h-12 w-8"
            dangerouslySetInnerHTML={{ __html: coloredAvatar }}
          />
        ) : (
          <span className="text-[10px] text-violet-200/70">...</span>
        )}
      </div>
      <div className="leading-tight">
        <div className="text-xs font-semibold text-white/90 truncate max-w-[110px]">{player.username}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-violet-200/80">Lvl {player.level}</div>
      </div>
    </button>
  )
}