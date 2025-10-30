import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
}

export interface Room {
  id: string
  roomId: string
  name: string
  description: string
  dangerLevel: number
  isSafe: boolean
  players: Player[]
  items?: any[]
  npcs?: any[]
  // Navigation directions
  north?: string
  northeast?: string
  east?: string
  southeast?: string
  south?: string
  southwest?: string
  west?: string
  northwest?: string
  up?: string
  down?: string
}

export interface GameState {
  // Player state
  player: Player | null
  isLoggedIn: boolean
  token: string | null
  
  // Room state
  currentRoom: Room | null
  roomPlayers: Player[]
  roomCache: Record<string, Room> // Cache for visited rooms
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Actions
  setPlayer: (player: Player | null) => void
  setCurrentRoom: (room: Room | null) => void
  setRoomPlayers: (players: Player[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (player: Player, token: string) => void
  logout: () => void
  getAuthHeaders: () => Record<string, string>
  cacheRoom: (room: Room) => void
  getCachedRoom: (roomId: string) => Room | null
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Initial state
      player: null,
      isLoggedIn: false,
      token: null,
      currentRoom: null,
      roomPlayers: [],
      roomCache: {},
      isLoading: false,
      error: null,
      
      // Actions
      setPlayer: (player) => set({ player }),
      setCurrentRoom: (currentRoom) => set({ currentRoom }),
      setRoomPlayers: (roomPlayers) => set({ roomPlayers }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
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
        currentRoom: null,
        roomPlayers: [],
        roomCache: {},
        error: null 
      }),

      getAuthHeaders: () => {
        const { token } = get()
        return token ? { Authorization: `Bearer ${token}` } : { Authorization: '' }
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
