'use client'

import { useGameStore } from '@/lib/game-state'
import type { Room, Player } from '@/lib/game-state'
import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'
import GameHeader from './GameHeader'
import GameSidebar from './GameSidebar'
import UnifiedFeedPanel, { type InputMode } from './UnifiedFeedPanel'
import RoomBox from './RoomBox'
import Compass from './Compass'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import SettingsModal from './SettingsModal'
import MapModal, { type MapOption } from './MapModal'
import TeleportModal, { type TeleportLocation } from './TeleportModal'
import ActionModal from './ActionModal'
import Icon from './Icon'
import { normalizeRoom, normalizeRoomItems } from '@/lib/normalize/room'
import { useWorldFeedStore } from '@/store/worldFeedStore'
import type { WorldFeedEntryInput } from '@/store/worldFeedStore'
import { useNotificationStore } from '@/store/notificationStore'
import NotificationContainer from './NotificationContainer'

const TRAVEL_DIRECTION_KEYS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down'] as const

type TravelDirectionKey = (typeof TRAVEL_DIRECTION_KEYS)[number]

const findTravelDirection = (fromRoom: Room | null, toRoomId: string): TravelDirectionKey | undefined => {
  if (!fromRoom) {
    return undefined
  }

  return TRAVEL_DIRECTION_KEYS.find((direction) => fromRoom[direction] === toRoomId)
}

// Command shorthand mapping
const COMMAND_SHORTHAND: Record<string, string> = {
  // Directions
  'n': 'north',
  'e': 'east',
  's': 'south',
  'w': 'west',
  'ne': 'northeast',
  'nw': 'northwest',
  'se': 'southeast',
  'sw': 'southwest',
  'u': 'up',
  'd': 'down',
  // Actions
  'l': 'look',
  'a': 'attack',
}

/**
 * Normalizes a command by converting shorthand to full command names.
 * Returns the full command if a shorthand is found, otherwise returns the original input.
 * This maintains backward compatibility with full commands.
 */
const normalizeCommand = (input: string): string => {
  const normalized = input.toLowerCase().trim()
  return COMMAND_SHORTHAND[normalized] || normalized
}

// Map configuration
const MAP_CONFIG: Array<MapOption & { flag: keyof Player }> = [
  { id: 'grassy-field', src: '/img/lightgray_map_grassyfield_main.jpg', title: 'Grassy Field', flag: 'grassyFieldMap' },
  { id: 'grassy-field-underground', src: '/img/lightgray_map_grassyfield_underground.jpg', title: 'Grassy Field Underground', flag: 'grassyFieldUndergroundMap' },
  { id: 'room-zero', src: '/img/lightgray_map_roomzero.jpg', title: 'Room Zero', flag: 'roomZeroMap' },
  { id: 'lobby', src: '/img/lightgray_map_the_lobby.jpg', title: 'The Lobby', flag: 'lobbyMap' },
]

// Helper function to determine which map corresponds to a room
const getMapIdForRoom = (roomId: string): string => {
  if (roomId === '000') return 'room-zero'
  if (roomId === '999') return 'lobby'
  return 'grassy-field' // Default for grassy field rooms
}

// Helper function to get unlocked maps - all maps are available to everyone
const getUnlockedMaps = (player: Player | null, currentRoomId: string | undefined): MapOption[] => {
  // Everyone can view all maps - no restrictions
  return MAP_CONFIG
}

// Teleport locations configuration
const TELEPORT_LOCATIONS: TeleportLocation[] = [
  { roomId: '999', name: 'Lobby', description: 'The main lobby area' },
  { roomId: '001', name: 'Grassy Field', description: 'Grassy Field Crossroads' },
  { roomId: '000', name: 'Room Zero', description: 'The starting room' },
]

