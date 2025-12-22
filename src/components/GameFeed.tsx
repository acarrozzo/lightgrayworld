'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Room, useGameStore } from '@/lib/game-state'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { ActionResultPayload, ActionErrorPayload, RoomPlayerMovedPayload, ChatMessage, WorldTickPayload } from '@/lib/socket'
import { normalizeRoom } from '@/lib/normalize/room'

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

      const normalizeAndAttachRoomData = (roomData?: any) => {
        const normalizedRoomData = normalizeRoom(roomData)
        if (normalizedRoomData) {
          augmentedPayload.data = {
            ...(augmentedPayload.data || {}),
            roomData: normalizedRoomData,
          }
        }
      }

      if (payload.data?.roomData) {
        normalizeAndAttachRoomData(payload.data.roomData)
      }

      if (payload.action === 'look') {
        const resolvedRoomData =
          payload.data?.roomData ||
          resolveActiveRoomData() ||
          (payload.data?.roomId ? getCachedRoom(payload.data.roomId) : null)

        if (resolvedRoomData) {
          normalizeAndAttachRoomData(resolvedRoomData)
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
