import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RoomView, RoomItemView } from '@/lib/types/room'
import { EquipSlot, WeaponCategory } from '@prisma/client'
import { PartySnapshot } from '@/lib/socket'

export interface Player {
  id: string
  username: string
  level: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  currentRoom: string
  isActive: boolean
  xp?: number
  cp?: number
  tp?: number
  sp?: number
  currency?: number
  physicalTraining?: number
  mentalTraining?: number
  str?: number
  dex?: number
  mag?: number
  def?: number
  strMod?: number
  dexMod?: number
  magMod?: number
  defMod?: number
  uIcon?: string
  uIconColor?: string
  presenceStatus?: 'active' | 'idle' | 'disconnected'
  /** True while this player is in an active battle (mirrors the server `inFight` flag). */
  inBattle?: boolean
  /** Leader id of the party this player belongs to (self if they lead); null/undefined = solo. */
  partyLeaderId?: string | null
  lastSeen?: number
  clicks?: number
  /**
   * Click-counted buff countdowns, keyed by the User column that stores them
   * (`wings`, `gills`, `buffStrClicks`, ...). Pushed on every counted action by
   * `player:clicks-update`; a value of 0 (or an absent key) means inactive.
   */
  buffs?: Record<string, number>
  deaths?: number
  chest1?: boolean
  grassyFieldMap?: boolean
  grassyFieldUndergroundMap?: boolean
  forestUndergroundMap?: boolean
  redTownMap?: boolean
  redTownSewersMap?: boolean
  roomZeroMap?: boolean
  lobbyMap?: boolean
  solarOfficeMap?: boolean
}

export type Room = RoomView

export interface InventoryItem {
  id: string
  quantity: number
  isEquipped: boolean
  slot?: string | null
  template: {
    id: string
    slug: string
    name: string
    type: string
    description: string
    max: number
    value: number
    canSell?: boolean
    canDrop?: boolean
    equipSlot?: EquipSlot | null
    weaponCategory?: WeaponCategory | null
    metadata?: { icon?: string; statMods?: { str?: number; dex?: number; mag?: number; def?: number } } | null
  }
}

export interface BattleActionMeta {
  kind: 'use_item' | 'equip_item' | 'unequip_item'
  itemSlug: string
  itemName: string
  itemMetadata: { icon?: string } | null
  actionVerb: string
  effectText: string | null
}

export interface BattleState {
  isInBattle: boolean
  isAdvantageTurn: boolean
  enemySlug: string | null
  enemyName: string | null
  enemyIcon: string | null
  enemyLevel: number | null
  enemyAtt: number | null
  enemyDef: number | null
  enemyCurrentHp: number
  enemyMaxHp: number
  turnCount: number
  canFlee: boolean
  playerHp: number
  playerHpMax: number
  playerStrMax: number | null
  playerDefMax: number | null
  lastPlayerDamage: number | null
  lastEnemyDamage: number | null
  playerRaw: number | null
  enemyRaw: number | null
  enemyStrMax: number | null
  playerBlocked: number | null
  enemyBlocked: number | null
  multiplayerBonus: boolean
  bonusPercent: number
  missedFlyingMelee: boolean
  weaponCategory: 'MELEE' | 'RANGED' | null
  enemyDamageType: 'MELEE' | 'RANGED' | 'MAGIC' | null
  /** Ammo left after the last shot, for weapons that spend it (bows, crossbow). */
  ammo: { slug: string; remaining: number | null } | null
  actionMeta: BattleActionMeta | null
}

const INITIAL_BATTLE_STATE: BattleState = {
  isInBattle: false,
  isAdvantageTurn: false,
  enemySlug: null,
  enemyName: null,
  enemyIcon: null,
  enemyLevel: null,
  enemyAtt: null,
  enemyDef: null,
  enemyCurrentHp: 0,
  enemyMaxHp: 0,
  turnCount: 0,
  canFlee: false,
  playerHp: 0,
  playerHpMax: 0,
  playerStrMax: null,
  playerDefMax: null,
  lastPlayerDamage: null,
  lastEnemyDamage: null,
  playerRaw: null,
  enemyRaw: null,
  enemyStrMax: null,
  playerBlocked: null,
  enemyBlocked: null,
  multiplayerBonus: false,
  bonusPercent: 0,
  missedFlyingMelee: false,
  ammo: null,
  weaponCategory: null,
  enemyDamageType: null,
  actionMeta: null,
}

