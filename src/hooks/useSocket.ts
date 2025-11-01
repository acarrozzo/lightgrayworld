'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Socket, DisconnectReason } from 'socket.io-client'
import { getOrCreateSocket, subscribeToConnection, getSocket } from '@/lib/socket-client'

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  connectionError: string | null
  reconnect: () => void
}

export const useSocket = (): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    console.log('[useSocket] Initializing with global socket')
    const instance = getOrCreateSocket()
    setSocket(instance)
    setIsConnected(instance.connected)
    setConnectionError(instance.connected ? null : 'Socket disconnected')

    const unsubscribe = subscribeToConnection((connected) => {
      console.log('[useSocket] Connection state changed:', connected, 'socketId:', instance.id)
      setIsConnected(connected)
      if (connected) {
        setConnectionError(null)
      }
    })

    const handleDisconnect = (reason: DisconnectReason) => {
      console.log('[useSocket] Disconnected from server with reason:', reason)
      setIsConnected(false)
      if (reason !== 'io client disconnect') {
        setConnectionError(reason)
      }
    }

    const handleConnectError = (error: Error) => {
      console.error('[useSocket] Connection error:', error)
      setIsConnected(false)
      setConnectionError(error.message)
    }

    instance.on('disconnect', handleDisconnect)
    instance.on('connect_error', handleConnectError)

    return () => {
      console.log('[useSocket] Cleaning up global listeners for socket')
      unsubscribe()
      instance.off('disconnect', handleDisconnect)
      instance.off('connect_error', handleConnectError)
    }
    // connectionError intentionally omitted to avoid re-subscribing when message changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reconnect = useCallback(() => {
    console.log('[useSocket] Manual reconnect requested')
    setConnectionError(null)
    const instance = getSocket() || getOrCreateSocket()
    if (!instance.connected) {
      instance.connect()
    }
    setSocket(instance)
  }, [])

  return { socket, isConnected, connectionError, reconnect }
}
