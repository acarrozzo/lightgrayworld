'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '@/lib/game-state'
import { inputStyles } from '@/lib/styles'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { escapeHtml } from '@/lib/sanitization'
import { RoomPlayerMovedPayload } from '@/lib/socket'
import Icon from './Icon'
import type { Room } from '@/lib/game-state'

const DIRECTION_KEYS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
] as const

type DirectionKey = (typeof DIRECTION_KEYS)[number]

const findDirectionKey = (currentRoom: Room | null | undefined, targetRoomId?: string): DirectionKey | null => {
  if (!currentRoom || !targetRoomId) {
    return null
  }

  const roomDirections = currentRoom as Record<DirectionKey, string | undefined>

  for (const key of DIRECTION_KEYS) {
    if (roomDirections[key] === targetRoomId) {
      return key
    }
  }

  return null
}

const buildDirectionPhrase = (direction: DirectionKey | null, context: 'enter' | 'exit'): string => {
  if (!direction) {
    return 'an unknown direction'
  }

  if (direction === 'up') {
    return context === 'enter' ? 'above' : 'upward'
  }

  if (direction === 'down') {
    return context === 'enter' ? 'below' : 'downward'
  }

  return `the ${direction.replace(/_/g, ' ')}`
}

interface RoomChatMessage {
  id: string
  userId?: string
  username: string
  message: string
  timestamp: Date
  level: number
  type?: 'chat' | 'system'
}

interface RoomChatProps {
  room: Room | null
  onClose?: () => void
  onNewMessage?: () => void
}

