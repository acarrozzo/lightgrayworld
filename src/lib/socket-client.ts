import { io, Socket } from 'socket.io-client'
import { useGameStore } from './game-state'

let globalSocket: Socket | null = null
const connectionListeners = new Set<(connected: boolean) => void>()

export function getOrCreateSocket(): Socket {
  if (!globalSocket) {
    console.log('[SocketClient] Creating global socket instance')
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000'
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'
    const token = useGameStore.getState().token

    globalSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      path: socketPath,
      auth: token ? { token } : undefined,
    })

    globalSocket.on('connect', () => {
      console.log('[SocketClient] Connected with ID:', globalSocket?.id)
      connectionListeners.forEach((listener) => listener(true))
    })

    globalSocket.on('disconnect', (reason) => {
      console.log('[SocketClient] Disconnected from server:', reason)
      connectionListeners.forEach((listener) => listener(false))
    })

    globalSocket.on('connect_error', (error) => {
      console.error('[SocketClient] Connection error:', error)
      connectionListeners.forEach((listener) => listener(false))
    })
  }

  return globalSocket
}

export function subscribeToConnection(callback: (connected: boolean) => void) {
  connectionListeners.add(callback)

  if (globalSocket?.connected) {
    callback(true)
  }

  return () => {
    connectionListeners.delete(callback)
  }
}

export function getSocket(): Socket | null {
  return globalSocket
}
