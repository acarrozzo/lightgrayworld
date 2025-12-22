'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Room, useGameStore } from '@/lib/game-state'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { ActionResultPayload, ActionErrorPayload, RoomPlayerMovedPayload, ChatMessage, WorldTickPayload } from '@/lib/socket'
import Icon from './Icon'
import RoomDisplay from './RoomDisplay'

const DIRECTION_KEYS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
] as const

type DirectionKey = (typeof DIRECTION_KEYS)[number]

const ROOM_NAME_MAP: Record<string, string> = {
  '000': 'Room Zero',
  '001': 'Grassy Field Crossroads',
  '002': 'Grassy Field South',
  '003': 'Wood Cabin',
  '004': 'Flower Patch',
  '005': 'Grassy Field North',
  '006': 'Basic Shop',
  '007': 'Cave Entrance',
  '020': 'Healing Springs',
  '021': 'Pajama Shaman',
}

const SCROLL_THRESHOLD = 100

// Helper function to get text color class - ensures Tailwind can detect all classes at build time
export const getTextColorClass = (color?: string | null, defaultColor: string = 'green-400'): string => {
  const colorValue = color || defaultColor
  
  // Map common Tailwind color values to full class names
  // This ensures Tailwind's JIT compiler can detect these classes
  const colorMap: Record<string, string> = {
    'red-50': 'text-red-50',
    'red-100': 'text-red-100',
    'red-200': 'text-red-200',
    'red-300': 'text-red-300',
    'red-400': 'text-red-400',
    'red-500': 'text-red-500',
    'red-600': 'text-red-600',
    'red-700': 'text-red-700',
    'red-800': 'text-red-800',
    'red-900': 'text-red-900',
    'blue-50': 'text-blue-50',
    'blue-100': 'text-blue-100',
    'blue-200': 'text-blue-200',
    'blue-300': 'text-blue-300',
    'blue-400': 'text-blue-400',
    'blue-500': 'text-blue-500',
    'blue-600': 'text-blue-600',
    'blue-700': 'text-blue-700',
    'blue-800': 'text-blue-800',
    'blue-900': 'text-blue-900',
    'green-50': 'text-green-50',
    'green-100': 'text-green-100',
    'green-200': 'text-green-200',
    'green-300': 'text-green-300',
    'green-400': 'text-green-400',
    'grass': 'text-green-400',
    'green-500': 'text-green-500',
    'green-600': 'text-green-600',
    'green-700': 'text-green-700',
    'green-800': 'text-green-800',
    'green-900': 'text-green-900',
    'yellow-50': 'text-yellow-50',
    'yellow-100': 'text-yellow-100',
    'yellow-200': 'text-yellow-200',
    'yellow-300': 'text-yellow-300',
    'yellow-400': 'text-yellow-400',
    'yellow-500': 'text-yellow-500',
    'yellow-600': 'text-yellow-600',
    'yellow-700': 'text-yellow-700',
    'dirt': 'text-yellow-700',
    'yellow-800': 'text-yellow-800',
    'yellow-900': 'text-yellow-900',
    'purple-50': 'text-purple-50',
    'purple-100': 'text-purple-100',
    'purple-200': 'text-purple-200',
    'purple-300': 'text-purple-300',
    'purple-400': 'text-purple-400',
    'purple-500': 'text-purple-500',
    'purple-600': 'text-purple-600',
    'purple-700': 'text-purple-700',
    'purple-800': 'text-purple-800',
    'purple-900': 'text-purple-900',
    'pink-50': 'text-pink-50',
    'pink-100': 'text-pink-100',
    'pink-200': 'text-pink-200',
    'pink-300': 'text-pink-300',
    'pink-400': 'text-pink-400',
    'pink-500': 'text-pink-500',
    'pink-600': 'text-pink-600',
    'pink-700': 'text-pink-700',
    'pink-800': 'text-pink-800',
    'pink-900': 'text-pink-900',
    'orange-50': 'text-orange-50',
    'orange-100': 'text-orange-100',
    'orange-200': 'text-orange-200',
    'orange-300': 'text-orange-300',
    'orange-400': 'text-orange-400',
    'orange-500': 'text-orange-500',
    'orange-600': 'text-orange-600',
    'orange-700': 'text-orange-700',
    'orange-800': 'text-orange-800',
    'orange-900': 'text-orange-900',
    'amber-50': 'text-amber-50',
    'amber-100': 'text-amber-100',
    'amber-200': 'text-amber-200',
    'amber-300': 'text-amber-300',
    'sand': 'text-amber-300',
    'amber-400': 'text-amber-400',
    'amber-500': 'text-amber-500',
    'amber-600': 'text-amber-600',
    'amber-700': 'text-amber-700',
    'amber-800': 'text-amber-800',
    'amber-900': 'text-amber-900',
    'gray-50': 'text-gray-50',
    'gray-100': 'text-gray-100',
    'gray-200': 'text-gray-200',
    'gray-300': 'text-gray-300',
    'gray-400': 'text-gray-400',
    'gray-500': 'text-gray-500',
    'gray-600': 'text-gray-600',
    'gray-700': 'text-gray-700',
    'gray-800': 'text-gray-800',
    'gray-900': 'text-gray-900',
    'indigo-50': 'text-indigo-50',
    'indigo-100': 'text-indigo-100',
    'indigo-200': 'text-indigo-200',
    'indigo-300': 'text-indigo-300',
    'indigo-400': 'text-indigo-400',
    'indigo-500': 'text-indigo-500',
    'indigo-600': 'text-indigo-600',
    'indigo-700': 'text-indigo-700',
    'indigo-800': 'text-indigo-800',
    'indigo-900': 'text-indigo-900',
  }
  
  // If color is in map, return it; otherwise construct it (for custom colors)
  return colorMap[colorValue] || `text-${colorValue}`
}

