import { useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '@/lib/game-state'
import { getRoomActions } from '@/lib/room-actions'
import { DEFAULT_AVATAR_COLOR, DEFAULT_PLAYER_AVATAR } from '@/lib/constants/avatars'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'

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
    return null
  }, [room?.roomId])

  useEffect(() => {
    if (capConfig) {
      setMaxCap(capConfig.maxPerTick)
      setRemainingCap(capConfig.maxPerTick)
    } else {
      setMaxCap(null)
      setRemainingCap(null)
    }
  }, [capConfig])

  useEffect(() => {
    if (!worldTick) return
    const now = Date.now()
    const seconds = Math.max(0, Math.ceil((worldTick.nextTickAt - now) / 1000))
    setCountdownSeconds(seconds)
    // reset remaining on tick increment
    if (lastTickRef.current !== null && worldTick.tickNumber !== lastTickRef.current && capConfig) {
      setRemainingCap(capConfig.maxPerTick)
    }
    lastTickRef.current = worldTick.tickNumber
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((worldTick.nextTickAt - Date.now()) / 1000))
      setCountdownSeconds(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [worldTick, capConfig])

  useEffect(() => {
    if (!actionResult?.action || !capConfig) return
    if (actionResult.action !== capConfig.action) return
    const remaining = actionResult?.data?.remaining
    if (typeof remaining === 'number') {
      setRemainingCap(remaining)
    }
  }, [actionResult, capConfig])
  
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

  const shouldShowCap = Boolean(capConfig && maxCap && worldTick)

  const handlePickupItem = async (item: any) => {
    if (!onAction || isPerformingAction) return

    const actionPayload = {
      type: 'pickup_item',
      data: {
        roomItemId: item.id,
        quantity: 1,
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
        <div className="mt-3 flex items-center gap-3 p-3 rounded-md bg-gray-900/70 border border-red-500/40">
          <div className="text-sm text-red-200">
            Remaining redberries this tick:{' '}
            <span className="font-semibold text-white">
              {remainingCap ?? maxCap ?? 0}/{maxCap ?? 0}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            Refresh in:{' '}
            <span className="font-semibold">
              {countdownSeconds !== null ? `${countdownSeconds}s` : '...'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {roomActions.map((actionItem) => (
          <button
            key={actionItem.action}
            onClick={() => handleAction(actionItem.action)}
            disabled={isPerformingAction === actionItem.action}
            className={`px-3 py-2 rounded-md text-sm text-white transition-colors ${
              isPerformingAction === actionItem.action
                ? 'bg-gray-700 cursor-wait'
                : actionItem.className || 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {actionItem.label}
          </button>
        ))}
      </div>

      {room.items && room.items.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-300 mb-2">Items here:</div>
          <div className="flex flex-wrap gap-2">
            {room.items.map((item: any) => (
              <button
                key={item.id}
                onClick={() => handlePickupItem(item)}
                className="px-3 py-1.5 rounded-md bg-emerald-500/70 text-white text-xs hover:bg-emerald-500 transition-colors flex items-center gap-1"
                disabled={isPerformingAction === `pickup-${item.id}`}
              >
                <span>{item.template.name}</span>
                {item.quantity > 1 && <span className="text-emerald-200">x{item.quantity}</span>}
              </button>
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
      className="group flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-left text-white transition-all hover:border-violet-400 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden"
    >
      <div className="flex h-8 w-8 items-center justify-center">
        {coloredAvatar ? (
          <div
            className="h-7 w-7"
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