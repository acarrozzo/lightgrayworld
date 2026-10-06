'use client'

import { useGameStore } from '@/lib/game-state'
import type { GatherCooldownView, SupplyView } from '@/lib/types/room'
import type { Room, Player } from '@/lib/game-state'
import { useShallow } from 'zustand/react/shallow'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import React from 'react'
import GameHeader from './GameHeader'
import { type InputMode } from './game-interface/panels/FeedPanel'
import RoomBox, { type RoomEnemy } from './RoomBox'
import BattlePanel from './game-interface/panels/BattlePanel'
import NotificationBadge from './NotificationBadge'
import TabBar, { tabDef, type TabBadges } from './game-interface/TabBar'
import { escapeCloses, reduceTabs, type TabEvent, type TabId } from '@/lib/tab-rules'
import LayerShell, { DeckProvider, HeaderTabs, type DeckPresentation } from './game-interface/LayerShell'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { MessageSquareText, ChevronUp, ChevronDown } from 'lucide-react'
import ExplorePanel from './game-interface/ExplorePanel'
import { ActionSheet, DOCK_BAR, DeckContent, type DeckContentProps } from './game-interface/Deck'
import ActionModal from './ActionModal'
import ConfirmDialog from './ConfirmDialog'
import { describePartyDeparture, partyDepartureWarning } from '@/lib/party-succession'
import ShopModal from './ShopModal'
import SkillsAndSpellsBook, { type BookTab } from './SkillsAndSpellsBook'
import Icon from './Icon'
import { normalizeRoom, normalizeRoomItems } from '@/lib/normalize/room'
import { resolveItemIcon } from '@/lib/item-actions'
import { describeStat, effectiveStats } from '@/lib/effective-stats'
import { buildSpellbook, getCastableSpells, getSpell, hasLearnableSpell } from '@/lib/spellbook'
import { buildSkillbook, hasLearnableSkill } from '@/lib/skillbook'
import { freshTabs, hiddenTabs, unlockDef, type UnlockFacts, type UnlockId } from '@/lib/unlocks'
import { useUnlocks } from '@/lib/use-unlocks'
import { useVisitedRooms } from '@/lib/visited-rooms'
import { trackedQuestView, useTrackedQuests } from '@/lib/tracked-quest'
import { buildJournal } from '@/lib/quest-journal'
import { registerFeedLinkHandler, type FeedLink } from '@/lib/feed-links'
import { useWorldFeedStore } from '@/store/worldFeedStore'
import type { WorldFeedEntryInput } from '@/store/worldFeedStore'
import type { PartyFollowRequestPayload } from '@/lib/socket'
import { useFontPreferenceStore } from '@/store/fontPreferenceStore'
import { useTickerStore } from '@/store/tickerStore'
import ActivityTicker from './ActivityTicker'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import { TELEPORT_MP_COST } from './game-interface/constants'
import { filterTabToView, getItemCategory, type FilterTab, type ItemFilterView } from '@/lib/inventory-categories'
import { findTravelDirection, checkIfExitHasGate, normalizeCommand, getMapIdForRoom, getUnlockedMaps, formatDirectionPhrase } from './game-interface/utils'
import { useGameSocketBindings } from './game-interface/useGameSocketBindings'
import { DirectoryContent } from './game-interface/DirectoryContent'
import CharPanel from './game-interface/panels/CharPanel'
import QuestsPanel, { QUEST_SUB_TABS, type QuestsTab } from './game-interface/panels/QuestsPanel'
import { countReadyQuests } from '@/lib/quest-journal'
import type { WorldTab } from './game-interface/WorldLayer'
import PanelResizeHandle from './game-interface/PanelResizeHandle'
import { useResizablePanel, useViewportWidth } from './game-interface/useResizablePanel'

