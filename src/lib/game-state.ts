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
  uIcon?: string
  uIconColor?: string
  grassyFieldMap?: boolean
  grassyFieldUndergroundMap?: boolean
  roomZeroMap?: boolean
  lobbyMap?: boolean
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
    metadata?: { icon?: string } | null
  }
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
