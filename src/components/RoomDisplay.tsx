'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Player } from '@/lib/game-state'
import { useGameStore } from '@/lib/game-state'
import { getRoomActions } from '@/lib/room-actions'
import { DEFAULT_AVATAR_COLOR, DEFAULT_PLAYER_AVATAR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import ItemDropdownButton from './ItemDropdownButton'
import Icon from './Icon'
import NpcQuestCard from './NpcQuestCard'

type CapStatus = 'known' | 'loading' | 'error' | 'unavailable'

type QuestProgress = { id: string; questId: string; progress: number; completed: boolean; data?: { accepted?: boolean } | null }


interface RoomDisplayProps {
  room: any
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction?: (action: string | { type: string; data?: any }) => void | Promise<void>
  onOpenPlayerProfile?: (player: Player) => void
  onRefreshCaps?: () => void | Promise<void>
  showHeader?: boolean
  className?: string
  showPlayers?: boolean
  worldTick?: {
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  }
  actionResult?: any
  quests?: QuestProgress[]
  killList?: { monster: string; kills: number }[]
}

export default function RoomDisplay({
  room,
  onAction,
  onOpenPlayerProfile,
  onRefreshCaps,
  roomPlayers = [],
  currentPlayerId,
  showHeader = true,
  className,
  showPlayers = true,
  worldTick,
  actionResult,
  quests = [],
  killList = [],
}: RoomDisplayProps) {
  // Subscribe to cap cache entry for this room/action using Zustand selector
  // This ensures the component re-renders when the cache updates
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

  const cachedCapEntry = useGameStore((state) => {
    if (!capConfig || !room?.roomId) return null
    const key = `${room.roomId}:${capConfig.action}`
    return state.capCache[key] || null
  })
  const [isPerformingAction, setIsPerformingAction] = useState<string | null>(null)
  const [loadingQuestId, setLoadingQuestId] = useState<string | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null)
  const [remainingCap, setRemainingCap] = useState<number | null>(null)
  const [maxCap, setMaxCap] = useState<number | null>(null)
  const [fallbackSecondsUntilReset, setFallbackSecondsUntilReset] = useState<number | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [capStatus, setCapStatus] = useState<CapStatus>('unavailable')
  const [retryAttempted, setRetryAttempted] = useState(false)
  const lastTickRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
  const otherUsers = useMemo(
    () => {
      const now = Date.now()
      return roomPlayers.filter((player) => {
        if (player.id === currentPlayerId) return false
        if (player.presenceStatus !== 'active' && player.lastSeen) {
          return now - player.lastSeen < TWENTY_FOUR_HOURS_MS
        }
        return true
      })
    },
    [roomPlayers, currentPlayerId]
  )

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
      setCapStatus('loading') // Start in loading state
      setRetryAttempted(false)
    } else {
      setMaxCap(null)
      setRemainingCap(null)
      setCapStatus('unavailable')
      setRetryAttempted(false)
    }
  }, [capConfig, room?.roomId]) // Reset when room changes

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
  // 2. Cap cache (primary source) - now subscribed via Zustand selector
  // 3. room.actionCaps[actionKey] (fallback from API response)
  // 4. Reset to maxPerTick when world tick increments (only if we have confirmed tick data)
  useEffect(() => {
    if (!capConfig || !room?.roomId) {
      setRemainingCap(null)
      return
    }

    const actionKey = capConfig.action
    const roomId = room.roomId

    // Priority 1: Action result (most recent, from action execution) - always wins
    if (actionResult?.action === actionKey && typeof actionResult?.data?.remaining === 'number') {
      setRemainingCap(actionResult.data.remaining)
      setCapStatus('known')
      // Store secondsUntilReset from action result as fallback for countdown display
      const secondsUntilReset = actionResult.data.secondsUntilReset
      if (typeof secondsUntilReset === 'number') {
        setFallbackSecondsUntilReset(secondsUntilReset)
      }
      return
    }

    // Priority 2: Cap cache (primary source) - now subscribed via Zustand selector
    // This will automatically trigger re-renders when the cache updates
    if (cachedCapEntry) {
      const currentTickId = worldTick?.tickNumber ?? 0
      const isRecent = cachedCapEntry.tickId === currentTickId
      
      if (cachedCapEntry.status === 'known' && isRecent) {
        setRemainingCap(cachedCapEntry.remaining)
        setCapStatus('known')
        return
      } else if (cachedCapEntry.status === 'known' && !isRecent) {
        // Stale cache - show value but mark as refreshing
        setRemainingCap(cachedCapEntry.remaining)
        setCapStatus('loading')
        return
      } else if (cachedCapEntry.status === 'error') {
        setRemainingCap(null)
        setCapStatus('error')
        return
      } else if (cachedCapEntry.status === 'loading') {
        setRemainingCap(null)
        setCapStatus('loading')
        return
      }
    }

    // Priority 3: API data from room.actionCaps (fallback)
    const fetchedRemaining = (room as any)?.actionCaps?.[actionKey]
    if (typeof fetchedRemaining === 'number') {
      setRemainingCap(fetchedRemaining)
      setCapStatus('known')
      return
    }

    // Priority 4: No data available - show loading state
    setRemainingCap(null)
    setCapStatus('loading')
  }, [capConfig, room, actionResult, worldTick, cachedCapEntry])

  // Retry logic: if cap remains loading beyond 3 seconds, trigger one re-fetch
  useEffect(() => {
    if (capStatus !== 'loading' || !capConfig || !room?.roomId || retryAttempted) {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      return
    }

    retryTimeoutRef.current = setTimeout(() => {
      if (capStatus === 'loading' && !retryAttempted && capConfig && room?.roomId) {
        console.log(`[RoomDisplay] Cap still loading after 3s, triggering retry for ${capConfig.action}`)
        setRetryAttempted(true)
        // Trigger refresh by calling onRefreshCaps if available, otherwise fall back to look action
        if (onRefreshCaps) {
          onRefreshCaps()
        } else if (onAction) {
          onAction('look')
        }
        // If still loading after retry, will be marked as error by the cap status logic
      }
    }, 3000)

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [capStatus, capConfig, room, retryAttempted, onAction, onRefreshCaps])

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

  const handleQuestTalk = async (questId: string, npcAction: string) => {
    if (!onAction || loadingQuestId) return
    setLoadingQuestId(questId)
    try {
      await onAction({ type: npcAction, data: { questId, introOnly: true } })
    } catch (error) {
      console.error('Quest talk error:', error)
    } finally {
      setLoadingQuestId(null)
    }
  }

  const handleQuestTurnIn = async (questId: string) => {
    if (!onAction || loadingQuestId) return
    setLoadingQuestId(questId)
    try {
      await onAction({ type: 'complete_quest', data: { questId } })
    } catch (error) {
      console.error('Quest turn-in error:', error)
    } finally {
      setLoadingQuestId(null)
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

      {room.stateNote && (
        <div className="mt-2 text-xs text-amber-300/80 italic">{room.stateNote}</div>
      )}

      {shouldShowCap && capStatus !== 'unavailable' && (
        <div className={`mt-3 relative flex items-center gap-3 p-3 rounded-md bg-gray-900/70 border ${getBerryBorderColor()}`}>
          {berryAction && !(capStatus === 'known' && remainingCap === 0) && capStatus !== 'loading' && (
            <button
              onClick={() => handleAction(berryAction.action)}
              disabled={isPerformingAction === berryAction.action || capStatus === 'error' || remainingCap === 0}
              className={`px-3 py-2 rounded-md text-sm text-white transition-colors flex-shrink-0 flex items-center gap-2 ${
                isPerformingAction === berryAction.action
                  ? 'bg-gray-700 cursor-wait'
                  : berryAction.className || 'bg-indigo-600 hover:bg-indigo-500'
              } ${remainingCap === 0 || capStatus === 'error' ? 'opacity-50' : ''}`}
            >
              {berryAction.icon && <Icon name={berryAction.icon} size={16} color="current" />}
              {berryAction.label}
            </button>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`text-sm ${getBerryTextColor()}`}>
              {capStatus !== 'loading' && (
                <>
                  Available {getItemNamePlural(capConfig?.action || '')}:{' '}
                </>
              )}
              {capStatus === 'loading' ? (
                <span className="font-semibold text-gray-400 flex items-center gap-1">
                  <Loader2 className={`h-3 w-3 animate-spin ${getBerrySpinnerColor()}`} />
                  Searching the berry bush...
                </span>
              ) : capStatus === 'error' ? (
                <span className="font-semibold text-red-400 flex items-center gap-2">
                  Can't load caps
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRetryAttempted(false)
                      setCapStatus('loading')
                      // Trigger refresh by calling onRefreshCaps if available
                      if (onRefreshCaps) {
                        onRefreshCaps()
                      } else if (onAction) {
                        onAction('look')
                      }
                    }}
                    className="text-xs underline hover:text-red-300 focus:outline-none"
                  >
                    Refresh
                  </button>
                </span>
              ) : (
                <span className="font-semibold text-white">
                  {remainingCap ?? '?'}
                </span>
              )}
            </div>
            {capStatus !== 'error' && capStatus !== 'loading' && (
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
            )}
          </div>
        </div>
      )}

      {(() => {
        const npcActions = filteredRoomActions.filter((a) => a.questIds?.length)
        const regularActions = filteredRoomActions.filter((a) => !a.questIds?.length)

        const renderButton = (actionItem: import('@/lib/room-actions').RoomAction) => {
          const isViewShop = actionItem.action === 'view shop'
          const override = room.actionOverrides?.[actionItem.action]
          const resolvedIcon = override?.icon ?? actionItem.icon
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
                  : override?.className || actionItem.className || 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {resolvedIcon && (
                <Icon
                  name={resolvedIcon}
                  size={isViewShop ? 20 : 16}
                  color="current"
                />
              )}
              <span>{actionItem.label}</span>
            </button>
          )
        }

        return (
          <div className="mt-4 flex flex-col gap-2">
            {npcActions.map((actionItem) => (
              <NpcQuestCard
                key={actionItem.action}
                npcName={actionItem.label}
                npcIcon={actionItem.icon ?? ''}
                questIds={actionItem.questIds ?? []}
                quests={quests}
                killList={killList}
                onTalk={(questId) => handleQuestTalk(questId, actionItem.action)}
                onTurnIn={(questId) => handleQuestTurnIn(questId)}
                loadingQuestId={loadingQuestId ?? undefined}
              />
            ))}
            {regularActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {regularActions.map(renderButton)}
              </div>
            )}
          </div>
        )
      })()}

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
                onInspect={() => {
                  if (onOpenPlayerProfile) {
                    onOpenPlayerProfile(player)
                    return
                  }
                  handleInspectPlayer(player)
                }}
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

function formatTimeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function PlayerCard({ player, onInspect, disabled }: PlayerCardProps) {
  const avatarKey = player.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = player.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatar = useColoredAvatar(avatarKey, avatarColor)

  const presence = player.presenceStatus ?? 'active'
  const isIdle = presence === 'idle'
  const isDisconnected = presence === 'disconnected'

  const containerClass = [
    'group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-white transition-all overflow-hidden',
    isDisconnected
      ? 'border-slate-600/20 bg-slate-700/10 opacity-35 grayscale hover:border-slate-500/40 hover:opacity-50'
      : isIdle
        ? 'border-amber-500/20 bg-amber-900/10 opacity-60 hover:border-amber-400/50 hover:bg-amber-500/15'
        : 'border-slate-500/30 bg-slate-500/10 hover:border-violet-400 hover:bg-violet-500/25',
    disabled ? 'cursor-not-allowed opacity-50' : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      onClick={onInspect}
      disabled={disabled}
      className={containerClass}
    >
      <div className="relative flex h-12 w-8 items-center justify-center flex-shrink-0">
        {coloredAvatar ? (
          <div
            className="h-12 w-8"
            dangerouslySetInnerHTML={{ __html: coloredAvatar }}
          />
        ) : (
          <span className="text-[10px] text-violet-200/70">...</span>
        )}
        {isIdle && (
          <span className="absolute -top-0.5 -right-1 text-[9px] leading-none" title="Idle">
            💤
          </span>
        )}
        {isDisconnected && (
          <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-700 block" title="Offline" />
        )}
      </div>
      <div className="leading-tight min-w-0">
        <div className="text-xs font-semibold text-white/90 truncate max-w-[110px]">{player.username}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-violet-200/80">Lvl {player.level}</div>
        {isIdle && player.lastSeen && (
          <div className="text-[9px] text-amber-400/80 mt-0.5">Idle {formatTimeAgo(player.lastSeen)}</div>
        )}
        {isDisconnected && player.lastSeen && (
          <div className="text-[9px] text-slate-400/80 mt-0.5">Offline {formatTimeAgo(player.lastSeen)}</div>
        )}
      </div>
    </button>
  )
}