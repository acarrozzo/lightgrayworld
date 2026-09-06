'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '@/lib/game-state'
import { useGameStore } from '@/lib/game-state'
import { getRoomActions } from '@/lib/room-actions'
import { goldChestFlagForRoom } from '@/lib/game-data/gold-chests'
import { PlayerAvatar, formatTimeAgo } from '@/components/player/PlayerRow'
import ItemDropdownButton from './ItemDropdownButton'
import Icon from './Icon'
import NpcQuestCard from './NpcQuestCard'
import ActionFlyout from './ActionFlyout'
import { useActionFlyout } from '@/hooks/useActionFlyout'
import { BASIC_ACTION_NAMES } from './BasicActionButtons'

type QuestProgress = { id: string; questId: string; progress: number; completed: boolean; data?: { accepted?: boolean } | null }


interface RoomDisplayProps {
  room: any
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction?: (action: string | { type: string; data?: any }) => void | Promise<void>
  onOpenPlayerProfile?: (player: Player) => void
  gatherCooldowns?: Array<{
    action: string
    cooldownSeconds: number
    secondsRemaining: number
    quantity?: number | null
    itemSlug?: string | null
    itemNamePlural?: string | null
    maxHeld?: number | null
    readyLabel?: string | null
  }>
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
  gatherCooldowns = [],
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
  // Persisted "gold chest opened" flag for THIS room's chest (chest1 for the
  // Grassy Field, chest2 for the Forest, ...) — drives the opened-button look.
  // A room without a gold chest resolves to no flag and never reads as opened.
  const goldChestFlag = goldChestFlagForRoom(room?.roomId)
  const goldChestOpened = useGameStore((state) =>
    goldChestFlag ? Boolean(state.player?.[goldChestFlag]) : false
  )
  // Live inventory, used to tell whether a capped gather node (e.g. Jack's
  // starter tree, which stops at 5 wood) is currently tapped out. Reading the
  // store means the button flips the instant the cap is hit or spent back down,
  // with no refetch.
  const inventory = useGameStore((state) => state.inventory)

  const [isPerformingAction, setIsPerformingAction] = useState<string | null>(null)
  const [loadingQuestId, setLoadingQuestId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  // Live seconds remaining per rolling gather action (sand / dirt / stone / berries),
  // keyed by action name. A room can host several gather actions at once; an entry
  // of 0 (or absent) means that action is ready.
  const [gatherRemaining, setGatherRemaining] = useState<Record<string, number>>({})

  // Action result flyout: shows the latest action's result text anchored to the
  // button that triggered it (mirrors the world feed / ActivityTicker). The four
  // basic actions are owned by BasicActionButtons (in More Actions and beside the
  // D-pad), so we skip them here to avoid showing two flyouts for the same result.
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult)
  const BASIC_FLYOUT_ACTIONS = BASIC_ACTION_NAMES
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

  // Per-action gather metadata (cooldown window, quantity), keyed by action name.
  const gatherByAction = useMemo(() => {
    // Element type is derived from the prop so the map never drifts from it.
    const map = new Map<string, NonNullable<RoomDisplayProps['gatherCooldowns']>[number]>()
    for (const g of gatherCooldowns) map.set(g.action, g)
    return map
  }, [gatherCooldowns])

  // Seed the live countdowns from the room's gather cooldowns on room/data change.
  useEffect(() => {
    const next: Record<string, number> = {}
    for (const g of gatherCooldowns) next[g.action] = g.secondsRemaining
    setGatherRemaining(next)
  }, [gatherCooldowns, room?.roomId])

  // Refresh a countdown from action feedback: a successful collect returns the
  // full window (secondsUntilReset); a too-early attempt returns what's left.
  useEffect(() => {
    const action = actionResult?.action
    if (!action || !gatherByAction.has(action)) return
    const secondsUntilReset = actionResult?.data?.secondsUntilReset
    if (typeof secondsUntilReset === 'number') {
      setGatherRemaining((prev) => ({ ...prev, [action]: secondsUntilReset }))
    }
  }, [actionResult, gatherByAction])