// Desktop side-panel widths. They reset to the default on every page load.
// The left panel cannot be dragged narrower than its default, only wider; the
// feed's floor is where its icon-less chip rows and input still read. The ceiling leaves the
// explore column room for the room card no matter how wide either panel is
// dragged.
const { MAP_SHEETS } = require('@/lib/game-data/world-map')
const LEFT_PANEL_DEFAULT = 420
const LEFT_PANEL_MIN = LEFT_PANEL_DEFAULT
const FEED_PANEL_DEFAULT = 360
const FEED_PANEL_MIN = 300
const PANEL_MAX = 720
// The left column may go wider than the feed: past INV_TWO_COLUMN_WIDTH the
// Inv tab lays its loadout and its bag side by side.
const LEFT_PANEL_MAX = 1040
const CENTER_MIN = 480
import FeedPanel from './game-interface/panels/FeedPanel'
import SettingsPanel from './game-interface/panels/SettingsPanel'
import PlayersPanel, { PLAYER_SUB_TABS, type PlayersSubTab } from './game-interface/panels/PlayersPanel'
import PartyRail from './game-interface/party/PartyRail'
import { usePartyBattleStore } from '@/store/partyBattleStore'
import type { SquadMember } from '@/lib/party/squad'
import CraftingSheet, { type RecipeTemplates } from './CraftingSheet'
import { isCraftingRoom, formatRecipeList } from '@/lib/game-data/crafting-recipes'
const { RESPAWN_ROOM_ID } = require('@/lib/game-data/constants') as { RESPAWN_ROOM_ID: string }
import QuestCompleteRewards, { type QuestCompleteData } from './QuestCompleteRewards'
import PlayerProfileModal from './PlayerProfileModal'
import { useDMStore } from '@/store/dmStore'
import LevelUpAlert from './LevelUpAlert'
import type { AllocationSummary } from './PointAllocation'
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
    itemPreview,
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
    itemPreview: s.itemPreview,
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
  // What each teammate is fighting and how it is going. Party-scoped and as
  // ephemeral as the party: emptied whenever the party ends for us.
  const applyPartyGlance = usePartyBattleStore((s) => s.apply)
  const clearPartyGlances = usePartyBattleStore((s) => s.clearAll)
  const hydrateSession = useGameStore((s) => s.hydrateSession)
  const updateRoomItems = useGameStore((s) => s.updateRoomItems)
  const equippedWeapon = inventory.find(item => item.isEquipped && item.slot === 'MAIN_HAND')
  const weaponIconName = equippedWeapon
    ? resolveItemIcon(equippedWeapon.template.metadata as { icon?: string } | null, equippedWeapon.template.slug ?? '')
    : 'equipment-fists'
  const weaponName = equippedWeapon?.template.name ?? null
  // The four stats as combat rolls them: core + gear + buffs + skill passives.
  const stats = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  const [action, setAction] = useState('')
  const [actionResult, setActionResult] = useState<any>(null)
  const [levelUpData, setLevelUpData] = useState<LevelUpPayload | null>(null)
  const [xpGain, setXpGain] = useState<number | null>(null)
  const [xpGainKey, setXpGainKey] = useState(0)
  // The last click's regen, floated "+3" over the header bars the way XP is.
  const [regenGain, setRegenGain] = useState<{ hp: number; mp: number } | null>(null)
  const [regenGainKey, setRegenGainKey] = useState(0)
  const regenGainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const xpGainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLoadingRoom, setIsLoadingRoom] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  // The crafting sheet: a local UI toggle that opens over the room the way the
  // shop does. `craftingRecipeId` marks the in-flight craft. The item templates
  // the recipe rows read (icon, stats, description) are fetched once, the first
  // time the sheet opens.
  const [isCraftingOpen, setIsCraftingOpen] = useState(false)
  const [craftingRecipeId, setCraftingRecipeId] = useState<string | null>(null)
  const [recipeTemplates, setRecipeTemplates] = useState<RecipeTemplates | null>(null)
  const [recipeTemplatesFailed, setRecipeTemplatesFailed] = useState(false)
  // Where the last defeat said to rise. Read when the player presses Rise on
  // the death card; the server authorizes that move for as long as they are dead.
  const respawnRoomRef = useRef<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const totalDmUnread = useDMStore((state) => state.getTotalUnreadCount())
  // Action: Explore's own utility, a layer over the compass (a sheet on a
  // phone). Not a tab; `lib/tab-rules` says when it opens and closes.
  const [actionOpen, setActionOpen] = useState(false)
  // Phones only, and only in a fight: the D-pad at the bottom folds down to its
  // own title bar so the battle deck gets the height, and one tap brings it
  // back when the fight turns and the way out is wanted. Out of battle the
  // strip is simply always there and this is not consulted.
  const [isBattleDpadOpen, setIsBattleDpadOpen] = useState(false)
  // Escaping a fight takes you out of your party (see partyStore.departAlone),
  // which is not something to discover afterwards — so the two ways of doing it
  // stop and say so first. Holds the escape to run if the player goes ahead.
  // People asking to travel behind us, oldest first. A queue rather than a
  // single slot: two players can ask at once, and silently dropping one of them
  // would leave them waiting on an answer that is never coming.
  const [followRequests, setFollowRequests] = useState<PartyFollowRequestPayload[]>([])
  // Asks we have made and not yet had answered, so the Follow control can read
  // Pending instead of letting the player ask the same person twice.
  const [pendingFollowIds, setPendingFollowIds] = useState<Set<string>>(() => new Set())
  const [partyDepartureConfirm, setPartyDepartureConfirm] = useState<
    { title: string; message: string; confirmLabel: string; run: () => void } | null
  >(null)
  const [worldTab, setWorldTab] = useState<WorldTab>('map')
  // Desktop world feed starts open; the toggle only affects this session.
  const [isFeedPanelOpen, setIsFeedPanelOpen] = useState(true)

  // Each side panel's ceiling is bounded by the viewport minus the other panel
  // and the explore column's floor, so neither can drag the room off screen.
  // Until the viewport is measured (0 before mount) the budget is unbounded so
  // the default width is not clamped down to the minimum on first render.
  const viewportWidth = useViewportWidth()
  const panelBudget = viewportWidth > 0 ? viewportWidth - CENTER_MIN : Infinity
  const [feedWidthForBounds, setFeedWidthForBounds] = useState(FEED_PANEL_DEFAULT)
  const leftPanel = useResizablePanel({
    side: 'left',
    defaultWidth: LEFT_PANEL_DEFAULT,
    minWidth: LEFT_PANEL_MIN,
    maxWidth: Math.min(LEFT_PANEL_MAX, panelBudget - (isFeedPanelOpen ? feedWidthForBounds : 0)),
    label: 'Resize the left panel',
  })
  const feedPanel = useResizablePanel({
    side: 'right',
    defaultWidth: FEED_PANEL_DEFAULT,
    minWidth: FEED_PANEL_MIN,
    maxWidth: Math.min(PANEL_MAX, panelBudget - leftPanel.width),
    label: 'Resize the World Feed panel',
  })
  useEffect(() => {
    setFeedWidthForBounds(feedPanel.width)
  }, [feedPanel.width])
  const [isShopModalOpen, setIsShopModalOpen] = useState(false)
  // One entry the book should ring, set by a character-panel row.
  const [bookHighlight, setBookHighlight] = useState<string | null>(null)

  // The Char tab's pages: the character sheet, and the two books.
  const [charTab, setCharTab] = useState<'char' | BookTab>('char')

  /**
   * Open the Skill book or the Spell book, optionally ringing one skill or
   * spell. They are pages of the Char tab, so this goes there.
   */
  const handleOpenBook = useCallback((tab: BookTab, highlightId?: string) => {
    setBookHighlight(highlightId ?? null)
    setCharTab(tab)
    setActionOpen(false)
    setCenterActiveTab('char')
  }, [])

  const [shopModalData, setShopModalData] = useState<{
    shopName?: string
    /** Set when the shop is a traveler's cart; the modal closes when they leave. */
    travelerId?: string
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
  // Rolling gather cooldown for the current room (sand / berries); null if none.
  const [gatherCooldowns, setGatherCooldowns] = useState<GatherCooldownView[]>([])
  // The room's supply shelf for this player (the spare hatchet, the arrow
  // crate); per player, so it rides beside the room like the countdowns do.
  const [supplies, setSupplies] = useState<SupplyView[]>([])
  // The open tab. Explore is home. Every rule about what opens and closes a
  // tab is in `lib/tab-rules`; `applyTabEvent` below is the only thing that
  // should change this in response to something happening in the game.
  const [centerActiveTab, setCenterActiveTab] = useState<TabId>('explore')
  const tabStateRef = useRef({ tab: centerActiveTab, actionOpen })
  tabStateRef.current = { tab: centerActiveTab, actionOpen }
  const applyTabEvent = useCallback((event: TabEvent) => {
    const next = reduceTabs(tabStateRef.current, event)
    setCenterActiveTab(next.tab)
    setActionOpen(next.actionOpen)
    return next
  }, [])
  const goToExplore = useCallback(() => {
    setCenterActiveTab('explore')
    setActionOpen(false)
  }, [])
  const [playersSubTab, setPlayersSubTab] = useState<PlayersSubTab>('roster')
  const [questsTab, setQuestsTab] = useState<QuestsTab>('quests')
  const [forceWorldChatMode, setForceWorldChatMode] = useState<InputMode | undefined>(undefined)
  const quests = useGameStore((s) => s.quests)
  const setQuests = useGameStore((s) => s.setQuests)
  const setGiversMet = useGameStore((s) => s.setGiversMet)
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
  // What the Inv tab's bag is filtered to. Held here so a link can open the
  // tab on a group or slot (a link from the corner, the Action layer or the feed).
  const [inventoryView, setInventoryView] = useState<ItemFilterView>(() => filterTabToView())
  // One item the bag should open on arrival, set by a character-panel row and
  // cleared when the player leaves the tab so the same row can send them back.
  const [inventoryOpenId, setInventoryOpenId] = useState<string | null>(null)
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())
  const [hasQuestUpdate, setHasQuestUpdate] = useState(false)
  // Quests ready to turn in, for the tab badge. The same evaluation the
  // journal and the NPC card use, so the number never disagrees with them.
  const giversMet = useGameStore((s) => s.giversMet)
  const readyQuestCount = useMemo(
    () => countReadyQuests({ inventory, killList, player, quests, giversMet }),
    [inventory, killList, player, quests, giversMet]
  )
  const isInitialInventoryLoadRef = useRef(true)
  const previousInventoryRef = useRef<typeof inventory>([])
  const pendingEquipActionRef = useRef<{ playerItemId: string } | null>(null)
  // The one enemy present in the room for this player, or null. Server-owned.
  const [roomEnemy, setRoomEnemy] = useState<RoomEnemy | null>(null)
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)
  const isPartyMember = !!party && !!player && party.leaderId !== player.id
  // The one ask we have sent but not yet seen confirmed. At most one can be in
  // that state — the server refuses a second ask to the same person — so a
  // refusal knows exactly which pending mark to take back.
  const unconfirmedFollowRef = useRef<string | null>(null)
  const clearPendingFollow = useCallback((targetId: string | null) => {
    if (!targetId) return
    if (unconfirmedFollowRef.current === targetId) unconfirmedFollowRef.current = null
    setPendingFollowIds((prev) => {
      if (!prev.has(targetId)) return prev
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
  }, [])
  const handleFollowPlayer = useCallback((targetId: string) => {
    // Marked pending before the server has confirmed it: the round trip is short
    // but a second click inside it would only earn a "they have not answered
    // yet" error. A refusal takes the mark back.
    if (socketHandlers.followPlayer(targetId)) {
      unconfirmedFollowRef.current = targetId
      setPendingFollowIds((prev) => new Set(prev).add(targetId))
    }
  }, [socketHandlers])
  const handleLeaveParty = useCallback(() => {
    socketHandlers.leaveParty()
  }, [socketHandlers])
  const handleRemovePartyMember = useCallback((memberId: string) => {
    socketHandlers.removePartyMember(memberId)
  }, [socketHandlers])
  const handleSetPartyClosed = useCallback((closed: boolean) => {
    socketHandlers.setPartyClosed(closed)
  }, [socketHandlers])
  const handleSetPartyName = useCallback((name: string) => {
    socketHandlers.setPartyName(name)
  }, [socketHandlers])
  const handleAnswerFollow = useCallback(
    (requesterId: string, accept: boolean) => {
      socketHandlers.answerFollowRequest(requesterId, accept)
      setFollowRequests((queue) => queue.filter((r) => r.requesterId !== requesterId))
    },
    [socketHandlers]
  )
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
  // The move awaiting the server's answer, with everything the optimistic swap
  // displaced so a refused move can put it all back: the room, and the player
  // and enemy lists that belonged to it.
  const pendingMoveRef = useRef<{
    moveSeq: number
    toRoomId: string
    fromRoomId: string
    previousRoom: Room | null
    previousPlayers: Player[]
    previousEnemy: RoomEnemy | null
  } | null>(null)
  // Which room's gather countdowns arrived with the room itself (socket move
  // payload or HTTP room load), so the per-room hydrate effect can skip its
  // fallback fetch for it.
  const gatherHydratedRoomIdRef = useRef<string | null>(null)
  const [isMoveInProgress, setIsMoveInProgress] = useState(false) // Prevents multiple simultaneous moves and triggers UI updates
  const appendWorldFeed = useCallback((entry: WorldFeedEntryInput) => {
    const { append } = useWorldFeedStore.getState()
    return append(entry)
  }, [])

  // A teammate dropping into trouble is worth saying out loud once. The watch
  // itself lives in the squad bar, which is where the live party state is.
  const handlePartyLowHp = useCallback(
    (member: SquadMember) => {
      appendWorldFeed({
        type: 'party',
        level: 'error',
        actor: member.username,
        message: `${member.username} is badly hurt (${member.hp}/${member.hpMax}).`,
        ts: Date.now(),
      })
    },
    [appendWorldFeed]
  )

  // Both point-spending modals (Core Points, Training Points) land here. The
  // server's row wins but it is only a projection, so client-only fields —
  // buffs, presence, party, in-battle — must survive the merge. The feed gets
  // the original's "You spend N CP…" line.
  const handlePointsSpent = useCallback((updatedPlayer: Player, summary: AllocationSummary) => {
    const { player: current, setPlayer: sp } = useGameStore.getState()
    sp(current ? { ...current, ...updatedPlayer } : updatedPlayer)
    const changes = summary.changes.map((c) => `${c.code} ${c.from} → ${c.to}`).join(', ')
    appendWorldFeed({
      type: 'action',
      outcome: 'success',
      isSelf: true,
      message: `You spend ${summary.total} ${summary.pointCode}: ${changes}.`,
      link: { tab: 'char' },
      roomId: currentRoomRef.current?.roomId,
    })
  }, [appendWorldFeed])

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
  const triggerRegenGain = useCallback((gain: { hp: number; mp: number }) => {
    if (regenGainTimerRef.current) clearTimeout(regenGainTimerRef.current)
    setRegenGain(gain)
    setRegenGainKey(k => k + 1)
    regenGainTimerRef.current = setTimeout(() => setRegenGain(null), 2500)
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

      gatherHydratedRoomIdRef.current = roomId
      setGatherCooldowns(data.gatherCooldowns ?? [])
      setSupplies(Array.isArray(data.supplies) ? data.supplies : [])
    } catch (error) {
      console.error(`[hydrateGatherCooldown] Error for room ${roomId}:`, error)
    }
  }, [getAuthHeaders, isLoggedIn])

  // Listen for world ticks to drive countdowns
  // Subscriptions that only feed stores (world tick, room items, world feed,
  // presence) live in this hook rather than here — see its own comment for why
  // the battle, party and action-feedback subscriptions deliberately do not.
  useGameSocketBindings(socket, socketHandlers, setWorldTick)

  // Gather countdowns for the current room. They normally arrive with the room
  // itself — the socket move payload and the HTTP room load both carry them —
  // and this effect only fetches for a room that turned up without them. It
  // used to fetch on every room change regardless, an extra request per step.
  useEffect(() => {
    const roomId = currentRoom?.roomId
    if (!roomId) {
      setGatherCooldowns([])
      return
    }
    if (gatherHydratedRoomIdRef.current === roomId) return
    // Clear stale values from the previous room before fresh status arrives.
    setGatherCooldowns([])
    setSupplies([])
    // An optimistic swap lands here before the server has answered; the
    // answer brings the countdowns, so there is nothing to fetch yet.
    if (pendingMoveRef.current?.toRoomId === roomId) return
    hydrateGatherCooldown(roomId)
  }, [currentRoom?.roomId, hydrateGatherCooldown])

  // Close the crafting sheet whenever the player leaves a crafting room or a
  // fight starts: the battle panel owns the screen then.
  useEffect(() => {
    if (!currentRoom?.roomId || !isCraftingRoom(currentRoom.roomId) || battle.isInBattle) {
      setIsCraftingOpen(false)
    }
  }, [currentRoom?.roomId, battle.isInBattle])

  // Recipe item templates, fetched the first time the sheet opens. They do not
  // change during a session, so one load serves every crafting room.
  useEffect(() => {
    if (!isCraftingOpen || recipeTemplates !== null) return
    let cancelled = false
    setRecipeTemplatesFailed(false)
    fetch('/api/game/recipes', { headers: getAuthHeaders() })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((body) => {
        if (!cancelled) setRecipeTemplates(body?.templates ?? {})
      })
      .catch((error) => {
        console.warn('[crafting] recipe templates failed to load', error)
        if (!cancelled) setRecipeTemplatesFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [isCraftingOpen, recipeTemplates, getAuthHeaders])

  // A craft result (success or refusal) frees the row's button again even if
  // the dispatch promise settled first.
  useEffect(() => {
    if (actionResult?.action === 'craft') setCraftingRecipeId(null)
  }, [actionResult?.action, actionResult?.timestamp])

  // Escape unwinds one layer per press — overlays, then any open panel or tab,
  // then the Explore sub-view, then the level-up card — so repeated presses
  // always end on the compass. The level-up card goes last so Escape never
  // dismisses it from under an open modal or while it is off-screen on a phone
  // tab. The battle summary is deliberately not dismissible this way, and the
  // feed side panel is a layout toggle rather than a layer.
  useEffect(() => {
    const closeTopLayer = (): boolean => {
      if (isShopModalOpen) {
        setIsShopModalOpen(false)
        setShopModalData(null)
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
      if (isCraftingOpen) {
        setIsCraftingOpen(false)
        return true
      }
      if (escapeCloses(tabStateRef.current)) {
        applyTabEvent({ type: 'escape' })
        return true
      }
      if (levelUpData) {
        setLevelUpData(null)
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
    actionOpen,
    applyTabEvent,
    isShopModalOpen,
    playerProfileModal.isOpen,
    actionModal.isOpen,
    isCraftingOpen,
    levelUpData,
  ])

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
      // The countdowns ride alongside the room; they are per-player state, not
      // part of the room record, so they stay out of the room cache.
      const { gatherCooldowns: providedGatherCooldowns, supplies: providedSupplies, ...providedRoom } = providedRoomData
      const normalizedRoom = normalizeRoom({
        ...providedRoom,
        // Preserve worldTick if present in provided data
        ...(providedRoom.worldTick ? { worldTick: providedRoom.worldTick } : {}),
      })
      if (normalizedRoom) {
        // Check sequence BEFORE committing any state
        if (sequence !== roomLoadSequenceRef.current) {
          console.log(`[GameInterface] Ignoring stale room load (provided data) [seq:${sequence}] current:${roomLoadSequenceRef.current}`)
          return
        }
        
        // Commit ALL state changes atomically (guarded by sequence)
        if (Array.isArray(providedGatherCooldowns)) {
          gatherHydratedRoomIdRef.current = normalizedRoom.roomId
          setGatherCooldowns(providedGatherCooldowns)
        }
        if (Array.isArray(providedSupplies)) setSupplies(providedSupplies)
        cacheRoom(normalizedRoom)
        setCurrentRoom(normalizedRoom)
        setRoomPlayers(stampPartyLeaders(normalizedRoom.players, normalizedRoom.roomId))
        setRoomEnemy((providedRoom as any).enemy ?? null)

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
          if (Array.isArray(roomData.gatherCooldowns)) {
            gatherHydratedRoomIdRef.current = normalizedRoom.roomId
            setGatherCooldowns(roomData.gatherCooldowns)
          }
          if (Array.isArray(roomData.supplies)) setSupplies(roomData.supplies)
          cacheRoom(normalizedRoom)
          setCurrentRoom(normalizedRoom)
          setRoomPlayers(stampPartyLeaders(roomPlayers, normalizedRoom.roomId))
          setRoomEnemy(roomData.room?.enemy ?? null)
        }

        // The server owns `currentRoom`: the authoritative socket move path
        // persists it, and defeat/respawn writes it directly. This block used to
        // POST the client's own belief to /api/game/room/sync, which inverted
        // that ownership — any client could name a room and have it written to
        // the database, skipping every gate. Align the local projection with the
        // room we actually loaded and write nothing durable.
        if (player && normalizedRoom && player.currentRoom !== normalizedRoom.roomId) {
          console.log('[GameInterface] Aligning local player.currentRoom to', normalizedRoom.roomId)
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
    // `worldTick` is deliberately absent: this reads the tick off the API
    // response, never the stored one. Listing it changed loadRoomData's identity
    // every tick, which cascaded into every effect that depends on it.
  }, [getAuthHeaders, cacheRoom, setCurrentRoom, setRoomPlayers, player, setPlayer, getCachedRoom, isLoggedIn, setWorldTick])
  const loadRoomDataRef = useRef(loadRoomData)

  /**
   * Give up on a pending move and re-adopt whatever room the server says we are in.
   *
   * Used when a move's confirmation never arrives, and when there was no socket
   * to send the move on at all. Neither case may leave the optimistic room
   * standing: the client would go on believing it is somewhere the server never
   * moved it, and since every later move is validated from the room the server
   * has, the player would be wedged until a refresh — with each failure rolling
   * back to the phantom room again.
   *
   * Fetching with no travel target is the reconciliation: that endpoint answers
   * with the player's actual `currentRoom`, and loadRoomData commits it.
   */
  const abandonPendingMove = useCallback((reason: string) => {
    console.warn(`[GameInterface] Abandoning pending move (${reason}); reconciling with server`)
    pendingMoveRef.current = null
    setIsMoveInProgress(false)
    enteredViaCacheRoomIdRef.current = null
    void loadRoomDataRef.current?.({ requireAuth: true })
  }, [])

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

  /**
   * Timers staging the end-of-battle sequence: one frame to render the HP drain,
   * then ~900ms later the summary and teardown.
   *
   * They are tracked so they can be cancelled. A battle can begin inside that
   * window — a rest or search ambush, or auto-advancing onto the next enemy in
   * the room — and the previous fight's delayed `clearBattle()` would then wipe
   * the fight that had just started, leaving no battle panel for a battle the
   * server thinks is live.
   */
  const battleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearBattleTimers = useCallback(() => {
    battleTimersRef.current.forEach((id) => clearTimeout(id))
    battleTimersRef.current = []
  }, [])

  const scheduleBattleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    battleTimersRef.current.push(id)
  }, [])

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

  // A traveling shop closes when its owner moves on. The room's traveler list
  // is the server's word on who is here; when the cart's owner drops out of it
  // the modal goes too, so nobody buys from an empty road.
  useEffect(() => {
    const travelerId = shopModalData?.travelerId
    if (!isShopModalOpen || !travelerId) return
    const present = (currentRoom?.travelers ?? []).some((t) => t.id === travelerId)
    if (present) return
    setIsShopModalOpen(false)
    setShopModalData(null)
    appendWorldFeed({
      type: 'action',
      isSelf: true,
      eventType: 'traveler',
      outcome: 'info',
      message: `${shopModalData?.shopName ?? 'The cart'} has packed up and moved on.`,
    })
  }, [isShopModalOpen, shopModalData, currentRoom?.travelers, appendWorldFeed])

  /**
   * Show a cached destination while the server decides the move.
   *
   * Only the room record is known ahead of time. Who is standing there and
   * which enemies are present are live state the server answers with, so both
   * lists are emptied rather than left showing the room just left — the
   * previous room's players used to stay on screen under the new room's name
   * until the answer arrived.
   */
  const enterRoomOptimistically = (cachedRoom: Room) => {
    // Travelers are live too: the cached copy remembers who was passing
    // through last visit, and the server's answer replaces it.
    setCurrentRoom({ ...cachedRoom, travelers: [] })
    setRoomPlayers([])
    setRoomEnemy(null)
    // Track that we entered this room via optimistic cache
    enteredViaCacheRoomIdRef.current = cachedRoom.roomId
    // Update player room optimistically
    const currentPlayer = playerRef.current
    if (currentPlayer && currentPlayer.currentRoom !== cachedRoom.roomId) {
      setPlayer({ ...currentPlayer, currentRoom: cachedRoom.roomId })
    }
  }

  const handleAction = async (actionInput: string | { type: string; data?: any }) => {
    const actionType = typeof actionInput === 'string' ? actionInput : actionInput.type
    const actionData = typeof actionInput === 'string' ? undefined : actionInput.data

    // Dead players can do exactly one thing: rise. Every other dispatch —
    // compass, room buttons, typed commands, bag actions — stops here with the
    // same line the server answers with, so nothing is even sent.
    if ((useGameStore.getState().player?.hp ?? 1) <= 0) {
      const lowered = actionType.toLowerCase()
      const isRise =
        lowered === 'teleport' && actionData?.toRoomId === (respawnRoomRef.current ?? RESPAWN_ROOM_ID)
      if (!isRise && lowered !== 'look' && lowered !== 'l') {
        appendWorldFeed({
          type: 'action',
          outcome: 'failure',
          isSelf: true,
          message: "You're dead. Rise again first.",
          roomId: currentRoomRef.current?.roomId,
        })
        return
      }
    }

    // Anything that produces a battle turn returns the player to the explore
    // tab so the BattlePanel is visible for the resulting animation: a turn in
    // a running fight, or a strike / attack spell cast from the character panel
    // that is about to open one. Heals and buffs cast out of a fight are left
    // alone — casting them without losing your place is the point of the
    // buttons there. Only the narrow layout needs the switch at all: past `lg`
    // the battle column stays on screen beside the open panel.
    const opensAFight =
      actionType === 'use_skill' ||
      (actionType === 'cast_spell' && getSpell(actionData?.spellId)?.kind === 'attack')
    const roomIsHidden = typeof window === 'undefined' || !window.matchMedia('(min-width: 1024px)').matches
    if ((battle.isInBattle || opensAFight) && centerActiveTab !== 'explore' && roomIsHidden) {
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

    // "Open Crafting" is a pure client-side toggle — no server round-trip. The
    // actual craft (type: 'craft') is dispatched from within the sheet.
    if (normalizedAction === 'open crafting') {
      setIsCraftingOpen(true)
      return
    }

    // The original's typed `craft list`: the whole recipe book, one feed line
    // per family, readable anywhere. Local — the list is shared data.
    if (normalizedAction === 'craft list' || normalizedAction === 'crafting list') {
      const roomId = currentRoomRef.current?.roomId
      appendWorldFeed({ type: 'action', outcome: 'info', isSelf: true, message: 'Crafting list:', roomId })
      for (const line of formatRecipeList() as string[]) {
        appendWorldFeed({ type: 'action', outcome: 'info', isSelf: true, message: line, roomId })
      }
      return
    }

    // "Spells" at the Pajama Shaman's tent is the same client-side toggle: the
    // book itself lives in the store, learning goes over HTTP, casting is a
    // normal game action dispatched from inside it.
    if (normalizedAction === 'open spellbook' || normalizedAction === 'open skills' || normalizedAction === 'open skillbook') {
      handleOpenBook(normalizedAction === 'open spellbook' ? 'spells' : 'skills')
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

      // Same guard the directional branch has always had. Without it a second
      // teleport could start while the first was pending, and its rollback
      // target would be the *first* teleport's optimistic destination — a room
      // the player had never actually stood in.
      if (isMoveInProgress) {
        console.warn('[handleAction] Move already in progress, ignoring new teleport request')
        return
      }

      // Increment move sequence when initiating teleport
      const moveSeq = ++moveSequenceRef.current

      // Store previous room state for rollback on failure
      const previousRoom = currentRoom

      // Set pending move with previous state - will be cleared when action:feedback arrives
      pendingMoveRef.current = { 
        moveSeq, 
        toRoomId: targetRoomId,
        fromRoomId: currentRoom.roomId,
        previousRoom: previousRoom,
        previousPlayers: useGameStore.getState().roomPlayers,
        previousEnemy: roomEnemy,
      }

      // Set move-in-progress flag
      setIsMoveInProgress(true)

      // Safety timeout: Clear move-in-progress flag if no feedback arrives within 10 seconds
      // This prevents the UI from being permanently stuck if feedback is lost
      setTimeout(() => {
        if (pendingMoveRef.current?.moveSeq === moveSeq) {
          abandonPendingMove(`teleport timeout moveSeq:${moveSeq}`)
        }
      }, 10000)

      // Optimistic update: immediately use cached room if available
      const cachedTargetRoom = getCachedRoom(targetRoomId)
      if (cachedTargetRoom) {
        console.log(`[handleAction] Using cached room for optimistic update (UI-only) [moveSeq:${moveSeq}]:`, cachedTargetRoom.name)
        enterRoomOptimistically(cachedTargetRoom)
      }

      if (socket) {
        console.log(`[handleAction] Emitting player-move event for teleport [moveSeq:${moveSeq}]:`, { fromRoom: currentRoom.roomId, toRoom: targetRoomId })
        socket.emit('player-move', {
          fromRoom: currentRoom.roomId,
          toRoom: targetRoomId,
        })
      } else {
        // Nothing was sent, so the optimistic room above is pure fiction — roll
        // it back rather than leaving the UI in a room the server never saw.
        console.warn('Socket not connected; teleport request not sent')
        abandonPendingMove('no socket for teleport')
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
      const hasGate = checkIfExitHasGate(currentRoom, actionType)

      // Increment move sequence when initiating move
      const moveSeq = ++moveSequenceRef.current

      // Store previous room state for rollback on failure
      const previousRoom = currentRoom

      // Set pending move with previous state - will be cleared when action:feedback arrives
      pendingMoveRef.current = { 
        moveSeq, 
        toRoomId: targetRoomId,
        fromRoomId: currentRoom.roomId,
        previousRoom: previousRoom,
        previousPlayers: useGameStore.getState().roomPlayers,
        previousEnemy: roomEnemy,
      }

      // Set move-in-progress flag
      setIsMoveInProgress(true)

      // Safety timeout: Clear move-in-progress flag if no feedback arrives within 10 seconds
      // This prevents the UI from being permanently stuck if feedback is lost
      setTimeout(() => {
        if (pendingMoveRef.current?.moveSeq === moveSeq) {
          abandonPendingMove(`move timeout moveSeq:${moveSeq}`)
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
          enterRoomOptimistically(cachedTargetRoom)
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
        // Nothing was sent, so the optimistic room above is pure fiction — roll
        // it back rather than leaving the UI in a room the server never saw.
        console.warn('Socket not connected; movement request not sent')
        abandonPendingMove('no socket for move')
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
      link: { tab: 'players', sub: 'dm' },
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
    // Party chat needs a prefix nobody types by accident: a bare "p" is a word.
    const slashPartyMatch = lowerInput.startsWith('/p ')
    const partyWordMatch = lowerInput.startsWith('/party ')

    // Prefix detection as fallback/override
    const prefixIsRoomChat = sayMatch || singleQuoteMatch || doubleQuoteMatch
    const prefixIsWorldChat = shoutMatch || exclamationMatch
    const prefixIsPartyChat = slashPartyMatch || partyWordMatch

    // Determine chat type: prefix overrides mode, otherwise use mode
    let isRoomChat = false
    let isWorldChat = false
    let isPartyChat = false

    if (prefixIsRoomChat || prefixIsWorldChat || prefixIsPartyChat) {
      // Prefix detection takes precedence
      isRoomChat = prefixIsRoomChat
      isWorldChat = prefixIsWorldChat
      isPartyChat = prefixIsPartyChat
    } else {
      // Use selected mode
      isRoomChat = mode === 'room'
      isWorldChat = mode === 'world'
      isPartyChat = mode === 'party'
    }

    if (isRoomChat || isWorldChat || isPartyChat) {
      let message = ''

      if (sayMatch || shoutMatch || slashPartyMatch || partyWordMatch) {
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
          message: "To chat: say hello | 'hello | \"hello | shout hello | !hello | /p hello",
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
      if (isPartyChat) {
        // Refused client-side only to save the round trip; the server checks
        // party membership itself and is the one that decides.
        if (!useGameStore.getState().party) {
          appendWorldFeed({
            type: 'action',
            level: 'error',
            message: 'You are not in a party. Follow someone here to start one.',
          })
          return
        }
        const sent = socketHandlers.sendPartyChatMessage(message)
        if (!sent) {
          appendWorldFeed({
            type: 'action',
            level: 'error',
            message: 'Failed to send party chat. Please try again.',
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
      if (payload?.data?.giversMet) {
        setGiversMet(payload.data.giversMet)
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

      // A take refreshes the shelf it came from; the server sends the whole
      // list back so held counts and availability never drift.
      if (Array.isArray(payload?.data?.supplies)) {
        setSupplies(payload.data.supplies)
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
        // A `redirected` move is the server landing us somewhere we did not
        // step (the Icy Mountain Path's slip into the pit below); its room is
        // authoritative and the optimistic one is simply wrong.
        const feedbackToRoom = payload?.data?.toRoom
        if (success && feedbackToRoom && feedbackToRoom !== pendingMove.toRoomId && !payload?.data?.redirected) {
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
              setRoomPlayers(pendingMove.previousPlayers)
              setRoomEnemy(pendingMove.previousEnemy)
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
      else if (action === 'auto_equip') eventType = 'equip'
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
            travelerId: typeof modalContent.travelerId === 'string' ? modalContent.travelerId : undefined,
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
              let iconColorClass = modalContent.iconColor || "text-status-warning"
              if (iconColorClass && !iconColorClass.startsWith('text-') && !iconColorClass.includes(' ')) {
                // If it's a simple color name like 'yellow-400', 'gray-500', or 'gray-500/70', add 'text-' prefix
                // The opacity modifier (e.g., /70) will be preserved: 'gray-500/70' -> 'text-fg-muted/70'
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
                      <h3 className="text-fg-bright text-lg font-semibold mb-4">
                        {modalContent.header}
                      </h3>
                    )}
                    {isMessageArray ? (
                      <div className="text-fg-bright text-base leading-relaxed space-y-4">
                        {messageContent.map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                    ) : messageContent ? (
                      <p className="text-fg-bright text-base leading-relaxed">
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
        // An enemy has appeared (or was already here on entry/refresh) — show it.
        if (payload?.data?.enemy) {
          setRoomEnemy(payload.data.enemy)
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
            link: { tab: 'quests' },
          })
        }
        setHasQuestUpdate(true)
      }
    })

    const cleanupLoginSuccess = socketHandlers.onLoginSuccess((payload) => {
      console.log('[GameInterface] Received login:success event')
      // One authoritative adoption of the server's account state. This fires on
      // the automatic re-login after a reconnect too, which is what corrects the
      // party and battle events missed while the connection was down — and the
      // fresh player snapshot, which used to be dropped here in favour of
      // whatever localStorage had rehydrated.
      hydrateSession({
        player: payload?.player,
        inventory: payload?.inventory,
        party: payload?.party ?? null,
        battle: payload?.battle ?? null,
      })
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
      // Read the store, not the refs: this event follows the move's own
      // feedback on the wire, and the refs are only updated by an effect after
      // the next render. Between the two messages they still named the old
      // room, so the mover's own event looked like a mismatch and triggered a
      // full HTTP reload of a room the client had just been handed.
      const { player: currentPlayer, currentRoom: activeRoom } = useGameStore.getState()

      if (!currentPlayer) {
        console.log('[GameInterface] No current player, ignoring room:player-moved')
        return
      }

      if (event.playerId === currentPlayer.id) {
        // For current player: treat as reconciliation, but only if event is credible
        const playerRoom = currentPlayer.currentRoom
        const uiRoom = activeRoom?.roomId
        const pendingMove = pendingMoveRef.current
        
        // This event is the server reporting where it has actually put us, so it
        // is authoritative — there is no such thing as an "incredible" one. It
        // used to be accepted only when it matched a move this tab had started,
        // which made the case that most needs it unreachable: a second tab for
        // the same account receives the move the *other* tab made, matches no
        // pending move of its own, and so sat in the old room forever, sending
        // every later action from a room the server had already left.
        const needsReconciliation =
          (playerRoom !== event.toRoom) ||  // Player state doesn't match event
          (uiRoom !== event.toRoom)         // UI doesn't match event destination

        if (needsReconciliation) {
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
        } else {
          console.log('[GameInterface] room:player-moved redundant for current player - state already matches', {
            eventToRoom: event.toRoom,
            playerRoom,
            uiRoom,
            pendingMove: pendingMove?.toRoomId,
          })
        }
        return
      }

      // Someone else's move. The room list is kept by the player-joined and
      // player-left events, which carry the player and arrive once the server
      // has actually moved them. Reloading the room over HTTP here raced those:
      // the read could run before the mover's room was persisted, and its
      // answer overwrote a list the events had already corrected — a player who
      // had just left reappeared, or one who had just arrived vanished.
      console.log('[GameInterface] Player moved event is for another player:', event.playerId)
    })

    return () => {
      cleanupActionFeedback()
      cleanupLoginSuccess()
      cleanupInventoryUpdate()
      cleanupRoomMoves()
    }
    // `worldTick` is deliberately absent: nothing in this effect reads it, but
    // it is replaced on every world tick, so listing it tore down and re-armed
    // the four most important handlers in the game on a timer.
  }, [socket, socketHandlers, setPlayer, setInventory, hydrateSession, updateRoomItems, appendWorldFeed])

  // Fetch quests and kill list on login so they're available immediately
  useEffect(() => {
    if (!isLoggedIn || !player) return
    let cancelled = false
    fetch('/api/game/quests/progress', { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return
        setQuests(data.quests || [])
        setGiversMet(data.giversMet || [])
      })
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
            setGiversMet(data.giversMet || [])
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
    // Matches the server gate: the reset fixture does not exist in production.
    if (process.env.NODE_ENV === 'production') return

    setIsResettingQuests(true)
    try {
      const response = await fetch('/api/game/quests/reset', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      
      if (data.success) {
        // Refresh quests and player state (the reset route clears chest1 and chest2)
        if (player) setPlayer({ ...player, chest1: false, chest2: false })
        const questResponse = await fetch('/api/game/quests/progress', {
          headers: getAuthHeaders(),
        })
        const questData = await questResponse.json()
        if (questData.success) {
          setQuests(questData.quests || [])
          setGiversMet(questData.giversMet || [])
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
    // Matches the server gate: the reset fixture does not exist in production.
    if (process.env.NODE_ENV === 'production') return
    setIsResettingQuests(true)
    try {
      const response = await fetch('/api/game/quests/reset?mode=skip-to-chest', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        // Refresh quests and player state (the reset route clears chest1 and chest2)
        if (player) setPlayer({ ...player, chest1: false, chest2: false })
        const questResponse = await fetch('/api/game/quests/progress', {
          headers: getAuthHeaders(),
        })
        const questData = await questResponse.json()
        if (questData.success) {
          setQuests(questData.quests || [])
          setGiversMet(questData.giversMet || [])
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
    // The line that just produced it (a pickup, a craft, a quest reward) can
    // lead straight to it.
    if (newItems.length > 0) useWorldFeedStore.getState().linkLatestOwn({ tab: 'inv', itemId: newItems[0].id })
    
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

  // Clear "new item" markers when the player LEAVES the Inv tab.
  // The dots must remain visible the entire time the tab is open (including
  // items picked up while viewing) so the player can see exactly which items
  // are new; they only clear once the player closes it or switches tab. The
  // filter and the item it was told to open are forgotten at the same moment,
  // so the link that sent the player there can send them back to the same one.
  const previousTabRef = useRef(centerActiveTab)
  useEffect(() => {
    const leftInventory = previousTabRef.current === 'inv' && centerActiveTab !== 'inv'
    previousTabRef.current = centerActiveTab
    if (leftInventory) {
      setNewItemIds(prev => (prev.size > 0 ? new Set() : prev))
      setInventoryView(filterTabToView())
      setInventoryOpenId(null)
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
      // Cancel the previous fight's staged teardown. Without this, a battle that
      // begins inside that ~900ms window is erased a moment later by the earlier
      // fight's delayed clearBattle().
      clearBattleTimers()
      // A new battle beginning (manual attack, auto-advance, or a rest/search ambush)
      // dismisses any lingering victory summary so it never blocks the next fight.
      clearBattleResult()
      setBattleStarted({
        isAdvantageTurn: payload.isAdvantageTurn,
        enemySlug: payload.enemySlug,
        enemyName: payload.enemyName,
        enemyIcon: payload.enemyIcon,
        enemyLevel: payload.enemyLevel,
        enemyRank: payload.enemyRank ?? null,
        enemyAtt: payload.enemyAtt,
        enemyDef: payload.enemyDef,
        enemyTraits: payload.enemyTraits ?? [],
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
          enemyAction: payload.enemyAction ?? null,
          ammo: payload.ammo ?? null,
          actionMeta: payload.actionMeta ?? null,
          spell: payload.spell ?? null,
          skill: payload.skill ?? null,
          immuneToMagic: payload.immuneToMagic ?? false,
          playerDodged: payload.playerDodged ?? false,
          petrifyApplied: payload.petrifyApplied ?? 0,
          petrifiedTurns: payload.petrifiedTurns ?? 0,
          extraHits: payload.extraHits ?? [],
          enemyDodged: payload.enemyDodged ?? false,
          petrified: payload.petrified ?? false,
          melted: payload.melted ?? false,
          enemyHealed: payload.enemyHealed ?? 0,
          enemyEffects: payload.enemyEffects ?? {},
          playerMp: payload.playerMp,
          playerMpMax: payload.playerMpMax,
          playerCurrency: payload.playerCurrency,
        })
      } else if (typeof payload.playerMp === 'number') {
        // A one-turn kill or a fatal counter after a cast: the terminal handler
        // owns the battle state, but the MP the spell spent is still real.
        const { player: currentPlayer, setPlayer: sp } = useGameStore.getState()
        if (currentPlayer) {
          sp({
            ...currentPlayer,
            mp: payload.playerMp,
            ...(typeof payload.playerCurrency === 'number' ? { currency: payload.playerCurrency } : {}),
          })
        }
      }
      appendWorldFeed({ type: 'room', message: payload.message, ts: Date.now(), eventType: 'battle-turn' })
    })

    const cleanupVictory = socketHandlers.onBattleVictory((payload) => {
      const applyVictory = () => {
        if (payload.summary) setBattleResult(payload.summary)
        if (payload.summary?.enemySlug) incrementKill(payload.summary.enemySlug)
        clearBattle()
        // A probabilistic room is empty again after the kill; a static room's
        // enemy is always there and stays on screen.
        if (payload.clearRoomEnemies) {
          setRoomEnemy(null)
        }
        const currentPlayer = useGameStore.getState().player
        if (currentPlayer) {
          setPlayer({
            ...currentPlayer,
            xp: (currentPlayer.xp ?? 0) + payload.xpAwarded,
            currency: (currentPlayer.currency ?? 0) + payload.goldAwarded,
            // A spell that landed the final blow still spent its MP.
            ...(typeof payload.playerMp === 'number' ? { mp: payload.playerMp } : {}),
          })
        }
        appendWorldFeed({
          type: 'room',
          isSelf: true,
          eventType: 'battle-victory',
          outcome: 'success',
          // What dropped is in the bag; a win with no drop is one for the log.
          link: payload.droppedItems.length > 0 ? { tab: 'inv' } : { tab: 'quests', sub: 'battle-log' },
          message: `Victory! +${payload.xpAwarded} XP  +${payload.goldAwarded} Gold${payload.droppedItems.length > 0 ? `  +${payload.droppedItems.join(', ')}` : ''}`,
          ts: Date.now(),
        })
        if (payload.xpAwarded > 0) triggerXpGain(payload.xpAwarded)
        // Inventory is refreshed via the inventory:update socket event emitted from the
        // server's background persistence (drops commit after this victory event fires).
      }
      const lt = payload.summary?.lastTurn
      scheduleBattleTimer(() => {
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
          enemyAction: lt?.enemyAction ?? null,
          spell: lt?.spell ?? null,
          skill: lt?.skill ?? null,
          immuneToMagic: lt?.immuneToMagic ?? false,
          playerDodged: lt?.playerDodged ?? false,
          petrifyApplied: lt?.petrifyApplied ?? 0,
          extraHits: lt?.extraHits ?? [],
          enemyDodged: lt?.enemyDodged ?? false,
          petrified: lt?.petrified ?? false,
          melted: lt?.melted ?? false,
          enemyHealed: lt?.enemyHealed ?? 0,
          enemyEffects: lt?.enemyEffects ?? {},
        })
        updateBattleTurn(buildUpdate(0))
      }, 0)
      scheduleBattleTimer(applyVictory, 900)
    })

    const cleanupDefeat = socketHandlers.onBattleDefeat((payload) => {
      const applyDefeat = () => {
        if (payload.summary) setBattleResult(payload.summary)
        clearBattle()
        // Dead is HP 0, and death strips every running buff. The card stays up
        // over the room that did it until the player presses Rise; only then
        // does the respawn move run (see onDismissResult on the battle panel).
        const current = useGameStore.getState().player
        if (current) {
          setPlayer({
            ...current,
            hp: payload.playerHp ?? 0,
            ...(payload.buffs ? { buffs: { ...current.buffs, ...payload.buffs } } : {}),
          })
        }
        respawnRoomRef.current = payload.respawnRoomId ?? null
        appendWorldFeed({
          type: 'room',
          isSelf: true,
          eventType: 'battle-defeat',
          outcome: 'failure',
          link: { tab: 'quests', sub: 'battle-log' },
          message: payload.message || 'You black out...',
          ts: Date.now(),
        })
        setRoomEnemy(null)
      }
      // Same macrotask-deferral as victory: ensure setBattleStarted renders first.
      const lt = payload.summary?.lastTurn
      scheduleBattleTimer(() => {
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
          enemyAction: lt?.enemyAction ?? null,
          spell: lt?.spell ?? null,
          skill: lt?.skill ?? null,
          immuneToMagic: lt?.immuneToMagic ?? false,
          playerDodged: lt?.playerDodged ?? false,
          petrifyApplied: lt?.petrifyApplied ?? 0,
          extraHits: lt?.extraHits ?? [],
          enemyDodged: lt?.enemyDodged ?? false,
          petrified: lt?.petrified ?? false,
          melted: lt?.melted ?? false,
          enemyHealed: lt?.enemyHealed ?? 0,
          enemyEffects: lt?.enemyEffects ?? {},
        })
      }, 0)
      scheduleBattleTimer(applyDefeat, 900)
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
        handleActionRef.current({ type: 'teleport', data: { toRoomId: returnRoomId } })
      } else {
        // Fleeing in place: the server abandoned the room's enemy, so clear the
        // local one to match (otherwise the fled-from enemy lingers on screen).
        setRoomEnemy(null)
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
    // advances on a click: buff countdowns, and the vitals when regen or poison
    // moved them (see GameEngine.applyClickTick).
    const cleanupClicksUpdate = socketHandlers.on<{
      clicks: number
      buffs?: Record<string, number>
      hp?: number
      mp?: number
      regen?: { hp: number; mp: number }
      poison?: { damage: number; remaining: number }
    }>('player:clicks-update', (payload) => {
      const { player: currentPlayer, setPlayer: sp, syncBattleVitals } = useGameStore.getState()
      if (!currentPlayer) return
      const next = { ...currentPlayer, clicks: payload.clicks }
      // Merge: a tick reports the countdowns; standing bonuses ride along untouched.
      if (payload.buffs) next.buffs = { ...currentPlayer.buffs, ...payload.buffs }
      if (typeof payload.hp === 'number') next.hp = payload.hp
      if (typeof payload.mp === 'number') next.mp = payload.mp
      sp(next)
      // Mid-fight, the battle card keeps its own HP; a poison tick between
      // turns has to reach it too, or the card lags the header by a click.
      if (typeof payload.hp === 'number') syncBattleVitals({ hp: payload.hp })
      // What regen actually restored this click, floated off the bars.
      if (payload.regen && (payload.regen.hp > 0 || payload.regen.mp > 0)) triggerRegenGain(payload.regen)
    })

    return () => {
      cleanupStarted()
      cleanupTurn()
      cleanupVictory()
      cleanupDefeat()
      cleanupFled()
      cleanupLevelUp()
      cleanupClicksUpdate()
      // Never leave a staged teardown to fire against an unmounted tree.
      clearBattleTimers()
    }
    // `handleAction` is deliberately absent: it is redefined on every render, so
    // listing it resubscribed all seven battle handlers each time this component
    // re-rendered — which, subscribing to player, room, battle and party state,
    // is constantly. The two call sites above dispatch through handleActionRef
    // instead, the pattern the rest of the long-lived subscriptions already use.
  }, [socket, socketHandlers, setBattleStarted, updateBattleTurn, clearBattle, setBattleResult, clearBattleResult, appendWorldFeed, scheduleBattleTimer, clearBattleTimers, triggerRegenGain])

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
          p.id === data.id
            ? { ...p, inBattle: data.inBattle, battleEnemyName: data.inBattle ? data.enemyName ?? null : null }
            : p
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
      clearPartyGlances()
    })

    const cleanupRemoved = socketHandlers.onPartyRemoved(() => {
      clearParty()
      clearPartyGlances()
      appendWorldFeed({
        type: 'party',
        isSelf: true,
        message: 'You were removed from the party.',
        ts: Date.now(),
      })
    })

    const cleanupError = socketHandlers.onPartyError((payload) => {
      // A party error can be the refusal of the ask we have just marked pending.
      clearPendingFollow(unconfirmedFollowRef.current)
      appendWorldFeed({
        type: 'party',
        isSelf: true,
        level: 'error',
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
        type: 'party',
        isSelf: true,
        message: payload.toRoomName ? `Your party travels to ${payload.toRoomName}.` : 'Your party travels together.',
        ts: Date.now(),
      })
    })

    // One line about the party: someone joined, fell, was left behind, levelled,
    // killed something. The server decides what is worth saying; the kind only
    // picks how loudly the feed says it.
    const cleanupNotice = socketHandlers.onPartyNotice((payload) => {
      appendWorldFeed({
        id: payload.id,
        type: 'party',
        level: payload.kind === 'fallen' || payload.kind === 'left-behind' ? 'error' : undefined,
        actor: payload.actor,
        message: payload.message,
        ts: payload.ts,
      })
    })

    const cleanupFollowRequest = socketHandlers.onPartyFollowRequest((payload) => {
      setFollowRequests((queue) =>
        queue.some((r) => r.requesterId === payload.requesterId) ? queue : [...queue, payload]
      )
    })

    const cleanupFollowPending = socketHandlers.onPartyFollowPending((payload) => {
      if (unconfirmedFollowRef.current === payload.targetId) unconfirmedFollowRef.current = null
      setPendingFollowIds((prev) => (prev.has(payload.targetId) ? prev : new Set(prev).add(payload.targetId)))
    })

    // Accepted, declined, withdrawn or lapsed — whichever end we are, this is
    // what puts the UI back: the leader's prompt closes, the asker's button
    // comes back.
    const cleanupFollowResolved = socketHandlers.onPartyFollowResolved((payload) => {
      clearPendingFollow(payload.targetId)
      setFollowRequests((queue) => queue.filter((r) => r.requesterId !== payload.requesterId))
    })

    const cleanupPartyChat = socketHandlers.onPartyChatMessage((payload) => {
      const isSelf = payload.userId === playerRef.current?.id
      appendWorldFeed({
        id: payload.id,
        type: 'party',
        // Marks a line somebody typed, as opposed to a notice about the party:
        // the rail's unread count only counts these.
        eventType: 'party-chat',
        actor: payload.username,
        isSelf,
        message: `${payload.username}: ${payload.message}`,
        ts: new Date(payload.timestamp).getTime(),
      })
    })

    // Everything said before we arrived (or before we refreshed). Ids are the
    // database rows', so the feed store's own de-duplication keeps a reconnect
    // from printing the conversation twice.
    const cleanupPartyChatHistory = socketHandlers.onPartyChatHistory((payload) => {
      const selfId = playerRef.current?.id
      for (const message of payload.messages ?? []) {
        appendWorldFeed({
          id: message.id,
          type: 'party',
          eventType: 'party-chat',
          actor: message.username,
          isSelf: message.userId === selfId,
          message: `${message.username}: ${message.message}`,
          ts: new Date(message.timestamp).getTime(),
        })
      }
    })

    // A teammate's fight at a glance — enemy HP, last exchange, turn. Only the
    // party receives these; the rail and the Party tab draw them.
    const cleanupMemberBattle = socketHandlers.onPartyMemberBattle((payload) => {
      applyPartyGlance(payload)
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
      cleanupNotice()
      cleanupFollowRequest()
      cleanupFollowPending()
      cleanupFollowResolved()
      cleanupPartyChat()
      cleanupPartyChatHistory()
      cleanupMemberBattle()
      cleanupRoomPartyState()
    }
  }, [socket, socketHandlers, setParty, clearParty, clearPartyGlances, applyPartyGlance, appendWorldFeed, setPlayer, applyRoomPartyState])

  // Global presence feed — the Players tab roster. Room-scoped presence above keeps
  // "Others here" live; this keeps the world-wide list live. Server-owned and
  // ephemeral, so a disconnect simply stops the deltas until the next sync.
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

  const syncMapToCurrentRoom = useCallback(() => {
    if (currentRoomRef.current?.roomId) {
      setCurrentMapId(getMapIdForRoom(currentRoomRef.current.roomId))
    }
  }, [])

  // Phones draw a tab as a page and Action as a sheet; a wide screen docks
  // both in the left column.
  const isWide = viewportWidth >= 1024

  // Opening a tab always lands on its main page: Char on the character, Quests
  // on the journal, World on the Map of the sheet under your feet. Players
  // is the one exception, opening on DM when a message is waiting. Inv's
  // filter is reset when it is left, so a link can set it before opening.
  const openTab = useCallback((tab: TabId) => {
    if (tab === 'char') setCharTab('char')
    if (tab === 'quests') setQuestsTab('quests')
    if (tab === 'world') {
      syncMapToCurrentRoom()
      setWorldTab('map')
    }
    if (tab === 'players') setPlayersSubTab(useDMStore.getState().getTotalUnreadCount() > 0 ? 'dm' : 'roster')
    setActionOpen(false)
    setCenterActiveTab(tab)
  }, [syncMapToCurrentRoom])

  // A tile in the bar: open its tab, or go home if it is the one open.
  const selectTab = useCallback((tab: TabId) => {
    const next = reduceTabs(tabStateRef.current, { type: 'select', tab })
    if (next.tab === 'explore') goToExplore()
    else openTab(next.tab)
  }, [goToExplore, openTab])

  // The centre of the compass ring: the World tab, on its Map.
  const openMap = useCallback(() => {
    openTab('world')
    setWorldTab('map')
  }, [openTab])

  const toggleAction = useCallback(() => applyTabEvent({ type: 'toggleAction' }), [applyTabEvent])
  const closeAction = useCallback(() => setActionOpen(false), [])

  // The Action layer's controls send the same actions the deck and the room
  // card send, through handleAction so the phone's snap-to-Explore rule for
  // anything that opens a fight applies. The server decides turn cost and
  // provocation. Attack is the fight's swing in a fight, else the room's
  // enemy is engaged; with nothing to hit the deck has already dimmed it.
  const handleUseItemFromLayer = useCallback((playerItemId: string, action: string) => {
    handleActionRef.current({ type: 'use_item', data: { playerItemId, action } })
  }, [])
  const handleCastFromLayer = useCallback((spellId: string) => {
    handleActionRef.current({ type: 'cast_spell', data: { spellId } })
  }, [])
  const handleSkillFromLayer = useCallback((skillId: string) => {
    handleActionRef.current({ type: 'use_skill', data: { skillId } })
  }, [])
  const isInBattleRef = useRef(false)
  isInBattleRef.current = battle.isInBattle
  const roomEnemyRef = useRef<RoomEnemy | null>(null)
  roomEnemyRef.current = roomEnemy
  const handleAttackFromLayer = useCallback(() => {
    if (isInBattleRef.current) {
      handleActionRef.current({ type: 'player_attack' })
      return
    }
    const enemy = roomEnemyRef.current
    if (enemy) handleActionRef.current({ type: 'start_battle', data: { enemySlug: enemy.slug } })
  }, [])

  const handleOpenPartyTab = useCallback(() => {
    setPlayersSubTab('party')
    setActionOpen(false)
    setCenterActiveTab('players')
  }, [])

  /**
   * What leaving a fight would do to the player's party right now, as a
   * sentence — null when they are not in one, or are not in a fight, in which
   * case travelling costs them nothing and needs no confirmation.
   */
  const escapeWarning = useMemo(() => {
    if (!battle.isInBattle) return null
    return partyDepartureWarning(describePartyDeparture(party, player?.id))
  }, [battle.isInBattle, party, player?.id])

  const handleTeleport = useCallback(
    (roomId: string) => {
      const go = () => handleAction({ type: 'teleport', data: { toRoomId: roomId } })
      if (escapeWarning) {
        setPartyDepartureConfirm({
          title: 'Teleport away from your party?',
          message: `${escapeWarning}\n\nThe enemy stays where it is, at full health.`,
          confirmLabel: 'Teleport',
          run: go,
        })
        return
      }
      go()
    },
    [handleAction, escapeWarning]
  )

  const handleFlee = useCallback(() => {
    const go = () => socketHandlers.sendGameAction({ type: 'player_flee' })
    if (escapeWarning) {
      setPartyDepartureConfirm({
        title: 'Retreat and leave your party?',
        message: `${escapeWarning}\n\nYou fall back to the room you came from. The enemy stays where it is, at full health.`,
        confirmLabel: 'Retreat',
        run: go,
      })
      return
    }
    go()
  }, [socketHandlers, escapeWarning])

  // Both are refused server-side anyway — party followers and the MP cost in
  // socket-server-handlers.js. The grid states the reason and disables the
  // destinations. Being in a fight is deliberately not on this list: a teleport
  // is how you get out of one, as it was in the original — and that holds for a
  // party member too, who escapes alone and leaves the party by doing it.
  const teleportBlockedReason = isPartyMember && !battle.isInBattle
    ? 'You are following your party. Leave the party to move freely.'
    : (player?.mp ?? 0) < TELEPORT_MP_COST
    ? `You need ${TELEPORT_MP_COST} MP to teleport. Rest first.`
    : null

  // What the game does to the tabs, per `lib/tab-rules`: a room change closes
  // only Action; a fight starting on a phone goes home to Explore (World
  // stays, since teleport is the way out); dying closes everything.
  useEffect(() => {
    applyTabEvent({ type: 'roomChanged' })
  }, [currentRoom?.roomId, applyTabEvent])

  useEffect(() => {
    if (!battle.isInBattle) return
    applyTabEvent({ type: 'fightStarted', phone: !window.matchMedia('(min-width: 1024px)').matches })
  }, [battle.isInBattle, applyTabEvent])

  const isDead = !!player && player.hp <= 0
  useEffect(() => {
    if (isDead) applyTabEvent({ type: 'died' })
  }, [isDead, applyTabEvent])

  // Every fight starts with the phone's D-pad folded away — the deck is what
  // you came to look at — and every fight ends with it unfolded again, so the
  // next room is not one tap further away than it was before.
  useEffect(() => {
    setIsBattleDpadOpen(false)
  }, [battle.isInBattle])

  // Every "open the inventory" link in the game lands here: the Inv tab of
  // the deck, optionally filtered and with one item's drawer open.
  const handleSwitchToInventory = useCallback((filter?: FilterTab, openItemId?: string) => {
    if (filter !== undefined) setInventoryView(filterTabToView(filter))
    setInventoryOpenId(openItemId ?? null)
    openTab('inv')
  }, [openTab])

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

  // Rooms this character has stood in, so the compass can name its exits.
  const [visitedNames, rememberVisited] = useVisitedRooms(player?.id)
  useEffect(() => {
    if (currentRoom?.roomId && currentRoom?.name) rememberVisited(currentRoom.roomId, currentRoom.name)
  }, [currentRoom?.roomId, currentRoom?.name, rememberVisited])

  // The quests being followed, pinned from the Quests tab and shown beside
  // the compass. Their rows come from the same journal the Quests tab builds,
  // so the step and the count never disagree with it. Turning one in unpins it.
  const trackedQuestStore = useTrackedQuests(player?.id)
  const trackedRows = useMemo(() => {
    if (trackedQuestStore.ids.length === 0) return []
    const rows = buildJournal({ inventory, killList, player, quests, giversMet }).flatMap((group) => group.givers.flatMap((section) => section.rows))
    return trackedQuestStore.ids.map((id) => rows.find((row) => row.questId === id)).filter((row): row is NonNullable<typeof row> => !!row)
  }, [trackedQuestStore.ids, inventory, killList, player, quests, giversMet])
  const removeTracked = trackedQuestStore.remove
  useEffect(() => {
    for (const row of trackedRows) if (row.state === 'completed') removeTracked(row.questId)
  }, [trackedRows, removeTracked])
  const trackedQuests = useMemo(() => trackedRows.filter((row) => row.state !== 'completed').map((row) => trackedQuestView(row, visitedNames)), [trackedRows, visitedNames])

  // Points are spent on the Char page itself; anything that says "spend your
  // points" goes there and brings the controls into view.
  const openCharPoints = useCallback(() => {
    openTab('char')
    requestAnimationFrame(() => {
      document.getElementById('char-points')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }, [openTab])

  // What of the interface this character has earned (lib/unlocks). Every fact
  // is one the server already sent; nothing here gates an action.
  const others = useMemo(() => roomPlayers.some((other) => other.id !== player?.id), [roomPlayers, player?.id])
  const unlockFacts = useMemo<UnlockFacts | null>(() => {
    if (!player) return null
    let consumableCount = 0
    let craftingCount = 0
    let miscCount = 0
    for (const item of inventory) {
      const category = getItemCategory(item)
      if (category === 'consumables') consumableCount += 1
      else if (category === 'crafting') craftingCount += 1
      else if (category === 'misc') miscCount += 1
    }
    const skills = buildSkillbook(player)
    const spells = buildSpellbook(player)
    const hasMap = (MAP_SHEETS as Array<{ flag: keyof Player }>).some((sheet) => Boolean(player[sheet.flag]))
    return {
      level: player.level ?? 1,
      itemCount: inventory.length,
      consumableCount,
      craftingCount,
      miscCount,
      questCount: quests.length,
      giversMet: giversMet.length,
      hasMapOrTeleport: hasMap || (player.discoveredTeleports?.length ?? 0) > 0,
      othersSeen: others || party !== null || totalDmUnread > 0,
      sp: player.sp ?? 0,
      hasSkillTeacher: skills.some((entry) => entry.maxLevel > 0),
      hasSpellTeacher: spells.some((entry) => entry.maxLevel > 0),
      hasLearnedSkill: skills.some((entry) => entry.level > 0),
      hasLearnedSpell: spells.some((entry) => entry.level > 0),
      hasAbility: getCastableSpells(player).length > 0 || skills.some((entry) => entry.level > 0 && entry.castCost !== null),
      kills: killList.length,
      deaths: player.deaths ?? 0,
    }
  }, [player, inventory, quests.length, giversMet.length, others, party, totalDmUnread, killList.length])

  const unlocks = useUnlocks(player?.id, unlockFacts, (id: UnlockId, line: string) => {
    const def = unlockDef(id)
    appendWorldFeed({
      type: 'action',
      outcome: 'success',
      isSelf: true,
      eventType: 'unlock',
      message: line,
      link: def ? { tab: def.tab, sub: def.sub } : undefined,
      roomId: currentRoomRef.current?.roomId,
    })
  })
  const hiddenTabSet = useMemo(() => hiddenTabs(unlocks.open), [unlocks.open])
  const freshTabSet = useMemo(() => freshTabs(unlocks.fresh), [unlocks.fresh])
  // Which book an "SP to spend" link opens: none until a teacher has been met.
  const spBookTab: BookTab | null = unlocks.open.has('char:skills') ? 'skills' : unlocks.open.has('char:spells') ? 'spells' : null

  // Looking at a place is what stops it glowing.
  const markSeen = unlocks.markSeen
  useEffect(() => {
    if (centerActiveTab === 'inv') markSeen(['tab:inv'])
    else if (centerActiveTab === 'quests') {
      const seen: UnlockId[] = ['tab:quests']
      if (questsTab === 'kill-list') seen.push('quests:kill-list')
      if (questsTab === 'battle-log') seen.push('quests:battle-log')
      markSeen(seen)
    } else if (centerActiveTab === 'world') markSeen(['tab:world'])
    else if (centerActiveTab === 'players') markSeen(['tab:players'])
    else if (centerActiveTab === 'char' && charTab !== 'char') markSeen([charTab === 'skills' ? 'char:skills' : 'char:spells'])
  }, [centerActiveTab, charTab, questsTab, markSeen])
  useEffect(() => {
    if (actionOpen) markSeen(['explore:action'])
  }, [actionOpen, markSeen])

  // Feed lines that know where they lead (lib/feed-links) are followed here.
  // A place not earned yet is not opened by a link either.
  const followLinkRef = useRef<(link: FeedLink) => void>(() => {})
  followLinkRef.current = (link: FeedLink) => {
    if (hiddenTabSet.has(link.tab)) return
    switch (link.tab) {
      case 'inv': {
        const item = link.itemId ? inventory.find((entry) => entry.id === link.itemId) : undefined
        if (item) handleSwitchToInventory(getItemCategory(item), item.id)
        else handleSwitchToInventory(link.sub as FilterTab | undefined)
        return
      }
      case 'char':
        if ((link.sub === 'skills' || link.sub === 'spells') && unlocks.open.has(`char:${link.sub}`)) handleOpenBook(link.sub)
        else openCharPoints()
        return
      case 'quests':
        openTab('quests')
        if (link.sub === 'kill-list' || link.sub === 'battle-log') setQuestsTab(link.sub)
        return
      case 'players':
        openTab('players')
        if (link.sub === 'party' || link.sub === 'dm' || link.sub === 'ranks') setPlayersSubTab(link.sub)
        return
      case 'world':
        openTab('world')
        if (link.sub === 'map') setWorldTab('map')
        return
      case 'explore':
        goToExplore()
        return
      default:
        openTab(link.tab)
    }
  }
  useEffect(() => {
    registerFeedLinkHandler((link) => followLinkRef.current(link))
    return () => registerFeedLinkHandler(null)
  }, [])

  const renderActivePanel = useCallback(() => {
    if (!player) return <div>Loading...</div>

    switch (centerActiveTab) {
      case 'char':
        if (charTab !== 'char') {
          return (
            <SkillsAndSpellsBook
              player={player}
              inBattle={battle.isInBattle}
              hasTarget={roomEnemy !== null}
              tab={charTab}
              highlightId={bookHighlight}
              onLearned={(updatedPlayer) => {
                // Merge: the server's row wins, client-only fields (buffs, presence) survive.
                const current = useGameStore.getState().player
                setPlayer(current ? { ...current, ...updatedPlayer } : updatedPlayer)
              }}
              onCast={(spellId) => handleAction({ type: 'cast_spell', data: { spellId } })}
              onUseSkill={(skillId) => handleAction({ type: 'use_skill', data: { skillId } })}
            />
          )
        }
        return (
          <CharPanel
            player={player}
            onSwitchToInventory={handleSwitchToInventory}
            onOpenBook={handleOpenBook}
            bookTab={spBookTab}
            onPointsSpent={handlePointsSpent}
          />
        )
      case 'quests':
        return (
          <QuestsPanel
            activeTab={questsTab}
            trackedQuestIds={trackedQuestStore.ids}
            onTrackQuest={trackedQuestStore.toggle}
            isLoadingQuests={isLoadingQuests}
            isResettingQuests={isResettingQuests}
            isLoggedIn={isLoggedIn}
            onResetQuests={handleResetQuests}
            onSkipToChest={handleSkipToChest}
          />
        )
      case 'players':
        return (
          <PlayersPanel
            activeSubTab={playersSubTab}
            onOpenWorldChat={handleOpenWorldChat}
            onClose={goToExplore}
            onDMMessageSent={(payload) => {
              appendDMFeed('to', payload.recipientUsername || 'Unknown', payload.message)
            }}
            party={party}
            roomPlayers={roomPlayers}
            currentPlayerId={player.id}
            currentPlayer={player}
            roomDanger={currentRoom}
            pendingFollowIds={pendingFollowIds}
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
          />
        )
      default:
        return null
    }
  }, [goToExplore, centerActiveTab, charTab, questsTab, trackedQuestStore.ids, trackedQuestStore.toggle, bookHighlight, spBookTab, handlePointsSpent, handleOpenBook, battle.isInBattle, roomEnemy, setPlayer, player, handleAction, handleSwitchToInventory, inventory, newItemIds, quests, isLoadingQuests, isResettingQuests, isLoggedIn, handleResetQuests, currentMapId, currentRoom, handleMapChange, handleOpenWorldChat, socket, customAction, isLoadingRoom, customActionInputRef, setUnreadCount, forceWorldChatMode, forceFeedFilter, forceFeedChatSubFilter, handleLogoutFlow, appendDMFeed, playersSubTab, totalDmUnread, battle.isInBattle, roomEnemy, handleOpenBook, inventoryOpenId, party, roomPlayers, pendingFollowIds])

  if (!player || !isLoggedIn) {
    return <div>Loading...</div>
  }

  if (!currentRoom || (isLoadingRoom && isInitialLoad)) {
    return (
      <div className="min-h-dvh fill-surface-canvas bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--accent)_4%,transparent)_0%,transparent_70%)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-hover/40 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-fg-muted text-sm tracking-wide">Loading world data...</p>
        </div>
      </div>
    )
  }

  const availableMaps = getUnlockedMaps(player, currentRoom?.roomId)

  // Unspent Core/Training Points: the original's nav badges. Skill Points are
  // left out — the spellbook button in the Character panel already pulses when
  // a spell is actually learnable.
  const unspentPoints = (player?.cp ?? 0) + (player?.tp ?? 0)

  // Which tab the level-up card's Spend SP button should open, or null when the
  // card should not offer one. CP and TP always buy something; SP buys nothing
  // until a teacher has been met, and the early levels belong to the Grassy
  // Field rather than to a trainer — so the button waits for level 5 and for
  // the book to hold a row this SP can actually pay for.
  // Only asked while the card is actually up, so the two books are not rebuilt
  // on every unrelated render.
  const levelUpBookTab: BookTab | null =
    !levelUpData || !player || player.level < 5 || spBookTab === null
      ? null
      : hasLearnableSkill(player)
        ? 'skills'
        : hasLearnableSpell(player)
          ? 'spells'
          : null

  const activeTab = centerActiveTab
  const tabBadges: TabBadges = {
    char: unspentPoints > 0 ? unspentPoints : undefined,
    inv: newItemIds.size > 0 ? newItemIds.size : undefined,
    quests: readyQuestCount > 0 ? readyQuestCount : hasQuestUpdate ? true : undefined,
    players: totalDmUnread > 0 ? totalDmUnread : undefined,
    feed: unreadCount > 0 ? unreadCount : undefined,
  }

  const enemyHere = !battle.isInBattle && !!roomEnemy
  const levelUpInVictory = !!levelUpData && !battle.isInBattle && battleResult?.outcome === 'WIN'

  // Every tab in the one frame: its sub-tabs (or its name) and close. World
  // and Inv bring their own layer; the rest are panels wrapped here.
  const renderPanelLayer = (presentation: DeckPresentation) => {
    if (centerActiveTab === 'inv' || centerActiveTab === 'world') {
      return (
        <DeckProvider value={{ presentation, onClose: goToExplore }}>
          <DeckContent tab={centerActiveTab} {...deckContent} />
        </DeckProvider>
      )
    }
    const def = tabDef(centerActiveTab)
    // Each tab's pages as sub-tabs in its header, all behaving alike: the
    // active one, clicked again, returns to the tab's main page.
    // A sub-tab not earned yet is not drawn, and a tab with only its main
    // page left wears its name instead of a row of one.
    const freshDot = (id: UnlockId) => (unlocks.fresh.has(id) ? <NotificationBadge value className="absolute -top-1 -right-1" /> : undefined)
    const charTabs: Array<{ id: 'char' | BookTab; label: string; extra?: React.ReactNode }> = [
      { id: 'char', label: 'Char' },
      ...(unlocks.open.has('char:skills') ? [{ id: 'skills' as const, label: 'Skills', extra: freshDot('char:skills') }] : []),
      ...(unlocks.open.has('char:spells') ? [{ id: 'spells' as const, label: 'Spells', extra: freshDot('char:spells') }] : []),
    ]
    const questTabs = QUEST_SUB_TABS.filter(
      (tab) => tab.id === 'quests' || (tab.id === 'kill-list' ? unlocks.open.has('quests:kill-list') : unlocks.open.has('quests:battle-log')),
    )
    const panelLead =
      centerActiveTab === 'char' ? (
        charTabs.length > 1 ? (
          <HeaderTabs
            label="Character, Skills or Spells"
            active={charTab}
            home="char"
            onChange={(next) => {
              // Switching pages by hand leaves the ring behind: it belonged
              // to the row that sent the player here.
              setBookHighlight(null)
              setCharTab(next)
            }}
            color="violet"
            tabs={charTabs}
          />
        ) : undefined
      ) : centerActiveTab === 'quests' ? (
        questTabs.length > 1 ? (
          <HeaderTabs
            label="Quests, Kill list or Battle log"
            color="gold"
            active={questsTab}
            home="quests"
            onChange={setQuestsTab}
            tabs={questTabs.map((tab) => ({
              ...tab,
              extra:
                tab.id === 'quests' && readyQuestCount > 0 ? (
                  <span className="ml-1 text-[10px] font-bold text-status-success tabular-nums">{readyQuestCount}</span>
                ) : tab.id === 'kill-list' ? (
                  freshDot('quests:kill-list')
                ) : tab.id === 'battle-log' ? (
                  freshDot('quests:battle-log')
                ) : undefined,
            }))}
          />
        ) : undefined
      ) : centerActiveTab === 'players' ? (
        <HeaderTabs
          label="Players, Party, Ranks or Messages"
          color="pink"
          active={playersSubTab}
          home="roster"
          onChange={setPlayersSubTab}
          tabs={PLAYER_SUB_TABS.map((tab) => ({
            ...tab,
            extra:
              tab.id === 'party' && party ? (
                <span className="ml-1 text-[10px] text-fg-muted">
                  {party.size}/{party.maxSize}
                </span>
              ) : tab.id === 'dm' && totalDmUnread > 0 ? (
                <NotificationBadge value={totalDmUnread} className="absolute -top-1 -right-1" />
              ) : undefined,
          }))}
        />
      ) : undefined
    return (
      <DeckProvider value={{ presentation, onClose: goToExplore }}>
        <LayerShell
          title={def?.id === 'feed' ? 'World Feed' : def?.label ?? ''}
          icon={def?.icon(15)}
          toneClass={def?.tone ?? 'text-fg-primary'}
          lead={panelLead}
          flush
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="h-full">{renderActivePanel()}</div>
          </div>
        </LayerShell>
      </DeckProvider>
    )
  }
  const deckContent: DeckContentProps = {
    player,
    inventory,
    currentRoomId: currentRoom?.roomId,
    openUnlocks: unlocks.open,
    freshUnlocks: unlocks.fresh,
    onSeenUnlocks: unlocks.markSeen,
    worldTab,
    onWorldTabChange: setWorldTab,
    currentMapId,
    availableMaps,
    onMapChange: handleMapChange,
    onTeleport: handleTeleport,
    teleportBlockedReason,
    invView: inventoryView,
    onInvViewChange: setInventoryView,
    invOpenId: inventoryOpenId,
    newItemIds,
    onClearNewItem: (itemId) => {
      setNewItemIds(prev => {
        const updated = new Set(prev)
        updated.delete(itemId)
        return updated
      })
    },
    onOpenCrafting:
      currentRoom && isCraftingRoom(currentRoom.roomId) && !battle.isInBattle ? () => setIsCraftingOpen(true) : undefined,
    onAction: handleAction,
    isLoggedIn,
    battle,
    roomEnemy,
    isActing: isLoadingRoom,
    onAttack: handleAttackFromLayer,
    onUseSkill: handleSkillFromLayer,
    onCastSpell: handleCastFromLayer,
    onUseItem: handleUseItemFromLayer,
    onOpenBook: handleOpenBook,
    onOpenInventory: handleSwitchToInventory,
  }

  return (
    <div className="h-dvh fill-surface-canvas flex flex-col overflow-hidden">
      <ConfirmDialog
        isOpen={partyDepartureConfirm !== null}
        title={partyDepartureConfirm?.title ?? ''}
        message={partyDepartureConfirm?.message ?? ''}
        confirmLabel={partyDepartureConfirm?.confirmLabel ?? 'Go'}
        cancelLabel="Stay"
        tone="danger"
        onConfirm={() => {
          partyDepartureConfirm?.run()
          setPartyDepartureConfirm(null)
        }}
        onCancel={() => setPartyDepartureConfirm(null)}
      />
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
      <CraftingSheet
        isOpen={isCraftingOpen && !!currentRoom && isCraftingRoom(currentRoom.roomId) && !battle.isInBattle}
        onClose={() => setIsCraftingOpen(false)}
        roomId={currentRoom?.roomId ?? ''}
        roomName={currentRoom?.name}
        inventory={inventory}
        quests={quests}
        templates={recipeTemplates}
        templatesFailed={recipeTemplatesFailed}
        craftingRecipeId={craftingRecipeId}
        actionResult={actionResult}
        onCraft={(recipeId, quantity) => {
          if (craftingRecipeId || quantity < 1) return
          setCraftingRecipeId(recipeId)
          Promise.resolve(handleAction({ type: 'craft', data: { recipeId, quantity } })).finally(() =>
            setCraftingRecipeId(null)
          )
        }}
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
              link: { tab: 'inv' },
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
        itemPreview={itemPreview}
        regenGain={regenGain}
        regenGainKey={regenGainKey}
        xp={player?.xp}
        xpGain={xpGain}
        xpGainKey={xpGainKey}
        str={player ? stats.str.total : undefined}
        dex={player ? stats.dex.total : undefined}
        mag={player ? stats.mag.total : undefined}
        def={player ? stats.def.total : undefined}
        statTitles={
          player
            ? {
                str: describeStat('STR', stats.str),
                dex: describeStat('DEX', stats.dex),
                mag: describeStat('MAG', stats.mag),
                def: describeStat('DEF', stats.def),
              }
            : undefined
        }
        clicks={player?.clicks}
        unspentPoints={unspentPoints}
        onCharacterClick={() => selectTab('char')}
        onSettingsClick={() => selectTab('settings')}
        settingsOpen={centerActiveTab === 'settings'}
        isConnected={socket?.connected ?? false}
        onRefresh={() => window.location.reload()}
      />
      <ActivityTicker />

      <div className="relative flex flex-1 overflow-hidden min-h-0">
        {/* Phone: Action is a sheet over the room, above the bottom bar so the bar stays in reach. */}
        {actionOpen && !isWide && <ActionSheet onClose={closeAction} content={deckContent} />}
        {/* Left: on desktop (lg+), the D-pad by default, a panel or deck layer when a tab is open; the tab bar pinned above it */}
        <div
          className="relative hidden lg:flex flex-col flex-shrink-0 border-r border-line-subtle/30 bg-surface-panel/95 min-h-0 overflow-hidden"
          style={{ width: leftPanel.width }}
        >
          <PanelResizeHandle edge="right" isDragging={leftPanel.isDragging} handleProps={leftPanel.handleProps} />
          <div className={`${DOCK_BAR} px-2`}>
            <TabBar variant="row" active={activeTab} onSelect={selectTab} badges={tabBadges} hidden={hiddenTabSet} fresh={freshTabSet} />
          </div>
          {centerActiveTab !== 'explore' ? (
            <div className="flex min-h-0 flex-1 flex-col">{renderPanelLayer('docked')}</div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ExplorePanel
                variant="sidebar"
                room={currentRoom}
                onAction={handleAction}
                player={player}
                inventory={inventory}
                trackedQuests={trackedQuests}
                onOpenTrackedQuest={() => openTab('quests')}
                actionUnlocked={unlocks.open.has('explore:action')}
                actionFresh={unlocks.fresh.has('explore:action')}
                isPartyMember={isPartyMember}
                deck={deckContent}
                actionOpen={actionOpen}
                enemyHere={enemyHere}
                onToggleAction={toggleAction}
                onOpenMap={unlocks.open.has('tab:world') ? openMap : undefined}
                onCloseAction={closeAction}
                currentAction={action}
                actionResult={actionResult}
                isMoveInProgress={isMoveInProgress}
                isDimmed={player.hp <= 0}
                showBattleBadge={battle.isInBattle}
                isLoadingRoom={isLoadingRoom}
              />
            </div>
          )}
        </div>

        {/* Mobile panel: full-width when a panel tab is active (< lg only) */}
        {centerActiveTab !== 'explore' && (
          <div className="flex flex-col flex-1 min-h-0 bg-surface-panel/95 overflow-hidden lg:hidden">
            {!isWide && renderPanelLayer('sheet')}
          </div>
        )}

        {/* Right (desktop) / Main (mobile): Explore area — always visible on desktop, only when explore tab active on mobile */}
        <div className={`relative flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden ${centerActiveTab !== 'explore' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Feed toggle button — desktop only, top-right of explore area */}
          <button
            type="button"
            onClick={() => setIsFeedPanelOpen(v => !v)}
            className="hidden lg:flex absolute top-2 right-3 z-20 items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line-subtle/50 fill-surface-panel hover:bg-surface-raised/80 text-fg-secondary hover: transition-all duration-200 text-xs font-medium shadow-sm"
            title={isFeedPanelOpen ? 'Close World Feed' : 'Open World Feed'}
            aria-label={isFeedPanelOpen ? 'Close World Feed' : 'Open World Feed'}
          >
            <MessageSquareText size={14} />
            {unreadCount > 0 && (
              <span className="min-w-[16px] h-[16px] px-1 rounded-full fill-status-error text-[9px] font-semibold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {currentRoom && (
            <div className="bg-surface-panel/50 flex-1 overflow-hidden min-h-0 h-full flex flex-col">
              {/* Who you are travelling with, above the room rather than in it,
                  so it stays put while the room and a fight scroll beneath.
                  Somebody asking to follow us lands here too. */}
              <PartyRail
                party={party}
                roomDanger={currentRoom}
                roomPlayers={roomPlayers}
                currentPlayerId={player.id}
                self={player}
                onLowHp={handlePartyLowHp}
                followRequests={followRequests}
                onAnswerFollow={handleAnswerFollow}
                onLeave={handleLeaveParty}
                onRemove={handleRemovePartyMember}
                onSetClosed={handleSetPartyClosed}
                onSetName={handleSetPartyName}
                onManage={handleOpenPartyTab}
                onSendChat={(message) => socketHandlers.sendPartyChatMessage(message)}
                onMessage={handleProfileMessage}
                onInspect={handleOpenPlayerProfile}
              />
              {/* The room column is a container: with two resizable side
                  panels it can be far narrower than the viewport, so what
                  renders inside sizes against it, not the window. */}
              <div className="@container flex-1 min-h-0 overflow-y-auto h-full">
                <div className="max-w-4xl mx-auto w-full">
                  {!socket?.connected && (
                    <div className="flex items-center justify-center gap-3 px-4 py-4 my-4 rounded-lg border border-line-subtle/30 bg-surface-panel/60">
                      <div className="flex items-center gap-2 text-xs text-fg-secondary">
                        <span className="w-2 h-2 rounded-full bg-status-error" />
                        <span>Not Connected</span>
                      </div>
                      <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 text-md font-medium rounded-lg fill-accent transition-all duration-200 shadow-md shadow-shadow/40 hover:shadow-lg active:scale-[0.98]"
                        aria-label="Refresh page"
                        title="Refresh page"
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                  {/* A level gained by a win rides in the victory card as a gold
                      band; the level-up card is for a level gained any other way. */}
                  {levelUpData && !levelUpInVictory && (
                    <LevelUpAlert
                      data={levelUpData}
                      tpAvailable={player?.tp ?? 0}
                      cpAvailable={player?.cp ?? 0}
                      spAvailable={player?.sp ?? 0}
                      canSpendSp={levelUpBookTab !== null}
                      onClose={() => setLevelUpData(null)}
                      onTrainNow={openCharPoints}
                      onSpendCorePoints={openCharPoints}
                      onSpendSkillPoints={() => handleOpenBook(levelUpBookTab ?? 'skills')}
                    />
                  )}
                  {(battle.isInBattle || battleResult) && (
                    // Death takes the whole screen: the card sits on a scrim over
                    // everything — room, compass, tabs — so the only thing left to
                    // press is Rise again. A victory card stays inline.
                    <div
                      className={
                        battleResult?.outcome === 'LOSS'
                          ? 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-surface-canvas/85 backdrop-blur-sm'
                          : 'px-4 pt-4'
                      }
                      role={battleResult?.outcome === 'LOSS' ? 'dialog' : undefined}
                      aria-modal={battleResult?.outcome === 'LOSS' ? true : undefined}
                      aria-label={battleResult?.outcome === 'LOSS' ? 'You died' : undefined}
                    >
                      <div className={battleResult?.outcome === 'LOSS' ? 'w-full max-w-xl max-h-full overflow-y-auto' : ''}>
                      <BattlePanel
                        battle={battle}
                        battleResult={battleResult}
                        onAttack={() => socketHandlers.sendGameAction({ type: 'player_attack' })}
                        onFlee={handleFlee}
                        fleeNeedsConfirm={escapeWarning !== null}
                        onUseItem={(itemId, action) => socketHandlers.sendGameAction({ type: 'use_item', data: { playerItemId: itemId, action } })}
                        onCastSpell={(spellId) => socketHandlers.sendGameAction({ type: 'cast_spell', data: { spellId } })}
                        onUseSkill={(skillId) => socketHandlers.sendGameAction({ type: 'use_skill', data: { skillId } })}
                        player={player}
                        travel={
                          unlocks.open.has('tab:world')
                            ? { currentRoomId: currentRoom?.roomId, onTeleport: handleTeleport, teleportBlockedReason: teleportBlockedReason ?? null }
                            : null
                        }
                        levelUp={
                          levelUpInVictory && levelUpData
                            ? { data: levelUpData, toSpend: (player.cp ?? 0) + (player.tp ?? 0), onSpend: openCharPoints }
                            : null
                        }
                        onDismissResult={() => {
                          // Death: pressing Rise is the respawn move itself. The
                          // teleport dismisses the card on its way out, and the
                          // server wakes the player to 1 HP on arrival.
                          if (battleResult?.outcome === 'LOSS') {
                            handleAction({ type: 'teleport', data: { toRoomId: respawnRoomRef.current ?? RESPAWN_ROOM_ID } })
                            return
                          }
                          // The band on the card has said the level. With Training
                          // Points still unspent the full level-up card takes over
                          // once this one is gone; otherwise one Continue clears both.
                          if (levelUpInVictory && (player.tp ?? 0) <= 0) setLevelUpData(null)
                          clearBattleResult()
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
                    </div>
                  )}
                  <RoomBox
                    room={currentRoom}
                    roomPlayers={roomPlayers}
                    currentPlayerId={player.id}
                    onAction={handleAction}
                    isPartyMember={isPartyMember}
                    onOpenPlayerProfile={handleOpenPlayerProfile}
                    party={party}
                    pendingFollowIds={pendingFollowIds}
                    onFollow={handleFollowPlayer}
                    gatherCooldowns={gatherCooldowns}
                    supplies={supplies}
                    worldTick={worldTick}
                    actionResult={actionResult}
                    isLoadingRoom={isLoadingRoom}
                    currentAction={action}
                    roomEnemy={roomEnemy}
                    isInBattle={battle.isInBattle}
                    quests={quests}
                    killList={killList}
                  />
                </div>
              </div>

              {/* D-pad — mobile/tablet only (< lg). Crafting is a sheet over the
                  whole screen, so it hides this; a battle no longer does. The
                  strip carries the Teleport control, which is how a fight is
                  escaped, and hiding it left phones with no way out but the
                  Retreat pill. */}
              <div className={`lg:hidden flex-shrink-0 flex flex-col border-t border-line-subtle/30 ${isCraftingOpen ? 'hidden' : ''}`}>
                {/* In a fight the D-pad collapses to this bar. It names what is
                    behind it rather than saying "expand", because the reason to
                    open it mid-fight is almost always the Teleport button. */}
                {battle.isInBattle && (
                  <button
                    type="button"
                    onClick={() => setIsBattleDpadOpen((open) => !open)}
                    aria-expanded={isBattleDpadOpen}
                    className="flex items-center justify-center gap-1.5 w-full py-2 text-[11px] font-semibold uppercase tracking-widest text-fg-muted bg-surface-canvas/60 hover:text-fg-primary transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                  >
                    {isBattleDpadOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronUp size={13} aria-hidden="true" />}
                    {isBattleDpadOpen ? 'Hide compass' : 'Compass & teleport'}
                  </button>
                )}
                {(!battle.isInBattle || isBattleDpadOpen) && (
                <ExplorePanel
                  variant="strip"
                  room={currentRoom}
                  onAction={handleAction}
                  player={player}
                  inventory={inventory}
                  trackedQuests={trackedQuests}
                  onOpenTrackedQuest={() => openTab('quests')}
                  actionUnlocked={unlocks.open.has('explore:action')}
                  actionFresh={unlocks.fresh.has('explore:action')}
                  isPartyMember={isPartyMember}
                  actionOpen={actionOpen}
                  enemyHere={enemyHere}
                  onToggleAction={toggleAction}
                  onOpenMap={unlocks.open.has('tab:world') ? openMap : undefined}
                  isMoveInProgress={isMoveInProgress}
                  isLoadingRoom={isLoadingRoom}
                  currentAction={action}
                  actionResult={actionResult}
                />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Feed panel — desktop only */}
        {isFeedPanelOpen && (
          <div
            className="relative hidden lg:flex flex-col flex-shrink-0 border-l border-line-subtle/30 bg-surface-panel/95 min-h-0 overflow-hidden"
            style={{ width: feedPanel.width }}
          >
            <PanelResizeHandle edge="left" isDragging={feedPanel.isDragging} handleProps={feedPanel.handleProps} />
            <div className="flex items-center justify-between px-3 py-2 border-b border-line-subtle/30">
              <span className="text-sm font-medium text-fg-primary">World Feed</span>
              <button
                type="button"
                onClick={() => setIsFeedPanelOpen(false)}
                className="p-1.5 text-fg-secondary hover:text-fg-bright transition-colors duration-200 rounded-lg hover:bg-surface-raised/50"
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

      {/* Phone: the tab bar across the bottom — five tabs and More. */}
      <div className="lg:hidden flex-shrink-0 border-t border-line-subtle/40 bg-surface-panel/95 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
        <TabBar variant="phone" active={activeTab} onSelect={selectTab} badges={tabBadges} hidden={hiddenTabSet} fresh={freshTabSet} />
      </div>
    </div>
  )
}
