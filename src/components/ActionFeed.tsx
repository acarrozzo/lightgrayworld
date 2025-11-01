'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/game-state'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers, GameFact } from '@/lib/socket-handlers'
import Icon from './Icon'

interface ActionHistory {
  id: string
  action: string
  message: string
  timestamp: string
  roomId?: string
  metadata?: string
}

interface ActionFeedProps {
  className?: string
}

export default function ActionFeed({ className = '' }: ActionFeedProps) {
  const [actions, setActions] = useState<ActionHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)
  const { getAuthHeaders, player } = useGameStore()
  const { socket, isConnected } = useSocket()
  const socketHandlers = useSocketHandlers(socket)

  // Helper function to deduplicate actions by ID and sort by timestamp
  const deduplicateActions = (actions: ActionHistory[]): ActionHistory[] => {
    const seen = new Set<string>()
    const unique = actions.filter(action => {
      if (seen.has(action.id)) {
        return false
      }
      seen.add(action.id)
      return true
    })
    
    // Sort by timestamp (newest first)
    return unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  const loadActions = async (pageNum: number = 1, append: boolean = false) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/game/actions?page=${pageNum}&limit=20`, {
        headers: getAuthHeaders()
      })

      if (response.ok) {
        const data = await response.json()
        const newActions = data.actions || []
        
        if (append) {
          setActions(prev => {
            const combined = [...prev, ...newActions]
            return deduplicateActions(combined)
          })
        } else {
          setActions(deduplicateActions(newActions))
        }
        
        setHasMore(data.pagination.page < data.pagination.pages)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('Failed to load actions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = () => {
    if (!isLoading && hasMore) {
      loadActions(page + 1, true)
    }
  }

  const scrollToBottom = () => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }

  const scrollToTop = () => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0
    }
  }

  useEffect(() => {
    loadActions(1, false)
  }, [])

  const factToAction = (fact: GameFact): ActionHistory | null => {
    const timestamp = new Date(fact.timestamp || Date.now()).toISOString()
    switch (fact.type) {
      case 'chat':
        return {
          id: `fact-${fact.tickId}-${fact.seq}`,
          action: 'chat',
          message: `${fact.data.username || fact.data.playerId}: ${fact.data.message || ''}`,
          timestamp,
          roomId: fact.data.roomId || undefined,
          metadata: JSON.stringify(fact.data),
        }
      case 'player_moved':
        return {
          id: `fact-${fact.tickId}-${fact.seq}`,
          action: 'move',
          message: `${fact.data.username || fact.data.playerId} moved to ${fact.data.toRoom || 'another room'}`,
          timestamp,
          roomId: fact.data.toRoom || undefined,
          metadata: JSON.stringify(fact.data),
        }
      case 'player_action':
        return {
          id: `fact-${fact.tickId}-${fact.seq}`,
          action: fact.data.action || 'action',
          message: `${fact.data.playerId} performed ${fact.data.action}`,
          timestamp,
          metadata: JSON.stringify(fact.data),
        }
      case 'attack_intent':
        return {
          id: `fact-${fact.tickId}-${fact.seq}`,
          action: 'attack',
          message: `${fact.data.playerId} prepares an attack`,
          timestamp,
          metadata: JSON.stringify(fact.data),
        }
      case 'use_item':
        return {
          id: `fact-${fact.tickId}-${fact.seq}`,
          action: 'use_item',
          message: `${fact.data.playerId} used ${fact.data.itemId}`,
          timestamp,
          metadata: JSON.stringify(fact.data),
        }
      case 'look':
        return {
          id: `fact-${fact.tickId}-${fact.seq}`,
          action: 'look',
          message: `${fact.data.playerId} looks around`,
          timestamp,
          metadata: JSON.stringify(fact.data),
        }
      default:
        return null
    }
  }

  // Listen for real-time action updates
  useEffect(() => {
    if (!socket || !player) {
      return // Silently return, don't log as this is normal during initial load
    }
 
    const cleanupFacts = socketHandlers.onGameFacts(({ facts }) => {
      const newEntries = facts
        .map(factToAction)
        .filter((entry): entry is ActionHistory => entry !== null)

      if (newEntries.length === 0) {
        return
      }

      setActions((prev) => deduplicateActions([...newEntries, ...prev]))
    })

    return () => {
      cleanupFacts()
    }
  }, [socket, player, socketHandlers])

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'look':
        return 'text-blue-400'
      case 'attack':
        return 'text-red-400'
      case 'search':
        return 'text-yellow-400'
      case 'rest':
        return 'text-green-400'
      case 'move':
        return 'text-purple-400'
      default:
        return 'text-gray-400'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'look':
        return 'aim'
      case 'attack':
        return 'attack'
      case 'search':
        return 'aim'
      case 'rest':
        return 'heal'
      case 'move':
        return 'arrow-north'
      default:
        return 'magic'
    }
  }

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Action Feed</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={scrollToTop}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            ↑ Top
          </button>
          <button
            onClick={scrollToBottom}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            ↓ Bottom
          </button>
        </div>
      </div>

      {/* Actions List */}
      <div 
        ref={feedRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {actions.length === 0 && !isLoading ? (
          <div className="text-center text-gray-500 py-8">
            <p>No actions yet.</p>
            <p className="text-sm">Perform some actions to see them here!</p>
          </div>
        ) : (
          actions.map((action) => (
            <div
              key={action.id}
              className="bg-gray-800 rounded-lg p-3 border-l-4 border-gray-600 hover:border-gray-500 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Icon name={getActionIcon(action.action)} size={24} color="gray" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold ${getActionColor(action.action)}`}>
                      {action.action.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                    {action.roomId && (
                      <span className="text-xs text-gray-500">
                        Room {action.roomId}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {action.message}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="text-center text-gray-500 py-4">
            <div className="inline-flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Loading actions...
            </div>
          </div>
        )}

        {/* Load more button */}
        {hasMore && !isLoading && (
          <div className="text-center py-4">
            <button
              onClick={loadMore}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Load More Actions
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
