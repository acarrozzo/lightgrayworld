import { Server } from 'socket.io'

// Socket event types
export type ActionFeedbackOutcome = 'success' | 'failure' | 'info'

export interface ActionFeedbackPayload {
  action: string
  message: string
  ts: number
  outcome: ActionFeedbackOutcome
  timestamp?: string
  success?: boolean
  data?: Record<string, any>
  eventType?: string
  roomId?: string
  actorId?: string
  actorName?: string
  actionId?: string
  meta?: Record<string, any>
}

export interface SocketEvents {
  // Client to server events
  'player-login': (data: Record<string, never>) => void
  'send-chat-message': (data: { message: string }) => void
  'send-room-chat-message': (data: { message: string; roomId: string }) => void
  'game-action': (data: { action: string }) => void
  'user:logout': () => void

  // Server to client events
  'player-joined': (player: PlayerInfo) => void
  'player-left': (player: { id: string; username: string; exitDirection?: string | null; isTeleport?: boolean }) => void
  'chat-message': (message: ChatMessage) => void
  'room-chat-message': (message: ChatMessage) => void
  'action-completed': (actionData: ActionData) => void
  'player-action': (actionData: PlayerAction) => void
  'action:confirmed': (payload: ActionConfirmation) => void
  'action:feedback': (payload: ActionFeedbackPayload) => void
  'world:tick': (payload: WorldTickPayload) => void
  'room:player-moved': (payload: RoomPlayerMovedPayload) => void
  'world:activity': (payload: WorldActivityPayload) => void
  'direct-message': (payload: DirectMessagePayload) => void
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
  uIcon?: string | null
  uIconColor?: string | null
  entryDirection?: string | null
  isTeleport?: boolean
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

export interface ActionConfirmation {
  action: string
  success: boolean
  data?: Record<string, any>
}

export interface RoomPlayerMovedPayload {
  playerId: string
  username: string
  fromRoom: string
  toRoom: string
}

export interface WorldActivityPayload {
  id: string
  ts: number
  type: 'world'
  level?: 'info' | 'error'
  actor?: string
  message: string
  eventType?: string
}

export interface DirectMessagePayload {
  id: string
  senderId: string
  senderUsername: string
  senderAvatar?: {
    uIcon?: string | null
    uIconColor?: string | null
  } | null
  recipientId: string
  recipientUsername: string
  message: string
  createdAt: string
  readAt?: string | null
}

export interface AmbientTickData {
  type: string
  message: string
  timestamp: number
}

export interface RoomTickUpdate {
  playerCount: number
  ambientData: AmbientTickData | null
}

export interface WorldTickPayload {
  tickId: number
  tickNumber: number
  timestamp: number
  nextTickAt: number
  tickIntervalMs: number
  roomId?: string
  update?: RoomTickUpdate
}

// Socket event constants
export const SOCKET_EVENTS = {
  // Client to server
  PLAYER_LOGIN: 'player-login',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  SEND_ROOM_CHAT_MESSAGE: 'send-room-chat-message',
  GAME_ACTION: 'game-action',
  USER_LOGOUT: 'user:logout',
  
  // Server to client
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  CHAT_MESSAGE: 'chat-message',
  ROOM_CHAT_MESSAGE: 'room-chat-message',
  ACTION_COMPLETED: 'action-completed',
  PLAYER_ACTION: 'player-action',
  ACTION_CONFIRMED: 'action:confirmed',
  ACTION_FEEDBACK: 'action:feedback',
  WORLD_TICK: 'world:tick',
  ROOM_PLAYER_MOVED: 'room:player-moved',
  WORLD_ACTIVITY: 'world:activity',
  DIRECT_MESSAGE: 'direct-message',
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
