import { useMemo } from 'react'
import { Socket } from 'socket.io-client'
import {
  SOCKET_EVENTS,
  ChatMessage,
  ActionData,
  ActionConfirmation,
  ActionFeedbackPayload,
  WorldTickPayload,
  RoomPlayerMovedPayload,
  WorldActivityPayload,
  DirectMessagePayload,
} from './socket'

// Centralized socket event handlers to reduce duplication
export class SocketEventHandlers {
  private socket: Socket | null = null
  private eventListeners: Map<string, ((...args: any[]) => void)[]> = new Map()

  constructor(socket: Socket | null) {
    this.socket = socket
  }

  // Generic event listener registration with cleanup tracking
  on<T = any>(event: string, handler: (data: T) => void): () => void {
    if (!this.socket) {
      console.warn('Socket not available for event:', event)
      return () => {}
    }


    // Track listeners for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(handler)

    this.socket.on(event, handler)

    // Return cleanup function
    return () => {
      this.socket?.off(event, handler)
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        const index = listeners.indexOf(handler)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  // Emit events with error handling
  private emit(event: (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS], data: any): boolean {
    if (!this.socket) {
      console.warn('[SocketHandlers] Socket not initialized, cannot emit event:', event)
      return false
    }

    try {
      console.log('[SocketHandlers] Emitting event:', event, 'data:', data)
      this.socket.emit(event, data)
      return true
    } catch (error) {
      console.error('[SocketHandlers] Failed to emit socket event:', error)
      return false
    }
  }

  // Player login (no payload - server derives identity from JWT)
  loginPlayer(): boolean {
    console.log('[SocketHandlers] loginPlayer called (payloadless), socket:', !!this.socket)
    const result = this.emit(SOCKET_EVENTS.PLAYER_LOGIN, {})
    console.log('[SocketHandlers] PLAYER_LOGIN emit result:', result)
    return result
  }

  logoutPlayer(): boolean {
    return this.emit(SOCKET_EVENTS.USER_LOGOUT, {})
  }

  // Send chat message
  sendChatMessage(message: string): boolean {
    return this.emit(SOCKET_EVENTS.SEND_CHAT_MESSAGE, { message })
  }

  // Send room chat message
  sendRoomChatMessage(message: string, roomId: string): boolean {
    return this.emit(SOCKET_EVENTS.SEND_ROOM_CHAT_MESSAGE, { message, roomId })
  }

  // Send game action (supports legacy string or structured object)
  sendGameAction(action: string | { type: string; data?: any }): boolean {
    if (typeof action === 'string') {
      return this.emit(SOCKET_EVENTS.GAME_ACTION, { action })
    }
    return this.emit(SOCKET_EVENTS.GAME_ACTION, { action })
  }

  // Listen for chat messages
  onChatMessage(handler: (message: ChatMessage) => void): () => void {
    return this.on(SOCKET_EVENTS.CHAT_MESSAGE, handler)
  }

  // Listen for room chat messages
  onRoomChatMessage(handler: (message: ChatMessage) => void): () => void {
    return this.on(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, handler)
  }

  // Listen for action completed events
  onActionCompleted(handler: (actionData: ActionData) => void): () => void {
    return this.on(SOCKET_EVENTS.ACTION_COMPLETED, handler)
  }

  // Listen for player joined events
  onPlayerJoined(handler: (player: any) => void): () => void {
    return this.on(SOCKET_EVENTS.PLAYER_JOINED, handler)
  }

  // Listen for player left events
  onPlayerLeft(handler: (player: any) => void): () => void {
    return this.on(SOCKET_EVENTS.PLAYER_LEFT, handler)
  }

  onActionFeedback(handler: (payload: ActionFeedbackPayload) => void): () => void {
    return this.on(SOCKET_EVENTS.ACTION_FEEDBACK, handler)
  }

  onLoginSuccess(handler: (payload: any) => void): () => void {
    return this.on('login:success', handler)
  }

  onActionConfirmed(handler: (payload: ActionConfirmation) => void): () => void {
    return this.on(SOCKET_EVENTS.ACTION_CONFIRMED, handler)
  }

  onRoomItemsUpdate(handler: (payload: { roomId: string; items: any[] }) => void): () => void {
    return this.on('room:items:update', handler)
  }

  onWorldTick(handler: (payload: WorldTickPayload) => void): () => void {
    return this.on(SOCKET_EVENTS.WORLD_TICK, handler)
  }

  onRoomPlayerMoved(handler: (payload: RoomPlayerMovedPayload) => void): () => void {
    return this.on(SOCKET_EVENTS.ROOM_PLAYER_MOVED, handler)
  }

  onWorldActivity(handler: (payload: WorldActivityPayload) => void): () => void {
    return this.on(SOCKET_EVENTS.WORLD_ACTIVITY, handler)
  }

  onDirectMessage(handler: (payload: DirectMessagePayload) => void): () => void {
    return this.on(SOCKET_EVENTS.DIRECT_MESSAGE, handler)
  }

  // Cleanup all listeners
  cleanup(): void {
    if (this.socket) {
      this.eventListeners.forEach((listeners, event) => {
        listeners.forEach(handler => {
          this.socket?.off(event, handler)
        })
      })
      this.eventListeners.clear()
    }
  }

  // Get connection status
  get isConnected(): boolean {
    return this.socket?.connected || false
  }
}

// Hook for using socket event handlers
export function useSocketHandlers(socket: Socket | null) {
  const handlers = useMemo(() => new SocketEventHandlers(socket), [socket])

  return handlers
}