  // Tick every active gather countdown down to zero once per second.
  useEffect(() => {
    if (!isMounted) return
    if (!Object.values(gatherRemaining).some((v) => v > 0)) return
    const interval = setInterval(() => {
      setGatherRemaining((prev) => {
        let changed = false
        const next: Record<string, number> = {}
        for (const [action, secs] of Object.entries(prev)) {
          const decremented = secs <= 1 ? 0 : secs - 1
          if (decremented !== secs) changed = true
          next[action] = decremented
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isMounted, gatherRemaining])


  if (!room) {
    return (
      <div className="mt-4 p-4 bg-surface-raised rounded-lg">
        <div className="text-fg-secondary">Loading room...</div>
      </div>
    )
  }

  // Actions can declare `requiresCompletedQuest` to stay hidden until the player
  // has finished that quest — both guilds use it so only the recruiter shows
  // until you have joined. Presentation only; the server gates the action too.
  const roomActions = getRoomActions(room.roomId).filter(
    (a) =>
      !a.requiresCompletedQuest ||
      quests.some((q) => q.questId === a.requiresCompletedQuest && q.completed)
  )

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
            <div className="text-sm text-fg-secondary">{room.subtitle}</div>
            <div className="text-xl font-semibold text-fg-bright">{room.name}</div>
          </div>
          <div className="text-xs text-fg-muted">Room {room.roomId}</div>
        </div>
      )}

      {room.stateNote && (
        <div className="mt-2 text-xs text-resource-gold/80 italic">{room.stateNote}</div>
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
          const openedClassName = 'fill-status-success'
          const showFlyout = flyoutActionForButton(actionItem.action)
          // Rolling gather action (sand / berries): disable while on cooldown and
          // show a live countdown beneath the button.
          const gatherInfo = gatherByAction.get(actionItem.action)
          const isGather = Boolean(gatherInfo)
          const gatherSecondsLeft = gatherRemaining[actionItem.action] ?? 0
          const gatherQuantity = gatherInfo?.quantity ?? null
          // A node that names itself ("Tree") shows just that name; anything else
          // reports that it's ready, and how much a click is worth.
          const gatherReadyLabel =
            gatherInfo?.readyLabel ??
            `Ready${gatherQuantity != null ? ` (${gatherQuantity})` : ''}`
          // Capped node: the player already holds all this node will give, so
          // say so up front instead of letting them click into a rejection.
          // Held count for a capped node, summed across rows to match the
          // server's getHeldQuantity so the two can never disagree.
          const gatherCap = gatherInfo?.maxHeld ?? null
          const gatherHeld =
            gatherCap != null && gatherInfo?.itemSlug
              ? inventory.reduce(
                  (total, i) => (i.template.slug === gatherInfo.itemSlug ? total + i.quantity : total),
                  0
                )
              : 0
          const gatherAtMax = gatherCap != null && gatherHeld >= gatherCap
          // A capped node reports its own fill instead of its ready badge: how
          // many more it will give ("3 wood left"), or that it's full ("5/5 wood").
          const gatherCapLabel =
            gatherCap != null
              ? gatherAtMax
                ? `${Math.min(gatherHeld, gatherCap)}/${gatherCap} ${gatherInfo?.itemNamePlural ?? ''}`.trim()
                : `${gatherCap - gatherHeld} ${gatherInfo?.itemNamePlural ?? ''} left`.replace('  ', ' ')
              : null
          // Both states disable the button; they differ only in what they say.
          const isGatherLocked = isGather && (gatherSecondsLeft > 0 || gatherAtMax)
          const gatherButton = (
            <button
              data-action-button
              onClick={() => handleAction(actionItem.action)}
              disabled={isPerformingAction === actionItem.action || isGatherLocked}
              className={`${
                isViewShop
                  ? 'px-4 py-3 rounded-lg text-base font-semibold transition-all flex items-center gap-2 border-2 border-resource-gold/40 shadow-lg shadow-resource-gold/20 hover:shadow-xl hover:border-resource-gold/60'
                  : 'px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 active:scale-[0.97]'
              } ${
                isPerformingAction === actionItem.action
                  ? 'fill-surface-hover cursor-wait'
                  : isOpenedGoldChest
                    ? openedClassName
                    : override?.className || actionItem.className || 'fill-accent shadow-sm'
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
              className={`relative flex flex-col items-start gap-0.5 ${
                isGather ? 'w-full' : ''
              }`}
            >
              {showFlyout && actionResult && (
                <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
              )}
              {isGather ? (
                // Minimal container: button on the left, status/countdown to the right.
                // Amber while on cooldown or tapped out, green when ready; border
                // matches the text color so the state reads at a glance.
                <div
                  className={`flex items-center gap-2 rounded-lg border bg-surface-raised/40 p-1.5 ${
                    isGatherLocked ? 'border-resource-gold/50' : 'border-status-success/50'
                  }`}
                >
                  {gatherButton}
                  <span
                    className={`text-xs whitespace-nowrap pr-1 ${
                      isGatherLocked ? 'text-resource-gold' : 'text-status-success'
                    }`}
                  >
                    {gatherAtMax
                      ? gatherCapLabel
                      : isGatherLocked
                        ? formatTimeRemaining(gatherSecondsLeft)
                        : gatherCapLabel ?? gatherReadyLabel}
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
          <div className="text-sm text-fg-primary mb-2">Items here:</div>
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
          <div className="text-sm text-fg-primary mb-2">Others here:</div>
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

function PlayerCard({ player, onInspect, disabled }: PlayerCardProps) {
  const presence = player.presenceStatus ?? 'active'
  const isIdle = presence === 'idle'
  const isDisconnected = presence === 'disconnected'

  const containerClass = [
    'group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-fg-bright transition-all duration-200 overflow-hidden active:scale-[0.98]',
    isDisconnected
      ? 'border-line-strong/20 bg-surface-hover/10 opacity-35 grayscale hover:border-line-strong/40 hover:opacity-50'
      : isIdle
        ? 'border-resource-gold/20 bg-resource-gold/10 opacity-60 hover:border-resource-gold/50 hover:bg-resource-gold/15'
        : 'border-line-strong/30 bg-surface-selected/10 hover:border-stat-mag hover:bg-stat-mag/20 shadow-sm hover:shadow-md hover:shadow-stat-mag/10',
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
        <PlayerAvatar uIcon={player.uIcon} uIconColor={player.uIconColor} size="md" />
        {isIdle && (
          <span className="absolute -top-0.5 -right-1 text-[9px] leading-none" title="Idle">
            💤
          </span>
        )}
        {isDisconnected && (
          <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-surface-selected border border-line-subtle block" title="Offline" />
        )}
      </div>
      <div className="leading-tight min-w-0">
        <div className="text-xs font-semibold text-fg-bright/90 truncate max-w-[110px]">{player.username}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-stat-mag/80">Lvl {player.level}</div>
        {isIdle && player.lastSeen && (
          <div className="text-[9px] text-resource-gold/80 mt-0.5">Idle {formatTimeAgo(player.lastSeen)}</div>
        )}
        {isDisconnected && player.lastSeen && (
          <div className="text-[9px] text-fg-secondary/80 mt-0.5">Offline {formatTimeAgo(player.lastSeen)}</div>
        )}
      </div>
    </button>
  )
}