const findDirectionKey = (currentRoom: Room | null | undefined, targetRoomId?: string): DirectionKey | null => {
  if (!currentRoom || !targetRoomId) {
    return null
  }

  const roomDirections = currentRoom as Record<DirectionKey, string | undefined>

  for (const key of DIRECTION_KEYS) {
    if (roomDirections[key] === targetRoomId) {
      return key
    }
  }

  return null
}

const buildDirectionPhrase = (direction: DirectionKey | null, context: 'enter' | 'exit'): string => {
  if (!direction) {
    return 'an unknown direction'
  }

  if (direction === 'up') {
    return context === 'enter' ? 'above' : 'upward'
  }

  if (direction === 'down') {
    return context === 'enter' ? 'below' : 'downward'
  }

  return `the ${direction.replace(/_/g, ' ')}`
}

interface ActionHistory {
  id: string
  action: string
  message: string
  timestamp: string
  roomId?: string
  metadata?: string
  success?: boolean
  roomData?: {
    id: string
    roomId: string
    name: string
    subtitle: string
    subtitlePosition?: 'above' | 'below' | string
    nameColor?: string | null
    subtitleColor?: string | null
    description: string
    dangerLevel: number
    isSafe: boolean
    players: any[]
    items: any[]
    npcs: any[]
  }
  suppressRoomDisplay?: boolean
}

export interface FeedControlHandlers {
  clearFeed: () => void
  scrollToTop: () => void
  scrollToBottom: () => void
}

interface GameFeedProps {
  room: Room | null
  actionResult?: any
  className?: string
  onRegisterControls?: (handlers: FeedControlHandlers) => void
  worldTick?: {
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  }
}

// Variant styles configuration
const variantStyles = {
  default: {
    padding: 'p-4 sm:p-6',
    iconSize: 'w-12 sm:w-20 h-12 sm:h-20',
    titleSize: 'text-xl sm:text-2xl',
    subtitleSize: 'text-base sm:text-lg',
    subtitleSizeAbove: 'text-lg',
    descriptionSize: 'text-xs sm:text-base',
  },
  sidebar: {
    padding: 'p-0',
    iconSize: 'w-10 h-10',
    titleSize: 'text-md',
    subtitleSize: 'text-sm',
    subtitleSizeAbove: 'text-sm',
    descriptionSize: 'text-xs',
  },
} as const

