import { Server } from 'socket.io'

// Socket event types
export interface SocketEvents {
  // Client to server events
  'player-login': (playerData: PlayerData) => void
  'send-chat-message': (data: { message: string }) => void
  'game-action': (data: { action: string }) => void
  
  // Server to client events
  'player-joined': (player: PlayerInfo) => void
  'player-left': (player: { id: string; username: string }) => void
  'chat-message': (message: ChatMessage) => void
  'action-completed': (actionData: ActionData) => void
  'player-action': (actionData: PlayerAction) => void
  'game:facts': (payload: { tickId: number; facts: GameFact[] }) => void
}

// Data type definitions
export interface PlayerData {
  id: string
  username: string
  level: number
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  currentRoom: string
}

export interface PlayerInfo {
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

export interface ChatMessage {
  id: string
  userId: string
  username: string
  message: string
  timestamp: Date
  level: number
  roomId: string
}

export interface ActionData {
  id: string
  action: string
  message: string
  timestamp: Date
  roomId: string
  metadata?: string
  playerId: string
  playerName: string
}

export interface PlayerAction {
  playerId: string
  username: string
  action: string
  timestamp: Date
}

export interface GameFact {
  seq: number
  tickId: number
  type: string
  data: Record<string, any>
  affectedPlayers: string[]
  timestamp?: number
}

// Socket event constants
export const SOCKET_EVENTS = {
  // Client to server
  PLAYER_LOGIN: 'player-login',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  GAME_ACTION: 'game-action',
  
  // Server to client
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  CHAT_MESSAGE: 'chat-message',
  ACTION_COMPLETED: 'action-completed',
  PLAYER_ACTION: 'player-action',
  GAME_FACTS: 'game:facts',
} as const

let io: Server<SocketEvents> | null = null

export function setSocketIO(ioInstance: Server<SocketEvents>) {
  io = ioInstance
}

export function getSocketIO(): Server<SocketEvents> | null {
  return io
}

// Helper function to emit socket events with error handling
export function emitToRoom(roomId: string, event: keyof SocketEvents, data: any) {
  if (!io) {
    console.warn('Socket.io not initialized, cannot emit event:', event)
    return false
  }
  
  try {
    io.to(`room-${roomId}`).emit(event, data)
    return true
  } catch (error) {
    console.error('Failed to emit socket event:', error)
    return false
  }
}