// Helper function to render directory content for sign modals
const renderDirectoryContent = (
  modalContent: any,
  buttons: Array<{ label: string; direction: string }>
): React.ReactNode => {
  const heading = modalContent.heading
  const locations = modalContent.locations || []
  const questMessage = modalContent.questMessage

  return (
    <div className="w-full">
      {/* Directory Panel */}
      <div className="bg-amber-900/30 border border-amber-800/50 rounded-lg p-6 mb-4">
        {/* Heading */}
        {heading && heading.parts ? (
          <>
            <h3 className="text-2xl font-bold mb-2">
              <span className="text-white">{heading.parts[0]}</span>
              {' '}
              <span className="text-yellow-400">{heading.parts[1]}</span>
            </h3>
            {heading.description && (
              <p className="text-sm text-amber-200/70 mb-6 leading-relaxed">{heading.description}</p>
            )}
          </>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-white mb-2">{heading?.text || 'Directory'}</h3>
            {heading?.description && (
              <p className="text-sm text-amber-200/70 mb-6 leading-relaxed">{heading.description}</p>
            )}
          </>
        )}

        {/* Location Buttons */}
        <div className="space-y-4 mb-4">
          {locations.map((location: any, index: number) => {
            const button = buttons.find(b => b.direction === location.direction)
            return (
              <div key={index} className="flex items-start gap-4">
                {button && (
                  <button
                    type="button"
                    data-direction={button.direction}
                    className="w-28 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium text-[0.97rem] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-900/30 flex-shrink-0"
                  >
                    {button.label}
                  </button>
                )}
                <div className="flex-1 space-y-1">
                  <span className="text-white text-lg">{location.name}</span>
                  {location.description && (
                    <p className="text-sm text-amber-200/70 leading-relaxed">{location.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Separator */}
        <div className="border-t border-amber-700/50 my-4"></div>

        {/* Quest Message */}
        {questMessage && (
          <>
            <p className="text-white text-base leading-relaxed">{questMessage}</p>
            {modalContent.questMessageDescription && (
              <p className="text-sm text-amber-200/70 mt-2 leading-relaxed">{modalContent.questMessageDescription}</p>
            )}
            <div className="border-t border-amber-700/50 my-4"></div>
          </>
        )}
      </div>
    </div>
  )
}

// Helper function to format direction phrases for feed messages
const formatDirectionPhrase = (direction: string | null | undefined, context: 'enter' | 'exit'): string => {
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

export default function GameInterface() {
  const {
    player,
    setPlayer,
    currentRoom,
    roomPlayers,
    setCurrentRoom,
    setRoomPlayers,
    getAuthHeaders,
    isLoggedIn,
    cacheRoom,
    getCachedRoom,
    setInventory,
    logout,
  } = useGameStore()
  const { updateRoomItems } = useGameStore()
  const [action, setAction] = useState('')
  const [actionResult, setActionResult] = useState<any>(null)
  const [isLoadingRoom, setIsLoadingRoom] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [isTeleportModalOpen, setIsTeleportModalOpen] = useState(false)
  const [mapInfo, setMapInfo] = useState<{ src: string; title: string }>({ src: '', title: '' })
  const [currentMapId, setCurrentMapId] = useState<string>('grassy-field')
  const [actionModal, setActionModal] = useState<{ 
    isOpen: boolean
    title: string
    content: string | React.ReactNode
    buttons?: Array<{ label: string; direction: string }>
  }>({
    isOpen: false,
    title: '',
    content: '',
  })
  const [customAction, setCustomAction] = useState('')
  const [worldTick, setWorldTick] = useState<{
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  } | undefined>(undefined)
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)
  const lastLoginSocketId = useRef<string | null>(null)
  const playerRef = useRef(player)
  const currentRoomRef = useRef(currentRoom)
  const customActionInputRef = useRef<HTMLInputElement>(null)
  const appendWorldFeed = useCallback((entry: WorldFeedEntryInput) => {
    const { append } = useWorldFeedStore.getState()
    return append(entry)
  }, [])
  const handleLogoutFlow = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      })
    } catch (error) {
      console.error('[GameInterface] Failed to call logout API', error)
    } finally {
      socketHandlers.logoutPlayer()
      logout()
      const { clear } = useWorldFeedStore.getState()
      clear()
    }
  }, [getAuthHeaders, logout, socketHandlers])

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedLeftSidebar = localStorage.getItem('leftSidebarOpen')
    const savedRightSidebar = localStorage.getItem('rightSidebarOpen')
    
    if (savedLeftSidebar !== null) {
      setLeftSidebarOpen(JSON.parse(savedLeftSidebar))
    }
    if (savedRightSidebar !== null) {
      setRightSidebarOpen(JSON.parse(savedRightSidebar))
    }
  }, [])

  // Listen for world ticks to drive countdowns
  useEffect(() => {
    if (!socket) return
    const cleanup = socketHandlers.onWorldTick((payload) => {
      const tickNumber = payload?.tickNumber ?? payload?.tickId ?? 0
      const interval = payload?.tickIntervalMs ?? 10000
      const nextTickAt = payload?.nextTickAt ?? (Date.now() + interval)
      setWorldTick({
        tickNumber,
        nextTickAt,
        tickIntervalMs: interval,
      })
    })
    return cleanup
  }, [socket, socketHandlers])

  useEffect(() => {
    if (!socket) return
    const cleanup = socketHandlers.onRoomItemsUpdate((payload) => {
      if (!payload?.roomId || !Array.isArray(payload.items)) return
      updateRoomItems(payload.roomId, normalizeRoomItems(payload.items))
    })
    return cleanup
  }, [socket, socketHandlers, updateRoomItems])

  useEffect(() => {
    if (!socket) return
    const cleanup = socketHandlers.onWorldActivity((payload) => {
      if (!payload) return
      appendWorldFeed({
        id: payload.id,
        ts: payload.ts,
        type: payload.type ?? 'world',
        level: payload.level,
        actor: payload.actor,
        message: payload.message,
        eventType: payload.eventType,
      })
    })
    return cleanup
  }, [socket, socketHandlers, appendWorldFeed])

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('leftSidebarOpen', JSON.stringify(leftSidebarOpen))
  }, [leftSidebarOpen])

  useEffect(() => {
    localStorage.setItem('rightSidebarOpen', JSON.stringify(rightSidebarOpen))
  }, [rightSidebarOpen])

  // Keyboard shortcuts for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts on desktop (when sidebars are not always visible)
      if (window.innerWidth >= 768) return
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault()
            setLeftSidebarOpen(!leftSidebarOpen)
            break
          case '2':
            e.preventDefault()
            setRightSidebarOpen(!rightSidebarOpen)
            break
          case 'Escape':
            e.preventDefault()
            setLeftSidebarOpen(false)
            setRightSidebarOpen(false)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [leftSidebarOpen, rightSidebarOpen])

  // Touch/swipe gesture support for mobile
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    const minSwipeDistance = 50

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartX || !touchStartY) return

      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const deltaX = touchEndX - touchStartX
      const deltaY = touchEndY - touchStartY

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          // Swipe right - open left sidebar
          setLeftSidebarOpen(true)
          setRightSidebarOpen(false)
        } else {
          // Swipe left - open right sidebar
          setRightSidebarOpen(true)
          setLeftSidebarOpen(false)
        }
      }

      touchStartX = 0
      touchStartY = 0
    }

    // Only add touch listeners on mobile
    if (window.innerWidth < 768) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
      document.addEventListener('touchend', handleTouchEnd, { passive: true })
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const loadRoomData = useCallback(async (options?: { isTransition?: boolean; travel?: { toRoomId?: string }; requireAuth?: boolean; roomData?: any }) => {
    const isTransition = options?.isTransition ?? false
    const travelTarget = options?.travel?.toRoomId
    const shouldUseAuth = options?.requireAuth ?? isLoggedIn
    const previousRoom = currentRoomRef.current
    const providedRoomData = options?.roomData

    if (!isTransition) {
      setIsLoadingRoom(true)
    }

    let travelResultEmitted = false

    // If roomData is provided (e.g., from socket event), use it directly
    if (providedRoomData && providedRoomData.roomId) {
      const normalizedRoom = normalizeRoom({
        ...providedRoomData,
        // Preserve worldTick if present in provided data
        ...(providedRoomData.worldTick ? { worldTick: providedRoomData.worldTick } : {}),
      })
      if (normalizedRoom) {
        cacheRoom(normalizedRoom)
        setCurrentRoom(normalizedRoom)
        setRoomPlayers(normalizedRoom.players)
        
        if (player && player.currentRoom !== normalizedRoom.roomId) {
          setPlayer({ ...player, currentRoom: normalizedRoom.roomId })
        }
        
        if (!isTransition) {
          setIsLoadingRoom(false)
        }
        setIsInitialLoad(false)
        return
      }
    }

    if (isTransition && travelTarget) {
      const cachedRoom = getCachedRoom(travelTarget)
      if (cachedRoom) {
        setCurrentRoom(cachedRoom)
        travelResultEmitted = true
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (shouldUseAuth) {
        Object.assign(headers, getAuthHeaders())
      }

      const endpoint = travelTarget
        ? `/api/game/room/current?roomId=${encodeURIComponent(travelTarget)}`
        : '/api/game/room/current'

      const response = await fetch(endpoint, {
        headers,
      })
      
      if (response.ok) {
        const roomData = await response.json()
        const roomPlayers = Array.isArray(roomData.players) ? roomData.players : []
        const normalizedRoom = normalizeRoom({
          ...roomData.room,
          players: roomPlayers,
          // Preserve actionCaps from API response if present
          ...(roomData.actionCaps ? { actionCaps: roomData.actionCaps } : {}),
          // Preserve worldTick from API response if present
          ...(roomData.worldTick ? { worldTick: roomData.worldTick } : {}),
        })
        
        if (normalizedRoom) {
          cacheRoom(normalizedRoom)
          setCurrentRoom(normalizedRoom)
          setRoomPlayers(roomPlayers)
        }

        if (player && normalizedRoom && player.currentRoom !== normalizedRoom.roomId) {
          console.log('[GameInterface] Syncing player.currentRoom to', normalizedRoom.roomId)

          if (shouldUseAuth) {
            try {
              const syncResponse = await fetch('/api/game/room/sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...getAuthHeaders(),
                },
                body: JSON.stringify({ roomId: normalizedRoom.roomId }),
              })

              if (!syncResponse.ok) {
                const errorText = await syncResponse.text()
                console.error(
                  'Failed to sync player room on server:',
                  syncResponse.status,
                  syncResponse.statusText,
                  errorText
                )
              }
            } catch (error) {
              console.error('Failed to sync player room on server:', error)
            }
          }

          setPlayer({ ...player, currentRoom: normalizedRoom.roomId })
        }

        if (normalizedRoom && options?.travel && !travelResultEmitted) {
          travelResultEmitted = true
          const travelDirection = findTravelDirection(previousRoom, normalizedRoom.roomId)
          const travelMessage = travelDirection
            ? `You travel ${travelDirection} to the ${normalizedRoom.name}`
            : `You teleport to ${normalizedRoom.name}`

          console.log('[GameInterface] Travel result emitted locally skipped in favor of server payload')
        }
      } else {
        const errorText = await response.text()
        console.error('Failed to load room data:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error('Failed to load room data:', error)
    } finally {
      if (!isTransition) {
        setIsLoadingRoom(false)
      }
      setIsInitialLoad(false)
    }
  }, [getAuthHeaders, cacheRoom, setCurrentRoom, setRoomPlayers, player, setPlayer, getCachedRoom, isLoggedIn])
  const loadRoomDataRef = useRef(loadRoomData)

  useEffect(() => {
    playerRef.current = player
  }, [player])

  useEffect(() => {
    const { setUser } = useWorldFeedStore.getState()
    setUser(player?.id ?? null)
  }, [player?.id])

  useEffect(() => {
    const { setUser } = useNotificationStore.getState()
    setUser(player?.id ?? null)
  }, [player?.id])

  useEffect(() => {
    currentRoomRef.current = currentRoom
  }, [currentRoom])

  useEffect(() => {
    loadRoomDataRef.current = loadRoomData
  }, [loadRoomData])

  useEffect(() => {
    if (player && isLoggedIn && !currentRoom) {
      // Only load room data if we don't already have it
      loadRoomData()
    }
  }, [player, isLoggedIn, currentRoom, loadRoomData])

  useEffect(() => {
    if (!isLoggedIn && isInitialLoad) {
      loadRoomData({ requireAuth: false })
    }
  }, [isLoggedIn, isInitialLoad, loadRoomData])

  const handleAction = async (actionInput: string | { type: string; data?: any }) => {
    const actionType = typeof actionInput === 'string' ? actionInput : actionInput.type
    const actionData = typeof actionInput === 'string' ? undefined : actionInput.data

    console.log('[handleAction] Called with action:', actionType, 'data:', actionData)
    setAction(actionType)
    setActionResult(null)

    const normalizedAction = actionType.toLowerCase()
    
    // Handle "teleport to grassy field" string action - convert to teleport object format
    if (normalizedAction === 'teleport to grassy field') {
      console.log('[handleAction] Converting teleport to grassy field string to teleport object')
      return handleAction({ type: 'teleport', data: { toRoomId: '001' } })
    }
    
    // Handle teleport action
    if (normalizedAction === 'teleport' && actionData?.toRoomId) {
      console.log('[handleAction] Teleport action detected, target room:', actionData.toRoomId)
      if (!currentRoom) {
        console.warn('No current room available for teleport action')
        setActionResult({
          action: 'teleport',
          message: 'Cannot teleport: no current room',
          timestamp: new Date().toISOString(),
          success: false,
          source: 'local',
        })
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: 'Cannot teleport: no current room',
          roomId: currentRoomRef.current?.roomId,
        })
        return
      }

      const targetRoomId = actionData.toRoomId
      console.log('[handleAction] Teleporting from', currentRoom.roomId, 'to', targetRoomId)

      // Optimistic update: immediately use cached room if available
      const cachedTargetRoom = getCachedRoom(targetRoomId)
      if (cachedTargetRoom) {
        console.log('[handleAction] Using cached room for optimistic update:', cachedTargetRoom.name)
        setCurrentRoom(cachedTargetRoom)
        // Update player room optimistically
        if (player && player.currentRoom !== targetRoomId) {
          setPlayer({ ...player, currentRoom: targetRoomId })
        }
      }

      if (socket) {
        console.log('[handleAction] Emitting player-move event for teleport:', { fromRoom: currentRoom.roomId, toRoom: targetRoomId })
        socket.emit('player-move', {
          fromRoom: currentRoom.roomId,
          toRoom: targetRoomId,
        })
      } else {
        console.warn('Socket not connected; teleport request not sent')
      }

      return
    }
    
    // Check if this is a navigation action for optimistic updates
    const travelActions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'move', 'navigate']
    const isNavigationAction = travelActions.includes(normalizedAction)
    
    if (isNavigationAction) {
      console.log('[handleAction] Navigation action detected, currentRoom:', currentRoom?.roomId)
      if (!currentRoom) {
        console.warn('No current room available for navigation action')
        setActionResult({
          action: 'move',
          message: `You don't see an exit in that direction (${actionType})`,
          timestamp: new Date().toISOString(),
          success: false,
          source: 'local',
        })
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: `You don't see an exit in that direction (${actionType})`,
          roomId: currentRoomRef.current?.roomId,
        })
        return
      }

      const targetRoomId = currentRoom[actionType as keyof typeof currentRoom]
      console.log('[handleAction] Target room:', targetRoomId)

      if (!targetRoomId || typeof targetRoomId !== 'string') {
        console.warn('Navigation target not available from current room')
        setActionResult({
          action: 'move',
          message: `You don't see an exit in that direction (${actionType})`,
          timestamp: new Date().toISOString(),
          success: false,
          source: 'local',
        })
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: `You don't see an exit in that direction (${actionType})`,
          roomId: currentRoomRef.current?.roomId,
        })
        return
      }

      // Optimistic update: immediately use cached room if available
      const cachedTargetRoom = getCachedRoom(targetRoomId)
      if (cachedTargetRoom) {
        console.log('[handleAction] Using cached room for optimistic update:', cachedTargetRoom.name)
        setCurrentRoom(cachedTargetRoom)
        // Update player room optimistically
        if (player && player.currentRoom !== targetRoomId) {
          setPlayer({ ...player, currentRoom: targetRoomId })
        }
      }

      if (socket) {
        console.log('[handleAction] Emitting player-move event:', { fromRoom: currentRoom.roomId, toRoom: targetRoomId })
        socket.emit('player-move', {
          fromRoom: currentRoom.roomId,
          toRoom: targetRoomId,
        })
      } else {
        console.warn('Socket not connected; movement request not sent')
      }

      return
    }

    if (normalizedAction === 'look') {
      console.log('[handleAction] Look action detected, sending to server')
      if (!currentRoom) {
        console.warn('Look action requested but no current room is available')
      }
      const lookResult = socketHandlers.sendGameAction(actionType)
      console.log('[handleAction] sendGameAction result for look:', lookResult)
      if (!lookResult) {
        console.warn('Failed to send look action via socket')
      }
      return
    }

    console.log('[handleAction] Non-navigation action, sending via socketHandlers')
    const payload = actionData ? { type: normalizedAction, data: actionData } : actionType
    const result = socketHandlers.sendGameAction(payload as any)
    console.log('[handleAction] sendGameAction result:', result)
    if (!result) {
      console.warn('Failed to send game action via socket; action will be ignored')
    }
  }

  const handleCustomAction = (e: React.FormEvent, mode: InputMode) => {
    e.preventDefault()
    const actionToSend = customAction.trim()
    if (!actionToSend) return

    setCustomAction('') // Clear input immediately

    const lowerInput = actionToSend.toLowerCase()
    const sayMatch = lowerInput.startsWith('say ')
    const shoutMatch = lowerInput.startsWith('shout ')
    const singleQuoteMatch = actionToSend.startsWith("'")
    const doubleQuoteMatch = actionToSend.startsWith('"')
    const exclamationMatch = actionToSend.startsWith('!')

    // Prefix detection as fallback/override
    const prefixIsRoomChat = sayMatch || singleQuoteMatch || doubleQuoteMatch
    const prefixIsWorldChat = shoutMatch || exclamationMatch

    // Determine chat type: prefix overrides mode, otherwise use mode
    let isRoomChat = false
    let isWorldChat = false

    if (prefixIsRoomChat || prefixIsWorldChat) {
      // Prefix detection takes precedence
      isRoomChat = prefixIsRoomChat
      isWorldChat = prefixIsWorldChat
    } else {
      // Use selected mode
      isRoomChat = mode === 'room'
      isWorldChat = mode === 'world'
    }

    if (isRoomChat || isWorldChat) {
      let message = ''

      if (sayMatch || shoutMatch) {
        const firstSpace = actionToSend.indexOf(' ')
        message = firstSpace >= 0 ? actionToSend.slice(firstSpace + 1).trim() : ''
      } else if (singleQuoteMatch || doubleQuoteMatch || exclamationMatch) {
        message = actionToSend.slice(1).trim()
      } else {
        // No prefix, use the input as-is for the selected mode
        message = actionToSend
      }

      if (!message) {
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: "To chat: say hello | 'hello | \"hello | shout hello | !hello",
        })
        return
      }
      if (isRoomChat) {
        const roomId = currentRoomRef.current?.roomId
        if (!roomId) {
          appendWorldFeed({
            type: 'action',
            level: 'error',
            message: 'You must be in a room to chat. Try again after loading a room.',
          })
          return
        }

        const sent = socketHandlers.sendRoomChatMessage(message, roomId)
        if (!sent) {
          appendWorldFeed({
            type: 'action',
            level: 'error',
            message: 'Failed to send room chat. Please try again.',
          })
        }
        return
      }
      if (isWorldChat) {
        const sent = socketHandlers.sendChatMessage(message)
        if (!sent) {
          appendWorldFeed({
            type: 'action',
            level: 'error',
            message: 'Failed to send world chat. Please try again.',
          })
        }
        return
      }
    }

    // If not chat, treat as action
    const normalizedCommand = normalizeCommand(actionToSend)
    handleAction(normalizedCommand)
  }

  useEffect(() => {
    if (!socket) {
      return
    }

    const cleanupActionFeedback = socketHandlers.onActionFeedback((payload) => {
      console.log('[GameInterface] Received action:feedback event:', payload)
      const outcome = payload?.outcome ?? 'info'
      const success = outcome === 'success'
      const timestampMs =
        typeof payload?.ts === 'number'
          ? payload.ts
          : Date.now()
      const messageText = payload?.message || payload?.action || 'Action feedback'

      setActionResult({
        action: payload?.action,
        success,
        outcome,
        message: messageText,
        timestamp: new Date(timestampMs).toISOString(),
        source: 'socket',
        data: payload?.data,
      })

      if (payload?.data?.inventory) {
        setInventory(payload.data.inventory)
      }

      if (payload?.data?.roomItems && currentRoomRef.current?.roomId) {
        updateRoomItems(currentRoomRef.current.roomId, normalizeRoomItems(payload.data.roomItems))
      }

      if (payload?.action === 'move' && success && payload?.data?.toRoom) {
        console.log('[GameInterface] Processing move action feedback')
        const currentPlayer = playerRef.current
        if (currentPlayer && currentPlayer.currentRoom !== payload.data.toRoom) {
          console.log('[GameInterface] Updating player room to:', payload.data.toRoom)
          setPlayer({ ...currentPlayer, currentRoom: payload.data.toRoom })
        }

        console.log('[GameInterface] Loading room data for:', payload.data.toRoom)
        loadRoomDataRef.current?.({
          isTransition: true,
          travel: { toRoomId: payload.data.toRoom },
          roomData: payload.data?.roomData,
        })
      }

      const isMoveAction = payload?.action === 'move'
      const travelDirection = isMoveAction && payload?.data?.direction ? payload.data.direction : undefined
      
      appendWorldFeed({
        type: 'action',
        message: messageText,
        roomId: payload?.data?.roomId || payload?.roomId || currentRoomRef.current?.roomId,
        ts: timestampMs,
        outcome,
        eventType: isMoveAction ? 'room-travel' : undefined,
        direction: travelDirection,
      })

      // Check if action should open a modal
      if (payload?.data?.showModal === true) {
        const modalContent = payload?.data?.modalContent
        const buttons = payload?.data?.buttons
        
        // Check if modalContent is structured (object) or simple string
        let renderedContent: string | React.ReactNode = messageText
        let modalTitle = payload?.action || 'Action'
        
        if (modalContent && typeof modalContent === 'object' && !Array.isArray(modalContent)) {
          // Check if it's an icon type modal
          if (modalContent.type === 'icon' && modalContent.icon) {
            renderedContent = (
              <div className="flex flex-col items-center justify-center gap-6 py-8">
                <Icon 
                  name={modalContent.icon} 
                  size={200} 
                  className="text-yellow-400"
                />
                <p className="text-gray-200 text-center text-base leading-relaxed max-w-md">
                  {modalContent.message || messageText}
                </p>
              </div>
            )
          } else if (modalContent.heading || modalContent.locations) {
            // Structured content - render directory
            modalTitle = modalContent.title || modalTitle
            renderedContent = renderDirectoryContent(modalContent, buttons || [])
          } else {
            // Other structured content
            modalTitle = modalContent.title || modalTitle
            renderedContent = modalContent.message || messageText
          }
        } else if (typeof modalContent === 'string') {
          // Simple string content
          renderedContent = modalContent
        }
        
        setActionModal({
          isOpen: true,
          title: modalTitle,
          content: renderedContent,
          buttons: buttons,
        })
      } else {
        // Trigger notification for room actions (only if not showing modal)
        // Skip notifications for movement actions
        if (payload?.action !== 'move') {
          const { addNotification } = useNotificationStore.getState()
          addNotification({
            message: messageText,
            outcome,
            action: payload?.action,
          })
        }
      }
    })

    const cleanupLoginSuccess = socketHandlers.onLoginSuccess((payload) => {
      console.log('[GameInterface] Received login:success event')
      if (payload?.inventory) {
        setInventory(payload.inventory)
      }
    })

    const cleanupRoomMoves = socketHandlers.onRoomPlayerMoved((event) => {
      console.log('[GameInterface] Received room:player-moved event:', event)
      const currentPlayer = playerRef.current
      const activeRoom = currentRoomRef.current

      if (!currentPlayer) {
        console.log('[GameInterface] No current player, ignoring room:player-moved')
        return
      }

      if (event.playerId === currentPlayer.id) {
        console.log('[GameInterface] Player moved event is for current player')
        if (currentPlayer.currentRoom !== event.toRoom) {
          console.log('[GameInterface] Updating player room from', currentPlayer.currentRoom, 'to', event.toRoom)
          setPlayer({ ...currentPlayer, currentRoom: event.toRoom })
        }

        console.log('[GameInterface] Loading room data for:', event.toRoom)
        loadRoomDataRef.current?.({
          isTransition: true,
          travel: { toRoomId: event.toRoom },
        })
        return
      }

      console.log('[GameInterface] Player moved event is for another player:', event.playerId)
      if (activeRoom && (event.toRoom === activeRoom.roomId || event.fromRoom === activeRoom.roomId)) {
        console.log('[GameInterface] Player entered or left current room, reloading')
        loadRoomDataRef.current?.({ isTransition: true })
      }
    })

    return () => {
      cleanupActionFeedback()
      cleanupLoginSuccess()
      cleanupRoomMoves()
    }
  }, [socket, socketHandlers, setPlayer, setInventory, updateRoomItems, appendWorldFeed])

  useEffect(() => {
    if (!socket) {
      return
    }

    const cleanupChat = socketHandlers.onChatMessage((chatMessage) => {
      const ts = chatMessage.timestamp ? new Date(chatMessage.timestamp).getTime() : Date.now()
      const currentPlayerName = playerRef.current?.username
      const isSelf = Boolean(currentPlayerName && chatMessage.username === currentPlayerName)
      appendWorldFeed({
        type: 'world',
        actor: chatMessage.username,
        isSelf,
        message: chatMessage.message,
        ts,
        id: chatMessage.id,
      })
    })

    const cleanupRoomChat = socketHandlers.onRoomChatMessage((roomMessage) => {
      const activeRoom = currentRoomRef.current
      if (activeRoom?.roomId && roomMessage.roomId && roomMessage.roomId !== activeRoom.roomId) {
        return
      }
      const ts = roomMessage.timestamp ? new Date(roomMessage.timestamp).getTime() : Date.now()
      const roomIdAtReceipt = roomMessage.roomId || activeRoom?.roomId
      const currentPlayerName = playerRef.current?.username
      const isSelf = Boolean(currentPlayerName && roomMessage.username === currentPlayerName)
      appendWorldFeed({
        type: 'room',
        actor: roomMessage.username,
        isSelf,
        message: roomMessage.message,
        ts,
        id: roomMessage.id,
        roomId: roomIdAtReceipt,
      })
    })

    return () => {
      cleanupChat()
      cleanupRoomChat()
    }
  }, [socket, socketHandlers, appendWorldFeed])

  useEffect(() => {
    if (!socket) {
      return
    }

    const cleanupPlayerJoined = socketHandlers.onPlayerJoined((playerInfo) => {
      const activeRoom = currentRoomRef.current
      const currentPlayer = playerRef.current

      // Only show notification if event is for current room
      if (!activeRoom || playerInfo.currentRoom !== activeRoom.roomId) {
        return
      }

      const isSelf = Boolean(currentPlayer && playerInfo.id === currentPlayer.id)
      const entryDirection = playerInfo.entryDirection
      const directionPhrase = formatDirectionPhrase(entryDirection, 'enter')
      const message = entryDirection
        ? `${playerInfo.username} entered from ${directionPhrase}`
        : `${playerInfo.username} teleported in`

      appendWorldFeed({
        type: 'room',
        actor: playerInfo.username,
        isSelf,
        message,
        ts: Date.now(),
        roomId: activeRoom.roomId,
        eventType: 'room-enter',
        direction: entryDirection || undefined,
      })
    })

    const cleanupPlayerLeft = socketHandlers.onPlayerLeft((playerData) => {
      const activeRoom = currentRoomRef.current
      const currentPlayer = playerRef.current

      // Only show notification if event is for current room
      if (!activeRoom || !activeRoom.roomId) {
        return
      }

      const isSelf = Boolean(currentPlayer && playerData.id === currentPlayer.id)
      const exitDirection = playerData.exitDirection
      const directionPhrase = formatDirectionPhrase(exitDirection, 'exit')
      const message = exitDirection
        ? `${playerData.username} exited to ${directionPhrase}`
        : `${playerData.username} teleported away`

      appendWorldFeed({
        type: 'room',
        actor: playerData.username,
        isSelf,
        message,
        ts: Date.now(),
        roomId: activeRoom.roomId,
        eventType: 'room-exit',
        direction: exitDirection || undefined,
      })
    })

    return () => {
      cleanupPlayerJoined()
      cleanupPlayerLeft()
    }
  }, [socket, socketHandlers, appendWorldFeed])

  useEffect(() => {
    console.log('[GameInterface] Socket state:', {
      socket: !!socket,
      player: !!player,
      currentRoom: currentRoom?.roomId,
      playerRoom: player?.currentRoom,
      isLoggedIn,
      socketConnected: socket?.connected,
      socketId: socket?.id,
      lastLoginSocketId: lastLoginSocketId.current,
    })
  }, [socket, player, currentRoom, isLoggedIn])

  const attemptSocketLogin = useCallback(
    (reason: string) => {
      if (!socket) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket missing`)
        return false
      }

      if (!player) {
        console.log(`[GameInterface] Skipping socket login (${reason}): player missing`)
        return false
      }

      if (!isLoggedIn) {
        console.log(`[GameInterface] Skipping socket login (${reason}): user not logged in`)
        return false
      }

      if (!currentRoom) {
        console.log(`[GameInterface] Skipping socket login (${reason}): currentRoom missing`)
        return false
      }

      if (!socket.connected) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket not connected`, {
          socketId: socket.id,
          connected: socket.connected,
        })
        return false
      }

      if (!socket.id) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket lacks id`)
        return false
      }

      const alreadyLoggedIn = lastLoginSocketId.current === socket.id
      if (alreadyLoggedIn) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket already logged in`, {
          socketId: socket.id,
        })
        return true
      }

      console.log('[GameInterface] Logging in player via socket', {
        reason,
        socketId: socket.id,
        playerId: player.id,
        playerRoom: player.currentRoom ?? currentRoom.roomId,
      })

      const loginResult = socketHandlers.loginPlayer()
      console.log('[GameInterface] loginPlayer result:', loginResult)
      if (loginResult) {
        lastLoginSocketId.current = socket.id
      }

      return loginResult
    },
    [socket, player, isLoggedIn, currentRoom, socketHandlers]
  )

  useEffect(() => {
    attemptSocketLogin('effect-trigger')
  }, [attemptSocketLogin])

  useEffect(() => {
    if (!socket) {
      return
    }

    const handleConnect = () => {
      console.log('[GameInterface] Socket connect event triggered')
      attemptSocketLogin('socket-connect-event')
    }

    socket.on('connect', handleConnect)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
    }
  }, [socket, attemptSocketLogin])

  useEffect(() => {
    if (!socket) {
      return
    }

    const handleAuthError = (error: { message?: string }) => {
      console.error('[GameInterface] Socket auth error:', error?.message || 'Unknown auth error')
      logout()
    }

    const handleConnectError = (error: Error & { message: string }) => {
      const message = error?.message || ''
      if (message.toLowerCase().includes('token') || message.toLowerCase().includes('auth')) {
        console.error('[GameInterface] Socket auth failed during connection:', message)
        logout()
      }
    }

    socket.on('auth:error', handleAuthError)
    socket.on('connect_error', handleConnectError)

    return () => {
      socket.off('auth:error', handleAuthError)
      socket.off('connect_error', handleConnectError)
    }
  }, [socket, logout])

  useEffect(() => {
    if (!socket || !player || !isLoggedIn) {
      return
    }

    if (!socket.connected || !socket.id) {
      return
    }

    if (lastLoginSocketId.current === socket.id) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      attemptSocketLogin('fallback-timeout')
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [attemptSocketLogin, socket, player, isLoggedIn])
  
  const handleOpenMap = useCallback((src: string, title: string) => {
    // Determine which map this corresponds to based on src
    const mapId = MAP_CONFIG.find(m => m.src === src)?.id || getMapIdForRoom(currentRoom?.roomId || '001')
    setCurrentMapId(mapId)
    setMapInfo({ src, title })
    setIsMapModalOpen(true)
  }, [currentRoom])
  
  const handleMapChange = useCallback((mapId: string) => {
    const selectedMap = MAP_CONFIG.find(m => m.id === mapId)
    if (selectedMap) {
      setCurrentMapId(mapId)
      setMapInfo({ src: selectedMap.src, title: selectedMap.title })
    }
  }, [])

  const handleOpenTeleport = useCallback(() => {
    setIsTeleportModalOpen(true)
  }, [])

  const handleTeleport = useCallback((roomId: string) => {
    handleAction({ type: 'teleport', data: { toRoomId: roomId } })
  }, [handleAction])

  if (!player || !isLoggedIn) {
    return <div>Loading...</div>
  }

  if (!currentRoom || (isLoadingRoom && isInitialLoad)) {
    return (
      <div className="min-h-dvh bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500/50 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading room data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-gray-950 text-white flex flex-col overflow-hidden">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={handleLogoutFlow}
      />
      <MapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        mapSrc={mapInfo.src}
        mapTitle={mapInfo.title || 'Map'}
        availableMaps={getUnlockedMaps(player, currentRoom?.roomId)}
        currentMapId={currentMapId}
        onMapChange={handleMapChange}
      />
      <TeleportModal
        isOpen={isTeleportModalOpen}
        onClose={() => setIsTeleportModalOpen(false)}
        locations={TELEPORT_LOCATIONS}
        onTeleport={handleTeleport}
        currentRoomId={currentRoom?.roomId}
      />
      <ActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, title: '', content: '' })}
        title={actionModal.title}
        content={actionModal.content}
        buttons={actionModal.buttons}
        onAction={handleAction}
      />
      <NotificationContainer />
      
      <div className="grid grid-cols-1 md:grid-cols-[1fr_minmax(340px,30%)] xl:grid-cols-[minmax(360px,25%)_1fr_minmax(360px,25%)] flex-1 overflow-hidden relative min-h-0">
        {/* Overlay backdrop for mobile */}
        {(leftSidebarOpen || rightSidebarOpen) && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-10 md:hidden transition-opacity duration-300"
            onClick={() => {
              setLeftSidebarOpen(false)
              setRightSidebarOpen(false)
            }}
          />
        )}
        
        {/* Left Sidebar - Player Info */}
        <div className={`
          bg-gray-900/95 backdrop-blur-sm border-r border-gray-800/50 flex flex-col flex-shrink-0 h-full min-h-0 overflow-hidden
          transition-transform duration-300 ease-out
          w-full md:w-[calc(100%-30%)] xl:w-full
          md:max-w-[calc(100%-340px)] xl:max-w-full

          ${leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          xl:translate-x-0 xl:static xl:col-start-1
          absolute left-0 top-0 bottom-0 z-20 shadow-xl
        `}>
          <GameSidebar 
            player={player} 
            onClose={() => setLeftSidebarOpen(false)} 
            onAction={handleAction}
          />
        </div>
        
        {/* Main Game Area */}
        <div className="flex flex-col min-w-0 min-h-0 h-full overflow-hidden md:col-start-1 xl:col-start-2">
          <GameHeader
            onToggleCharacterSidebar={() => setLeftSidebarOpen((prev) => !prev)}
            onToggleWorldSidebar={() => setRightSidebarOpen((prev) => !prev)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            playerName={player?.username}
          />
          {currentRoom && (
            <div className="bg-gray-900/50 flex-1 overflow-hidden min-h-0 h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <RoomBox
                  room={currentRoom}
                  roomPlayers={roomPlayers}
                  currentPlayerId={player.id}
                  onAction={handleAction}
                  worldTick={worldTick}
                  actionResult={actionResult}
                />
              </div>

              {/* D-pad */}
              <div className="p-4 flex-shrink-0 relative flex flex-col gap-4 border-t border-gray-800/50">
                {/* Map and Teleport buttons - left edge */}
                <div className="absolute left-4 top-4 flex flex-row md:flex-col gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      const isRoomZero = currentRoom?.roomId === '000'
                      const isLobby = currentRoom?.roomId === '999'
                      const mapBackground = isRoomZero
                        ? '/img/lightgray_map_roomzero.jpg'
                        : isLobby
                        ? '/img/lightgray_map_the_lobby.jpg'
                        : '/img/lightgray_map_grassyfield_main.jpg'
                      const mapTitle = isRoomZero ? 'Room Zero' : isLobby ? 'The Lobby' : 'Grassy Field'
                      handleOpenMap(mapBackground, mapTitle)
                    }}
                    className="px-3 py-1.5 border border-green-600/40 hover:border-green-500/60 bg-transparent hover:bg-green-900/20 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 text-green-400/70 hover:text-green-300 text-sm font-medium whitespace-nowrap"
                    title="View Map"
                    aria-label="View Map"
                  >
                    <Icon name="world" size={16} />
                    <span className="hidden md:inline">Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenTeleport}
                    className="px-3 py-1.5 border border-blue-600/40 hover:border-blue-500/60 bg-transparent hover:bg-blue-900/20 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 text-blue-400/70 hover:text-blue-300 text-sm font-medium whitespace-nowrap"
                    title="Open Teleport"
                    aria-label="Open Teleport"
                  >
                    <span className="block md:hidden">
                      <Icon name="ironskin" size={16} />
                    </span>
                    <span className="hidden md:inline">Teleport</span>
                  </button>
                </div>
                {/* Compass and Action Buttons */}
                <div className="relative flex items-center justify-center gap-4">
                  <Compass room={currentRoom} onAction={handleAction} onOpenMap={handleOpenMap} onOpenTeleport={handleOpenTeleport} />
                  
                  {/* Action Buttons - stacked vertically */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        console.log('[ActionButton] Attack button clicked')
                        handleAction('attack')
                      }}
                      disabled={isLoadingRoom}
                      className="px-3 py-1 bg-red-500/70 hover:bg-red-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                    >
                      {isLoadingRoom && action === 'attack' ? '...' : 'Attack'}
                    </button>
                    <button
                      onClick={() => {
                        console.log('[ActionButton] Search button clicked')
                        handleAction('search')
                      }}
                      disabled={isLoadingRoom}
                      className="px-3 py-1 bg-amber-500/70 hover:bg-amber-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                    >
                      {isLoadingRoom && action === 'search' ? '...' : 'Search'}
                    </button>
                    <button
                      onClick={() => {
                        console.log('[ActionButton] Rest button clicked')
                        handleAction('rest')
                      }}
                      disabled={isLoadingRoom}
                      className="px-3 py-1 bg-emerald-600/70 hover:bg-emerald-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                    >
                      {isLoadingRoom && action === 'rest' ? '...' : 'Rest'}
                    </button>
                    <button
                      onClick={() => {
                        console.log('[ActionButton] Look button clicked')
                        handleAction('look')
                      }}
                      disabled={isLoadingRoom}
                      className="px-3 py-1 bg-blue-600/70 hover:bg-blue-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                    >
                      {isLoadingRoom && action === 'look' ? '...' : 'Look'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Sidebar - Tabbed Interface (Feed, World Chat, Room Chat) */}
        <div className={` rightColumn
          bg-gray-900/95 backdrop-blur-sm border-l border-gray-800/50 flex flex-col flex-shrink-0 h-full min-h-0 overflow-hidden
          transition-transform duration-300 ease-out
          md:min-w-[320px]
          ${rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0 md:static md:col-start-2
          xl:col-start-3
          absolute right-0 top-0 bottom-0 w-full z-20 shadow-xl
        `}>
          <UnifiedFeedPanel
            currentRoomId={currentRoom?.roomId}
            isConnected={socket?.connected ?? false}
            onClose={() => setRightSidebarOpen(false)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            customAction={customAction}
            onCustomActionChange={setCustomAction}
            onCustomActionSubmit={handleCustomAction}
            isLoadingRoom={isLoadingRoom}
            customActionInputRef={customActionInputRef}
          />
        </div>
      </div>
    </div>
  )
}
