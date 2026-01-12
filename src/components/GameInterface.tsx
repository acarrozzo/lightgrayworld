'use client'

import { useGameStore } from '@/lib/game-state'
import type { Room, Player } from '@/lib/game-state'
import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'
import GameHeader from './GameHeader'
import { type InputMode } from './game-interface/panels/FeedPanel'
import RoomBox from './RoomBox'
import Compass from './Compass'
import TabContainer, { type TabConfig } from './TabContainer'
import InventoryDisplay from './InventoryDisplay'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import SettingsContent from './SettingsContent'
import { Settings as SettingsIcon, ChevronLeft, ChevronRight, MessageSquare, MessageSquareText, Map } from 'lucide-react'
import TeleportModal, { type TeleportLocation } from './TeleportModal'
import ActionModal from './ActionModal'
import ShopModal from './ShopModal'
import Icon from './Icon'
import { normalizeRoom, normalizeRoomItems } from '@/lib/normalize/room'
import { useWorldFeedStore } from '@/store/worldFeedStore'
import type { WorldFeedEntryInput } from '@/store/worldFeedStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'
import NotificationContainer from './NotificationContainer'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import UsersDisplay from './UsersDisplay'
import { MAP_CONFIG, TELEPORT_LOCATIONS } from './game-interface/constants'
import { findTravelDirection, checkIfExitHasGate, normalizeCommand, getMapIdForRoom, getUnlockedMaps, formatDirectionPhrase } from './game-interface/utils'
import { DirectoryContent } from './game-interface/DirectoryContent'
import CharPanel from './game-interface/panels/CharPanel'
import InventoryPanel from './game-interface/panels/InventoryPanel'
import QuestsPanel from './game-interface/panels/QuestsPanel'
import MapPanel from './game-interface/panels/MapPanel'
import ChatPanel from './game-interface/panels/ChatPanel'
import FeedPanel from './game-interface/panels/FeedPanel'
import SettingsPanel from './game-interface/panels/SettingsPanel'

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
    buttons?: Array<{ label: string; direction: string; closeOnAction?: boolean }>
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
  const [forceWorldChatMode, setForceWorldChatMode] = useState<InputMode | undefined>(undefined)
  const [quests, setQuests] = useState<Array<{ id: string; questId: string; progress: number; completed: boolean }>>([])
  const [isLoadingQuests, setIsLoadingQuests] = useState(false)
  const [isResettingQuests, setIsResettingQuests] = useState(false)
  const [forceFeedFilter, setForceFeedFilter] = useState<'chat' | undefined>(undefined)
  const [forceFeedChatSubFilter, setForceFeedChatSubFilter] = useState<'all-chat' | undefined>(undefined)
  type FilterTab = 'all' | 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'consumables' | 'misc'
  const [inventoryFilter, setInventoryFilter] = useState<FilterTab | undefined>(undefined)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const isInitialInventoryLoadRef = useRef(true)
  const previousInventoryRef = useRef<typeof inventory>([])
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
  const pendingMoveRef = useRef<{ moveSeq: number; toRoomId: string; fromRoomId: string; previousRoom: Room | null } | null>(null) // Tracks pending moves with previous state
  const [isMoveInProgress, setIsMoveInProgress] = useState(false) // Prevents multiple simultaneous moves and triggers UI updates
  const tickRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const tickRefreshSequenceRef = useRef(0)
  const lastTickNumberRef = useRef<number | null>(null)
  const appendWorldFeed = useCallback((entry: WorldFeedEntryInput) => {
    const { append } = useWorldFeedStore.getState()
    return append(entry)
  }, [])
  
  // Clear new items on mount - after refresh, nothing should be "new"
  useEffect(() => {
    setNewItemIds(new Set())
  }, []) // Run only on mount
  
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

  // Detect tick number changes and trigger refresh immediately
  useEffect(() => {
    if (!worldTick?.tickNumber || !currentRoom) return
    
    const currentTickNumber = worldTick.tickNumber
    const lastTickNumber = lastTickNumberRef.current
    
    // If tick number has increased, a new tick has occurred
    if (lastTickNumber !== null && currentTickNumber > lastTickNumber) {
      console.log(`[GameInterface] Detected tick number change from ${lastTickNumber} to ${currentTickNumber}, triggering cap refresh for room ${currentRoom.roomId}`)
      // Trigger refresh immediately when tick number changes
      hydrateRoomCaps(currentRoom.roomId, roomLoadSequenceRef.current)
    }
    
    // Update the ref to track the current tick number
    lastTickNumberRef.current = currentTickNumber
  }, [worldTick?.tickNumber, currentRoom, hydrateRoomCaps])

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
    const { setUser } = useFontPreferenceStore.getState()
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

      // Increment move sequence when initiating teleport
      const moveSeq = ++moveSequenceRef.current

      // Store previous room state for rollback on failure
      const previousRoom = currentRoom
      const previousPlayerRoom = player?.currentRoom

      // Set pending move with previous state - will be cleared when action:feedback arrives
      pendingMoveRef.current = { 
        moveSeq, 
        toRoomId: targetRoomId,
        fromRoomId: currentRoom.roomId,
        previousRoom: previousRoom,
      }

      // Set move-in-progress flag
      setIsMoveInProgress(true)

      // Safety timeout: Clear move-in-progress flag if no feedback arrives within 10 seconds
      // This prevents the UI from being permanently stuck if feedback is lost
      setTimeout(() => {
        if (pendingMoveRef.current?.moveSeq === moveSeq) {
          console.warn(`[GameInterface] Teleport timeout - clearing move-in-progress flag for moveSeq:${moveSeq}`)
          setIsMoveInProgress(false)
          // Don't clear pendingMoveRef here - let it be cleared by feedback if it arrives late
        }
      }, 10000)

      // Optimistic update: immediately use cached room if available
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
        console.log(`[handleAction] Emitting player-move event for teleport [moveSeq:${moveSeq}]:`, { fromRoom: currentRoom.roomId, toRoom: targetRoomId })
        socket.emit('player-move', {
          fromRoom: currentRoom.roomId,
          toRoom: targetRoomId,
        })
      } else {
        console.warn('Socket not connected; teleport request not sent')
        // Clear move-in-progress if socket not connected
        setIsMoveInProgress(false)
        pendingMoveRef.current = null
      }

      return
    }
    
    // Check if this is a navigation action for optimistic updates
    const travelActions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'move', 'navigate']
    const isNavigationAction = travelActions.includes(normalizedAction)
    
    if (isNavigationAction) {
      console.log('[handleAction] Navigation action detected, currentRoom:', currentRoom?.roomId)
      
      // Move-in-progress guard: Prevent new moves while one is pending
      if (isMoveInProgress) {
        console.warn('[handleAction] Move already in progress, ignoring new move request')
        return
      }

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

      // Check if this exit has a gate (skip optimistic update for gated exits)
      const hasGate = checkIfExitHasGate(currentRoom.roomId, actionType)

      // Increment move sequence when initiating move
      const moveSeq = ++moveSequenceRef.current

      // Store previous room state for rollback on failure
      const previousRoom = currentRoom
      const previousPlayerRoom = player?.currentRoom

      // Set pending move with previous state - will be cleared when action:feedback arrives
      pendingMoveRef.current = { 
        moveSeq, 
        toRoomId: targetRoomId,
        fromRoomId: currentRoom.roomId,
        previousRoom: previousRoom,
      }

      // Set move-in-progress flag
      setIsMoveInProgress(true)

      // Safety timeout: Clear move-in-progress flag if no feedback arrives within 10 seconds
      // This prevents the UI from being permanently stuck if feedback is lost
      setTimeout(() => {
        if (pendingMoveRef.current?.moveSeq === moveSeq) {
          console.warn(`[GameInterface] Move timeout - clearing move-in-progress flag for moveSeq:${moveSeq}`)
          setIsMoveInProgress(false)
          // Don't clear pendingMoveRef here - let it be cleared by feedback if it arrives late
        }
      }, 10000)

      // Optimistic update: immediately use cached room if available
      // SKIP optimistic update for gated exits to avoid showing wrong room
      // NOTE: This is UI-only for instant feedback. The authoritative update
      // will come from action:feedback, which will hydrate the room with
      // server truth (players, items, state). This does NOT trigger
      // loadRoomData() to avoid competing with the authoritative update.
      if (!hasGate) {
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
      } else {
        console.log(`[handleAction] Skipping optimistic update - exit has gate [moveSeq:${moveSeq}]`)
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
        // Clear move-in-progress if socket not connected
        setIsMoveInProgress(false)
        pendingMoveRef.current = null
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

    // Parse quest actions with questId (and optional choiceId)
    // Format: accept_quest:quest_002 or accept_quest:quest_002:polite
    if (normalizedAction.startsWith('accept_quest:')) {
      const parts = normalizedAction.split(':')
      const questId = parts[1]
      const choiceId = parts[2] || null
      if (questId) {
        console.log('[handleAction] Parsed accept_quest action:', { questId, choiceId })
        return handleAction({ type: 'accept_quest', data: { questId, choiceId } })
      }
    }

    // Format: complete_quest:quest_002
    if (normalizedAction.startsWith('complete_quest:')) {
      const parts = normalizedAction.split(':')
      const questId = parts[1]
      if (questId) {
        console.log('[handleAction] Parsed complete_quest action:', { questId })
        return handleAction({ type: 'complete_quest', data: { questId } })
      }
    }

    // Handle quest actions via socket (after parsing)
    if (normalizedAction === 'accept_quest' || normalizedAction === 'complete_quest') {
      console.log('[handleAction] Quest action detected, sending to server:', normalizedAction, actionData)
      const questResult = socketHandlers.sendGameAction({
        type: normalizedAction,
        data: actionData,
      })
      console.log('[handleAction] sendGameAction result for quest:', questResult)
      if (!questResult) {
        console.warn('Failed to send quest action via socket')
      }
      return
    }

    if (normalizedAction === 'decline_quest') {
      // Just close the modal (already handled by ActionModal)
      return
    }

    if (normalizedAction === 'continue') {
      // Just close the modal (already handled by ActionModal)
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

  const handleOpenWorldChat = () => {
    setRightSidebarOpen(true)
    setForceFeedFilter('chat')
    setForceFeedChatSubFilter('all-chat')
    setForceWorldChatMode('world')
    // Focus the input after sidebar opens
    setTimeout(() => {
      customActionInputRef.current?.focus()
    }, 350) // Wait for sidebar animation to complete
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
      
      // Validate message length
      if (message.length > MESSAGE_MAX_LENGTH) {
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters. Current: ${message.length} characters`,
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

      // Update player state if provided in action feedback (e.g., from equip/unequip, quest completion)
      // Merge partial updates instead of replacing entire state to preserve fields like hp, hpMax, mp, mpMax, level, currentRoom
      if (payload?.data?.player) {
        const currentPlayer = playerRef.current
        if (currentPlayer) {
          setPlayer({ ...currentPlayer, ...payload.data.player })
        } else {
          // Fallback: if no current player, use the payload player (shouldn't happen normally)
          setPlayer(payload.data.player)
        }
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

      // Handle move action feedback (both success and failure)
      if (payload?.action === 'move') {
        const pendingMove = pendingMoveRef.current
        
        // Validate: Only process feedback if there's a pending move
        // This ensures we're processing feedback for the move we initiated
        if (!pendingMove) {
          console.warn('[GameInterface] Received move feedback but no pending move exists, ignoring')
          return
        }
        
        // Validate: Check if feedback destination matches pending move destination
        // This is a sanity check to ensure feedback matches our request
        const feedbackToRoom = payload?.data?.toRoom
        if (success && feedbackToRoom && feedbackToRoom !== pendingMove.toRoomId) {
          console.warn(`[GameInterface] Move feedback destination mismatch - pending: ${pendingMove.toRoomId}, feedback: ${feedbackToRoom}, ignoring`)
          return
        }
        
        if (success && payload?.data?.toRoom) {
          // SUCCESSFUL MOVE
          console.log(`[GameInterface] Processing successful move action feedback [moveSeq:${pendingMove?.moveSeq}]`)
          const currentPlayer = playerRef.current
          const activeRoom = currentRoomRef.current
          
          // Clear pending move and move-in-progress flag - feedback has arrived
          if (pendingMove) {
            console.log(`[GameInterface] Clearing pending move - feedback received for room ${payload.data.toRoom}`)
            pendingMoveRef.current = null
          }
          setIsMoveInProgress(false)
          
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
        } else if (!success) {
          // FAILED MOVE - Rollback optimistic update
          console.log(`[GameInterface] Processing failed move action feedback [moveSeq:${pendingMove?.moveSeq}]`)
          
          // Clear move-in-progress flag
          setIsMoveInProgress(false)
          
          if (pendingMove) {
            // Rollback: Restore previous room state
            if (pendingMove.previousRoom) {
              console.log(`[GameInterface] Rolling back optimistic update - restoring room ${pendingMove.previousRoom.roomId}`)
              setCurrentRoom(pendingMove.previousRoom)
              enteredViaCacheRoomIdRef.current = null
              
              // Restore player room state
              const currentPlayer = playerRef.current
              if (currentPlayer && currentPlayer.currentRoom !== pendingMove.fromRoomId) {
                console.log(`[GameInterface] Restoring player room to: ${pendingMove.fromRoomId}`)
                setPlayer({ ...currentPlayer, currentRoom: pendingMove.fromRoomId })
              }
            }
            
            // Clear pending move
            pendingMoveRef.current = null
          }
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
              // Handle message as array (paragraphs) or string
              const messageContent = modalContent.message || messageText
              const isMessageArray = Array.isArray(messageContent)
              
              renderedContent = (
                <div className="flex flex-col items-center justify-center gap-6 py-8">
                  <Icon 
                    name={modalContent.icon} 
                    size={200} 
                    className={iconColorClass}
                  />
                  <div className="text-center max-w-md">
                    {modalContent.header && (
                      <h3 className="text-gray-100 text-lg font-semibold mb-4">
                        {modalContent.header}
                      </h3>
                    )}
                    {isMessageArray ? (
                      <div className="text-gray-200 text-base leading-relaxed space-y-4">
                        {messageContent.map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-200 text-base leading-relaxed">
                        {messageContent}
                      </p>
                    )}
                  </div>
                </div>
              )
              modalTitle = modalContent.title || modalTitle
            } else if (modalContent.heading || modalContent.locations) {
              // Structured content - render directory
              modalTitle = modalContent.title || modalTitle
              renderedContent = <DirectoryContent modalContent={modalContent} buttons={buttons || []} />
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

      // Handle quest chain toast (show even if modal is open)
      if (payload?.data?.questChain) {
        const toastMessage = payload.data.toast || payload.data.questChain.message
        if (toastMessage) {
          const { addNotification } = useNotificationStore.getState()
          addNotification({
            message: toastMessage,
            outcome: 'success',
            action: 'quest_chain',
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

  // Fetch quests when quest tab is opened
  useEffect(() => {
    if (centerActiveTab === 'quests' && isLoggedIn) {
      let cancelled = false
      setIsLoadingQuests(true)
      fetch('/api/game/quests/progress', {
        headers: getAuthHeaders(),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data.success) {
            setQuests(data.quests || [])
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Error fetching quests:', error)
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingQuests(false)
          }
        })
      
      return () => {
        cancelled = true
      }
    }
  }, [centerActiveTab, isLoggedIn]) // Removed isLoadingQuests and getAuthHeaders from deps

  // Handler to reset quests to initial state
  const handleResetQuests = async () => {
    if (!isLoggedIn) return
    
    setIsResettingQuests(true)
    try {
      const response = await fetch('/api/game/quests/reset', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      
      if (data.success) {
        // Refresh quests after reset
        const questResponse = await fetch('/api/game/quests/progress', {
          headers: getAuthHeaders(),
        })
        const questData = await questResponse.json()
        if (questData.success) {
          setQuests(questData.quests || [])
        }
      } else {
        console.error('Failed to reset quests:', data.error)
      }
    } catch (error) {
      console.error('Error resetting quests:', error)
    } finally {
      setIsResettingQuests(false)
    }
  }

  // Track new items when inventory changes
  useEffect(() => {
    // Skip tracking on initial load
    // Check both the ref flag and if we're going from empty to populated (initial load scenario)
    const isInitialLoad = isInitialInventoryLoadRef.current || 
      (previousInventoryRef.current.length === 0 && inventory.length > 0)
    
    if (isInitialLoad) {
      previousInventoryRef.current = inventory
      isInitialInventoryLoadRef.current = false
      return
    }

    // Compare previous inventory with new inventory to find new items
    const previousItemIds = new Set(previousInventoryRef.current.map(item => item.id))
    const newItems = inventory.filter(item => !previousItemIds.has(item.id))
    
    if (newItems.length > 0) {
      // Add new item IDs to the set
      setNewItemIds(prev => {
        const updated = new Set(prev)
        newItems.forEach(item => updated.add(item.id))
        return updated
      })
    }

    // Update previous inventory ref
    previousInventoryRef.current = inventory
  }, [inventory])

  // Clear forceWorldChatMode after it's been applied
  useEffect(() => {
    if (forceWorldChatMode && rightSidebarOpen) {
      // Small delay to ensure the mode is set, then clear it
      const timer = setTimeout(() => {
        setForceWorldChatMode(undefined)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [forceWorldChatMode, rightSidebarOpen])

  // Clear forceFeedFilter after it's been applied
  useEffect(() => {
    if (forceFeedFilter && rightSidebarOpen) {
      // Small delay to ensure the filter is set, then clear it
      const timer = setTimeout(() => {
        setForceFeedFilter(undefined)
        setForceFeedChatSubFilter(undefined)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [forceFeedFilter, rightSidebarOpen])

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
            bg-gray-900/95 backdrop-blur-sm border-r border-gray-800/50 flex flex-col flex-shrink-0 h-full min-h-0 overflow-hidden
            transition-all duration-[250ms] ease-out
            ${leftSidebarOpen 
              ? rightSidebarOpen
                ? 'w-full md:w-[360px] xl:min-w-[360px] xl:max-w-[25%] translate-x-0'
                : 'w-full md:w-[480px] xl:min-w-[480px] xl:max-w-[25%] translate-x-0'
              : 'w-0 md:w-0 -translate-x-full md:translate-x-0'
            }
            absolute md:relative left-0 top-0 bottom-0 z-20 shadow-xl md:shadow-none
          `}
        >
          <div className="flex flex-col h-full">
            {/* Header with toggle button */}
            <div className="flex items-center gap-3 p-4 bg-gray-900/95 backdrop-blur-sm flex-shrink-0 border-b border-gray-800/50">
              <button
                onClick={() => setLeftSidebarOpen((prev) => !prev)}
                className="px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300"
                title="Close"
                aria-label="Close character panel"
              >
                <ChevronLeft size={14} className="mr-0.5" />
                <Icon name="character" size={14} color="purple" />
              </button>
              <h2 className="text-sm font-semibold text-white">Character</h2>
            </div>
            <div ref={leftSidebarScrollRef} className="flex-1 overflow-y-auto min-h-0">
              <CharPanel
                player={player}
                onAction={handleAction}
                onSwitchToInventory={handleSwitchToInventory}
              />
            </div>
          </div>
        </div>
        
        {/* Main Game Area */}
        <div className="flex flex-col min-w-0 min-h-0 h-full overflow-hidden flex-1">
          {currentRoom && (
            <div className="bg-gray-900/50 flex-1 overflow-hidden min-h-0 h-full flex flex-col">
              <TabContainer
                leftElement={
                  <button
                    onClick={() => setLeftSidebarOpen(true)}
                    className={`group px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300 ${leftSidebarOpen ? 'md:hidden' : ''}`}
                    title="Open character panel"
                    aria-label="Open character panel"
                  >
                    <Icon name="character" size={14} color="purple" />
                    <span className="opacity-0 -translate-x-2 max-w-0 overflow-hidden transition-all duration-200 md:group-hover:opacity-100 md:group-hover:translate-x-0 md:group-hover:max-w-[100px] whitespace-nowrap ml-1">
                      Character
                    </span>
                    <ChevronRight size={14} className="ml-0.5" />
                  </button>
                }
                rightElement={
                  <button
                    onClick={() => setRightSidebarOpen(true)}
                    className={`group px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300 ${rightSidebarOpen ? 'md:hidden' : ''}`}
                    title="Open world panel"
                    aria-label="Open world panel"
                  >
                    <ChevronLeft size={14} className="mr-0.5" />
                    <span className="opacity-0 translate-x-2 max-w-0 overflow-hidden transition-all duration-200 md:group-hover:opacity-100 md:group-hover:translate-x-0 md:group-hover:max-w-[120px] whitespace-nowrap">
                      World Feed
                    </span>
                    <MessageSquareText size={14} className="text-blue-500 ml-1" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
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
                            {!socket?.connected && (
                              <div className="flex items-center justify-center gap-3 px-4 py-4 my-4 rounded-lg border border-gray-800/60 bg-gray-900/80">
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  <span>Not Connected</span>
                                </div>
                                <button
                                  onClick={() => window.location.reload()}
                                  className="px-6 py-2 text-md font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 shadow-sm hover:shadow"
                                  aria-label="Refresh page"
                                  title="Refresh page"
                                >
                                  Refresh
                                </button>
                              </div>
                            )}
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
                            <Compass room={currentRoom} onAction={handleAction} onNavigateToMap={() => setCenterActiveTab('map')} onOpenTeleport={handleOpenTeleport} isMoveInProgress={isMoveInProgress} />
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'char',
                    label: 'Char',
                    icon: 'character',
                    color: 'purple',
                    content: (
                      <CharPanel
                        player={player}
                        onAction={handleAction}
                        onSwitchToInventory={handleSwitchToInventory}
                        onClose={() => setCenterActiveTab('explore')}
                      />
                    ),
                  },
                  {
                    id: 'inventory',
                    label: 'Inv',
                    icon: 'inv',
                    color: 'green',
                    badge: newItemIds.size > 0 ? newItemIds.size : undefined,
                    content: (
                      <InventoryPanel
                        inventory={inventory}
                        onAction={handleAction}
                        initialFilter={inventoryFilter}
                        newItemIds={newItemIds}
                        onClearNewItem={(itemId) => {
                          setNewItemIds(prev => {
                            const updated = new Set(prev)
                            updated.delete(itemId)
                            return updated
                          })
                        }}
                        onClose={() => setCenterActiveTab('explore')}
                      />
                    ),
                  },
                  {
                    id: 'quests',
                    label: 'Quests',
                    icon: 'trophy',
                    color: 'gold',
                    content: (
                      <QuestsPanel
                        quests={quests}
                        isLoadingQuests={isLoadingQuests}
                        isResettingQuests={isResettingQuests}
                        isLoggedIn={isLoggedIn}
                        inventory={inventory}
                        onResetQuests={handleResetQuests}
                        onClose={() => setCenterActiveTab('explore')}
                      />
                    ),
                  },
                  {
                    id: 'map',
                    label: 'Map',
                    icon: <Map size={14} />,
                    color: 'sky',
                    content: (
                      <MapPanel
                        currentMapId={currentMapId}
                        availableMaps={getUnlockedMaps(player, currentRoom?.roomId)}
                        onMapChange={handleMapChange}
                        onClose={() => setCenterActiveTab('explore')}
                      />
                    ),
                  },
                  {
                    id: 'chat',
                    label: 'Chat',
                    icon: <MessageSquare size={14} />,
                    color: 'purple',
                    content: (
                      <ChatPanel
                        onOpenWorldChat={handleOpenWorldChat}
                        onClose={() => setCenterActiveTab('explore')}
                      />
                    ),
                  },
                  {
                    id: 'feed',
                    label: 'Feed',
                    icon: <MessageSquareText size={14} />,
                    color: 'blue',
                    content: (
                      <FeedPanel
                        currentRoomId={currentRoom?.roomId}
                        currentRoomName={currentRoom?.name}
                        isConnected={socket?.connected ?? false}
                        onClose={() => setCenterActiveTab('explore')}
                        onOpenSettings={() => setCenterActiveTab('settings')}
                        customAction={customAction}
                        onCustomActionChange={setCustomAction}
                        onCustomActionSubmit={handleCustomAction}
                        isLoadingRoom={isLoadingRoom}
                        customActionInputRef={customActionInputRef}
                        onUnreadCountChange={setUnreadCount}
                        forceInputMode={forceWorldChatMode}
                        forceFilter={forceFeedFilter}
                        forceChatSubFilter={forceFeedChatSubFilter}
                      />
                    ),
                  },
                  {
                    id: 'settings',
                    label: '',
                    icon: <SettingsIcon size={14} />,
                    color: 'gray',
                    content: (
                      <SettingsPanel
                        onLogout={handleLogoutFlow}
                        onClose={() => setCenterActiveTab('explore')}
                      />
                    ),
                  },
                ]}
                defaultTab="explore"
                activeTab={centerActiveTab}
                onTabChange={(tabId) => {
                  setCenterActiveTab(tabId || 'explore')
                  
                  // When map tab is opened, default to the player's current map
                  if (tabId === 'map' && currentRoom?.roomId) {
                    const mapIdForCurrentRoom = getMapIdForRoom(currentRoom.roomId)
                    setCurrentMapId(mapIdForCurrentRoom)
                  }
                  
                  // Clear inventory filter when switching away from inventory tab
                  if (tabId !== 'inventory') {
                    setInventoryFilter(undefined)
                    // Clear new items badge when leaving inventory tab
                    setNewItemIds(new Set())
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
            rightColumn bg-gray-900/95 backdrop-blur-sm border-l border-gray-800/50 flex flex-col flex-shrink-0 h-full min-h-0 overflow-hidden
            transition-all duration-[250ms] ease-out
            ${rightSidebarOpen 
              ? leftSidebarOpen
                ? 'w-full md:w-[360px] xl:min-w-[360px] xl:max-w-[25%] translate-x-0'
                : 'w-full md:w-[480px] xl:min-w-[480px] xl:max-w-[25%] translate-x-0'
              : 'w-0 md:w-0 translate-x-full md:translate-x-0'
            }
            absolute md:relative right-0 top-0 bottom-0 z-20 shadow-xl md:shadow-none
          `}
        >
          <div className="flex flex-col h-full">
            {/* Header with toggle button */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800/60 bg-gray-900/80 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-100">World Feed</span>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span>{socket?.connected ? 'Connected' : 'Disconnected'}</span>
                </div>
                {!socket?.connected && (
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 shadow-sm hover:shadow"
                    aria-label="Refresh page"
                    title="Refresh page"
                  >
                    Refresh
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRightSidebarOpen((prev) => !prev)}
                  className="px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300"
                  title="Close"
                  aria-label="Close world panel"
                >
                  <MessageSquareText size={14} className="text-blue-500" />
                  <ChevronRight size={14} className="ml-0.5" />
                </button>
              </div>
            </div>
            <div ref={rightSidebarScrollRef} className="flex-1 overflow-y-auto min-h-0">
              <FeedPanel
                currentRoomId={currentRoom?.roomId}
                currentRoomName={currentRoom?.name}
                isConnected={socket?.connected ?? false}
                onOpenSettings={() => setCenterActiveTab('settings')}
                customAction={customAction}
                onCustomActionChange={setCustomAction}
                onCustomActionSubmit={handleCustomAction}
                isLoadingRoom={isLoadingRoom}
                customActionInputRef={customActionInputRef}
                onUnreadCountChange={setUnreadCount}
                forceInputMode={forceWorldChatMode}
                forceFilter={forceFeedFilter}
                forceChatSubFilter={forceFeedChatSubFilter}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