export interface BattleLastTurn {
  playerDealtDamage: number
  enemyDealtDamage: number
  playerRaw: number | null
  enemyRaw: number
  playerBlocked: number
  enemyBlocked: number
  playerStrMax: number
  playerDefMax: number
  enemyStrMax: number
  multiplayerBonus: boolean
  bonusPercent: number
  missedFlyingMelee?: boolean
  weaponCategory?: 'MELEE' | 'RANGED' | null
  enemyDamageType?: 'MELEE' | 'RANGED' | 'MAGIC' | null
}

export interface BattleResult {
  outcome: 'WIN' | 'LOSS'
  enemyName: string
  enemyIcon: string
  enemySlug: string
  turnsCount: number
  totalDamageDealt: number
  totalDamageReceived: number
  maxSingleHit: number
  xpEarned: number
  goldEarned: number
  itemsDropped: string[]
  dropDetails?: BattleDropDetail[]
  multiplayerBonus: boolean
  lastTurn: BattleLastTurn | null
}

export interface BattleDropDetail {
  slug: string
  qty: number
  firstKill: boolean
}

export interface KillEntry {
  monster: string
  kills: number
}

export interface GameState {
  // Player state
  player: Player | null
  isLoggedIn: boolean
  token: string | null
  inventory: InventoryItem[]
  killList: KillEntry[]

  // Room state
  currentRoom: Room | null
  roomPlayers: Player[]
  roomCache: Record<string, Room>
  roomFactSeq: Record<string, number>

  // Battle state
  battle: BattleState

  // Party state (ephemeral; null when not in a party)
  party: PartySnapshot | null

  // Post-battle result (shown after battle ends, null when dismissed)
  battleResult: BattleResult | null

  // UI state
  isLoading: boolean
  error: string | null

