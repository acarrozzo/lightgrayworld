'use client'

import { useState, useEffect, useRef } from 'react'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { getAuthHeaders, player } = useGameStore()
  const { socket, isConnected, connectionError, reconnect } = useSocket()
  const socketHandlers = useSocketHandlers(socket)

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }

  // Only auto-scroll when new messages are added, not when messages array changes for other reasons
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages.length])

  useEffect(() => {
    if (!socket || !player) return
 
     // Listen for authoritative facts from the engine
     const cleanupFacts = socketHandlers.onGameFacts(({ facts }) => {
       facts
         .filter((fact) => fact.type === 'chat')
         .forEach((fact) => {
           const formattedMessage: ChatMessage = {
             id: `${fact.tickId}-${fact.seq}`,
             username: fact.data.username || 'Unknown',
             message: fact.data.message || '',
             timestamp: new Date(fact.timestamp || Date.now()),
             level: fact.data.level ?? 0,
           }

           setMessages((prev) => [...prev, formattedMessage])

           if (onNewMessage) {
             onNewMessage()
           }
         })
     })
 
     // Load existing messages
     loadMessages()
 
     return () => {
       cleanupFacts()
     }
   }, [socket, player, socketHandlers])

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/chat/messages', {
        headers: getAuthHeaders()
      })
      
      if (response.ok) {
        const data = await response.json()
        // Convert timestamp strings back to Date objects
        const formattedMessages = (data.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(formattedMessages)
      }
    } catch (error) {
      console.error('Failed to load messages:', error)
    }
  }

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
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
        <div ref={messagesEndRef} />
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
