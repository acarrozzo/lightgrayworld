'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Room, useGameStore } from '@/lib/game-state'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { ActionResultPayload, ActionErrorPayload, RoomPlayerMovedPayload, ChatMessage } from '@/lib/socket'
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
}

export default function GameFeed({ room, actionResult, className = '', onRegisterControls }: GameFeedProps) {
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
  const pendingRoomDisplays = useRef(
    new Map<
      string,
      {
        roomId: string
      }
    >()
  )
  const { getAuthHeaders, player, setCurrentRoom, setRoomPlayers, getCachedRoom } = useGameStore()
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)

  const handleRoomDisplayAction = useCallback(async (action: string) => {
    const success = socketHandlers.sendGameAction(action)
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
      feedRef.current.scrollTop = feedRef.current.scrollHeight
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
      let supplementalRoomAction: ActionHistory | null = null

      if (entry.roomData && !entry.suppressRoomDisplay) {
        const timestampMs = new Date(entry.timestamp || Date.now()).getTime()
        supplementalRoomAction = {
          id: `room-display-${entry.roomData.roomId || 'unknown'}-${timestampMs}`,
          action: 'room-display',
          message: `Room: ${entry.roomData.name}`,
          timestamp: new Date(timestampMs + 1).toISOString(),
          success: true,
          roomData: entry.roomData,
        }
      }

      setActions((prev) => {
        let nextEntries = [...prev, entry]

        if (supplementalRoomAction) {
          nextEntries = [...nextEntries, supplementalRoomAction]
        }

        return deduplicateActions(nextEntries)
      })

      if (
        !entry.roomData &&
        entry.roomId &&
        (entry.action === 'move' || entry.action === 'look') &&
        !entry.suppressRoomDisplay
      ) {
        pendingRoomDisplays.current.set(entry.id, { roomId: entry.roomId })
      }
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
    return {
      id: message.id || `socket-chat-${timestamp}`,
      action: 'chat',
      message: `[${message.username}] ${message.message}`,
      timestamp,
      roomId: message.roomId,
      metadata: JSON.stringify(message),
    }
  }, [])

  // Listen for real-time action updates
  useEffect(() => {
    if (!socket || !player) {
      return
    }

    const cleanupActionResult = socketHandlers.onActionResult((payload) => {
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

      if (payload.action === 'move') {
        const targetRoomId = payload.data?.toRoom || payload.data?.roomId
        const cachedRoom = targetRoomId ? getCachedRoom(targetRoomId) : null

        if (cachedRoom) {
          augmentedPayload.data = {
            ...(augmentedPayload.data || {}),
            roomData: cachedRoom,
          }
        }

        // Server already sends the descriptive travel message once the room data is known.
        // Avoid overriding it here so we can take advantage of the improved payload.
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

    return () => {
      cleanupActionResult()
      cleanupActionError()
      cleanupRoomMove()
      cleanupChat()
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
    room,
    getCachedRoom,
    resolveActiveRoomData,
  ])

  useEffect(() => {
    if (!room) {
      return
    }

    pendingRoomDisplays.current.forEach((info, actionId) => {
      if (info.roomId === room.roomId) {
        pendingRoomDisplays.current.delete(actionId)
        const timestamp = new Date().toISOString()
        const normalizedRoomData: ActionHistory['roomData'] = {
          ...room,
          players: Array.isArray(room.players) ? room.players : [],
          items: Array.isArray(room.items) ? room.items : [],
          npcs: Array.isArray(room.npcs) ? room.npcs : [],
        }
        const roomDisplayEntry: ActionHistory = {
          id: `room-display-${room.roomId}-${timestamp}`,
          action: 'room-display',
          message: `Room: ${room.name}`,
          timestamp,
          success: true,
          roomData: normalizedRoomData,
        }
        pushAction(roomDisplayEntry)
      }
    })
  }, [room, pushAction])

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

  // Get room-specific icon
  const getRoomIcon = (roomId: string) => {
    switch (roomId) {
      case '000': return 'roomzero'
      case '001': return 'sun'
      case '002': return 'redberry'
      case '003': return 'cabin2'
      case '004': return 'flower'
      case '005': return 'blueberry'
      case '006': return 'basicshop'
      case '007': return 'cave1'
      case '020': return 'waterfall'
      case '021': return 'tent'
      default: return 'sun'
    }
  }

  const renderRoomInfo = (roomData: any, action?: string, isMostRecent: boolean = false) => {
    // Get room-specific actions
    const getRoomActions = (roomId: string) => {
      switch (roomId) {
        case '000': // Room Zero
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'pick up map', label: 'Pick Up Map' },
            { action: 'press button', label: 'Press Button' },
          ]
        case '001': // Grassy Field Crossroads
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'ex chest', label: 'Examine Chest' },
            { action: 'open chest', label: 'Open Gold Chest' },
          ]
        case '002': // Grassy Field South
          return [
            { action: 'pick redberry', label: 'Pick Redberry' },
          ]
        case '003': // Wood Cabin
          return [
            { action: 'ex cabin', label: 'Examine Cabin' },
            { action: 'attack dummy', label: 'Attack Dummy' },
            { action: 'cook meat', label: 'Cook Meat' },
          ]
        case '004': // Flower Patch
          return [
            { action: 'pick flower', label: 'Pick Flower' },
          ]
        case '005': // Grassy Field North
          return [
            { action: 'pick blueberry', label: 'Pick Blueberry' },
            { action: 'ex tent', label: 'Examine Tent' },
          ]
        case '006': // Basic Shop
          return [
            { action: 'buy dagger', label: 'Buy Dagger' },
            { action: 'buy potion', label: 'Buy Potion' },
          ]
        case '007': // Cave Entrance
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'search', label: 'Search' },
          ]
        case '020': // Healing Springs
          return [
            { action: 'rest', label: 'Rest at Waterfall' },
          ]
        case '021': // Pajama Shaman
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'buy staff', label: 'Buy Staff' },
          ]
        default:
          return []
      }
    }

    const roomActions = getRoomActions(roomData.roomId)
    const defaultSubtitle = 'This is it. The world is yours.'
    const subtitleText = (roomData.subtitle ?? defaultSubtitle).trim()
    const hasSubtitle = subtitleText.length > 0
    const subtitlePlacement = roomData.subtitlePosition?.toLowerCase() === 'above' ? 'above' : 'below'

    return (
      <div className="p-6">
        {/* Header with icon and two-line title */}
        <div className="flex items-start gap-4 mb-4">
          <Icon name={getRoomIcon(roomData.roomId)} size={64} color="yellow" />
          <div className="flex-1">
            {hasSubtitle && subtitlePlacement === 'above' && (
              <p className="text-blue-300 text-sm mb-1">{subtitleText}</p>
            )}
            <h3 className="text-xl font-bold text-green-400">{roomData.name}</h3>
            {hasSubtitle && subtitlePlacement === 'below' && (
              <p className="text-blue-300 text-sm mt-1">{subtitleText}</p>
            )}
          </div>
        </div>

        {/* Room Description */}
        <p className="text-gray-300 leading-relaxed mb-6">
          {roomData.description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Universal actions */}
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            West
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            South
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            North
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            East
          </button>
          
          {/* Room-specific actions */}
          {roomActions.map((actionItem) => (
            <button
              key={actionItem.action}
              className={`px-4 py-2 text-white rounded-md text-sm flex items-center gap-2 ${
                actionItem.action === 'read sign' ? 'bg-amber-600 hover:bg-amber-700' :
                actionItem.action === 'open chest' ? 'bg-orange-500 hover:bg-orange-600' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {actionItem.action === 'read sign' && <Icon name="sign" size={18} color="white" />}
              {actionItem.action === 'open chest' && <Icon name="chest" size={18} color="white" />}
              {actionItem.label}
            </button>
          ))}
        </div>

        <RoomDisplay
          room={roomData}
          roomPlayers={Array.isArray(roomData.players) ? roomData.players : []}
          currentPlayerId={player?.id}
          onAction={handleRoomDisplayAction}
          showHeader={false}
          className="mt-6"
        />

        {/* Additional room info sections */}
        {(roomData.players?.length > 0 || roomData.items?.length > 0 || roomData.npcs?.length > 0) && (          <div className="mt-6 space-y-3">
            {/* Players in Room */}
            {roomData.players && roomData.players.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">Also Here:</h4>
                <div className="flex flex-wrap gap-2">
                  {roomData.players.map((player: any) => (
                    <span
                      key={player.id}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full"
                    >
                      [{player.level}] {player.username}
                    </span>
                  ))}
                </div>
              </div>
            )}


            {/* Items in Room */}
            {roomData.items && roomData.items.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-green-400 mb-2">Items:</h4>
                <div className="flex flex-wrap gap-2">
                  {roomData.items.map((item: any) => (
                    <span
                      key={item.id}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded-full"
                    >
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* NPCs in Room */}
            {roomData.npcs && roomData.npcs.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-purple-400 mb-2">NPCs:</h4>
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

  if (!initialRoom) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading room...</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      <div className="relative flex-1 overflow-hidden">
        {/* Feed Content */}
        <div 
          ref={feedRef}
          data-near-bottom={isNearBottom ? 'true' : 'false'}
          className="absolute inset-0 overflow-y-auto p-4 space-y-4"
        >
          {/* Initial Room Info - Always show at the top */}
          <div className="space-y-4">
            <div className="text-center text-gray-500 py-4">
              <p className="text-lg font-semibold mb-2">Welcome to {initialRoom.name}!</p>
              <p className="text-sm">Your adventure begins here.</p>
            </div>
            <div className={`bg-gray-800 rounded-lg ${
              actions.length === 0 ? 'border-2 border-green-500' : 'border border-gray-600'
            }`}>
              {renderRoomInfo(initialRoom, undefined, actions.length === 0)}
            </div>
          </div>

          {/* Actions List */}
          {actions.map((action, index) => {
            // Check if this is the last action in the feed (bottom-most)
            const isLastAction = index === actions.length - 1
            
            // Check if this is a room-display action
            if (action.action === 'room-display') {
              return (
                <div
                  key={action.id}
                  className={`room-box bg-gray-800 rounded-lg ${
                    isLastAction ? 'border-2 border-green-500' : 'border border-gray-600'
                  }`}
                >
                  {renderRoomInfo(action.roomData, action.action, isLastAction)}
                </div>
              )
            }
            
            // Regular action (LOOK, REST, SEARCH, ATTACK, etc.)
            return (
              <div
                key={action.id}
                className={`action-bar rounded-lgX p-X2 border-r ${
                  isLastAction ? 'border-green-500' : 'border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                  <p className="text-gray-300 text-sm">
                    {action.message}
                  </p>
                </div>
              </div>
            )
          })}

        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleUnreadIndicatorClick}
            className="absolute left-1/2 bottom-4 -translate-x-1/2 bg-gray-800/90 text-white text-sm px-4 py-2 rounded-full shadow-lg border border-green-400/60 flex items-center gap-2 z-10 hover:bg-gray-700/90 transition-colors"
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
