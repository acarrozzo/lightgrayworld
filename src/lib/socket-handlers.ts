import { Socket } from 'socket.io-client'
import { SOCKET_EVENTS, PlayerData, ChatMessage, ActionData } from './socket'

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
  emit<T = any>(event: string, data: T): boolean {
    if (!this.socket) {
      console.warn('Socket not available for emit:', event)
      return false
    }

    try {
      this.socket.emit(event, data)
      return true
    } catch (error) {
      console.error('Failed to emit socket event:', error)
      return false
    }
  }

  // Player login
  loginPlayer(playerData: PlayerData): boolean {
    return this.emit(SOCKET_EVENTS.PLAYER_LOGIN, playerData)
  }

  // Send chat message
  sendChatMessage(message: string): boolean {
    return this.emit(SOCKET_EVENTS.SEND_CHAT_MESSAGE, { message })
  }

  // Send game action
  sendGameAction(action: string): boolean {
    return this.emit(SOCKET_EVENTS.GAME_ACTION, { action })
  }

  // Listen for chat messages
  onChatMessage(handler: (message: ChatMessage) => void): () => void {
    return this.on(SOCKET_EVENTS.CHAT_MESSAGE, handler)
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
  return new SocketEventHandlers(socket)
}
