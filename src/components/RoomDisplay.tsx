'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '@/lib/game-state'
import { useGameStore } from '@/lib/game-state'
import { getRoomActions } from '@/lib/room-actions'
import { DEFAULT_AVATAR_COLOR, DEFAULT_PLAYER_AVATAR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import ItemDropdownButton from './ItemDropdownButton'
import Icon from './Icon'
import NpcQuestCard from './NpcQuestCard'
import ActionFlyout from './ActionFlyout'
import { useActionFlyout } from '@/hooks/useActionFlyout'

type QuestProgress = { id: string; questId: string; progress: number; completed: boolean; data?: { accepted?: boolean } | null }


interface RoomDisplayProps {
  room: any
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction?: (action: string | { type: string; data?: any }) => void | Promise<void>
  onOpenPlayerProfile?: (player: Player) => void
  gatherCooldown?: {
    action: string
    cooldownSeconds: number
    secondsRemaining: number
    quantity?: number | null
  } | null
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
  gatherCooldown,
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
  // Persisted "gold chest opened" flag (chest1) — drives the opened-button look.
  const goldChestOpened = useGameStore((state) => state.player?.chest1 ?? false)

  const [isPerformingAction, setIsPerformingAction] = useState<string | null>(null)
  const [loadingQuestId, setLoadingQuestId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  // Live seconds remaining on the room's rolling gather cooldown (sand / berries).
  // 0 (or null when no gather action) means the action is ready.
  const [gatherRemaining, setGatherRemaining] = useState<number | null>(null)

  // Action result flyout: shows the latest action's result text anchored to the
  // button that triggered it (mirrors the world feed / ActivityTicker). The four
  // basic actions are owned by RoomBox's persistent buttons, so we skip them here
  // to avoid showing two flyouts for the same result.
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult)
  const BASIC_FLYOUT_ACTIONS = ['attack', 'search', 'rest', 'look']
  const ITEM_FLYOUT_ACTIONS = ['pickup_item', 'examine_item']
  const flyoutActionForButton = (action: string) =>
    activeFlyoutAction === action && !BASIC_FLYOUT_ACTIONS.includes(action)

  // Item actions: the button can disappear (item picked up), so we capture the
  // button's screen rect at click time and pin the flyout to that frozen spot.
  const itemButtonRefs = useRef<Map<string, HTMLElement>>(new Map())
  const itemFlyoutRectRef = useRef<{ top: number; left: number } | null>(null)
  const captureItemRect = (itemId: string) => {
    const el = itemButtonRefs.current.get(itemId)
    const rect = el?.getBoundingClientRect()
    itemFlyoutRectRef.current = rect ? { top: rect.top, left: rect.left } : null
  }
  const showItemFlyout = ITEM_FLYOUT_ACTIONS.includes(activeFlyoutAction ?? '')

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

  // Track mount state to prevent hydration mismatches
  // Use useLayoutEffect for faster initialization on client
  useLayoutEffect(() => {
    setIsMounted(true)
  }, [])

  // The room's gather action (sand / berries), if any.
  const gatherAction = gatherCooldown?.action ?? null
  // How many items a single pick grants (shown in the ready state).
  const gatherQuantity = gatherCooldown?.quantity ?? null

  // Seed the live countdown from the room's gather cooldown on room/data change.
  useEffect(() => {
    setGatherRemaining(gatherCooldown ? gatherCooldown.secondsRemaining : null)
  }, [gatherCooldown, room?.roomId])

  // Refresh the countdown from action feedback: a successful collect returns the
  // full window (secondsUntilReset); a too-early attempt returns what's left.
  useEffect(() => {
    if (!gatherAction) return
    if (actionResult?.action !== gatherAction) return
    const secondsUntilReset = actionResult?.data?.secondsUntilReset
    if (typeof secondsUntilReset === 'number') {
      setGatherRemaining(secondsUntilReset)
    }
  }, [actionResult, gatherAction])

  // Tick the gather countdown down to zero once per second.
  useEffect(() => {
    if (!isMounted) return
    if (gatherRemaining === null || gatherRemaining <= 0) return
    const interval = setInterval(() => {
      setGatherRemaining((prev) => {
        if (prev === null || prev <= 1) return 0
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isMounted, gatherRemaining])


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

  // The gather action is on cooldown when there are seconds left to wait.
  const gatherOnCooldown = Boolean(gatherAction && gatherRemaining !== null && gatherRemaining > 0)

  const handlePickupItem = async (item: any, quantity: number = 1) => {
    if (!onAction || isPerformingAction) return

    captureItemRect(item.id)

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

    captureItemRect(item.id)

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

      {(() => {
        const npcActions = roomActions.filter((a) => a.questIds?.length)
        const regularActions = roomActions.filter((a) => !a.questIds?.length)

        const renderButton = (actionItem: import('@/lib/room-actions').RoomAction) => {
          const isViewShop = actionItem.action === 'view shop'
          const override = room.actionOverrides?.[actionItem.action]
          // Show the gold chest as opened once looted. Still clickable so the
          // player can re-open the reminder of what they got.
          const isOpenedGoldChest = actionItem.action === 'open gold chest' && goldChestOpened
          const resolvedIcon = isOpenedGoldChest ? 'chest2' : (override?.icon ?? actionItem.icon)
          const resolvedLabel = isOpenedGoldChest ? 'Gold Chest (Opened)' : actionItem.label
          const openedClassName = 'bg-emerald-700/70 hover:bg-emerald-700'
          const showFlyout = flyoutActionForButton(actionItem.action)
          // Rolling gather action (sand / berries): disable while on cooldown and
          // show a live countdown beneath the button.
          const isGather = actionItem.action === gatherAction
          const isGatherLocked = isGather && gatherOnCooldown
          const gatherButton = (
            <button
              data-action-button
              onClick={() => handleAction(actionItem.action)}
              disabled={isPerformingAction === actionItem.action || isGatherLocked}
              className={`${
                isViewShop
                  ? 'px-4 py-3 rounded-md text-base font-semibold text-white transition-all flex items-center gap-2 border-2 border-amber-400/50 shadow-lg hover:shadow-xl'
                  : 'px-3 py-2 rounded-md text-sm text-white transition-colors flex items-center gap-2'
              } ${
                isPerformingAction === actionItem.action
                  ? 'bg-gray-700 cursor-wait'
                  : isOpenedGoldChest
                    ? openedClassName
                    : override?.className || actionItem.className || 'bg-indigo-600 hover:bg-indigo-500'
              } ${isGatherLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {resolvedIcon && (
                <Icon
                  name={resolvedIcon}
                  size={isViewShop ? 20 : 16}
                  color="current"
                />
              )}
              <span>{resolvedLabel}</span>
            </button>
          )
          return (
            <div
              key={actionItem.action}
              ref={showFlyout ? flyoutRootRef : undefined}
              className="relative flex flex-col items-start gap-0.5"
            >
              {showFlyout && actionResult && (
                <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
              )}
              {isGather ? (
                // Minimal container: button on the left, status/countdown to the right.
                <div className="flex items-center gap-2 rounded-lg border border-gray-700/60 bg-gray-800/40 p-1.5">
                  {gatherButton}
                  <span className="text-xs text-gray-400 whitespace-nowrap pr-1">
                    {isGatherLocked
                      ? formatTimeRemaining(gatherRemaining ?? 0)
                      : `Ready to pick${gatherQuantity != null ? ` (${gatherQuantity})` : ''}`}
                  </span>
                </div>
              ) : (
                gatherButton
              )}
            </div>
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
              <div
                key={item.id}
                ref={(el) => {
                  if (el) itemButtonRefs.current.set(item.id, el)
                  else itemButtonRefs.current.delete(item.id)
                }}
              >
                <ItemDropdownButton
                  item={item}
                  onPickup={(quantity) => handlePickupItem(item, quantity)}
                  onExamine={() => handleExamineItem(item)}
                  disabled={
                    isPerformingAction === `pickup-${item.id}` ||
                    isPerformingAction === `examine-${item.id}`
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item-action flyout: pinned to the clicked button's last screen position
          (the button may be gone after a pickup). */}
      {showItemFlyout && actionResult && itemFlyoutRectRef.current && (
        <ActionFlyout
          result={actionResult}
          anchorRect={itemFlyoutRectRef.current}
          onDismiss={dismissFlyout}
        />
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