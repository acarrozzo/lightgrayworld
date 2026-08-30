'use client'

import { useGameStore } from '@/lib/game-state'
import type { Room, Player } from '@/lib/game-state'
import { useShallow } from 'zustand/react/shallow'
import { useCallback, useEffect, useRef, useState } from 'react'
import React from 'react'
import GameHeader from './GameHeader'
import { type InputMode } from './game-interface/panels/FeedPanel'
import RoomBox, { type RoomEnemy } from './RoomBox'
import BattlePanel from './game-interface/panels/BattlePanel'
import TabContainer, { type TabConfig } from './TabContainer'
import MobileBottomNav from './MobileBottomNav'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { Settings as SettingsIcon, MessageSquare, MessageSquareText } from 'lucide-react'
import ExplorePanel, { type ExploreSubView } from './game-interface/ExplorePanel'
import { type BasicActionSurface } from './BasicActionButtons'
import ActionModal from './ActionModal'
import ShopModal from './ShopModal'
import Icon from './Icon'
import { normalizeRoom, normalizeRoomItems } from '@/lib/normalize/room'
import { resolveItemIcon } from '@/lib/item-actions'
import { useWorldFeedStore } from '@/store/worldFeedStore'
import type { WorldFeedEntryInput } from '@/store/worldFeedStore'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'
import { useTickerStore } from '@/store/tickerStore'
import ActivityTicker from './ActivityTicker'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import { MAP_CONFIG, TELEPORT_LOCATIONS } from './game-interface/constants'
import type { FilterTab } from '@/lib/inventory-categories'
import { findTravelDirection, checkIfExitHasGate, normalizeCommand, getMapIdForRoom, getUnlockedMaps, formatDirectionPhrase } from './game-interface/utils'
import { DirectoryContent } from './game-interface/DirectoryContent'
import CharPanel from './game-interface/panels/CharPanel'
import InventoryPanel from './game-interface/panels/InventoryPanel'
import QuestsPanel from './game-interface/panels/QuestsPanel'
import MapPanel from './game-interface/panels/MapPanel'
import FeedPanel from './game-interface/panels/FeedPanel'
import SettingsPanel from './game-interface/panels/SettingsPanel'
import PlayersPanel, { type PlayersSubTab } from './game-interface/panels/PlayersPanel'
import PartyStrip from './game-interface/PartyStrip'
import CraftingPanel from './game-interface/panels/CraftingPanel'
import { isCraftingRoom } from '@/lib/game-data/crafting-recipes'
import QuestCompleteRewards, { type QuestCompleteData } from './QuestCompleteRewards'
import PlayerProfileModal from './PlayerProfileModal'
import { useDMStore } from '@/store/dmStore'
import { usePresenceStore } from '@/store/presenceStore'
import LevelUpAlert from './LevelUpAlert'
import TrainingAllocationModal from './TrainingAllocationModal'
import StatAllocationModal from './StatAllocationModal'
import type { LevelUpPayload } from '@/lib/socket'