// Export renderRoomInfo function for reuse in other components
export const renderRoomInfo = (roomData: any, options?: { action?: string; isMostRecent?: boolean; player?: any; onAction?: (action: any) => void | Promise<void>; variant?: 'default' | 'sidebar'; worldTick?: { tickNumber: number; nextTickAt: number; tickIntervalMs: number }; actionResult?: any }) => {
  const { action, isMostRecent = false, player, onAction, variant = 'default', worldTick, actionResult } = options || {}
  const styles = variantStyles[variant]
  const handleRoomDisplayAction = onAction || (async (action: string) => {
    // Fallback if no onAction provided - this shouldn't happen in practice
    console.warn('No onAction handler provided to renderRoomInfo')
  })
  const defaultSubtitle = 'This is it. The world is yours.'
  const subtitleText = (roomData.subtitle ?? defaultSubtitle).trim()
  const hasSubtitle = subtitleText.length > 0
  const subtitlePlacement = roomData.subtitlePosition?.toLowerCase() === 'above' ? 'above' : 'below'

  return (
    <div className={styles.padding}>
      {/* Header with icon and two-line title */}
      <div className="flex items-center gap-4 mb-4">
        <div className={getTextColorClass(roomData.iconColor, 'yellow-400')}>
          <Icon 
            name={roomData.icon || 'sun'} 
            className={styles.iconSize}
            color="current"
          />
        </div>
        <div className="flex-1">
          {hasSubtitle && subtitlePlacement === 'above' && (
            <p className={`${getTextColorClass(roomData.subtitleColor, 'blue-300')} font-bold ${styles.subtitleSizeAbove}`}>{subtitleText}</p>
          )}
          <h3 className={`${styles.titleSize} font-bold ${getTextColorClass(roomData.nameColor, 'green-400')}`}>{roomData.name}</h3>
          {hasSubtitle && subtitlePlacement === 'below' && (
            <p className={`${getTextColorClass(roomData.subtitleColor, 'blue-300')} font-bold ${styles.subtitleSize}`}>{subtitleText}</p>
          )}
        </div>
      </div>

      {/* Room Description */}
      {variant !== 'sidebar' && (
        <p className={`text-gray-300/90 leading-relaxed ${styles.descriptionSize} mb-4`}>
          {roomData.description}
        </p>
      )}

      {/* Action Buttons */}
      {variant !== 'sidebar' && (
        <div className="flex flex-wrap gap-2">
          {/* Universal actions */}
          <button className="px-4 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg text-sm transition-all duration-200">
            West
          </button>
          <button className="px-4 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg text-sm transition-all duration-200">
            South
          </button>
          <button className="px-4 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg text-sm transition-all duration-200">
            North
          </button>
          <button className="px-4 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg text-sm transition-all duration-200">
            East
          </button>
        </div>
      )}

      <RoomDisplay
        room={roomData}
        roomPlayers={Array.isArray(roomData.players) ? roomData.players : []}
        currentPlayerId={player?.id}
        onAction={handleRoomDisplayAction as any}
        showHeader={false}
        className="mt-0"
        worldTick={worldTick}
        actionResult={actionResult}
      />

      {/* Additional room info sections */}
      {(roomData.items?.length > 0 || roomData.npcs?.length > 0) && (
        <div className="mt-6 space-y-3">
          {/* Items in Room */}
          {roomData.items && roomData.items.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800/50">
              <h4 className="text-sm font-semibold text-emerald-400/90 mb-2">Items:</h4>
              <div className="flex flex-wrap gap-2">
                {roomData.items.map((item: any) => (
                  <span
                    key={item.id}
                    className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs rounded-full transition-colors duration-200"
                  >
                    {item.template?.name || 'Item'}{item.quantity > 1 ? ` x${item.quantity}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* NPCs in Room */}
          {roomData.npcs && roomData.npcs.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-800/50">
              <h4 className="text-sm font-semibold text-purple-400/90 mb-2">NPCs:</h4>
              <div className="flex flex-wrap gap-2">
                {roomData.npcs.map((npc: any) => (
                  <span
                    key={npc.id}
                    className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full"
                  >
                    {npc.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GameFeed({ room, actionResult, className = '', onRegisterControls, worldTick }: GameFeedProps) {
  const [actions, setActions] = useState<ActionHistory[]>([])
  const [initialRoom, setInitialRoom] = useState(room)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const prevActionsLengthRef = useRef(0)
  const hasHydratedActionsRef = useRef(false)
  const hasInitialized = useRef(false)
  const isClearingFeed = useRef(false)
  const { getAuthHeaders, player, setCurrentRoom, setRoomPlayers, getCachedRoom } = useGameStore()
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)

  const handleRoomDisplayAction = useCallback(async (action: string | { type: string; data?: any }) => {
    const success = socketHandlers.sendGameAction(action as any)
    if (!success) {
      throw new Error('Failed to send game action')
    }
  }, [socketHandlers])

  // Load from localStorage and set initial room on mount (only once)
  useEffect(() => {
    if (hasInitialized.current || isClearingFeed.current) {
      console.log('GameFeed useEffect - already initialized or clearing feed, skipping')
      return
    }
    
    console.log('GameFeed useEffect - initializing for first time')
    console.log('GameFeed useEffect - room prop:', room)
    console.log('GameFeed useEffect - current initialRoom state:', initialRoom)
    
    const savedActions = localStorage.getItem('gameFeedActions')
    const savedInitialRoom = localStorage.getItem('gameFeedInitialRoom')
    
    console.log('GameFeed useEffect - savedActions:', savedActions ? 'exists' : 'null')
    console.log('GameFeed useEffect - savedInitialRoom:', savedInitialRoom ? 'exists' : 'null')
    
    // Load saved actions
    if (savedActions) {
      try {
        const parsedActions = JSON.parse(savedActions)
        console.log('GameFeed useEffect - loading actions:', parsedActions.length)
        setActions(parsedActions)
      } catch (error) {
        console.error('Failed to parse saved actions:', error)
        localStorage.removeItem('gameFeedActions')
      }
    }
    
    // Load saved initial room
    if (savedInitialRoom) {
      try {
        const parsedRoom = JSON.parse(savedInitialRoom)
        console.log('GameFeed useEffect - loading saved initial room:', parsedRoom.name)
        setInitialRoom(parsedRoom)
      } catch (error) {
        console.error('Failed to parse saved initial room:', error)
        localStorage.removeItem('gameFeedInitialRoom')
      }
    } else if (room) {
      // Only set initial room if no saved room exists and we have a room prop
      console.log('GameFeed useEffect - setting initial room from prop:', room.name)
      setInitialRoom(room)
    }
    
    hasInitialized.current = true
  }, [])

  // Save actions to localStorage whenever actions change
  useEffect(() => {
    if (actions.length > 0) {
      localStorage.setItem('gameFeedActions', JSON.stringify(actions))
    }
  }, [actions])

  // Save initial room to localStorage when it changes
  useEffect(() => {
    if (initialRoom) {
      console.log('GameFeed useEffect - saving initial room:', initialRoom.name)
      localStorage.setItem('gameFeedInitialRoom', JSON.stringify(initialRoom))
    }
  }, [initialRoom])

  // Helper function to deduplicate actions by ID and sort by timestamp
  const deduplicateActions = (actions: ActionHistory[]): ActionHistory[] => {
    const seen = new Set<string>()
    const unique = actions.filter(action => {
      if (seen.has(action.id)) {
        return false
      }
      seen.add(action.id)
      return true
    })
    
    // Sort by timestamp (oldest first, newest at bottom)
    return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  const clearFeed = useCallback(() => {
    console.log('GameFeed clearFeed - clearing everything')
    isClearingFeed.current = true // Set flag to prevent useEffect from interfering
    
    setActions([])
    localStorage.removeItem('gameFeedActions') // Clear localStorage as well
    localStorage.removeItem('gameFeedInitialRoom') // Clear saved initial room
    setUnreadCount(0)
    setIsNearBottom(true)
    isNearBottomRef.current = true
    
    // Set the current room as the new initial room
    if (room) {
      console.log('GameFeed clearFeed - setting current room as new initial room:', room.name)
      setInitialRoom(room)
    }
    
    // Reset flags after a brief delay to allow state updates to complete
    setTimeout(() => {
      isClearingFeed.current = false
      hasInitialized.current = true
    }, 100)
  }, [room])

  const updateScrollState = useCallback(() => {
    const container = feedRef.current
    if (!container) {
      return
    }

    const distanceFromBottom = container.scrollHeight - (container.scrollTop + container.clientHeight)
    const nearBottom = distanceFromBottom <= SCROLL_THRESHOLD

    isNearBottomRef.current = nearBottom
    setIsNearBottom(nearBottom)

    if (nearBottom) {
      setUnreadCount((prev) => {
        return 0
      })
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: 'smooth',
      })
      requestAnimationFrame(() => updateScrollState())
    }
  }, [updateScrollState])

  const scrollToTop = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0
    }
  }, [])

  const handleNewFeedEntries = useCallback(
    (count = 1) => {
      if (isNearBottomRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom()
          })
        })
      } else {
        setUnreadCount((prev) => {
          return prev + count
        })
      }
    },
    [scrollToBottom]
  )

  const handleUnreadIndicatorClick = useCallback(() => {
    scrollToBottom()
  }, [scrollToBottom])

  useEffect(() => {
    if (!hasHydratedActionsRef.current) {
      prevActionsLengthRef.current = actions.length
      hasHydratedActionsRef.current = true
      return
    }

    const previousLength = prevActionsLengthRef.current
    const currentLength = actions.length
    const additions = Math.max(currentLength - previousLength, 0)

    prevActionsLengthRef.current = currentLength

    if (additions > 0) {
      handleNewFeedEntries(additions)
    }
  }, [actions, handleNewFeedEntries])

  useEffect(() => {
    if (!onRegisterControls) return

    onRegisterControls({
      clearFeed,
      scrollToTop,
      scrollToBottom,
    })
  }, [onRegisterControls, clearFeed, scrollToTop, scrollToBottom])

  // Scroll to bottom on initial mount/refresh so users land at the latest entries
  useEffect(() => {
    const t = setTimeout(() => scrollToBottom(), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const container = feedRef.current
    if (!container) {
      return
    }

    const handleScroll = () => {
      updateScrollState()
    }

    container.addEventListener('scroll', handleScroll)
    updateScrollState()

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [updateScrollState])

  const resolveRoomInfo = (roomId?: string, fallbackName?: string) => {
    if (!roomId) {
      return { id: '', name: 'Unknown Room' }
    }

    if (room?.roomId === roomId && room?.name) {
      return { id: roomId, name: room.name }
    }

    if (initialRoom?.roomId === roomId && initialRoom?.name) {
      return { id: roomId, name: initialRoom.name }
    }

    const cachedRoom = getCachedRoom(roomId)
    if (cachedRoom?.name) {
      return { id: roomId, name: cachedRoom.name }
    }

    const actionRoom = actions.find((entry) => entry.roomData?.roomId === roomId)
    if (actionRoom?.roomData?.name) {
      return { id: roomId, name: actionRoom.roomData.name }
    }

    if (ROOM_NAME_MAP[roomId]) {
      return { id: roomId, name: ROOM_NAME_MAP[roomId] }
    }

    if (fallbackName) {
      return { id: roomId, name: fallbackName }
    }

    return { id: roomId, name: 'Unknown Room' }
  }

  const pushAction = useCallback(
    (entry: ActionHistory) => {
      setActions((prev) => {
        let nextEntries = [...prev, entry]
        return deduplicateActions(nextEntries)
      })

    },
    [setActions]
  )

  const formatRoomLabel = (roomId?: string, fallbackName?: string) => {
    const info = resolveRoomInfo(roomId, fallbackName)
    if (!info.id) {
      return info.name
    }
    return `#${info.id} - ${info.name}`
  }

  const resolveActiveRoomData = useCallback(() => {
    if (room) {
      return room
    }

    if (player?.currentRoom) {
      const cachedRoom = getCachedRoom(player.currentRoom)
      if (cachedRoom) {
        return cachedRoom
      }
    }

    if (initialRoom) {
      return initialRoom
    }

    return null
  }, [room, player?.currentRoom, getCachedRoom, initialRoom])

  // Add current action result to the feed
  useEffect(() => {
    if (!actionResult || actionResult.source !== 'local') {
      return
    }

    const entry: ActionHistory = {
      id: `local-action-${Date.now()}`,
      action: actionResult.action,
      message: actionResult.message,
      timestamp: actionResult.timestamp || new Date().toISOString(),
      success: actionResult.success,
      roomData: actionResult.roomData,
    }

    pushAction(entry)
  }, [actionResult, pushAction])

  const createActionResultEntry = useCallback(
    (payload: ActionResultPayload): ActionHistory => ({
      id: `socket-action-${payload.timestamp}-${payload.action}-${Math.random().toString(36).slice(2, 8)}`,
      action: payload.action,
      message: payload.message,
      timestamp: payload.timestamp,
      roomId: payload.data?.roomId,
      metadata: payload.data ? JSON.stringify(payload.data) : undefined,
      success: payload.success,
      roomData: payload.data?.roomData,
    }),
    []
  )

  const createActionErrorEntry = useCallback((payload: ActionErrorPayload): ActionHistory => {
    const timestamp = new Date().toISOString()
    return {
      id: `socket-action-error-${timestamp}-${payload.action}`,
      action: payload.action,
      message: `Action failed: ${payload.message}`,
      timestamp,
      success: false,
    }
  }, [])

  const createMovementEntry = useCallback(
    (event: RoomPlayerMovedPayload): ActionHistory | null => {
      const timestamp = new Date().toISOString()
      const isSelfMovement = event.playerId === player?.id
      if (isSelfMovement) {
        return null
      }

      const isEnteringCurrentRoom = room?.roomId && event.toRoom === room.roomId
      const isLeavingCurrentRoom = room?.roomId && event.fromRoom === room.roomId

      if (!isEnteringCurrentRoom && !isLeavingCurrentRoom) {
        return null
      }

      const referenceRoom = room
      const directionRoomId = isEnteringCurrentRoom ? event.fromRoom : event.toRoom
      const direction = findDirectionKey(referenceRoom, directionRoomId)
      const directionPhrase = buildDirectionPhrase(direction, isEnteringCurrentRoom ? 'enter' : 'exit')

      const message = isEnteringCurrentRoom
        ? `${event.username} enters from ${directionPhrase}`
        : `${event.username} exits to ${directionPhrase}`

      return {
        id: `socket-room-move-${event.playerId}-${timestamp}`,
        action: 'move',
        message,
        timestamp,
        metadata: JSON.stringify(event),
        suppressRoomDisplay: true,
      }
    },
    [player?.id, room, initialRoom, getCachedRoom]
  )

  const createChatEntry = useCallback((message: ChatMessage): ActionHistory => {
    const timestamp = new Date(message.timestamp).toISOString()
    const isPlayerMessage = player?.id && message.userId === player.id
    const formattedMessage = isPlayerMessage
      ? `You say, "${message.message}"`
      : `[${message.level}] ${message.username} says, "${message.message}"`

    return {
      id: message.id || `socket-chat-${timestamp}`,
      action: 'chat',
      message: formattedMessage,
      timestamp,
      roomId: message.roomId,
      metadata: JSON.stringify(message),
    }
  }, [player?.id])

  const createRoomChatEntry = useCallback((message: ChatMessage): ActionHistory => {
    const timestamp = new Date(message.timestamp).toISOString()
    const isPlayerMessage = player?.id && message.userId === player.id
    const formattedMessage = isPlayerMessage
      ? `You say, "${message.message}"`
      : `[${message.level}] ${message.username} says, "${message.message}"`

    return {
      id: message.id || `socket-room-chat-${timestamp}`,
      action: 'room-chat',
      message: formattedMessage,
      timestamp,
      roomId: message.roomId,
      metadata: JSON.stringify(message),
    }
  }, [player?.id])

  const createWorldTickEntry = useCallback((payload: WorldTickPayload): ActionHistory => {
    const timestamp = new Date(payload.timestamp).toISOString()
    const displayNumber = payload.tickId + 1 // tickId starts at 0, display starts at 1

    return {
      id: `world-tick-${payload.tickId}-${payload.timestamp}`,
      action: 'world-tick',
      message: `world tick - ${displayNumber}`,
      timestamp,
      roomId: payload.roomId,
      metadata: JSON.stringify(payload),
      suppressRoomDisplay: true,
    }
  }, [])

  // Listen for real-time action updates
  useEffect(() => {
    if (!socket || !player) {
      return
    }

    const cleanupActionResult = socketHandlers.onActionResult((payload) => {
      if (payload.action === 'chat') {
        return
      }

      const augmentedPayload: ActionResultPayload = {
        ...payload,
        data: payload.data ? { ...payload.data } : {},
      }

      if (payload.action === 'look') {
        const resolvedRoomData =
          payload.data?.roomData ||
          resolveActiveRoomData() ||
          (payload.data?.roomId ? getCachedRoom(payload.data.roomId) : null)

        if (resolvedRoomData) {
          augmentedPayload.data = {
            ...(augmentedPayload.data || {}),
            roomData: resolvedRoomData,
          }
        }
      }

      if (payload.action === 'move' && payload.data?.roomData) {
        const normalizedRoomData = {
          ...payload.data.roomData,
          players: Array.isArray(payload.data.roomData.players) ? payload.data.roomData.players : [],
          items: Array.isArray(payload.data.roomData.items) ? payload.data.roomData.items : [],
          npcs: Array.isArray(payload.data.roomData.npcs) ? payload.data.roomData.npcs : [],
        }

        augmentedPayload.data = {
          ...(augmentedPayload.data || {}),
          roomData: normalizedRoomData,
        }
      }

      pushAction(createActionResultEntry(augmentedPayload))
    })

    const cleanupActionError = socketHandlers.onActionError((payload) => {
      pushAction(createActionErrorEntry(payload))
    })

    const cleanupRoomMove = socketHandlers.onRoomPlayerMoved((event) => {
      const entry = createMovementEntry(event)
      if (entry) {
        pushAction(entry)
      }
    })

    const cleanupChat = socketHandlers.onChatMessage((message) => {
      pushAction(createChatEntry(message))
    })

    const cleanupRoomChat = socketHandlers.onRoomChatMessage((message) => {
      // Only show room chat messages for the current room
      if (room?.roomId && message.roomId === room.roomId) {
        pushAction(createRoomChatEntry(message))
      }
    })

    const cleanupWorldTick = socketHandlers.onWorldTick((payload) => {
      pushAction(createWorldTickEntry(payload))
    })

    return () => {
      cleanupActionResult()
      cleanupActionError()
      cleanupRoomMove()
      cleanupChat()
      cleanupRoomChat()
      cleanupWorldTick()
    }
  }, [
    socket,
    player,
    socketHandlers,
    pushAction,
    createActionResultEntry,
    createActionErrorEntry,
    createMovementEntry,
    createChatEntry,
    createRoomChatEntry,
    createWorldTickEntry,
    room,
    getCachedRoom,
    resolveActiveRoomData,
  ])

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'look':
        return 'text-blue-400'
      case 'attack':
        return 'text-red-400'
      case 'search':
        return 'text-yellow-400'
      case 'rest':
        return 'text-green-400'
      case 'move':
        return 'text-purple-400'
      case 'room-display':
        return 'text-green-400'
      case 'chat':
        return 'text-cyan-400'
      case 'room-chat':
        return 'text-cyan-400'
      default:
        return 'text-gray-400'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'look':
        return 'aim'
      case 'attack':
        return 'attack'
      case 'search':
        return 'aim'
      case 'rest':
        return 'heal'
      case 'move':
        return 'arrow'
      case 'north':
        return 'arrow'
      case 'northeast':
        return 'arrow'
      case 'east':
        return 'arrow'
      case 'southeast':
        return 'arrow'
      case 'south':
        return 'arrow'
      case 'southwest':
        return 'arrow'
      case 'west':
        return 'arrow'
      case 'northwest':
        return 'arrow'
      case 'up':
        return 'arrow-up'
      case 'down':
        return 'arrow-down'
      case 'room-display':
        return 'world'
      default:
        return 'magic'
    }
  }

  const getActionRotation = (action: string) => {
    switch (action.toLowerCase()) {
      case 'north':
        return 0
      case 'northeast':
        return 45
      case 'east':
        return 90
      case 'southeast':
        return 135
      case 'south':
        return 180
      case 'southwest':
        return 225
      case 'west':
        return 270
      case 'northwest':
        return 315
      default:
        return 0
    }
  }


  if (!initialRoom) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500/80">Loading room...</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="relative flex-1 overflow-hidden">
        {/* Feed Content */}
        <div 
          ref={feedRef}
          data-near-bottom={isNearBottom ? 'true' : 'false'}
          className="absolute inset-0 overflow-y-auto p-4 space-y-2"
        >
          {/* Actions List */}
          {actions.map((action, index) => {
            // Check if this is the last action in the feed (bottom-most)
            const isLastAction = index === actions.length - 1
            
            // Check if we should show roombox for look or move actions
            const shouldShowRoombox = 
              (action.action === 'look' || action.action === 'move') && 
              action.roomData && 
              action.success !== false &&
              !action.suppressRoomDisplay
            
            // Regular action (LOOK, REST, SEARCH, ATTACK, etc.)
            return (
              <div key={action.id} className="space-y-2">
                <div
                  className={`action-bar rounded-lg p-2 border border-gray-700/50 ${
                    isLastAction ? 'border-1 border-emerald-500/60 bg-emerald-500/10' : 'border-l-0 border-gray-800/50 bg-gray-900/30 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-gray-500/70 whitespace-nowrap shrink-0">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                    <p className={`text-sm ${
                      action.action === 'move' 
                        ? 'italic text-gray-400/80' 
                        : 'text-gray-300/90'
                    }`}>
                      {action.message}
                    </p>
                  </div>
                </div>
                
                {/* Roombox display after look or move action */}
                {shouldShowRoombox && (
                  <div className="border border-gray-700/50 rounded-lg bg-gray-900/50 overflow-hidden">
                    {renderRoomInfo(action.roomData, {
                      player,
                      onAction: handleRoomDisplayAction,
                      worldTick,
                      actionResult,
                    })}
                  </div>
                )}
              </div>
            )
          })}

        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleUnreadIndicatorClick}
            className="absolute left-1/2 bottom-4 -translate-x-1/2 bg-gray-900/95 backdrop-blur-sm text-white text-sm px-4 py-1.5 rounded-full shadow-lg border border-emerald-500/50 flex items-center gap-2 z-10 hover:bg-gray-800/95 transition-all duration-200"
            aria-label={`${unreadCount} new message${unreadCount === 1 ? '' : 's'}. Click to scroll to bottom.`}
          >
            <span>{unreadCount === 1 ? '1 new message' : `${unreadCount} new messages`}</span>
            <span aria-hidden="true">↓</span>
          </button>
        )}
      </div>
    </div>
  )
}