  // Actions
  setPlayer: (player: Player | null) => void
  setInventory: (inventory: InventoryItem[]) => void
  setKillList: (kills: KillEntry[]) => void
  incrementKill: (monster: string) => void
  setCurrentRoom: (room: Room | null) => void
  setRoomPlayers: (players: Player[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (player: Player, token: string) => void
  logout: () => void
  getAuthHeaders: () => Record<string, string>
  cacheRoom: (room: Room) => void
  getCachedRoom: (roomId: string) => Room | null
  setRoomFactSeq: (roomId: string, seq: number) => void
  getRoomFactSeq: (roomId: string) => number
  updateRoomItems: (roomId: string, items: RoomItemView[]) => void
  setBattleStarted: (payload: { isAdvantageTurn: boolean; enemySlug: string; enemyName: string; enemyIcon: string; enemyLevel: number; enemyAtt: number; enemyDef: number; enemyCurrentHp: number; enemyMaxHp: number; turnCount: number; canFlee: boolean; playerHp: number; playerHpMax: number; playerStr: number; playerDef: number }) => void
  updateBattleTurn: (payload: { enemyCurrentHp: number; enemyMaxHp: number; turnCount: number; canFlee: boolean; playerHp: number; playerHpMax: number; playerDealtDamage: number; enemyDealtDamage: number; playerRaw: number | null; enemyRaw: number; playerStrMax: number | null; playerDefMax: number; enemyStrMax: number; playerBlocked: number; enemyBlocked: number; multiplayerBonus: boolean; bonusPercent: number; missedFlyingMelee?: boolean; weaponCategory?: 'MELEE' | 'RANGED' | null; enemyDamageType?: 'MELEE' | 'RANGED' | 'MAGIC' | null; ammo?: { slug: string; remaining: number | null } | null; actionMeta?: BattleActionMeta | null }) => void
  clearBattle: () => void
  setBattleResult: (result: BattleResult) => void
  clearBattleResult: () => void
  setParty: (party: PartySnapshot | null) => void
  clearParty: () => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Initial state
      player: null,
      isLoggedIn: false,
      token: null,
      inventory: [],
      killList: [],
      currentRoom: null,
      roomPlayers: [],
      roomCache: {},
      roomFactSeq: {},
      battle: { ...INITIAL_BATTLE_STATE },
      party: null,
      battleResult: null,
      isLoading: false,
      error: null,
      
      // Actions
      setPlayer: (player) => set({ player }),
      setInventory: (inventory) => set({ inventory }),
      setKillList: (killList) => set({ killList }),
      incrementKill: (monster) =>
        set((state) => {
          const existing = state.killList.find((k) => k.monster === monster)
          if (existing) {
            return { killList: state.killList.map((k) => k.monster === monster ? { ...k, kills: k.kills + 1 } : k) }
          }
          return { killList: [...state.killList, { monster, kills: 1 }] }
        }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
      setRoomPlayers: (roomPlayers) => set({ roomPlayers }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      updateRoomItems: (roomId, items) =>
        set((state) => {
          const cachedRoom = state.roomCache[roomId]
          const nextCache = cachedRoom
            ? {
                ...state.roomCache,
                [roomId]: { ...cachedRoom, items },
              }
            : state.roomCache

          const isCurrent = state.currentRoom?.roomId === roomId

          return {
            ...state,
            roomCache: nextCache,
            currentRoom: isCurrent && state.currentRoom
              ? { ...state.currentRoom, items }
              : state.currentRoom,
          }
        }),
      
      login: (player, token) => set({ 
        player, 
        token,
        isLoggedIn: true,
        error: null 
      }),
      
      logout: () => set({
        player: null,
        token: null,
        isLoggedIn: false,
        inventory: [],
        currentRoom: null,
        roomPlayers: [],
        roomCache: {},
        battle: { ...INITIAL_BATTLE_STATE },
        party: null,
        battleResult: null,
        error: null
      }),

      getAuthHeaders: () => {
        const { token } = get()
        return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
      },
      
      cacheRoom: (room) => {
        const { roomCache } = get()
        console.log('Caching room:', room.name, 'ID:', room.roomId)
        set({ 
          roomCache: { 
            ...roomCache, 
            [room.roomId]: room 
          } 
        })
      },
      
      getCachedRoom: (roomId) => {
        const { roomCache } = get()
        const cached = roomCache[roomId]
        console.log('Getting cached room for ID:', roomId, 'Found:', cached ? cached.name : 'None')
        return cached || null
      },

      setRoomFactSeq: (roomId, seq) => {
        set((state) => ({
          roomFactSeq: {
            ...state.roomFactSeq,
            [roomId]: Math.max(state.roomFactSeq[roomId] || 0, seq),
          },
        }))
      },

      getRoomFactSeq: (roomId) => {
        const { roomFactSeq } = get()
        return roomFactSeq[roomId] || 0
      },

      setBattleStarted: (payload) =>
        set((state) => ({
          battle: {
            ...INITIAL_BATTLE_STATE,
            isInBattle: true,
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
            playerStrMax: payload.playerStr,
            playerDefMax: payload.playerDef,
          },
          player: state.player ? { ...state.player, hp: payload.playerHp, hpMax: payload.playerHpMax } : state.player,
        })),

      updateBattleTurn: (payload) =>
        set((state) => ({
          battle: {
            ...state.battle,
            enemyCurrentHp: payload.enemyCurrentHp,
            enemyMaxHp: payload.enemyMaxHp,
            turnCount: payload.turnCount,
            canFlee: payload.canFlee,
            playerHp: payload.playerHp,
            playerHpMax: payload.playerHpMax,
            playerStrMax: payload.playerStrMax,
            playerDefMax: payload.playerDefMax,
            lastPlayerDamage: payload.playerDealtDamage,
            lastEnemyDamage: payload.enemyDealtDamage,
            playerRaw: payload.playerRaw,
            enemyRaw: payload.enemyRaw,
            enemyStrMax: payload.enemyStrMax,
            playerBlocked: payload.playerBlocked,
            enemyBlocked: payload.enemyBlocked,
            multiplayerBonus: payload.multiplayerBonus,
            bonusPercent: payload.bonusPercent,
            missedFlyingMelee: payload.missedFlyingMelee ?? false,
            weaponCategory: payload.weaponCategory ?? null,
            enemyDamageType: payload.enemyDamageType ?? null,
            ammo: payload.ammo ?? null,
            actionMeta: payload.actionMeta ?? null,
          },
          player: state.player ? { ...state.player, hp: payload.playerHp } : state.player,
        })),

      clearBattle: () =>
        set({ battle: { ...INITIAL_BATTLE_STATE } }),

      setBattleResult: (result) => set({ battleResult: result }),

      clearBattleResult: () => set({ battleResult: null }),

      setParty: (party) => set({ party }),

      clearParty: () => set({ party: null }),
    }),
    {
      name: 'game-storage', // unique name for localStorage key
      // Only persist essential data, not UI state
      partialize: (state) => ({
        player: state.player,
        isLoggedIn: state.isLoggedIn,
        token: state.token,
        // Don't persist currentRoom - always load fresh from API
      }),
    }
  )
)
