import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RoomView, RoomItemView } from '@/lib/types/room'
import { EquipSlot } from '@prisma/client'

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
  grassyFieldMap?: boolean
  grassyFieldUndergroundMap?: boolean
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
    maxStack: number
    maxPerPlayer?: number | null
    value: number
    canSell?: boolean
    canDrop?: boolean
    equipSlot?: EquipSlot | null
    metadata?: { icon?: string; statMods?: { str?: number; dex?: number; mag?: number; def?: number } } | null
  }
}

export interface CapCacheEntry {
  remaining: number
  capPerTick: number
  tickId: number
  lastUpdated: number
  status: 'known' | 'loading' | 'error'
}

export interface BattleState {
  isInBattle: boolean
  enemySlug: string | null
  enemyName: string | null
  enemyCurrentHp: number
  enemyMaxHp: number
  turnCount: number
  canFlee: boolean
  playerHp: number
  playerHpMax: number
  lastPlayerDamage: number | null
  lastEnemyDamage: number | null
  multiplayerBonus: boolean
  bonusPercent: number
}

const INITIAL_BATTLE_STATE: BattleState = {
  isInBattle: false,
  enemySlug: null,
  enemyName: null,
  enemyCurrentHp: 0,
  enemyMaxHp: 0,
  turnCount: 0,
  canFlee: false,
  playerHp: 0,
  playerHpMax: 0,
  lastPlayerDamage: null,
  lastEnemyDamage: null,
  multiplayerBonus: false,
  bonusPercent: 0,
}

export interface GameState {
  // Player state
  player: Player | null
  isLoggedIn: boolean
  token: string | null
  inventory: InventoryItem[]

  // Room state
  currentRoom: Room | null
  roomPlayers: Player[]
  roomCache: Record<string, Room>
  roomFactSeq: Record<string, number>

  // Cap cache: key is `${roomId}:${actionKey}` -> CapCacheEntry
  capCache: Record<string, CapCacheEntry>

  // Battle state
  battle: BattleState

  // UI state
  isLoading: boolean
  error: string | null

  // Actions
  setPlayer: (player: Player | null) => void
  setInventory: (inventory: InventoryItem[]) => void
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
  updateCapCache: (roomId: string, actionKey: string, entry: Partial<CapCacheEntry>) => void
  getCapCache: (roomId: string, actionKey: string) => CapCacheEntry | null
  clearCapCache: (roomId?: string) => void
  setBattleStarted: (payload: { enemySlug: string; enemyName: string; enemyCurrentHp: number; enemyMaxHp: number; turnCount: number; canFlee: boolean; playerHp: number; playerHpMax: number }) => void
  updateBattleTurn: (payload: { enemyCurrentHp: number; enemyMaxHp: number; turnCount: number; canFlee: boolean; playerHp: number; playerHpMax: number; playerDealtDamage: number; enemyDealtDamage: number; multiplayerBonus: boolean; bonusPercent: number }) => void
  clearBattle: () => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Initial state
      player: null,
      isLoggedIn: false,
      token: null,
      inventory: [],
      currentRoom: null,
      roomPlayers: [],
      roomCache: {},
      roomFactSeq: {},
      capCache: {},
      battle: { ...INITIAL_BATTLE_STATE },
      isLoading: false,
      error: null,
      
      // Actions
      setPlayer: (player) => set({ player }),
      setInventory: (inventory) => set({ inventory }),
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
        capCache: {},
        battle: { ...INITIAL_BATTLE_STATE },
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

      updateCapCache: (roomId, actionKey, entry) => {
        const key = `${roomId}:${actionKey}`
        set((state) => {
          const existing = state.capCache[key]
          return {
            capCache: {
              ...state.capCache,
              [key]: {
                ...existing,
                ...entry,
                lastUpdated: Date.now(),
              } as CapCacheEntry,
            },
          }
        })
      },

      getCapCache: (roomId, actionKey) => {
        const { capCache } = get()
        const key = `${roomId}:${actionKey}`
        return capCache[key] || null
      },

      setBattleStarted: (payload) =>
        set((state) => ({
          battle: {
            ...INITIAL_BATTLE_STATE,
            isInBattle: true,
            enemySlug: payload.enemySlug,
            enemyName: payload.enemyName,
            enemyCurrentHp: payload.enemyCurrentHp,
            enemyMaxHp: payload.enemyMaxHp,
            turnCount: payload.turnCount,
            canFlee: payload.canFlee,
            playerHp: payload.playerHp,
            playerHpMax: payload.playerHpMax,
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
            lastPlayerDamage: payload.playerDealtDamage,
            lastEnemyDamage: payload.enemyDealtDamage,
            multiplayerBonus: payload.multiplayerBonus,
            bonusPercent: payload.bonusPercent,
          },
          player: state.player ? { ...state.player, hp: payload.playerHp } : state.player,
        })),

      clearBattle: () =>
        set({ battle: { ...INITIAL_BATTLE_STATE } }),

      clearCapCache: (roomId) => {
        if (roomId) {
          // Clear all caps for a specific room
          set((state) => {
            const newCache: Record<string, CapCacheEntry> = {}
            for (const [key, entry] of Object.entries(state.capCache)) {
              if (!key.startsWith(`${roomId}:`)) {
                newCache[key] = entry
              }
            }
            return { capCache: newCache }
          })
        } else {
          // Clear all caps
          set({ capCache: {} })
        }
      },
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