export default function GameInterface() {
  // State selectors — only re-render when these specific values change
  const {
    player,
    currentRoom,
    roomPlayers,
    isLoggedIn,
    inventory,
    killList,
    battle,
    battleResult,
    party,
  } = useGameStore(useShallow((s) => ({
    player: s.player,
    currentRoom: s.currentRoom,
    roomPlayers: s.roomPlayers,
    isLoggedIn: s.isLoggedIn,
    inventory: s.inventory,
    killList: s.killList,
    battle: s.battle,
    battleResult: s.battleResult,
    party: s.party,
  })))

  // Actions — stable references, never cause re-renders
  const setPlayer = useGameStore((s) => s.setPlayer)
  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom)
  const setRoomPlayers = useGameStore((s) => s.setRoomPlayers)
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const cacheRoom = useGameStore((s) => s.cacheRoom)
  const getCachedRoom = useGameStore((s) => s.getCachedRoom)
  const setInventory = useGameStore((s) => s.setInventory)
  const setKillList = useGameStore((s) => s.setKillList)
  const incrementKill = useGameStore((s) => s.incrementKill)
  const logout = useGameStore((s) => s.logout)
  const setBattleStarted = useGameStore((s) => s.setBattleStarted)
  const updateBattleTurn = useGameStore((s) => s.updateBattleTurn)
  const clearBattle = useGameStore((s) => s.clearBattle)
  const setBattleResult = useGameStore((s) => s.setBattleResult)
  const clearBattleResult = useGameStore((s) => s.clearBattleResult)
  const setParty = useGameStore((s) => s.setParty)
  const clearParty = useGameStore((s) => s.clearParty)
  const updateRoomItems = useGameStore((s) => s.updateRoomItems)
  const equippedWeapon = inventory.find(item => item.isEquipped && item.slot === 'MAIN_HAND')
  const weaponIconName = equippedWeapon
    ? resolveItemIcon(equippedWeapon.template.metadata as { icon?: string } | null, equippedWeapon.template.slug ?? '')
    : 'equipment-fists'
  const weaponName = equippedWeapon?.template.name ?? null
  const [action, setAction] = useState('')
  const [actionResult, setActionResult] = useState<any>(null)
  const [levelUpData, setLevelUpData] = useState<LevelUpPayload | null>(null)
  const [isTrainingModalOpen, setTrainingModalOpen] = useState(false)
  const [isStatModalOpen, setStatModalOpen] = useState(false)
  const [xpGain, setXpGain] = useState<number | null>(null)
  const [xpGainKey, setXpGainKey] = useState(0)
  const xpGainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLoadingRoom, setIsLoadingRoom] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  // Crafting panel (rooms 003 / 021): a local UI toggle that renders above the
  // room info, like the battle panel. `craftingRecipeId` marks the in-flight craft.
  const [isCraftingOpen, setIsCraftingOpen] = useState(false)
  const [craftingRecipeId, setCraftingRecipeId] = useState<string | null>(null)
  const craftingPanelRef = useRef<HTMLDivElement>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const totalDmUnread = useDMStore((state) => state.getTotalUnreadCount())
  const syncPresence = usePresenceStore((state) => state.syncPresence)
  const upsertPresence = usePresenceStore((state) => state.upsertPresence)
  const removePresence = usePresenceStore((state) => state.removePresence)
  const [exploreSubView, setExploreSubView] = useState<ExploreSubView>('compass')
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  // Desktop world feed starts open; the toggle only affects this session.
  const [isFeedPanelOpen, setIsFeedPanelOpen] = useState(true)
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  const [shopModalData, setShopModalData] = useState<{
    shopName?: string
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
  // Attack / Search / Rest / Look render both in the room's More Actions section
  // and beside the compass D-pad. This tracks which copy was last pressed so only
  // that one shows the result flyout. Defaults to the D-pad, which is always
  // visible, so results from typed commands still surface somewhere.
  const [basicActionSurface, setBasicActionSurface] = useState<BasicActionSurface>('explore')
  const [worldTick, setWorldTick] = useState<{
    tickNumber: number
    nextTickAt: number
    tickIntervalMs: number
  } | undefined>(undefined)
  // Rolling gather cooldown for the current room (sand / berries); null if none.
  const [gatherCooldowns, setGatherCooldowns] = useState<Array<{
    action: string
    cooldownSeconds: number
    secondsRemaining: number
    quantity: number | null
    itemSlug?: string | null
    itemNamePlural?: string | null
    maxHeld?: number | null
    readyLabel?: string | null
  }>>([])
  const [centerActiveTab, setCenterActiveTab] = useState<string>('explore')
  // Returning to Explore always lands on the compass — a sub-view left open
  // before switching tabs never greets you on the way back.
  const goToExplore = useCallback(() => {
    setCenterActiveTab('explore')
    setExploreSubView('compass')
  }, [])
  const [playersSubTab, setPlayersSubTab] = useState<PlayersSubTab>('roster')
  const [forceWorldChatMode, setForceWorldChatMode] = useState<InputMode | undefined>(undefined)
  const [quests, setQuests] = useState<Array<{ id: string; questId: string; progress: number; completed: boolean; data?: { accepted?: boolean } | null }>>([])
  const [isLoadingQuests, setIsLoadingQuests] = useState(false)
  const [isResettingQuests, setIsResettingQuests] = useState(false)
  const [forceFeedFilter, setForceFeedFilter] = useState<'chat' | undefined>(undefined)
  const [forceFeedChatSubFilter, setForceFeedChatSubFilter] = useState<'all-chat' | undefined>(undefined)
  // Avatar fields are nullable here because roster and ranks rows come straight from
  // the database, where the columns are nullable; room players carry them as optional.
  // PlayerProfileModal already accepts both.
  const [playerProfileModal, setPlayerProfileModal] = useState<{
    isOpen: boolean
    player: {
      id: string
      username: string
      level: number
      uIcon?: string | null
      uIconColor?: string | null
    } | null
  }>({
    isOpen: false,
    player: null,
  })
  const [inventoryFilter, setInventoryFilter] = useState<FilterTab | undefined>(undefined)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [hasQuestUpdate, setHasQuestUpdate] = useState(false)
  const isInitialInventoryLoadRef = useRef(true)
  const previousInventoryRef = useRef<typeof inventory>([])
  const pendingEquipActionRef = useRef<{ playerItemId: string } | null>(null)
  const [roomEnemies, setRoomEnemies] = useState<RoomEnemy[]>([])
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)
  const isPartyMember = !!party && !!player && party.leaderId !== player.id
  const handleFollowPlayer = useCallback((targetId: string) => {
    socketHandlers.followPlayer(targetId)
  }, [socketHandlers])
  const handleLeaveParty = useCallback(() => {
    socketHandlers.leaveParty()
  }, [socketHandlers])
  const handleRemovePartyMember = useCallback((memberId: string) => {
    socketHandlers.removePartyMember(memberId)
  }, [socketHandlers])
  const lastLoginSocketId = useRef<string | null>(null)
  const playerRef = useRef(player)
  const currentRoomRef = useRef(currentRoom)
  // Authoritative live roster for a specific room: playerId -> party leaderId|null.
  // Its keys ARE the set of players truly socket-present in that room, so it doubles as
  // a presence source to (a) survive REST reloads that lack party affiliation and
  // (b) prune stale DB-listed players who aren't actually connected here.
  const roomPartyLeadersRef = useRef<{ roomId: string | null; leaders: Record<string, string | null> }>({
    roomId: null,
    leaders: {},
  })
  const customActionInputRef = useRef<HTMLInputElement>(null)
  const moveSequenceRef = useRef(0) // Tracks move actions (not room loads)
  const roomLoadSequenceRef = useRef(0) // Tracks room load requests
  const enteredViaCacheRoomIdRef = useRef<string | null>(null) // Tracks optimistic entries
  const pendingMoveRef = useRef<{ moveSeq: number; toRoomId: string; fromRoomId: string; previousRoom: Room | null } | null>(null) // Tracks pending moves with previous state
  const [isMoveInProgress, setIsMoveInProgress] = useState(false) // Prevents multiple simultaneous moves and triggers UI updates
  const appendWorldFeed = useCallback((entry: WorldFeedEntryInput) => {
    const { append } = useWorldFeedStore.getState()
    return append(entry)
  }, [])

  // Reconcile a player list against a known-authoritative live roster for the same room:
  // stamp partyLeaderId on real occupants, drop active/idle players who aren't actually
  // connected here (stale DB rows), and preserve intentional 'disconnected' ghosts.
  const reconcileWithRoster = useCallback(
    (players: Player[], leaders: Record<string, string | null>): Player[] => {
      return players
        .filter((p) => p.id in leaders || p.presenceStatus === 'disconnected')
        .map((p) => (p.id in leaders ? { ...p, partyLeaderId: leaders[p.id] ?? null } : p))
    },
    []
  )

  // Apply the cached roster onto a freshly-loaded (REST) player list. Only acts when the
  // cached roster is for this same room, so a room change can't prune the new room's list.
  const stampPartyLeaders = useCallback(
    (players: Player[], roomId: string): Player[] => {
      const cache = roomPartyLeadersRef.current
      if (cache.roomId !== roomId || Object.keys(cache.leaders).length === 0) return players
      return reconcileWithRoster(players, cache.leaders)
    },
    [reconcileWithRoster]
  )

  // Apply a full room roster from the socket layer: cache it (room-scoped) and reconcile
  // the players currently in the store when it's the room we're actually viewing.
  const applyRoomPartyState = useCallback(
    (roomId: string, members: { id: string; partyLeaderId: string | null }[]) => {
      const leaders: Record<string, string | null> = {}
      for (const m of members) leaders[m.id] = m.partyLeaderId
      roomPartyLeadersRef.current = { roomId, leaders }
      if (currentRoomRef.current?.roomId !== roomId) return
      const currentRoomPlayers = useGameStore.getState().roomPlayers
      setRoomPlayers(reconcileWithRoster(currentRoomPlayers, leaders))
    },
    [reconcileWithRoster, setRoomPlayers]
  )

  const triggerXpGain = useCallback((amount: number) => {
    if (xpGainTimerRef.current) clearTimeout(xpGainTimerRef.current)
    setXpGain(amount)
    setXpGainKey(k => k + 1)
    xpGainTimerRef.current = setTimeout(() => setXpGain(null), 2500)
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
   * Hydrate the rolling gather cooldown (sand / berries) for a room without
   * affecting room state. Runs once per room entry; the in-room countdown then
   * ticks down locally and is refreshed by action feedback. No polling.
   */
  const hydrateGatherCooldown = useCallback(async (roomId: string): Promise<void> => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (isLoggedIn) {
        Object.assign(headers, getAuthHeaders())
      }

      const response = await fetch(`/api/game/room/gather?roomId=${encodeURIComponent(roomId)}`, {
        headers,
      })

      if (!response.ok) return

      const data = await response.json()

      // Guard: room may have changed during the await
      if (currentRoomRef.current?.roomId !== roomId) return

      setGatherCooldowns(data.gatherCooldowns ?? [])
    } catch (error) {
      console.error(`[hydrateGatherCooldown] Error for room ${roomId}:`, error)
    }
  }, [getAuthHeaders, isLoggedIn])

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

  // Hydrate the rolling gather cooldown whenever the current room changes.
  useEffect(() => {
    if (!currentRoom?.roomId) {
      setGatherCooldowns([])
      return
    }
    // Clear stale values from the previous room before fetching fresh status.
    setGatherCooldowns([])
    hydrateGatherCooldown(currentRoom.roomId)
  }, [currentRoom?.roomId, hydrateGatherCooldown])

  // Close the crafting panel whenever the player leaves a crafting room.
  useEffect(() => {
    if (!currentRoom?.roomId || !isCraftingRoom(currentRoom.roomId)) {
      setIsCraftingOpen(false)
    }
  }, [currentRoom?.roomId])

  // When crafting opens, jump the scroll to the top of the crafting container.
  useEffect(() => {
    if (!isCraftingOpen) return
    const raf = requestAnimationFrame(() => {
      craftingPanelRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    })
    return () => cancelAnimationFrame(raf)
  }, [isCraftingOpen])

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

  // Escape unwinds one layer per press — overlays, then any open panel or tab,
  // then the Explore sub-view — so repeated presses always end on the compass.
  // Rewards that need acknowledging (level-up, battle summary) are deliberately
  // not dismissible this way, and the feed side panel is a layout toggle rather
  // than a layer.
  useEffect(() => {
    const closeTopLayer = (): boolean => {
      if (isShopModalOpen) {
        setIsShopModalOpen(false)
        setShopModalData(null)
        return true
      }
      if (isTrainingModalOpen) {
        setTrainingModalOpen(false)
        return true
      }
      if (isStatModalOpen) {
        setStatModalOpen(false)
        return true
      }
      if (playerProfileModal.isOpen) {
        setPlayerProfileModal({ isOpen: false, player: null })
        return true
      }
      if (actionModal.isOpen) {
        setActionModal({ isOpen: false, title: '', content: '' })
        return true
      }
      if (isMapModalOpen) {
        setIsMapModalOpen(false)
        return true
      }
      if (isCraftingOpen) {
        setIsCraftingOpen(false)
        return true
      }
      if (centerActiveTab !== 'explore') {
        goToExplore()
        return true
      }
      if (exploreSubView !== 'compass') {
        setExploreSubView('compass')
        return true
      }
      return false
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (closeTopLayer()) {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [
    centerActiveTab,
    exploreSubView,
    goToExplore,
    isShopModalOpen,
    isTrainingModalOpen,
    isStatModalOpen,
    playerProfileModal.isOpen,
    actionModal.isOpen,
    isMapModalOpen,
    isCraftingOpen,
  ])

  // Tab order for swipe navigation (matches the order in the tabs array)
  const tabOrder = ['explore', 'char', 'inventory', 'quests', 'map', 'players', 'feed', 'settings']

  // Helper function to get next/previous tab with wrapping
  const getAdjacentTab = useCallback((currentTab: string | null, direction: 'next' | 'prev'): string => {
    const currentTabId = currentTab || 'explore'
    const currentIndex = tabOrder.indexOf(currentTabId)
    
    // If current tab not found, default to explore
    if (currentIndex === -1) {
      return 'explore'
    }

    let newIndex: number
    if (direction === 'next') {
      // Swipe right = next tab (wrap to first if at end)
      newIndex = (currentIndex + 1) % tabOrder.length
    } else {
      // Swipe left = previous tab (wrap to last if at start)
      newIndex = currentIndex === 0 ? tabOrder.length - 1 : currentIndex - 1
    }

    return tabOrder[newIndex]
  }, [])

  // Touch/swipe gesture support for mobile - navigate tabs instead of opening sidebars
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
          // Swipe right - go to next tab (wraps to first if at last)
          const nextTab = getAdjacentTab(centerActiveTab, 'next')
          setCenterActiveTab(nextTab)
        } else {
          // Swipe left - go to previous tab (wraps to last if at first)
          const nextTab = getAdjacentTab(centerActiveTab, 'prev')
          setCenterActiveTab(nextTab)
        }
      }

      touchStartX = 0
      touchStartY = 0
    }

    // Only add touch listeners on screens below lg breakpoint (1024px) where sidebars are hidden
    if (window.innerWidth < 1024) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
      document.addEventListener('touchend', handleTouchEnd, { passive: true })
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [centerActiveTab, getAdjacentTab])

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
        setRoomPlayers(stampPartyLeaders(normalizedRoom.players, normalizedRoom.roomId))
        setRoomEnemies((providedRoomData as any).enemies || [])

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
        // Gather cooldown is hydrated by the room-change effect (keyed on roomId).
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
        const activePlayers = Array.isArray(roomData.players)
          ? roomData.players.map((p: any) => ({ ...p, inBattle: p?.inBattle ?? p?.inFight ?? false }))
          : []
        const ghosts = Array.isArray(roomData.roomGhosts)
          ? roomData.roomGhosts.map((g: any) => ({ ...g, presenceStatus: g.status ?? 'disconnected' }))
          : []
        const activeIds = new Set(activePlayers.map((p: { id: string }) => p.id))
        const roomPlayers = [...activePlayers, ...ghosts.filter((g: { id: string }) => !activeIds.has(g.id))]
        const normalizedRoom = normalizeRoom({
          ...roomData.room,
          players: roomPlayers,
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
          setRoomPlayers(stampPartyLeaders(roomPlayers, normalizedRoom.roomId))
          setRoomEnemies(Array.isArray(roomData.room?.enemies) ? roomData.room.enemies : [])
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
  }, [getAuthHeaders, cacheRoom, setCurrentRoom, setRoomPlayers, player, setPlayer, getCachedRoom, isLoggedIn, worldTick, setWorldTick])
  const loadRoomDataRef = useRef(loadRoomData)

  useEffect(() => {
    playerRef.current = player
  }, [player])

  useEffect(() => {
    const { setUser } = useWorldFeedStore.getState()
    setUser(player?.id ?? null)
  }, [player?.id])

  useEffect(() => {
    const { setUser } = useTickerStore.getState()
    setUser(player?.id ?? null)
  }, [player?.id])

  useEffect(() => {
    const { setUser } = useDMStore.getState()
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

  // handleAction is redefined every render and the socket subscriptions below are
  // deliberately long-lived, so they dispatch through this ref rather than
  // capturing a render's copy of it.
  useEffect(() => {
    handleActionRef.current = handleAction
  })

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

  const handleActionRef = useRef<(input: string | { type: string; data?: any }) => void>(() => {})

  const handleAction = async (actionInput: string | { type: string; data?: any }) => {
    const actionType = typeof actionInput === 'string' ? actionInput : actionInput.type
    const actionData = typeof actionInput === 'string' ? undefined : actionInput.data

    // While in battle, any dispatched action returns the player to the explore
    // tab so the BattlePanel (which only renders on explore) is visible for the
    // resulting turn animation.
    if (battle.isInBattle && centerActiveTab !== 'explore') {
      setCenterActiveTab('explore')
    }

    console.log('[handleAction] Called with action:', actionType, 'data:', actionData)
    setAction(actionType)
    setActionResult(null)

    const normalizedAction = actionType.toLowerCase()

    // Movement dismisses any lingering victory summary (just close it — the
    // destination room handles its own entry encounter). Battle-starting actions
    // close it via the battle:started handler instead.
    const MOVEMENT_ACTIONS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'move', 'navigate', 'teleport']
    if (MOVEMENT_ACTIONS.includes(normalizedAction)) {
      clearBattleResult()
    }

    // "Open Crafting" is a pure client-side panel toggle — no server round-trip.
    // The actual craft (type: 'craft') is dispatched from within the panel.
    if (normalizedAction === 'open crafting') {
      setIsCraftingOpen((prev) => !prev)
      return
    }

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
    // Format: accept_quest:quest_oldman_001 or accept_quest:quest_oldman_001:polite
    if (normalizedAction.startsWith('accept_quest:')) {
      const parts = normalizedAction.split(':')
      const questId = parts[1]
      const choiceId = parts[2] || null
      if (questId) {
        console.log('[handleAction] Parsed accept_quest action:', { questId, choiceId })
        return handleAction({ type: 'accept_quest', data: { questId, choiceId } })
      }
    }

    // Format: complete_quest:quest_oldman_001
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
    setIsFeedPanelOpen(true)
    setForceFeedFilter('chat')
    setForceFeedChatSubFilter('all-chat')
    setForceWorldChatMode('world')
    setTimeout(() => {
      customActionInputRef.current?.focus()
    }, 100)
  }

  const appendDMFeed = useCallback((direction: 'from' | 'to', username: string, message: string) => {
    const snippet = message.length > 120 ? `${message.slice(0, 119)}...` : message
    appendWorldFeed({
      type: 'dm',
      message: `DM ${direction} ${username}: ${snippet}`,
      ts: Date.now(),
      direction,
      actor: username,
    })
  }, [appendWorldFeed])

  const openDMThread = useCallback((otherUserId: string, otherUsername?: string) => {
    const { setSelectedThread, upsertThread } = useDMStore.getState()
    if (otherUsername) {
      upsertThread({
        otherUser: {
          id: otherUserId,
          username: otherUsername,
        },
        lastMessageSnippet: '',
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      })
    }
    setSelectedThread(otherUserId)
    setPlayersSubTab('dm')
    setCenterActiveTab('players')
  }, [])

  const handleCustomAction = async (e: React.FormEvent, mode: InputMode) => {
    e.preventDefault()
    const actionToSend = customAction.trim()
    if (!actionToSend) return

    setCustomAction('') // Clear input immediately

    const lowerInput = actionToSend.toLowerCase()
    if (lowerInput.startsWith('dm ')) {
      const directMessageInput = actionToSend.slice(3).trim()
      const firstSeparator = directMessageInput.indexOf(' ')
      const recipientUsername =
        firstSeparator > 0 ? directMessageInput.slice(0, firstSeparator).trim() : ''
      const message = firstSeparator > 0 ? directMessageInput.slice(firstSeparator + 1).trim() : ''

      if (!recipientUsername || !message) {
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: 'Usage: dm username message',
        })
        return
      }

      if (message.length > MESSAGE_MAX_LENGTH) {
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters. Current: ${message.length} characters`,
        })
        return
      }

      try {
        const response = await fetch('/api/dm/send', {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientUsername,
            message,
          }),
        })
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error?.message || 'Failed to send direct message')
        }

        const currentUserId = playerRef.current?.id
        if (currentUserId) {
          const { appendMessage } = useDMStore.getState()
          appendMessage(payload.directMessage, currentUserId)
        }
        openDMThread(payload.directMessage.recipientId, payload.directMessage.recipientUsername)
        appendDMFeed('to', payload.directMessage.recipientUsername, payload.directMessage.message)
      } catch (dmError) {
        console.error('[DM command] send failed:', dmError)
        appendWorldFeed({
          type: 'action',
          level: 'error',
          message: dmError instanceof Error ? dmError.message : 'Failed to send direct message',
        })
      }
      return
    }

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
          // Update inventory so the UI reflects the new equipped state
          if (payload?.data?.inventory) {
            setInventory(payload.data.inventory)
          }
          pendingEquipActionRef.current = null
        }
      }

      if (payload?.data?.inventory) {
        setInventory(payload.data.inventory)
      }

      // A server action that moves the player names its destination and lets the
      // normal teleport pipeline do the moving (the guild lair teleports work this
      // way, as flee and respawn already do). The server has already decided the
      // move is allowed; this only carries it out.
      if (success && payload?.data?.teleportRoomId) {
        const destination = payload.data.teleportRoomId
        if (destination !== currentRoomRef.current?.roomId) {
          handleActionRef.current({ type: 'teleport', data: { toRoomId: destination } })
        }
      }

      if (payload?.data?.quests) {
        setQuests(payload.data.quests)
      }


      // Update player state if provided in action feedback (e.g., from equip/unequip, quest completion)
      // Merge partial updates instead of replacing entire state to preserve fields like hp, hpMax, mp, mpMax, level, currentRoom
      if (payload?.data?.player) {
        const currentPlayer = playerRef.current
        if (currentPlayer) {
          const newXp = payload.data.player.xp
          const oldXp = currentPlayer.xp ?? 0
          if (typeof newXp === 'number' && newXp > oldXp) triggerXpGain(newXp - oldXp)
          setPlayer({ ...currentPlayer, ...payload.data.player })
        } else {
          setPlayer(payload.data.player)
        }
      }

      // Update player HP and/or MP if provided in action feedback
      if (typeof payload?.data?.hp === 'number' || typeof payload?.data?.mp === 'number') {
        const currentPlayer = playerRef.current
        if (currentPlayer) {
          setPlayer({
            ...currentPlayer,
            ...(typeof payload.data.hp === 'number' && { hp: payload.data.hp }),
            ...(typeof payload.data.mp === 'number' && { mp: payload.data.mp }),
          })
        }
      }

      if (payload?.data?.roomItems && currentRoomRef.current?.roomId) {
        updateRoomItems(currentRoomRef.current.roomId, normalizeRoomItems(payload.data.roomItems))
      }

      if ((payload?.data?.stateNote !== undefined || payload?.data?.actionOverrides !== undefined || payload?.data?.roomPatch !== undefined) && currentRoomRef.current) {
        setCurrentRoom({
          ...currentRoomRef.current,
          ...(payload.data.roomPatch && typeof payload.data.roomPatch === 'object' ? payload.data.roomPatch : {}),
          ...(payload.data.stateNote !== undefined && { stateNote: payload.data.stateNote }),
          ...(payload.data.actionOverrides !== undefined && { actionOverrides: payload.data.actionOverrides }),
        })
      }

      // Gather cooldown (rolling): the in-room countdown updates live from the
      // action result's secondsUntilReset, handled in RoomDisplay. Nothing to
      // cache here.

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

      const action = payload?.action
      const isMoveAction = action === 'move'
      const travelDirection = isMoveAction && payload?.data?.direction ? payload.data.direction : undefined

      let eventType: string | undefined
      if (isMoveAction) eventType = 'room-travel'
      else if (action === 'teleport') eventType = 'teleport'
      else if (action === 'equip_item') eventType = 'equip'
      else if (action === 'enemy_spawn') eventType = 'enemy-spawn'
      else if (action) eventType = 'action-feedback'

      appendWorldFeed({
        type: 'action',
        isSelf: true,
        message: messageText,
        roomId: payload?.data?.roomId || payload?.roomId || currentRoomRef.current?.roomId,
        ts: timestampMs,
        outcome,
        eventType,
        direction: travelDirection,
        actor: action,
      })

      // Check if action should open a modal
      if (payload?.data?.showModal === true) {
        const modalContent = payload?.data?.modalContent
        const buttons = payload?.data?.buttons
        
        // Check if it's a shop modal
        if (modalContent && typeof modalContent === 'object' && !Array.isArray(modalContent) && modalContent.type === 'shop') {
          setIsShopModalOpen(true)
          setShopModalData({
            shopName: modalContent.shopName,
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
              const questCompleteData: QuestCompleteData | null =
                payload?.data?.questComplete
                  ? (payload.data.questComplete as QuestCompleteData)
                  : null

              // Handle message as array (paragraphs) or string.
              // For quest-complete modals, suppress the message line entirely when
              // no dialog is provided (the rewards panel already shows the quest title),
              // rather than falling back to the raw feedback text.
              const messageContent = modalContent.message
                ? modalContent.message
                : questCompleteData
                  ? null
                  : messageText
              const isMessageArray = Array.isArray(messageContent)

              renderedContent = (
                <div className="flex flex-col items-center justify-center gap-6 py-8">
                  <Icon
                    name={modalContent.icon}
                    size={200}
                    className={iconColorClass}
                  />
                  <div className="text-center max-w-md w-full">
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
                    ) : messageContent ? (
                      <p className="text-gray-200 text-base leading-relaxed">
                        {messageContent}
                      </p>
                    ) : null}
                    {questCompleteData && (
                      <QuestCompleteRewards data={questCompleteData} />
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
      } else if (payload?.action === 'enemy_spawn') {
        // A probabilistic wave has appeared — show the full ordered list of present
        // enemies (front enemy is fought first). Fall back to the single enemy for
        // older payloads that don't include the list.
        if (Array.isArray(payload?.data?.enemies) && payload.data.enemies.length > 0) {
          setRoomEnemies(payload.data.enemies)
        } else if (payload?.data?.enemy) {
          setRoomEnemies([payload.data.enemy])
        }
      }

      // Handle quest chain toast (show even if modal is open)
      if (payload?.data?.questChain) {
        const toastMessage = payload.data.toast || payload.data.questChain.message
        if (toastMessage) {
          appendWorldFeed({
            type: 'action',
            isSelf: true,
            eventType: 'quest-chain',
            outcome: 'success',
            message: toastMessage,
          })
        }
        setHasQuestUpdate(true)
      }
    })

    const cleanupLoginSuccess = socketHandlers.onLoginSuccess((payload) => {
      console.log('[GameInterface] Received login:success event')
      if (payload?.inventory) {
        setInventory(payload.inventory)
      }
      if (Array.isArray(payload?.roomGhosts) && payload.roomGhosts.length > 0) {
        const currentRoomPlayers = useGameStore.getState().roomPlayers
        const activeIds = new Set(currentRoomPlayers.map((p) => p.id))
        const newGhosts = payload.roomGhosts
          .filter((g: { id: string }) => !activeIds.has(g.id))
          .map((g: any) => ({ ...g, presenceStatus: g.status ?? 'disconnected' }))
        if (newGhosts.length > 0) {
          setRoomPlayers([...currentRoomPlayers, ...newGhosts])
        }
      }
      if (Array.isArray(payload?.roomPartyState) && payload?.player?.currentRoom) {
        applyRoomPartyState(payload.player.currentRoom, payload.roomPartyState)
      }
    })

    const cleanupInventoryUpdate = socketHandlers.onInventoryUpdate((payload) => {
      if (Array.isArray(payload?.inventory)) {
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
      cleanupInventoryUpdate()
      cleanupRoomMoves()
    }
  }, [socket, socketHandlers, setPlayer, setInventory, updateRoomItems, appendWorldFeed, worldTick])

  // Fetch quests and kill list on login so they're available immediately
  useEffect(() => {
    if (!isLoggedIn || !player) return
    let cancelled = false
    fetch('/api/game/quests/progress', { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.success) setQuests(data.quests || []) })
      .catch(() => {})
    fetch('/api/player/kill-list', { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => { if (!cancelled && data.success) setKillList(data.kills || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isLoggedIn, player?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch quests when quest tab is opened
  useEffect(() => {
    if (centerActiveTab === 'quests' && isLoggedIn) {
      setHasQuestUpdate(false)
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
        // Refresh quests and player state (chest1 was reset)
        if (player) setPlayer({ ...player, chest1: false })
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

  const handleSkipToChest = async () => {
    if (!isLoggedIn) return
    setIsResettingQuests(true)
    try {
      const response = await fetch('/api/game/quests/reset?mode=skip-to-chest', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        // Refresh quests and player state (chest1 was reset)
        if (player) setPlayer({ ...player, chest1: false })
        const questResponse = await fetch('/api/game/quests/progress', {
          headers: getAuthHeaders(),
        })
        const questData = await questResponse.json()
        if (questData.success) {
          setQuests(questData.quests || [])
        }
      } else {
        console.error('Failed to skip to chest:', data.error)
      }
    } catch (error) {
      console.error('Error skipping to chest:', error)
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

    // Compare previous inventory with new inventory to find new items.
    // Flag an item as new ONLY if its id wasn't present before (a genuinely
    // new item). Picking up more of a stack you already own (a quantity
    // increase) does NOT count as new and must not trigger the badge.
    const previousIds = new Set(previousInventoryRef.current.map(item => item.id))
    const newItems = inventory.filter(item => !previousIds.has(item.id))
    
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

  // Clear "new item" markers when the player LEAVES the inventory tab.
  // The dots must remain visible the entire time the inventory tab is open
  // (including items picked up while viewing) so the player can see exactly
  // which items are new; they only clear once the player navigates away.
  const previousCenterTabRef = useRef(centerActiveTab)
  useEffect(() => {
    const leftInventoryTab =
      previousCenterTabRef.current === 'inventory' && centerActiveTab !== 'inventory'
    previousCenterTabRef.current = centerActiveTab
    if (leftInventoryTab) {
      setNewItemIds(prev => (prev.size > 0 ? new Set() : prev))
    }
  }, [centerActiveTab])

  // Clear forceWorldChatMode after it's been applied
  useEffect(() => {
    if (forceWorldChatMode && isFeedPanelOpen) {
      const timer = setTimeout(() => {
        setForceWorldChatMode(undefined)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [forceWorldChatMode, isFeedPanelOpen])

  // Clear forceFeedFilter after it's been applied
  useEffect(() => {
    if (forceFeedFilter && isFeedPanelOpen) {
      const timer = setTimeout(() => {
        setForceFeedFilter(undefined)
        setForceFeedChatSubFilter(undefined)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [forceFeedFilter, isFeedPanelOpen])

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

    const cleanupDirectMessage = socketHandlers.onDirectMessage((payload) => {
      const currentUser = playerRef.current
      if (!currentUser?.id || !payload) return

      const { appendMessage, upsertThread, threadsByUserId } = useDMStore.getState()
      appendMessage(
        {
          id: payload.id,
          senderId: payload.senderId,
          senderUsername: payload.senderUsername,
          recipientId: payload.recipientId,
          recipientUsername: payload.recipientUsername,
          message: payload.message,
          createdAt: payload.createdAt,
          readAt: payload.readAt || null,
        },
        currentUser.id
      )

      upsertThread({
        otherUser: {
          id: payload.senderId,
          username: payload.senderUsername,
          uIcon: payload.senderAvatar?.uIcon || undefined,
          uIconColor: payload.senderAvatar?.uIconColor || undefined,
        },
        lastMessageSnippet: payload.message.length > 120 ? `${payload.message.slice(0, 119)}...` : payload.message,
        lastMessageAt: payload.createdAt,
        unreadCount: threadsByUserId[payload.senderId]?.unreadCount ?? 0,
      })

      appendDMFeed('from', payload.senderUsername, payload.message)
    })

    return () => {
      cleanupDirectMessage()
    }
  }, [socket, socketHandlers, appendDMFeed])

  // Battle event handlers
  useEffect(() => {
    if (!socket) return

    const cleanupStarted = socketHandlers.onBattleStarted((payload) => {
      // A new battle beginning (manual attack, auto-advance, or a rest/search ambush)
      // dismisses any lingering victory summary so it never blocks the next fight.
      clearBattleResult()
      setBattleStarted({
        isAdvantageTurn: payload.isAdvantageTurn,
        enemySlug: payload.enemySlug,
        enemyName: payload.enemyName,
        enemyIcon: payload.enemyIcon,
        enemyLevel: payload.enemyLevel,
        enemyAtt: payload.enemyAtt,
        enemyDef: payload.enemyDef,
        enemyCurrentHp: payload.enemyCurrentHp,
        enemyMaxHp: payload.enemyMaxHp,
        turnCount: payload.turnCount,
        canFlee: payload.canFlee,
        playerHp: payload.playerHp,
        playerHpMax: payload.playerHpMax,
        playerStr: payload.playerStr,
        playerDef: payload.playerDef,
      })
      appendWorldFeed({
        type: 'room',
        isSelf: true,
        eventType: 'battle-started',
        outcome: payload.isAggressive ? 'failure' : 'info',
        message: payload.isAggressive
          ? `A ${payload.enemyName} attacks you!`
          : `You engage the ${payload.enemyName}!`,
      })
    })

    const cleanupTurn = socketHandlers.onBattleTurn((payload) => {
      // Skip when enemy or player HP hits 0 — victory/defeat handlers own that
      // update with proper setTimeout(0) timing to avoid React 18 batching
      // collapsing the initial render (setBattleStarted) and the HP=0 render
      // into one, which would prevent the HpBar animation from firing.
      if (payload.enemyCurrentHp > 0 && payload.playerHp > 0) {
        updateBattleTurn({
          enemyCurrentHp: payload.enemyCurrentHp,
          enemyMaxHp: payload.enemyMaxHp,
          turnCount: payload.turnCount,
          canFlee: payload.canFlee,
          playerHp: payload.playerHp,
          playerHpMax: payload.playerHpMax,
          playerDealtDamage: payload.playerDealtDamage,
          enemyDealtDamage: payload.enemyDealtDamage,
          playerRaw: payload.playerRaw,
          enemyRaw: payload.enemyRaw,
          playerStrMax: payload.playerStrMax,
          playerDefMax: payload.playerDefMax,
          enemyStrMax: payload.enemyStrMax,
          playerBlocked: payload.playerBlocked,
          enemyBlocked: payload.enemyBlocked,
          multiplayerBonus: payload.multiplayerBonus,
          bonusPercent: payload.bonusPercent,
          missedFlyingMelee: payload.missedFlyingMelee,
          weaponCategory: payload.weaponCategory,
          enemyDamageType: payload.enemyDamageType,
          ammo: payload.ammo ?? null,
          actionMeta: payload.actionMeta ?? null,
        })
      }
      appendWorldFeed({ type: 'room', message: payload.message, ts: Date.now(), eventType: 'battle-turn' })
    })

    const cleanupVictory = socketHandlers.onBattleVictory((payload) => {
      const applyVictory = () => {
        if (payload.summary) setBattleResult(payload.summary)
        if (payload.summary?.enemySlug) incrementKill(payload.summary.enemySlug)
        clearBattle()
        // Clear the room display only when the whole wave is defeated; otherwise show
        // the enemies still present (the next front enemy steps up).
        if (payload.clearRoomEnemies) {
          setRoomEnemies([])
        } else if (Array.isArray(payload.remainingEnemies)) {
          setRoomEnemies(payload.remainingEnemies)
        }
        const currentPlayer = useGameStore.getState().player
        if (currentPlayer) {
          setPlayer({
            ...currentPlayer,
            xp: (currentPlayer.xp ?? 0) + payload.xpAwarded,
            currency: (currentPlayer.currency ?? 0) + payload.goldAwarded,
          })
        }
        appendWorldFeed({
          type: 'room',
          isSelf: true,
          eventType: 'battle-victory',
          outcome: 'success',
          message: `Victory! +${payload.xpAwarded} XP  +${payload.goldAwarded} Gold${payload.droppedItems.length > 0 ? `  +${payload.droppedItems.join(', ')}` : ''}`,
          ts: Date.now(),
        })
        if (payload.xpAwarded > 0) triggerXpGain(payload.xpAwarded)
        // Inventory is refreshed via the inventory:update socket event emitted from the
        // server's background persistence (drops commit after this victory event fires).
      }
      const lt = payload.summary?.lastTurn
      setTimeout(() => {
        const b = useGameStore.getState().battle
        const buildUpdate = (enemyHp: number) => ({
          enemyCurrentHp: enemyHp,
          enemyMaxHp: b.enemyMaxHp,
          turnCount: b.turnCount,
          canFlee: b.canFlee,
          playerHp: b.playerHp,
          playerHpMax: b.playerHpMax,
          playerDealtDamage: lt?.playerDealtDamage ?? 0,
          enemyDealtDamage: lt?.enemyDealtDamage ?? 0,
          playerRaw: lt?.playerRaw ?? null,
          enemyRaw: lt?.enemyRaw ?? 0,
          playerStrMax: lt?.playerStrMax ?? b.playerStrMax ?? 0,
          playerDefMax: lt?.playerDefMax ?? b.playerDefMax ?? 0,
          enemyStrMax: lt?.enemyStrMax ?? b.enemyStrMax ?? 0,
          playerBlocked: lt?.playerBlocked ?? 0,
          enemyBlocked: lt?.enemyBlocked ?? 0,
          multiplayerBonus: lt?.multiplayerBonus ?? false,
          bonusPercent: lt?.bonusPercent ?? 0,
        })
        updateBattleTurn(buildUpdate(0))
      }, 0)
      setTimeout(applyVictory, 900)
    })

    const cleanupDefeat = socketHandlers.onBattleDefeat((payload) => {
      const applyDefeat = () => {
        if (payload.summary) setBattleResult(payload.summary)
        clearBattle()
        if (payload.playerHp !== undefined) {
          setPlayer({ ...useGameStore.getState().player!, hp: payload.playerHp })
        }
        appendWorldFeed({
          type: 'room',
          isSelf: true,
          eventType: 'battle-defeat',
          outcome: 'failure',
          message: `Defeated! Respawning at The Lobby...`,
          ts: Date.now(),
        })
        setRoomEnemies([])
        handleAction({ type: 'teleport', data: { toRoomId: payload.respawnRoomId ?? '999' } })
      }
      // Same macrotask-deferral as victory: ensure setBattleStarted renders first.
      const lt = payload.summary?.lastTurn
      setTimeout(() => {
        const b = useGameStore.getState().battle
        updateBattleTurn({
          enemyCurrentHp: b.enemyCurrentHp,
          enemyMaxHp: b.enemyMaxHp,
          turnCount: b.turnCount,
          canFlee: b.canFlee,
          playerHp: 0,
          playerHpMax: b.playerHpMax,
          playerDealtDamage: lt?.playerDealtDamage ?? 0,
          enemyDealtDamage: lt?.enemyDealtDamage ?? 0,
          playerRaw: lt?.playerRaw ?? null,
          enemyRaw: lt?.enemyRaw ?? 0,
          playerStrMax: lt?.playerStrMax ?? b.playerStrMax ?? 0,
          playerDefMax: lt?.playerDefMax ?? b.playerDefMax ?? 0,
          enemyStrMax: lt?.enemyStrMax ?? b.enemyStrMax ?? 0,
          playerBlocked: lt?.playerBlocked ?? 0,
          enemyBlocked: lt?.enemyBlocked ?? 0,
          multiplayerBonus: lt?.multiplayerBonus ?? false,
          bonusPercent: lt?.bonusPercent ?? 0,
        })
      }, 0)
      setTimeout(applyDefeat, 900)
    })

    const cleanupFled = socketHandlers.onBattleFled((payload) => {
      clearBattle()
      appendWorldFeed({
        type: 'room',
        isSelf: true,
        eventType: 'battle-fled',
        outcome: 'info',
        message: payload.message,
        ts: Date.now(),
      })
      // Retreat to the room the player came from, reusing the normal move pipeline
      // (the 'teleport' action is the client's "move to an explicit room id" primitive).
      const returnRoomId = payload.returnRoomId
      if (returnRoomId && returnRoomId !== currentRoomRef.current?.roomId) {
        handleAction({ type: 'teleport', data: { toRoomId: returnRoomId } })
      } else {
        // Fleeing in place: the server abandoned the room's wave, so clear the
        // local roster to match (otherwise the fled-from enemies linger on screen).
        setRoomEnemies([])
      }
    })

    const cleanupLevelUp = socketHandlers.onPlayerLevelUp((payload) => {
      setLevelUpData(payload)
      const { player: currentPlayer, setPlayer: sp } = useGameStore.getState()
      if (currentPlayer) {
        const newHpMax = (currentPlayer.hpMax ?? 0) + payload.hpGained
        const newMpMax = (currentPlayer.mpMax ?? 0) + payload.mpGained
        sp({
          ...currentPlayer,
          level: payload.newLevel,
          hpMax: newHpMax,
          mpMax: newMpMax,
          hp: newHpMax,
          mp: newMpMax,
          cp: (currentPlayer.cp ?? 0) + payload.cpGained,
          tp: (currentPlayer.tp ?? 0) + payload.tpGained,
          sp: (currentPlayer.sp ?? 0) + payload.spGained,
        })
      }
    })

    // One per counted action. Carries the click count plus everything else that
    // advances on a click: buff countdowns, and regenerated vitals when equipped
    // gear moved them (see GameEngine.applyClickTick).
    const cleanupClicksUpdate = socketHandlers.on<{
      clicks: number
      buffs?: Record<string, number>
      hp?: number
      mp?: number
    }>('player:clicks-update', (payload) => {
      const { player: currentPlayer, setPlayer: sp } = useGameStore.getState()
      if (!currentPlayer) return
      const next = { ...currentPlayer, clicks: payload.clicks }
      if (payload.buffs) next.buffs = payload.buffs
      if (typeof payload.hp === 'number') next.hp = payload.hp
      if (typeof payload.mp === 'number') next.mp = payload.mp
      sp(next)
    })

    return () => {
      cleanupStarted()
      cleanupTurn()
      cleanupVictory()
      cleanupDefeat()
      cleanupFled()
      cleanupLevelUp()
      cleanupClicksUpdate()
    }
  }, [socket, socketHandlers, setBattleStarted, updateBattleTurn, clearBattle, setBattleResult, clearBattleResult, appendWorldFeed, handleAction])

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

      // Keep the live-roster cache in sync so a REST reload before the next
      // room:party-state broadcast doesn't prune this just-arrived player.
      if (roomPartyLeadersRef.current.roomId === activeRoom.roomId) {
        roomPartyLeadersRef.current.leaders[playerInfo.id] = playerInfo.partyLeaderId ?? null
      }

      const currentRoomPlayers = useGameStore.getState().roomPlayers
      const existingIndex = currentRoomPlayers.findIndex((playerItem) => playerItem.id === playerInfo.id)
      if (existingIndex === -1) {
        setRoomPlayers([...currentRoomPlayers, { ...playerInfo, presenceStatus: 'active' as const }])
      } else {
        // Re-activate a ghost entry
        const updated = [...currentRoomPlayers]
        updated[existingIndex] = { ...playerInfo, presenceStatus: 'active' as const, lastSeen: undefined }
        setRoomPlayers(updated)
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

      const currentRoomPlayers = useGameStore.getState().roomPlayers

      if (playerData.reason === 'disconnect' && playerData.ghostData) {
        // Replace the active entry with a disconnected ghost
        setRoomPlayers(
          currentRoomPlayers.map((p) =>
            p.id === playerData.id
              ? { ...playerData.ghostData, presenceStatus: 'disconnected' as const, lastSeen: playerData.lastSeen ?? Date.now() }
              : p
          )
        )
      } else {
        // Player moved to another room — remove entirely
        setRoomPlayers(currentRoomPlayers.filter((playerItem) => playerItem.id !== playerData.id))
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

    const cleanupPlayerIdle = socketHandlers.onPlayerIdle((data) => {
      const activeRoom = currentRoomRef.current
      if (!activeRoom || data.roomId !== activeRoom.roomId) return

      const currentRoomPlayers = useGameStore.getState().roomPlayers
      setRoomPlayers(
        currentRoomPlayers.map((p) =>
          p.id === data.id
            ? { ...p, presenceStatus: 'idle' as const, lastSeen: data.lastSeen }
            : p
        )
      )
    })

    const cleanupPlayerReturned = socketHandlers.onPlayerReturned((data) => {
      const activeRoom = currentRoomRef.current
      if (!activeRoom || data.roomId !== activeRoom.roomId) return

      const currentRoomPlayers = useGameStore.getState().roomPlayers
      setRoomPlayers(
        currentRoomPlayers.map((p) =>
          p.id === data.id
            ? { ...p, presenceStatus: 'active' as const, lastSeen: undefined }
            : p
        )
      )
    })

    const cleanupPlayerBattleStatus = socketHandlers.onPlayerBattleStatus((data) => {
      const activeRoom = currentRoomRef.current
      if (!activeRoom || data.roomId !== activeRoom.roomId) return

      const currentRoomPlayers = useGameStore.getState().roomPlayers
      setRoomPlayers(
        currentRoomPlayers.map((p) =>
          p.id === data.id ? { ...p, inBattle: data.inBattle } : p
        )
      )
    })

    const cleanupPlayerVitals = socketHandlers.onPlayerVitals((data) => {
      const activeRoom = currentRoomRef.current
      if (!activeRoom || data.roomId !== activeRoom.roomId) return

      const currentRoomPlayers = useGameStore.getState().roomPlayers
      // Only touch the affected row; skip the state update entirely if values are unchanged
      // so we don't re-render the player panels on no-op turns.
      const target = currentRoomPlayers.find((p) => p.id === data.id)
      if (!target) return
      const next: Partial<typeof target> = {}
      if (typeof data.hp === 'number' && data.hp !== target.hp) next.hp = data.hp
      if (typeof data.hpMax === 'number' && data.hpMax !== target.hpMax) next.hpMax = data.hpMax
      if (typeof data.mp === 'number' && data.mp !== target.mp) next.mp = data.mp
      if (typeof data.mpMax === 'number' && data.mpMax !== target.mpMax) next.mpMax = data.mpMax
      if (Object.keys(next).length === 0) return

      setRoomPlayers(
        currentRoomPlayers.map((p) => (p.id === data.id ? { ...p, ...next } : p))
      )
    })

    return () => {
      cleanupPlayerJoined()
      cleanupPlayerLeft()
      cleanupPlayerIdle()
      cleanupPlayerReturned()
      cleanupPlayerBattleStatus()
      cleanupPlayerVitals()
    }
  }, [socket, socketHandlers, appendWorldFeed])

  // Party events
  useEffect(() => {
    if (!socket) return

    const cleanupUpdated = socketHandlers.onPartyUpdated((payload) => {
      setParty(payload)
    })

    const cleanupDisbanded = socketHandlers.onPartyDisbanded(() => {
      clearParty()
    })

    const cleanupRemoved = socketHandlers.onPartyRemoved(() => {
      clearParty()
      appendWorldFeed({
        type: 'room',
        isSelf: true,
        eventType: 'party',
        outcome: 'info',
        message: 'You were removed from the party.',
        ts: Date.now(),
      })
    })

    const cleanupError = socketHandlers.onPartyError((payload) => {
      appendWorldFeed({
        type: 'room',
        isSelf: true,
        eventType: 'party',
        outcome: 'failure',
        message: payload.message,
        ts: Date.now(),
      })
    })

    // Leader pulled us to a new room — we didn't initiate this move, so apply it
    // authoritatively (the normal move path is gated on a pending move we never set).
    const cleanupPulled = socketHandlers.onPartyPulled((payload) => {
      if (!payload?.toRoom) return
      pendingMoveRef.current = null
      enteredViaCacheRoomIdRef.current = null
      setIsMoveInProgress(false)

      const currentPlayer = playerRef.current
      if (currentPlayer && currentPlayer.currentRoom !== payload.toRoom) {
        setPlayer({ ...currentPlayer, currentRoom: payload.toRoom })
      }

      // Do NOT reuse payload.roomData here: it's a snapshot the server captured
      // before the party entered the room, so its player list is stale/empty (the
      // follower ends up with no roomPlayers → "stats unavailable"), and its per-user
      // room state was computed for the leader, not this member. Omitting roomData
      // forces a fresh authoritative fetch for the correct room and user.
      loadRoomDataRef.current?.({
        isTransition: true,
        travel: { toRoomId: payload.toRoom },
      })

      appendWorldFeed({
        type: 'room',
        isSelf: true,
        eventType: 'party',
        outcome: 'info',
        message: payload.toRoomName ? `Your party travels to ${payload.toRoomName}.` : 'Your party travels together.',
        ts: Date.now(),
      })
    })

    // Live party groupings for everyone in the room (including parties we're not in).
    const cleanupRoomPartyState = socketHandlers.onRoomPartyState((payload) => {
      const activeRoom = currentRoomRef.current
      if (!activeRoom || payload.roomId !== activeRoom.roomId) return
      applyRoomPartyState(payload.roomId, payload.members)
    })

    return () => {
      cleanupUpdated()
      cleanupDisbanded()
      cleanupRemoved()
      cleanupError()
      cleanupPulled()
      cleanupRoomPartyState()
    }
  }, [socket, socketHandlers, setParty, clearParty, appendWorldFeed, setPlayer, applyRoomPartyState])

  // Global presence feed — the Players tab roster. Room-scoped presence above keeps
  // "Others here" live; this keeps the world-wide list live. Server-owned and
  // ephemeral, so a disconnect simply stops the deltas until the next sync.
  useEffect(() => {
    if (!socket) return

    const cleanupSync = socketHandlers.onWorldPresenceSync((payload) => {
      syncPresence(payload.players ?? [], payload.serverTime ?? Date.now())
    })

    const cleanupUpdate = socketHandlers.onWorldPresenceUpdate((payload) => {
      const serverTime = payload.serverTime ?? Date.now()
      if (payload.type === 'remove') {
        removePresence(payload.id, serverTime)
        return
      }
      if (payload.player) upsertPresence(payload.player, serverTime)
    })

    return () => {
      cleanupSync()
      cleanupUpdate()
    }
  }, [socket, socketHandlers, syncPresence, upsertPresence, removePresence])

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

  // Fast travel is a sub-view of Explore rather than a modal. The party and
  // combat guards are surfaced inside the list (teleportBlockedReason) instead
  // of refusing to open, so the control never looks dead.
  const handleOpenTeleport = useCallback(() => {
    setCenterActiveTab('explore')
    setExploreSubView('teleport')
  }, [])

  const syncMapToCurrentRoom = useCallback(() => {
    if (currentRoomRef.current?.roomId) {
      setCurrentMapId(getMapIdForRoom(currentRoomRef.current.roomId))
    }
  }, [])

  const handleOpenMap = useCallback(() => {
    syncMapToCurrentRoom()
    setIsMapModalOpen(true)
  }, [syncMapToCurrentRoom])

  // The sidebar is tall enough to hold the map inline; the overlay stays one
  // click away via the sub-view's Fullscreen control.
  const handleShowMap = useCallback(() => {
    syncMapToCurrentRoom()
    setCenterActiveTab('explore')
    setExploreSubView('map')
  }, [syncMapToCurrentRoom])

  const handleOpenPartyTab = useCallback(() => {
    setPlayersSubTab('party')
    setCenterActiveTab('players')
  }, [])

  const handleTeleport = useCallback((roomId: string) => {
    handleAction({ type: 'teleport', data: { toRoomId: roomId } })
  }, [handleAction])

  // Both of these are refused server-side anyway — party followers in
  // socket-server-handlers.js, movement in combat in room-state.js. The list
  // states the reason and disables the destinations.
  const teleportBlockedReason = isPartyMember
    ? 'You are following your party. Leave the party to move freely.'
    : battle.isInBattle
    ? 'You cannot leave while in combat. Fight or flee.'
    : null

  // Fast travel closes itself once you have actually travelled, and never
  // survives into a battle (movement is refused mid-combat regardless).
  useEffect(() => {
    setExploreSubView('compass')
  }, [currentRoom?.roomId])

  useEffect(() => {
    if (battle.isInBattle) {
      setExploreSubView('compass')
    }
  }, [battle.isInBattle])

  const handleSwitchToInventory = useCallback((filter?: FilterTab) => {
    setCenterActiveTab('inventory')
    setInventoryFilter(filter)
  }, [])

  const handleOpenPlayerProfile = useCallback(
    (targetPlayer: {
      id: string
      username: string
      level: number
      uIcon?: string | null
      uIconColor?: string | null
    }) => {
      setPlayerProfileModal({
        isOpen: true,
        player: {
          id: targetPlayer.id,
          username: targetPlayer.username,
          level: targetPlayer.level,
          uIcon: targetPlayer.uIcon,
          uIconColor: targetPlayer.uIconColor,
        },
      })
    },
    []
  )

  const handleProfileInspect = useCallback((targetPlayer: Pick<Player, 'username'>) => {
    handleAction(`look at ${targetPlayer.username}`)
  }, [handleAction])

  const handleProfileMessage = useCallback((targetPlayer: Pick<Player, 'id' | 'username'>) => {
    openDMThread(targetPlayer.id, targetPlayer.username)
  }, [openDMThread])

  const renderActivePanel = useCallback(() => {
    if (!player) return <div>Loading...</div>

    switch (centerActiveTab) {
      case 'char':
        return (
          <CharPanel
            player={player}
            onAction={handleAction}
            onSwitchToInventory={handleSwitchToInventory}
            onClose={goToExplore}
          />
        )
      case 'inventory':
        return (
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
            onClose={goToExplore}
          />
        )
      case 'quests':
        return (
          <QuestsPanel
            quests={quests}
            isLoadingQuests={isLoadingQuests}
            isResettingQuests={isResettingQuests}
            isLoggedIn={isLoggedIn}
            inventory={inventory}
            onResetQuests={handleResetQuests}
            onSkipToChest={handleSkipToChest}
            onClose={goToExplore}
          />
        )
      case 'players':
        return (
          <PlayersPanel
            activeSubTab={playersSubTab}
            onSubTabChange={setPlayersSubTab}
            unreadDmCount={totalDmUnread}
            onOpenWorldChat={handleOpenWorldChat}
            onClose={goToExplore}
            onDMMessageSent={(payload) => {
              appendDMFeed('to', payload.recipientUsername || 'Unknown', payload.message)
            }}
            party={party}
            roomPlayers={roomPlayers}
            currentPlayerId={player.id}
            currentPlayer={player}
            onOpenProfile={handleOpenPlayerProfile}
            onMessagePlayer={handleProfileMessage}
            onFollowPlayer={handleFollowPlayer}
            onLeaveParty={handleLeaveParty}
            onRemovePartyMember={handleRemovePartyMember}
          />
        )
      case 'feed':
        return (
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
        )
      case 'settings':
        return (
          <SettingsPanel
            onLogout={handleLogoutFlow}
            onClose={goToExplore}
          />
        )
      default:
        return null
    }
  }, [goToExplore, centerActiveTab, player, handleAction, handleSwitchToInventory, inventory, inventoryFilter, newItemIds, quests, isLoadingQuests, isResettingQuests, isLoggedIn, handleResetQuests, currentMapId, currentRoom, handleMapChange, handleOpenWorldChat, socket, customAction, isLoadingRoom, customActionInputRef, setUnreadCount, forceWorldChatMode, forceFeedFilter, forceFeedChatSubFilter, handleLogoutFlow, appendDMFeed, playersSubTab, totalDmUnread, handleOpenTeleport])

  const handleCenterTabChange = useCallback((tabId: string | null) => {
    if (!tabId || tabId === 'explore') {
      goToExplore()
    } else {
      setCenterActiveTab(tabId)
    }

    if (tabId === 'players') {
      const unread = useDMStore.getState().getTotalUnreadCount()
      setPlayersSubTab(unread > 0 ? 'dm' : 'roster')
    }

    if (tabId !== 'inventory') {
      setInventoryFilter(undefined)
      setNewItemIds(new Set())
    }
  }, [goToExplore])

  if (!player || !isLoggedIn) {
    return <div>Loading...</div>
  }

  if (!currentRoom || (isLoadingRoom && isInitialLoad)) {
    return (
      <div className="min-h-dvh bg-gray-950 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.04)_0%,transparent_70%)] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-400/40 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm tracking-wide">Loading world data...</p>
        </div>
      </div>
    )
  }

  const availableMaps = getUnlockedMaps(player, currentRoom?.roomId)

  const panelTabs: TabConfig[] = [
    { id: 'explore', label: 'Explore', icon: 'world', color: 'blue' },
    { id: 'char', label: 'Char', icon: 'character', color: 'violet' },
    { id: 'inventory', label: 'Inv', icon: 'inv', color: 'green', badge: newItemIds.size > 0 ? newItemIds.size : undefined },
    { id: 'quests', label: 'Quests', icon: 'trophy', color: 'gold', badge: hasQuestUpdate ? true : undefined },
    { id: 'players', label: 'Players', icon: <MessageSquare size={14} />, color: 'pink', badge: totalDmUnread > 0 ? totalDmUnread : undefined },
    { id: 'settings', label: '', icon: <SettingsIcon size={14} />, color: 'gray' },
  ]

  // Mobile includes feed tab in bottom nav
  const mobileTabs: TabConfig[] = [
    ...panelTabs,
    { id: 'feed', label: 'World Feed', icon: <MessageSquareText size={14} />, color: 'blue', badge: unreadCount > 0 ? unreadCount : undefined },
  ]

  return (
    <div className="h-dvh bg-gray-950 text-white flex flex-col overflow-hidden">
      {isMapModalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <MapPanel
            currentMapId={currentMapId}
            currentRoomId={currentRoom?.roomId}
            availableMaps={availableMaps}
            onMapChange={handleMapChange}
            onOpenTeleport={() => {
              setIsMapModalOpen(false)
              handleOpenTeleport()
            }}
            onClose={() => setIsMapModalOpen(false)}
          />
        </div>
      )}
      <ActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, title: '', content: '' })}
        title={actionModal.title}
        content={actionModal.content}
        buttons={actionModal.buttons}
        onAction={handleAction}
      />
      <PlayerProfileModal
        isOpen={playerProfileModal.isOpen}
        onClose={() => setPlayerProfileModal({ isOpen: false, player: null })}
        player={playerProfileModal.player}
        onInspect={handleProfileInspect}
        onMessage={handleProfileMessage}
      />
      <TrainingAllocationModal
        isOpen={isTrainingModalOpen}
        player={player}
        onClose={() => setTrainingModalOpen(false)}
        onTrainingAllocated={(updatedPlayer) => setPlayer(updatedPlayer)}
      />
      <StatAllocationModal
        isOpen={isStatModalOpen}
        player={player}
        onClose={() => setStatModalOpen(false)}
        onStatAllocated={(updatedPlayer) => setPlayer(updatedPlayer)}
      />
      <ShopModal
        isOpen={isShopModalOpen}
        onClose={() => {
          setIsShopModalOpen(false)
          setShopModalData(null)
        }}
        shopName={shopModalData?.shopName}
        shopItems={shopModalData?.shopItems || []}
        playerCurrency={shopModalData?.playerCurrency || player?.currency || 0}
        playerInventory={shopModalData?.playerInventory || inventory}
        onBuy={async (itemSlug: string, quantity?: number) => {
          try {
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

            // Surface in the world feed like every other action
            appendWorldFeed({
              type: 'action',
              isSelf: true,
              message: data.message,
              ts: Date.now(),
              outcome: 'success',
              eventType: 'buy',
            })

            return data.message as string
          } catch (err: any) {
            const message = err?.message || 'Failed to purchase item'
            appendWorldFeed({
              type: 'action',
              isSelf: true,
              message,
              ts: Date.now(),
              outcome: 'failure',
              eventType: 'buy',
            })
            throw err
          }
        }}
        onSell={async (playerItemId: string, quantity: number) => {
          try {
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

            // Surface in the world feed like every other action
            appendWorldFeed({
              type: 'action',
              isSelf: true,
              message: data.message,
              ts: Date.now(),
              outcome: 'success',
              eventType: 'sell',
            })

            return data.message as string
          } catch (err: any) {
            const message = err?.message || 'Failed to sell item'
            appendWorldFeed({
              type: 'action',
              isSelf: true,
              message,
              ts: Date.now(),
              outcome: 'failure',
              eventType: 'sell',
            })
            throw err
          }
        }}
      />
      <GameHeader
        playerName={player?.username}
        level={player?.level}
        hp={player?.hp}
        hpMax={player?.hpMax}
        mp={player?.mp}
        mpMax={player?.mpMax}
        xp={player?.xp}
        xpGain={xpGain}
        xpGainKey={xpGainKey}
        str={player ? (player.str ?? 0) + (player.strMod ?? 0) : undefined}
        dex={player ? (player.dex ?? 0) + (player.dexMod ?? 0) : undefined}
        mag={player ? (player.mag ?? 0) + (player.magMod ?? 0) : undefined}
        def={player ? (player.def ?? 0) + (player.defMod ?? 0) : undefined}
        clicks={player?.clicks}
        onCharacterClick={() => handleCenterTabChange(centerActiveTab === 'char' ? null : 'char')}
        isConnected={socket?.connected ?? false}
        onRefresh={() => window.location.reload()}
      />
      <ActivityTicker />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: on desktop (lg+), tab bar at top; D-pad default, panel content when tab active */}
        <div className="hidden lg:flex flex-col flex-shrink-0 w-[420px] border-r border-gray-700/30 bg-gray-900/95 min-h-0 overflow-hidden">
          <TabContainer
            tabs={panelTabs}
            defaultTab="explore"
            activeTab={centerActiveTab}
            onTabChange={handleCenterTabChange}
            containerClassName="!flex-none"
            headerClassName="px-3 pt-2 pb-1"
            buttonPadding="px-2 py-1"
            wrap
          />
          {centerActiveTab !== 'explore' ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              {renderActivePanel()}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ExplorePanel
                variant="sidebar"
                room={currentRoom}
                subView={exploreSubView}
                onSubViewChange={setExploreSubView}
                onAction={handleAction}
                onTeleport={handleTeleport}
                teleportLocations={TELEPORT_LOCATIONS}
                teleportBlockedReason={teleportBlockedReason}
                onShowMap={handleShowMap}
                onOpenMapFullscreen={handleOpenMap}
                currentMapId={currentMapId}
                availableMaps={availableMaps}
                onMapChange={handleMapChange}
                isMoveInProgress={isMoveInProgress}
                isDimmed={battle.isInBattle || isCraftingOpen}
                showBattleBadge={battle.isInBattle}
                actionResult={actionResult}
                isLoadingRoom={isLoadingRoom}
                currentAction={action}
                activeActionSurface={basicActionSurface}
                onActionSurfaceChange={setBasicActionSurface}
              />
            </div>
          )}
        </div>

        {/* Mobile panel: full-width when a panel tab is active (< lg only) */}
        {centerActiveTab !== 'explore' && (
          <div className="flex flex-col flex-1 min-h-0 bg-gray-900/95 overflow-hidden lg:hidden">
            <div className="flex-1 overflow-y-auto min-h-0">
              {renderActivePanel()}
            </div>
          </div>
        )}

        {/* Right (desktop) / Main (mobile): Explore area — always visible on desktop, only when explore tab active on mobile */}
        <div className={`relative flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden ${centerActiveTab !== 'explore' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Feed toggle button — desktop only, top-right of explore area */}
          <button
            type="button"
            onClick={() => setIsFeedPanelOpen(v => !v)}
            className="hidden lg:flex absolute top-2 right-3 z-20 items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-700/50 bg-gray-900/80 hover:bg-gray-800/80 text-gray-400 hover:text-white transition-all duration-200 text-xs font-medium shadow-sm"
            title={isFeedPanelOpen ? 'Close World Feed' : 'Open World Feed'}
            aria-label={isFeedPanelOpen ? 'Close World Feed' : 'Open World Feed'}
          >
            <MessageSquareText size={14} />
            {unreadCount > 0 && (
              <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-[9px] font-semibold text-white flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {currentRoom && (
            <div className="bg-gray-900/50 flex-1 overflow-hidden min-h-0 h-full flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto h-full">
                <div className="max-w-4xl mx-auto w-full">
                  {!socket?.connected && (
                    <div className="flex items-center justify-center gap-3 px-4 py-4 my-4 rounded-lg border border-gray-700/30 bg-gray-900/60">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>Not Connected</span>
                      </div>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 text-md font-medium rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white transition-all duration-200 shadow-md shadow-indigo-950/40 hover:shadow-lg active:scale-[0.98]"
                        aria-label="Refresh page"
                        title="Refresh page"
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                  {levelUpData && (
                    <LevelUpAlert
                      data={levelUpData}
                      tpAvailable={player?.tp ?? 0}
                      cpAvailable={player?.cp ?? 0}
                      onClose={() => setLevelUpData(null)}
                      onTrainNow={() => setTrainingModalOpen(true)}
                      onSpendCorePoints={() => setStatModalOpen(true)}
                    />
                  )}
                  {(battle.isInBattle || battleResult) && (
                    <div className="px-4 pt-4">
                      <BattlePanel
                        battle={battle}
                        battleResult={battleResult}
                        onAttack={() => socketHandlers.sendGameAction({ type: 'player_attack' })}
                        onFlee={() => socketHandlers.sendGameAction({ type: 'player_flee' })}
                        onUseItem={(itemId, action) => socketHandlers.sendGameAction({ type: 'use_item', data: { playerItemId: itemId, action } })}
                        onDismissResult={() => {
                          clearBattleResult()
                          const nextHostile = roomEnemies.find((e) => e.isAggressive)
                          if (nextHostile) {
                            handleAction({ type: 'start_battle', data: { enemySlug: nextHostile.slug } })
                          }
                        }}
                        isActing={isLoadingRoom}
                        playerName={player.username}
                        playerLevel={player.level}
                        playerMp={player.mp}
                        playerMpMax={player.mpMax}
                        weaponIconName={weaponIconName}
                        weaponName={weaponName}
                        weaponCategory={(equippedWeapon?.template.weaponCategory as 'MELEE' | 'RANGED' | null | undefined) ?? null}
                        inventory={inventory}
                      />
                    </div>
                  )}
                  <PartyStrip
                    party={party}
                    roomPlayers={roomPlayers}
                    currentPlayerId={player.id}
                    onFollow={handleFollowPlayer}
                    onLeave={handleLeaveParty}
                    onManage={handleOpenPartyTab}
                  />
                  {isCraftingOpen && currentRoom && isCraftingRoom(currentRoom.roomId) && !battle.isInBattle && (
                    <div ref={craftingPanelRef} className="px-4 pt-4 scroll-mt-4">
                      <CraftingPanel
                        roomId={currentRoom.roomId}
                        inventory={inventory}
                        quests={quests}
                        craftingRecipeId={craftingRecipeId}
                        actionResult={actionResult}
                        onClose={() => setIsCraftingOpen(false)}
                        onCraft={(recipeId, quantity) => {
                          if (craftingRecipeId || quantity < 1) return
                          setCraftingRecipeId(recipeId)
                          Promise.resolve(
                            handleAction({ type: 'craft', data: { recipeId, quantity } })
                          ).finally(() => setCraftingRecipeId(null))
                        }}
                      />
                    </div>
                  )}
                  <RoomBox
                    room={currentRoom}
                    roomPlayers={roomPlayers}
                    currentPlayerId={player.id}
                    onAction={handleAction}
                    isPartyMember={isPartyMember}
                    onOpenPlayerProfile={handleOpenPlayerProfile}
                    gatherCooldowns={gatherCooldowns}
                    worldTick={worldTick}
                    actionResult={actionResult}
                    isLoadingRoom={isLoadingRoom}
                    currentAction={action}
                    roomEnemies={roomEnemies}
                    isInBattle={battle.isInBattle}
                    quests={quests}
                    killList={killList}
                    activeActionSurface={basicActionSurface}
                    onActionSurfaceChange={setBasicActionSurface}
                  />
                </div>
              </div>

              {/* D-pad — mobile/tablet only (< lg), hidden during battle/crafting */}
              <div className={`lg:hidden flex-shrink-0 flex flex-col border-t border-gray-700/30 ${battle.isInBattle || isCraftingOpen ? 'hidden' : ''}`}>
                <ExplorePanel
                  variant="strip"
                  room={currentRoom}
                  subView={exploreSubView}
                  onSubViewChange={setExploreSubView}
                  onAction={handleAction}
                  onTeleport={handleTeleport}
                  teleportLocations={TELEPORT_LOCATIONS}
                  teleportBlockedReason={teleportBlockedReason}
                  onShowMap={handleShowMap}
                  onOpenMapFullscreen={handleOpenMap}
                  currentMapId={currentMapId}
                  availableMaps={availableMaps}
                  onMapChange={handleMapChange}
                  isMoveInProgress={isMoveInProgress}
                  actionResult={actionResult}
                  isLoadingRoom={isLoadingRoom}
                  currentAction={action}
                  activeActionSurface={basicActionSurface}
                  onActionSurfaceChange={setBasicActionSurface}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Feed panel — desktop only */}
        {isFeedPanelOpen && (
          <div className="hidden lg:flex flex-col flex-shrink-0 w-[360px] border-l border-gray-700/30 bg-gray-900/95 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/30">
              <span className="text-sm font-medium text-gray-300">World Feed</span>
              <button
                type="button"
                onClick={() => setIsFeedPanelOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
                title="Close World Feed"
                aria-label="Close World Feed"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
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
        )}
      </div>

      {/* Mobile bottom nav — includes explore tab + overflow */}
      <div className="lg:hidden">
        <MobileBottomNav
          tabs={mobileTabs}
          activeTab={centerActiveTab}
          onTabChange={handleCenterTabChange}
          fallbackLabels={{ players: 'Players', feed: 'World Feed', settings: 'Settings' }}
          overflowAfter={5}
        />
      </div>
    </div>
  )
}