export default function RoomChat({ room, onClose, onNewMessage }: RoomChatProps) {
  const [messages, setMessages] = useState<RoomChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const hasAutoScrolledRef = useRef(false)
  const hasLoadedHistoryRef = useRef(false)
  const previousConnectionRef = useRef(false)
  const previousRoomIdRef = useRef<string | null>(null)
  const { getAuthHeaders, player } = useGameStore()
  const { socket, isConnected, connectionError, reconnect } = useSocket()
  const socketHandlers = useSocketHandlers(socket)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = messagesContainerRef.current
    if (!container) return

    container.scrollTo({ top: container.scrollHeight, behavior })
  }, [])

  // Scroll behavior: instant on first load, smooth only when near bottom for new messages
  useEffect(() => {
    if (messages.length === 0) return

    const container = messagesContainerRef.current
    if (!container) return

    if (!hasAutoScrolledRef.current) {
      scrollToBottom('auto')
      hasAutoScrolledRef.current = true
      return
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    const isNearBottom = distanceFromBottom < 100

    if (isNearBottom) {
      scrollToBottom('smooth')
    }
  }, [messages.length, scrollToBottom])

  const mergeMessages = useCallback(
    (incoming: RoomChatMessage[]): boolean => {
      if (incoming.length === 0) return false

      let added = false
      setMessages((prev) => {
        const map = new Map<string, RoomChatMessage>()
        prev.forEach((message) => {
          map.set(message.id, message)
        })

        incoming.forEach((message) => {
          if (!map.has(message.id)) {
            added = true
          }
          map.set(message.id, message)
        })

        const next = Array.from(map.values()).sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        )

        if (next.length !== prev.length) {
          added = true
        }

        return next
      })

      return added
    },
    []
  )

  const loadMessages = useCallback(async (roomId: string) => {
    if (!roomId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/chat/room/messages?roomId=${encodeURIComponent(roomId)}`, {
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        const data = await response.json()
        const formattedMessages: RoomChatMessage[] = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          userId: msg.userId,
          username: msg.username,
          message: msg.message,
          timestamp: new Date(msg.timestamp),
          level: msg.level,
          type: (msg.type || 'chat') as 'chat' | 'system',
        }))

        mergeMessages(formattedMessages)
        hasLoadedHistoryRef.current = true
      }
    } catch (error) {
      console.error('Failed to load room chat messages:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeaders, mergeMessages])

  // Load messages when room changes
  useEffect(() => {
    if (!room?.roomId) return
    if (!player?.id) return

    // If room changed, reset and reload
    if (previousRoomIdRef.current !== room.roomId) {
      setMessages([])
      hasLoadedHistoryRef.current = false
      hasAutoScrolledRef.current = false
      setIsLoading(true)
      previousRoomIdRef.current = room.roomId
      loadMessages(room.roomId)
    } else if (!hasLoadedHistoryRef.current) {
      loadMessages(room.roomId)
    }
  }, [room?.roomId, player?.id, loadMessages])

  // Listen for room chat messages
  useEffect(() => {
    if (!socket || !player || !room?.roomId) return

    console.log('[RoomChat] Setting up room-chat-message listener for room:', room.roomId)

    const cleanupRoomChat = socketHandlers.onRoomChatMessage((message) => {
      // Only process messages for the current room
      if (message.roomId !== room.roomId) {
        return
      }

      console.log('[RoomChat] Received room-chat-message event:', message)
      const roomChatMessage: RoomChatMessage = {
        id: message.id || `${message.userId}-${Date.now()}`,
        username: message.username,
        message: message.message,
        timestamp: new Date(message.timestamp),
        level: message.level,
        type: 'chat',
      }

      console.log('[RoomChat] Processed room chat message:', roomChatMessage)
      const added = mergeMessages([roomChatMessage])
      console.log('[RoomChat] Message added to state:', added)
      if (added && onNewMessage) {
        onNewMessage()
      }
    })

    return () => {
      console.log('[RoomChat] Cleaning up room-chat-message listener')
      cleanupRoomChat()
    }
  }, [socket, player?.id, room?.roomId, socketHandlers, mergeMessages, onNewMessage])

  // Listen for player movement (entry/exit)
  useEffect(() => {
    if (!socket || !player || !room?.roomId) return

    console.log('[RoomChat] Setting up room:player-moved listener for room:', room.roomId)

    const cleanupRoomMove = socketHandlers.onRoomPlayerMoved((event: RoomPlayerMovedPayload) => {
      const isEnteringCurrentRoom = event.toRoom === room.roomId
      const isLeavingCurrentRoom = event.fromRoom === room.roomId

      if (!isEnteringCurrentRoom && !isLeavingCurrentRoom) {
        return
      }

      const directionRoomId = isEnteringCurrentRoom ? event.fromRoom : event.toRoom
      const direction = findDirectionKey(room, directionRoomId)
      const directionPhrase = buildDirectionPhrase(direction, isEnteringCurrentRoom ? 'enter' : 'exit')
      const isSelfMovement = event.playerId === player.id
      const displayName = isSelfMovement ? 'You' : event.username

      const systemMessage: RoomChatMessage = {
        id: `room-move-${event.playerId}-${Date.now()}`,
        userId: event.playerId,
        username: '',
        message: isEnteringCurrentRoom
          ? `${displayName} enter${isSelfMovement ? '' : 's'} from ${directionPhrase}`
          : `${displayName} exit${isSelfMovement ? '' : 's'} to ${directionPhrase}`,
        timestamp: new Date(),
        level: 0,
        type: 'system',
      }

      console.log('[RoomChat] Adding system message for player movement:', systemMessage)
      const added = mergeMessages([systemMessage])
      if (added && onNewMessage) {
        onNewMessage()
      }
    })

    return () => {
      console.log('[RoomChat] Cleaning up room:player-moved listener')
      cleanupRoomMove()
    }
  }, [socket, player?.id, room, socketHandlers, mergeMessages, onNewMessage])

  useEffect(() => {
    if (!player?.id) {
      previousConnectionRef.current = false
      return
    }

    if (isConnected && !previousConnectionRef.current && hasLoadedHistoryRef.current && room?.roomId) {
      loadMessages(room.roomId)
    }

    previousConnectionRef.current = isConnected
  }, [isConnected, player?.id, room?.roomId, loadMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !room?.roomId) return

    const messageToSend = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    try {
      // Send message via Socket.io for real-time delivery (if connected)
      // Socket handler already saves to database, so no need for API call
      if (socketHandlers.isConnected) {
        socketHandlers.sendRoomChatMessage(messageToSend, room.roomId)
        return // Socket handler saves to DB and broadcasts, so we're done
      }
      
      // If Socket.io is not connected, save to database via API
      const response = await fetch('/api/chat/room/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ message: messageToSend, roomId: room.roomId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to send room chat message:', errorData)
        // Optionally show error to user
        return
      }

      // Reload messages to show the new one when not using socket
      loadMessages(room.roomId)
    } catch (error) {
      console.error('Failed to send room chat message:', error)
      // Optionally show error to user
    }
  }

  const getLevelColor = (level: number) => {
    if (level >= 60) return 'text-yellow-300'
    if (level >= 50) return 'text-red-300'
    if (level >= 40) return 'text-orange-300'
    if (level >= 30) return 'text-purple-300'
    if (level >= 20) return 'text-blue-300'
    if (level >= 10) return 'text-green-300'
    return 'text-gray-300'
  }

  if (!room) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-2.5 bg-gray-900/50 border-b border-gray-800/50 flex-shrink-0">
          <span className="text-sm text-gray-300 font-medium">Room Chat</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-gray-500/80 text-sm text-center">
            No room selected
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Connection Status */}
      <div className="px-4 py-2.5 bg-gray-900/50 border-b border-gray-800/50 flex-shrink-0">
        <div className="w-full flex-1 flex items-center justify-between">
          <div className="flex-1 flex items-center gap-2.5">
            <span className="text-sm text-gray-300 font-medium">Room Chat</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
              title="Close"
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {isLoading && messages.length === 0 ? (
          <div className="text-gray-500/80 text-sm text-center py-8">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Loading messages...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-gray-500/80 text-sm text-center py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => {
            if (message.type === 'system') {
              // Replace username with "You" for system messages from the current player
              let displayMessage = message.message
              if (message.userId && player?.id && message.userId === player.id) {
                // For database-loaded messages, replace username in message text with "You"
                // For socket messages, the message already contains "You" when it's self-movement
                const username = message.username || player.username
                if (username && !displayMessage.startsWith('You ')) {
                  // Replace username at the start of the message with "You"
                  displayMessage = displayMessage.replace(
                    new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'),
                    'You '
                  )
                  // Fix verb conjugation: "You enters" -> "You enter", "You exits" -> "You exit"
                  displayMessage = displayMessage.replace(/\s+enters\s+/i, ' enter ')
                  displayMessage = displayMessage.replace(/\s+exits\s+/i, ' exit ')
                }
              }
              
              return (
                <div key={message.id} className="text-sm">
                  <span className="text-gray-500/70 text-xs">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="ml-2 italic text-gray-400/80">
                    {escapeHtml(displayMessage)}
                  </span>
                </div>
              )
            }

            return (
              <div key={message.id} className="text-sm">
                <span className="text-gray-500/70 text-xs">
                  {message.timestamp.toLocaleTimeString()}
                </span>
                <span className={`ml-2 font-medium ${getLevelColor(message.level)}`}>
                  [{message.level}] {escapeHtml(message.username)}:
                </span>
                <span className="ml-2 text-gray-300/90">{escapeHtml(message.message)}</span>
              </div>
            )
          })
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800/50 flex-shrink-0 bg-gray-900/30">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a room message..."
            className={inputStyles.chat}
          />
          <button
            type="submit"
            className={inputStyles.button.chat}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

