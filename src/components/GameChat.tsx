'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '@/lib/game-state'
import { inputStyles } from '@/lib/styles'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import { escapeHtml } from '@/lib/sanitization'
import Icon from './Icon'

interface ChatMessage {
  id: string
  username: string
  message: string
  timestamp: Date
  level: number
}

interface GameChatProps {
  onClose?: () => void
  onNewMessage?: () => void
}

export default function GameChat({ onClose, onNewMessage }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const hasAutoScrolledRef = useRef(false)
  const hasLoadedHistoryRef = useRef(false)
  const previousConnectionRef = useRef(false)
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
    (incoming: ChatMessage[]): boolean => {
      if (incoming.length === 0) return false

      let added = false
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>()
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

  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/messages', {
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        const data = await response.json()
        const formattedMessages: ChatMessage[] = (data.messages || []).map((msg: any) => ({
          id: msg.id,
          username: msg.username,
          message: msg.message,
          timestamp: new Date(msg.timestamp),
          level: msg.level,
        }))

        mergeMessages(formattedMessages)
        hasLoadedHistoryRef.current = true
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }, [getAuthHeaders, mergeMessages])

  useEffect(() => {
    if (!player?.id) return
    if (hasLoadedHistoryRef.current) return

    loadMessages()
  }, [player?.id, loadMessages])

  useEffect(() => {
    if (!socket || !player) return

    const cleanupFacts = socketHandlers.onGameFacts(({ facts }) => {
      const chatMessages: ChatMessage[] = facts
        .filter((fact) => fact.type === 'chat')
        .map((fact) => ({
          id: `${fact.tickId}-${fact.seq}`,
          username: fact.data.username || 'Unknown',
          message: fact.data.message || '',
          timestamp: new Date(fact.timestamp || Date.now()),
          level: fact.data.level ?? 0,
        }))

      if (chatMessages.length === 0) return

      const added = mergeMessages(chatMessages)
      if (added && onNewMessage) {
        onNewMessage()
      }
    })

    return () => {
      cleanupFacts()
    }
  }, [socket, player?.id, socketHandlers, mergeMessages, onNewMessage])

  useEffect(() => {
    if (!player?.id) {
      previousConnectionRef.current = false
      return
    }

    if (isConnected && !previousConnectionRef.current && hasLoadedHistoryRef.current) {
      loadMessages()
    }

    previousConnectionRef.current = isConnected
  }, [isConnected, player?.id, loadMessages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const messageToSend = newMessage.trim()
    setNewMessage('') // Clear input immediately for better UX

    try {
      // Send message via Socket.io for real-time delivery (if connected)
      if (socketHandlers.isConnected) {
        socketHandlers.sendChatMessage(messageToSend)
      }
      
      // Always save to database via API
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ message: messageToSend }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Failed to send message:', errorData)
        // Optionally show error to user
        return
      }

      // If Socket.io is not connected, reload messages to show the new one
      if (!socket || !isConnected) {
        loadMessages()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Connection Status */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="w-full flex-1 flex items-center justify-between">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-gray-200">World Chat</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-sm text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-sm text-center">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="text-sm">
              <span className="text-gray-500 text-xs">
                {message.timestamp.toLocaleTimeString()}
              </span>
              <span className={`ml-2 font-semibold ${getLevelColor(message.level)}`}>
                [{message.level}] {escapeHtml(message.username)}:
              </span>
              <span className="ml-2 text-gray-300">{escapeHtml(message.message)}</span>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-700 flex-shrink-0">
        <div className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
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
