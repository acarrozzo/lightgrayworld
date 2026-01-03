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
import TabContainer, { type TabConfig } from './TabContainer'
import InventoryDisplay from './InventoryDisplay'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import SettingsContent from './SettingsContent'
import { Settings as SettingsIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import MapContent, { type MapOption } from './MapContent'
import TeleportModal, { type TeleportLocation } from './TeleportModal'
import ActionModal from './ActionModal'
import ShopModal from './ShopModal'
import Icon from './Icon'
import { normalizeRoom, normalizeRoomItems } from '@/lib/normalize/room'
import { useWorldFeedStore } from '@/store/worldFeedStore'
import type { WorldFeedEntryInput } from '@/store/worldFeedStore'
import { useNotificationStore } from '@/store/notificationStore'
import NotificationContainer from './NotificationContainer'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

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
  { id: 'solar-office', src: '/img/lightgray_map_solar_office.jpg', title: 'Solar Office', flag: 'solarOfficeMap' },
]

// Helper function to determine which map corresponds to a room
const getMapIdForRoom = (roomId: string): string => {
  if (roomId === '000') return 'room-zero'
  if (roomId === '999') return 'lobby'
  if (roomId === '088') return 'solar-office'
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
  { roomId: '088', name: 'Solar Office', description: 'A large, open-plan command office' },
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
    inventory,
    setInventory,
    logout,
    updateCapCache,
    getCapCache,
  } = useGameStore()
  const { updateRoomItems } = useGameStore()
  const [action, setAction] = useState('')
  const [actionResult, setActionResult] = useState<any>(null)
  const [isLoadingRoom, setIsLoadingRoom] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const leftSidebarScrollRef = useRef<HTMLDivElement>(null)
  const rightSidebarScrollRef = useRef<HTMLDivElement>(null)
  const leftSidebarScrollPosition = useRef<number>(0)
  const rightSidebarScrollPosition = useRef<number>(0)
  const [isTeleportModalOpen, setIsTeleportModalOpen] = useState(false)
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [shopModalData, setShopModalData] = useState<{
    shopItems: Array<{ id: string; slug: string; name: string; description: string; value: number; type: string }>
    playerCurrency: number
    playerInventory: typeof inventory
  } | null>(null)
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
  const [centerActiveTab, setCenterActiveTab] = useState<string>('explore')
  type FilterTab = 'all' | 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'consumables' | 'misc'
  const [inventoryFilter, setInventoryFilter] = useState<FilterTab | undefined>(undefined)
  const pendingEquipActionRef = useRef<{ playerItemId: string } | null>(null)
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)
  const lastLoginSocketId = useRef<string | null>(null)
  const playerRef = useRef(player)
  const currentRoomRef = useRef(currentRoom)
  const customActionInputRef = useRef<HTMLInputElement>(null)
  const moveSequenceRef = useRef(0) // Tracks move actions (not room loads)
  const roomLoadSequenceRef = useRef(0) // Tracks room load requests
  const enteredViaCacheRoomIdRef = useRef<string | null>(null) // Tracks optimistic entries
  const pendingMoveRef = useRef<{ moveSeq: number; toRoomId: string } | null>(null) // Tracks pending moves
  const tickRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tickRefreshSequenceRef = useRef(0)
  const appendWorldFeed = useCallback((entry: WorldFeedEntryInput) => {
    const { append } = useWorldFeedStore.getState()
    return append(entry)
  }, [])
  
  // Avatar for collapsed rail
  const avatarKey = player?.uIcon || DEFAULT_PLAYER_AVATAR
  const avatarColor = player?.uIconColor || DEFAULT_AVATAR_COLOR
  const coloredAvatarSvg = useColoredAvatar(avatarKey, avatarColor)
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

  /**
   * Hydrates action caps and world tick for a room without affecting room state.
   * This is a subordinate operation that does NOT trigger room transitions.
   * 
   * @param roomId - The room ID to hydrate caps for
   * @param parentSequence - The room load sequence this hydration is subordinate to
   * @returns Promise that resolves when hydration completes (or is cancelled)
   */
  const hydrateRoomCaps = useCallback(async (
    roomId: string,
    parentSequence: number
  ): Promise<void> => {
    // 1. Guard: Only proceed if roomId matches currentRoomRef
    if (currentRoomRef.current?.roomId !== roomId) {
      console.log(`[hydrateRoomCaps] Cancelled - room changed to ${currentRoomRef.current?.roomId}`)
      return
    }
    
    // 2. Guard: Only proceed if parent sequence is still current
    if (parentSequence !== roomLoadSequenceRef.current) {
      console.log(`[hydrateRoomCaps] Cancelled - sequence stale (${parentSequence} vs ${roomLoadSequenceRef.current})`)
      return
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (isLoggedIn) {
        Object.assign(headers, getAuthHeaders())
      }

      const response = await fetch(`/api/game/room/caps?roomId=${encodeURIComponent(roomId)}`, {
        headers,
      })

      if (!response.ok) {
        console.error(`[hydrateRoomCaps] Failed to fetch caps: ${response.status}`)
        // Mark cache entries as error for this room
        const capConfigs = [
          { roomId: '002', actionKey: 'pick redberry', maxPerTick: 5 },
          { roomId: '005', actionKey: 'pick blueberry', maxPerTick: 3 },
        ]
        const config = capConfigs.find(c => c.roomId === roomId)
        if (config) {
          updateCapCache(roomId, config.actionKey, {
            status: 'error',
            remaining: 0,
            capPerTick: config.maxPerTick,
            tickId: worldTick?.tickNumber ?? 0,
          })
        }
        return
      }

      const data = await response.json()

      // 3. Guard again after async operation
      if (currentRoomRef.current?.roomId !== roomId) {
        console.log(`[hydrateRoomCaps] Cancelled after fetch - room changed to ${currentRoomRef.current?.roomId}`)
        return
      }

      if (parentSequence !== roomLoadSequenceRef.current) {
        console.log(`[hydrateRoomCaps] Cancelled after fetch - sequence stale (${parentSequence} vs ${roomLoadSequenceRef.current})`)
        return
      }

      // 4. Update cap cache ONLY (never currentRoom, players, etc.)
      if (data.actionCaps) {
        const currentTickId = data.worldTick?.tickNumber ?? data.worldTick?.tickId ?? worldTick?.tickNumber ?? 0
        for (const [actionKey, remaining] of Object.entries(data.actionCaps)) {
          const capConfigs = [
            { roomId: '002', actionKey: 'pick redberry', maxPerTick: 5 },
            { roomId: '005', actionKey: 'pick blueberry', maxPerTick: 3 },
          ]
          const config = capConfigs.find(c => c.roomId === roomId && c.actionKey === actionKey)
          if (config && typeof remaining === 'number') {
            updateCapCache(roomId, actionKey, {
              remaining,
              capPerTick: config.maxPerTick,
              tickId: currentTickId,
              status: 'known',
            })
          }
        }
      }

      // 5. Update worldTick state if provided
      if (data.worldTick) {
        const tickNumber = data.worldTick.tickNumber ?? data.worldTick.tickId ?? 0
        const interval = data.worldTick.tickIntervalMs ?? 10000
        const nextTickAt = data.worldTick.nextTickAt ?? (Date.now() + interval)
        setWorldTick({
          tickNumber,
          nextTickAt,
          tickIntervalMs: interval,
        })
      }

      console.log(`[hydrateRoomCaps] Successfully hydrated caps for room ${roomId}`)
    } catch (error) {
      console.error(`[hydrateRoomCaps] Error hydrating caps for room ${roomId}:`, error)
      // Mark cache entries as error for this room
      const capConfigs = [
        { roomId: '002', actionKey: 'pick redberry', maxPerTick: 5 },
        { roomId: '005', actionKey: 'pick blueberry', maxPerTick: 3 },
      ]
      const config = capConfigs.find(c => c.roomId === roomId)
      if (config) {
        updateCapCache(roomId, config.actionKey, {
          status: 'error',
          remaining: 0,
          capPerTick: config.maxPerTick,
          tickId: worldTick?.tickNumber ?? 0,
        })
      }
    }
  }, [getAuthHeaders, isLoggedIn, updateCapCache, worldTick, setWorldTick])

  // Load sidebar state from localStorage on mount
  // Default to open on desktop (md breakpoint and above) if no preference is saved
  useEffect(() => {
    const savedLeftSidebar = localStorage.getItem('leftSidebarOpen')
    const savedRightSidebar = localStorage.getItem('rightSidebarOpen')
    
    if (savedLeftSidebar !== null) {
      setLeftSidebarOpen(JSON.parse(savedLeftSidebar))
    } else if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      // Default to open on desktop if no preference
      setLeftSidebarOpen(true)
    }
    
    if (savedRightSidebar !== null) {
      setRightSidebarOpen(JSON.parse(savedRightSidebar))
    } else if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      // Default to open on desktop if no preference
      setRightSidebarOpen(true)
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

  // Automatic cap refresh at tick boundary
  useEffect(() => {
    if (!worldTick?.nextTickAt || !currentRoom) return
    
    // Cancel any existing scheduled refresh
    if (tickRefreshTimeoutRef.current) {
      clearTimeout(tickRefreshTimeoutRef.current)
      tickRefreshTimeoutRef.current = null
    }
    
    const msUntilTick = worldTick.nextTickAt - Date.now()
    const sequence = ++tickRefreshSequenceRef.current
    
    tickRefreshTimeoutRef.current = setTimeout(() => {
      // Small jitter to avoid edge timing
      setTimeout(() => {
        // Guard: only apply if still current room AND sequence matches
        if (currentRoomRef.current?.roomId === currentRoom.roomId &&
            sequence === tickRefreshSequenceRef.current) {
          console.log(`[GameInterface] Triggering tick boundary cap refresh for room ${currentRoom.roomId}`)
          hydrateRoomCaps(currentRoom.roomId, roomLoadSequenceRef.current) // Use current sequence, don't increment
        }
      }, 500)
    }, Math.max(0, msUntilTick))
    
    return () => {
      if (tickRefreshTimeoutRef.current) {
        clearTimeout(tickRefreshTimeoutRef.current)
        tickRefreshTimeoutRef.current = null
      }
    }
  }, [worldTick, currentRoom, hydrateRoomCaps])

  // Also cancel tick refresh on socket disconnect
  useEffect(() => {
    if (!socket?.connected && tickRefreshTimeoutRef.current) {
      clearTimeout(tickRefreshTimeoutRef.current)
      tickRefreshTimeoutRef.current = null
    }
  }, [socket?.connected])

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

  // Preserve scroll positions when collapsing/expanding
  useEffect(() => {
    if (!leftSidebarScrollRef.current) return
    
    // Find the actual scrollable element inside GameSidebar (the div with overflow-y-auto and p-4)
    const scrollableElement = leftSidebarScrollRef.current.querySelector('div.overflow-y-auto.p-4') as HTMLElement ||
                              leftSidebarScrollRef.current.querySelector('.overflow-y-auto') as HTMLElement
    
    if (scrollableElement) {
      if (leftSidebarOpen) {
        // Restore scroll position when expanding (after transition)
        const timeoutId = setTimeout(() => {
          if (scrollableElement) {
            scrollableElement.scrollTop = leftSidebarScrollPosition.current
          }
        }, 260) // Slightly after transition completes
        return () => clearTimeout(timeoutId)
      } else {
        // Save scroll position when collapsing
        leftSidebarScrollPosition.current = scrollableElement.scrollTop
      }
    }
  }, [leftSidebarOpen])

  useEffect(() => {
    if (!rightSidebarScrollRef.current) return
    
    // Find the actual scrollable element inside UnifiedFeedPanel (worldFeedEntries)
    const scrollableElement = rightSidebarScrollRef.current.querySelector('.worldFeedEntries') as HTMLElement
    
    if (scrollableElement) {
      if (rightSidebarOpen) {
        // Restore scroll position when expanding (after transition)
        const timeoutId = setTimeout(() => {
          if (scrollableElement) {
            scrollableElement.scrollTop = rightSidebarScrollPosition.current
          }
        }, 260) // Slightly after transition completes
        return () => clearTimeout(timeoutId)
      } else {
        // Save scroll position when collapsing
        rightSidebarScrollPosition.current = scrollableElement.scrollTop
      }
    }
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
    // Increment sequence for this request
    const sequence = ++roomLoadSequenceRef.current
    const targetRoomId = options?.travel?.toRoomId || options?.roomData?.roomId || null
    
    console.log(`[GameInterface] loadRoomData started [roomLoadSeq:${sequence}] targetRoom:${targetRoomId}`)
    
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
        // Check sequence BEFORE committing any state
        if (sequence !== roomLoadSequenceRef.current) {
          console.log(`[GameInterface] Ignoring stale room load (provided data) [seq:${sequence}] current:${roomLoadSequenceRef.current}`)
          return
        }
        
        // Commit ALL state changes atomically (guarded by sequence)
        cacheRoom(normalizedRoom)
        setCurrentRoom(normalizedRoom)
        setRoomPlayers(normalizedRoom.players)
        
        if (player && player.currentRoom !== normalizedRoom.roomId) {
          setPlayer({ ...player, currentRoom: normalizedRoom.roomId })
        }
        
        // Clear optimistic entry flag when authoritative data arrives
        if (enteredViaCacheRoomIdRef.current === normalizedRoom.roomId) {
          console.log(`[GameInterface] Clearing optimistic entry flag for room ${normalizedRoom.roomId}`)
          enteredViaCacheRoomIdRef.current = null
        }
        
        if (!isTransition) {
          setIsLoadingRoom(false)
        }
        setIsInitialLoad(false)
        console.log(`[GameInterface] Room load committed [roomLoadSeq:${sequence}] room:${normalizedRoom.roomId}`)
        
        // Check if hydration is needed for missing dynamic fields
        const needsHydration = 
          !providedRoomData?.actionCaps ||
          !providedRoomData?.worldTick ||
          enteredViaCacheRoomIdRef.current === normalizedRoom.roomId
        
        if (needsHydration) {
          console.log(`[GameInterface] Triggering cap hydration for room ${normalizedRoom.roomId}`)
          // Trigger second-stage hydration (subordinate to current room load sequence)
          hydrateRoomCaps(normalizedRoom.roomId, sequence) // Pass existing sequence, don't increment
        }
        
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
        
        // Check if this request is still the latest before committing ANY state
        if (sequence !== roomLoadSequenceRef.current) {
          console.log(`[GameInterface] Ignoring stale room load response [seq:${sequence}] current:${roomLoadSequenceRef.current}`)
          return
        }
        
        // Commit ALL state changes atomically (guarded by sequence)
        if (normalizedRoom) {
          cacheRoom(normalizedRoom)
          setCurrentRoom(normalizedRoom)
          setRoomPlayers(roomPlayers) // Guarded by sequence
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

          setPlayer({ ...player, currentRoom: normalizedRoom.roomId }) // Guarded by sequence
        }
        
        // Clear optimistic entry flag when authoritative data arrives
        if (normalizedRoom && enteredViaCacheRoomIdRef.current === normalizedRoom.roomId) {
          console.log(`[GameInterface] Clearing optimistic entry flag for room ${normalizedRoom.roomId}`)
          enteredViaCacheRoomIdRef.current = null
        }
        
        console.log(`[GameInterface] Room load committed [roomLoadSeq:${sequence}] room:${normalizedRoom?.roomId}`)
        
        // Update cap cache from API response if present
        if (normalizedRoom && roomData.actionCaps) {
          const currentTickId = roomData.worldTick?.tickNumber ?? roomData.worldTick?.tickId ?? worldTick?.tickNumber ?? 0
          for (const [actionKey, remaining] of Object.entries(roomData.actionCaps)) {
            const capConfigs = [
              { roomId: '002', actionKey: 'pick redberry', maxPerTick: 5 },
              { roomId: '005', actionKey: 'pick blueberry', maxPerTick: 3 },
            ]
            const config = capConfigs.find(c => c.roomId === normalizedRoom.roomId && c.actionKey === actionKey)
            if (config && typeof remaining === 'number') {
              updateCapCache(normalizedRoom.roomId, actionKey, {
                remaining,
                capPerTick: config.maxPerTick,
                tickId: currentTickId,
                status: 'known',
              })
            }
          }
        }
        
        // Update worldTick from API response if present
        if (roomData.worldTick) {
          const tickNumber = roomData.worldTick.tickNumber ?? roomData.worldTick.tickId ?? 0
          const interval = roomData.worldTick.tickIntervalMs ?? 10000
          const nextTickAt = roomData.worldTick.nextTickAt ?? (Date.now() + interval)
          setWorldTick({
            tickNumber,
            nextTickAt,
            tickIntervalMs: interval,
          })
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
      // Check sequence before logging errors from stale requests
      if (sequence === roomLoadSequenceRef.current) {
        console.error('Failed to load room data:', error)
      } else {
        console.log(`[GameInterface] Ignoring error from stale room load [seq:${sequence}]`)
      }
    } finally {
      if (!isTransition) {
        setIsLoadingRoom(false)
      }
      setIsInitialLoad(false)
    }
  }, [getAuthHeaders, cacheRoom, setCurrentRoom, setRoomPlayers, player, setPlayer, getCachedRoom, isLoggedIn, hydrateRoomCaps, updateCapCache, worldTick, setWorldTick])
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

  // Initialize map based on current room
  useEffect(() => {
    if (currentRoom?.roomId) {
      const mapId = getMapIdForRoom(currentRoom.roomId)
      setCurrentMapId(mapId)
    }
  }, [currentRoom?.roomId])

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

      // Increment move sequence when initiating move
      const moveSeq = ++moveSequenceRef.current

      // Set pending move - will be cleared when action:feedback arrives
      pendingMoveRef.current = { moveSeq, toRoomId: targetRoomId }

      // Optimistic update: immediately use cached room if available
      // NOTE: This is UI-only for instant feedback. The authoritative update
      // will come from action:feedback, which will hydrate the room with
      // server truth (players, items, state). This does NOT trigger
      // loadRoomData() to avoid competing with the authoritative update.
      const cachedTargetRoom = getCachedRoom(targetRoomId)
      if (cachedTargetRoom) {
        console.log(`[handleAction] Using cached room for optimistic update (UI-only) [moveSeq:${moveSeq}]:`, cachedTargetRoom.name)
        setCurrentRoom(cachedTargetRoom)
        // Track that we entered this room via optimistic cache
        enteredViaCacheRoomIdRef.current = targetRoomId
        // Update player room optimistically
        if (player && player.currentRoom !== targetRoomId) {
          setPlayer({ ...player, currentRoom: targetRoomId })
        }
      }

      if (socket) {
        console.log(`[handleAction] Emitting player-move event [moveSeq:${moveSeq}]`, { 
          fromRoom: currentRoom.roomId, 
          toRoom: targetRoomId 
        })
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
    
    // Track equip_item actions for undo functionality
    if (normalizedAction === 'equip_item' && actionData?.playerItemId) {
      pendingEquipActionRef.current = { playerItemId: actionData.playerItemId }
    }
    
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

      // Handle equip_item action with undo toast (before inventory update to capture state)
      if (payload?.action === 'equip_item' && success) {
        const pendingEquip = pendingEquipActionRef.current
        if (pendingEquip) {
          // Update inventory first so we can find the item
          if (payload?.data?.inventory) {
            setInventory(payload.data.inventory)
          }
          
          // Find the item in the updated inventory to get its name
          const updatedInventory = payload?.data?.inventory || inventory
          const equippedItem = updatedInventory.find((item: any) => item.id === pendingEquip.playerItemId && item.isEquipped)
          const itemName = equippedItem?.template.name || messageText.replace(/^Equipped\s+/i, '').replace(/\.$/, '') || 'item'
          
          // Show toast with undo button
          const { addNotification } = useNotificationStore.getState()
          addNotification({
            message: `Equipped ${itemName}`,
            outcome: 'success',
            action: 'equip_item',
            onUndo: () => {
              // Undo: unequip the item
              handleAction({
                type: 'unequip_item',
                data: { playerItemId: pendingEquip.playerItemId },
              })
              pendingEquipActionRef.current = null
            },
          })
          
          // Clear pending equip action
          pendingEquipActionRef.current = null
        }
      }

      if (payload?.data?.inventory) {
        setInventory(payload.data.inventory)
      }

      // Update player state if provided in action feedback (e.g., from equip/unequip)
      if (payload?.data?.player) {
        setPlayer(payload.data.player)
      }

      // Update player HP if provided in action feedback
      if (typeof payload?.data?.hp === 'number') {
        const currentPlayer = playerRef.current
        if (currentPlayer) {
          setPlayer({ ...currentPlayer, hp: payload.data.hp })
        }
      }

      if (payload?.data?.roomItems && currentRoomRef.current?.roomId) {
        updateRoomItems(currentRoomRef.current.roomId, normalizeRoomItems(payload.data.roomItems))
      }

      // Update cap cache from action result (action results always win)
      if (currentRoomRef.current?.roomId && payload?.data?.remaining !== undefined) {
        const actionKey = payload?.action
        const remaining = payload.data.remaining
        const roomId = currentRoomRef.current.roomId
        
        // Check if this is a berry picking action
        const capConfigs = [
          { roomId: '002', actionKey: 'pick redberry', maxPerTick: 5 },
          { roomId: '005', actionKey: 'pick blueberry', maxPerTick: 3 },
        ]
        const config = capConfigs.find(c => c.roomId === roomId && c.actionKey === actionKey)
        
        if (config && typeof remaining === 'number') {
          const currentTickId = worldTick?.tickNumber ?? 0
          // Action result always wins - update cache immediately
          updateCapCache(roomId, actionKey, {
            remaining,
            capPerTick: config.maxPerTick,
            tickId: currentTickId,
            status: 'known',
          })
          console.log(`[GameInterface] Updated cap cache from action result: ${actionKey} = ${remaining}`)
        }
      }

      if (payload?.action === 'move' && success && payload?.data?.toRoom) {
        const moveSeq = moveSequenceRef.current
        console.log(`[GameInterface] Processing move action feedback [moveSeq:${moveSeq}]`)
        const currentPlayer = playerRef.current
        const activeRoom = currentRoomRef.current
        
        // Clear pending move - feedback has arrived
        if (pendingMoveRef.current) {
          console.log(`[GameInterface] Clearing pending move - feedback received for room ${payload.data.toRoom}`)
          pendingMoveRef.current = null
        }
        
        if (currentPlayer && currentPlayer.currentRoom !== payload.data.toRoom) {
          console.log('[GameInterface] Updating player room to:', payload.data.toRoom)
          setPlayer({ ...currentPlayer, currentRoom: payload.data.toRoom })
        }

        // Determine if we need to hydrate room data
        const hasAuthoritativeRoomData = payload.data?.roomData && payload.data.roomData.roomId === payload.data.toRoom
        const isAlreadyViewingRoom = activeRoom?.roomId === payload.data.toRoom
        const enteredViaCache = enteredViaCacheRoomIdRef.current === payload.data.toRoom
        
        // Always hydrate if:
        // 1. We have authoritative room data in payload (apply it)
        // 2. We're not viewing the room (need to load it)
        // 3. We're viewing the room but got here via optimistic cache (need server truth)
        const shouldHydrate = hasAuthoritativeRoomData || !isAlreadyViewingRoom || enteredViaCache
        
        if (shouldHydrate) {
          if (hasAuthoritativeRoomData) {
            console.log('[GameInterface] Hydrating room with authoritative data from action:feedback')
          } else if (!isAlreadyViewingRoom) {
            console.log('[GameInterface] Loading room data for:', payload.data.toRoom)
          } else if (enteredViaCache) {
            console.log('[GameInterface] Refreshing room data to ensure server truth (entered via optimistic cache)')
          }
          
          loadRoomDataRef.current?.({
            isTransition: true,
            travel: { toRoomId: payload.data.toRoom },
            roomData: payload.data?.roomData, // Use authoritative data if provided
          })
        } else {
          console.log('[GameInterface] Skipping room load - already have authoritative data for current room')
        }
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
        
        // Check if it's a shop modal
        if (modalContent && typeof modalContent === 'object' && !Array.isArray(modalContent) && modalContent.type === 'shop') {
          setIsShopModalOpen(true)
          setShopModalData({
            shopItems: modalContent.shopItems || [],
            playerCurrency: modalContent.playerCurrency || 0,
            playerInventory: modalContent.playerInventory || [],
          })
        } else {
          // Check if modalContent is structured (object) or simple string
          let renderedContent: string | React.ReactNode = messageText
          let modalTitle = payload?.action || 'Action'
          
          if (modalContent && typeof modalContent === 'object' && !Array.isArray(modalContent)) {
            // Check if it's an icon type modal
            if (modalContent.type === 'icon' && modalContent.icon) {
              // Ensure iconColor has 'text-' prefix if it's a color without it
              // Opacity modifiers (e.g., /70) are preserved and will be handled by Icon component
              let iconColorClass = modalContent.iconColor || "text-yellow-400"
              if (iconColorClass && !iconColorClass.startsWith('text-') && !iconColorClass.includes(' ')) {
                // If it's a simple color name like 'yellow-400', 'gray-500', or 'gray-500/70', add 'text-' prefix
                // The opacity modifier (e.g., /70) will be preserved: 'gray-500/70' -> 'text-gray-500/70'
                iconColorClass = `text-${iconColorClass}`
              }
              renderedContent = (
                <div className="flex flex-col items-center justify-center gap-6 py-8">
                  <Icon 
                    name={modalContent.icon} 
                    size={200} 
                    className={iconColorClass}
                  />
                  <p className="text-gray-200 text-center text-base leading-relaxed max-w-md">
                    {modalContent.message || messageText}
                  </p>
                </div>
              )
              modalTitle = modalContent.title || modalTitle
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
        }
      } else {
        // Trigger notification for room actions (only if not showing modal)
        // Skip notifications for movement actions and equip_item (handled above)
        if (payload?.action !== 'move' && payload?.action !== 'equip_item') {
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
        // For current player: treat as reconciliation, but only if event is credible
        const playerRoom = currentPlayer.currentRoom
        const uiRoom = activeRoom?.roomId
        const pendingMove = pendingMoveRef.current
        
        // Gate reconciliation: only reconcile if:
        // 1. There's a pending move that matches this event (credible - we're waiting for feedback)
        // 2. OR player/UI state is unset/unknown (reconnect case - need to sync)
        // 3. OR event matches expected target from pending move
        const isCredibleEvent = 
          (pendingMove && pendingMove.toRoomId === event.toRoom) || // Matches pending move
          (!playerRoom && !uiRoom) || // Reconnect case - no state
          (pendingMove && event.fromRoom === playerRoom && event.toRoom === pendingMove.toRoomId) // Matches expected move
        
        // Check if this event indicates a state mismatch that needs reconciliation
        const needsReconciliation = 
          (playerRoom !== event.toRoom) ||  // Player state doesn't match event
          (uiRoom !== event.toRoom)         // UI doesn't match event destination
        
        if (needsReconciliation && isCredibleEvent) {
          console.log('[GameInterface] Reconciliation needed for current player move', {
            eventFromRoom: event.fromRoom,
            eventToRoom: event.toRoom,
            playerRoom,
            uiRoom,
            pendingMove: pendingMove?.toRoomId,
            reason: playerRoom !== event.toRoom ? 'player-state-mismatch' : 'ui-state-mismatch'
          })
          
          // Update player state if needed
          if (playerRoom !== event.toRoom) {
            console.log('[GameInterface] Reconciling player room from', playerRoom, 'to', event.toRoom)
            setPlayer({ ...currentPlayer, currentRoom: event.toRoom })
          }
          
          // Load room data if UI doesn't match
          if (uiRoom !== event.toRoom) {
            console.log('[GameInterface] Reconciling UI room - loading:', event.toRoom)
            loadRoomDataRef.current?.({
              isTransition: true,
              travel: { toRoomId: event.toRoom },
            })
          }
        } else if (!isCredibleEvent) {
          console.log('[GameInterface] Ignoring stale room:player-moved for current player - event not credible', {
            eventToRoom: event.toRoom,
            playerRoom,
            uiRoom,
            pendingMove: pendingMove?.toRoomId,
            reason: 'event-does-not-match-pending-move-or-state'
          })
        } else {
          console.log('[GameInterface] room:player-moved redundant for current player - state already matches', {
            eventToRoom: event.toRoom,
            playerRoom,
            uiRoom
          })
        }
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
  }, [socket, socketHandlers, setPlayer, setInventory, updateRoomItems, appendWorldFeed, updateCapCache, worldTick])

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
  
  const handleMapChange = useCallback((mapId: string) => {
    setCurrentMapId(mapId)
  }, [])

  const handleOpenTeleport = useCallback(() => {
    setIsTeleportModalOpen(true)
  }, [])

  const handleTeleport = useCallback((roomId: string) => {
    handleAction({ type: 'teleport', data: { toRoomId: roomId } })
  }, [handleAction])

  const handleSwitchToInventory = useCallback((filter?: FilterTab) => {
    setCenterActiveTab('inventory')
    setInventoryFilter(filter)
  }, [])

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
      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => {
          setIsShopModalOpen(false)
          setShopModalData(null)
        }}
        shopItems={shopModalData?.shopItems || []}
        playerCurrency={shopModalData?.playerCurrency || player?.currency || 0}
        playerInventory={shopModalData?.playerInventory || inventory}
        onBuy={async (itemSlug: string, quantity?: number) => {
          const response = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ itemSlug, quantity }),
          })

          const data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to purchase item')
          }

          // Update inventory and currency
          if (data.inventory) {
            setInventory(data.inventory)
          }
          if (data.currency !== undefined && player) {
            setPlayer({ ...player, currency: data.currency })
          }

          // Update shop modal data
          if (shopModalData) {
            setShopModalData({
              ...shopModalData,
              playerCurrency: data.currency,
              playerInventory: data.inventory,
            })
          }
        }}
        onSell={async (playerItemId: string, quantity: number) => {
          const response = await fetch('/api/shop/sell', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders(),
            },
            body: JSON.stringify({ playerItemId, quantity }),
          })

          const data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to sell item')
          }

          // Update inventory and currency
          if (data.inventory) {
            setInventory(data.inventory)
          }
          if (data.currency !== undefined && player) {
            setPlayer({ ...player, currency: data.currency })
          }

          // Update shop modal data
          if (shopModalData) {
            setShopModalData({
              ...shopModalData,
              playerCurrency: data.currency,
              playerInventory: data.inventory,
            })
          }
        }}
      />
      <NotificationContainer />
      
      <GameHeader 
        playerName={player?.username}
        level={player?.level}
        hp={player?.hp}
        hpMax={player?.hpMax}
        mp={player?.mp}
        mpMax={player?.mpMax}
        str={player?.str}
        strMod={player?.strMod}
        dex={player?.dex}
        dexMod={player?.dexMod}
        mag={player?.mag}
        magMod={player?.magMod}
        def={player?.def}
        defMod={player?.defMod}
        onCharacterClick={() => setLeftSidebarOpen((prev) => !prev)}
      />
      
      <div className="flex flex-1 overflow-hidden relative min-h-0">
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
        <div 
          className={`
            bg-gray-900/95 backdrop-blur-sm border-r border-gray-800/50 flex flex-col flex-shrink-0 h-full min-h-0
            transition-all duration-[250ms] ease-out
            ${leftSidebarOpen 
              ? 'w-full md:w-[360px] xl:min-w-[360px] xl:max-w-[25%] translate-x-0' 
              : 'w-0 md:w-0 -translate-x-full md:translate-x-0'
            }
            absolute md:relative left-0 top-0 bottom-0 z-20 shadow-xl md:shadow-none
          `}
        >
          <div ref={leftSidebarScrollRef} className="flex-1 overflow-y-auto min-h-0">
            <GameSidebar 
              player={player} 
              onToggle={() => setLeftSidebarOpen((prev) => !prev)}
              isOpen={leftSidebarOpen}
              onAction={handleAction}
              onSwitchToInventory={handleSwitchToInventory}
            />
          </div>
        </div>
        
        {/* Main Game Area */}
        <div className="flex flex-col min-w-0 min-h-0 h-full overflow-hidden flex-1">
          {currentRoom && (
            <div className="bg-gray-900/50 flex-1 overflow-hidden min-h-0 h-full flex flex-col">
              <TabContainer
                leftElement={
                  !leftSidebarOpen && (
                    <button
                      onClick={() => setLeftSidebarOpen(true)}
                      className="px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300"
                      title="Open character panel"
                      aria-label="Open character panel"
                    >
                      <Icon name="character" size={14} color="purple" />
                      <ChevronRight size={14} className="ml-0.5" />
                    </button>
                  )
                }
                rightElement={
                  !rightSidebarOpen && (
                    <button
                      onClick={() => setRightSidebarOpen(true)}
                      className="px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300"
                      title="Open world panel"
                      aria-label="Open world panel"
                    >
                      <ChevronLeft size={14} className="mr-0.5" />
                      <Icon name="world" size={14} color="blue" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  )
                }
                tabs={[
                  {
                    id: 'explore',
                    label: 'Explore',
                    icon: 'world',
                    color: 'blue',
                    content: (
                      <div className="flex flex-col flex-1 min-h-0 h-full">
                        <div className="flex-1 min-h-0 overflow-y-auto h-full">
                          <div className="max-w-4xl mx-auto w-full">
                            <RoomBox
                            room={currentRoom}
                            roomPlayers={roomPlayers}
                            currentPlayerId={player.id}
                            onAction={handleAction}
                            onRefreshCaps={() => {
                              if (currentRoom?.roomId) {
                                hydrateRoomCaps(currentRoom.roomId, roomLoadSequenceRef.current)
                              }
                            }}
                            worldTick={worldTick}
                            actionResult={actionResult}
                            isLoadingRoom={isLoadingRoom}
                            currentAction={action}
                          />
                          </div>
                        </div>

                        {/* D-pad */}
                        <div className="flex-shrink-0 p-4 relative flex flex-col gap-4 border-t border-gray-800/50">
                          {/* Teleport button - left edge */}
                          <div className="absolute left-4 top-4 flex flex-row md:flex-col gap-2 z-10">
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
                          {/* Compass */}
                          <div className="flex items-center justify-center">
                            <Compass room={currentRoom} onAction={handleAction} onNavigateToMap={() => setCenterActiveTab('map')} onOpenTeleport={handleOpenTeleport} />
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'inventory',
                    label: 'Inv',
                    icon: 'inv',
                    color: 'green',
                    content: (
                      <InventoryDisplay
                        inventory={inventory}
                        onAction={handleAction}
                        initialFilter={inventoryFilter}
                      />
                    ),
                  },
                  {
                    id: 'quests',
                    label: 'Quests',
                    icon: 'trophy',
                    color: 'gold',
                    content: (
                      <div className="space-y-4 p-4 sm:p-6">
                        <h3 className="text-lg font-semibold text-white">Quests</h3>
                        <div className="text-gray-400 text-sm">
                          No active quests.
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'map',
                    label: 'Map',
                    icon: 'world',
                    color: 'sky',
                    content: (() => {
                      const selectedMap = MAP_CONFIG.find(m => m.id === currentMapId)
                      return (
                        <MapContent
                          mapSrc={selectedMap?.src || ''}
                          mapTitle={selectedMap?.title || 'Map'}
                          availableMaps={getUnlockedMaps(player, currentRoom?.roomId)}
                          currentMapId={currentMapId}
                          onMapChange={handleMapChange}
                        />
                      )
                    })(),
                  },
                  {
                    id: 'settings',
                    label: '',
                    icon: <SettingsIcon size={14} />,
                    color: 'gray',
                    content: (
                      <SettingsContent onLogout={handleLogoutFlow} />
                    ),
                  },
                ]}
                defaultTab="explore"
                activeTab={centerActiveTab}
                onTabChange={(tabId) => {
                  setCenterActiveTab(tabId || 'explore')
                  // Clear inventory filter when switching away from inventory tab
                  if (tabId !== 'inventory') {
                    setInventoryFilter(undefined)
                  }
                }}
                containerClassName="flex-1 min-h-0"
                contentClassName="flex-1 min-h-0 overflow-hidden"
              />
            </div>
          )}
        </div>
        
        {/* Right Sidebar - Tabbed Interface (Feed, World Chat, Room Chat) */}
        <div 
          className={`
            rightColumn bg-gray-900/95 backdrop-blur-sm border-l border-gray-800/50 flex flex-col flex-shrink-0 h-full min-h-0
            transition-all duration-[250ms] ease-out
            ${rightSidebarOpen 
              ? 'w-full md:w-[360px] xl:min-w-[360px] xl:max-w-[25%] translate-x-0' 
              : 'w-0 md:w-0 translate-x-full md:translate-x-0'
            }
            absolute md:relative right-0 top-0 bottom-0 z-20 shadow-xl md:shadow-none
          `}
        >
          <div ref={rightSidebarScrollRef} className="flex-1 overflow-y-auto min-h-0">
            <UnifiedFeedPanel
              currentRoomId={currentRoom?.roomId}
              isConnected={socket?.connected ?? false}
              onToggle={() => setRightSidebarOpen((prev) => !prev)}
              isOpen={rightSidebarOpen}
              onOpenSettings={() => setCenterActiveTab('settings')}
              customAction={customAction}
              onCustomActionChange={setCustomAction}
              onCustomActionSubmit={handleCustomAction}
              isLoadingRoom={isLoadingRoom}
              customActionInputRef={customActionInputRef}
              onUnreadCountChange={setUnreadCount}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
