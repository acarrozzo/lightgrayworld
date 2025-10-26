'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@/lib/socket'

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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.close()
      socketRef.current = null
    }
  }, [])

  const createSocket = useCallback(() => {
    cleanup()
    
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    })

    socketInstance.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
      setConnectionError(null)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
      setConnectionError(error.message)
    })

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to server after', attemptNumber, 'attempts')
      setIsConnected(true)
      setConnectionError(null)
    })

    socketInstance.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error)
      setConnectionError(error.message)
    })

    socketInstance.on('reconnect_failed', () => {
      console.error('Failed to reconnect to server')
      setConnectionError('Failed to reconnect to server')
    })

    socketRef.current = socketInstance
    setSocket(socketInstance)
  }, [cleanup])

  const reconnect = useCallback(() => {
    console.log('Manual reconnect triggered')
    setConnectionError(null)
    createSocket()
  }, [createSocket])

  useEffect(() => {
    // Add a small delay to ensure the server is ready
    const timer = setTimeout(() => {
      createSocket()
    }, 100)

    return () => {
      clearTimeout(timer)
      cleanup()
    }
  }, [createSocket, cleanup])

  return { socket, isConnected, connectionError, reconnect }
}
