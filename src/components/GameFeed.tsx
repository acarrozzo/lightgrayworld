'use client'

import { useState, useEffect, useRef } from 'react'
import { Room, useGameStore } from '@/lib/game-state'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'
import Icon from './Icon'

interface ActionHistory {
  id: string
  action: string
  message: string
  timestamp: string
  roomId?: string
  metadata?: string
  success?: boolean
  roomData?: {
    id: string
    roomId: string
    name: string
    description: string
    lookDesc: string
    dangerLevel: number
    isSafe: boolean
    players: any[]
    items: any[]
    npcs: any[]
  }
}

interface GameFeedProps {
  room: Room | null
  actionResult?: any
  className?: string
}

export default function GameFeed({ room, actionResult, className = '' }: GameFeedProps) {
  const [actions, setActions] = useState<ActionHistory[]>([])
  const [initialRoom, setInitialRoom] = useState(room)
  const feedRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)
  const isClearingFeed = useRef(false)
  const { getAuthHeaders, player, setCurrentRoom, setRoomPlayers } = useGameStore()
  const { socket, isConnected } = useSocket()
  const socketHandlers = useSocketHandlers(socket)

  // Load from localStorage and set initial room on mount (only once)
  useEffect(() => {
    if (hasInitialized.current || isClearingFeed.current) {
      console.log('GameFeed useEffect - already initialized or clearing feed, skipping')
      return
    }
    
    console.log('GameFeed useEffect - initializing for first time')
    console.log('GameFeed useEffect - room prop:', room)
    console.log('GameFeed useEffect - current initialRoom state:', initialRoom)
    
    const savedActions = localStorage.getItem('gameFeedActions')
    const savedInitialRoom = localStorage.getItem('gameFeedInitialRoom')
    
    console.log('GameFeed useEffect - savedActions:', savedActions ? 'exists' : 'null')
    console.log('GameFeed useEffect - savedInitialRoom:', savedInitialRoom ? 'exists' : 'null')
    
    // Load saved actions
    if (savedActions) {
      try {
        const parsedActions = JSON.parse(savedActions)
        console.log('GameFeed useEffect - loading actions:', parsedActions.length)
        setActions(parsedActions)
      } catch (error) {
        console.error('Failed to parse saved actions:', error)
        localStorage.removeItem('gameFeedActions')
      }
    }
    
    // Load saved initial room
    if (savedInitialRoom) {
      try {
        const parsedRoom = JSON.parse(savedInitialRoom)
        console.log('GameFeed useEffect - loading saved initial room:', parsedRoom.name)
        setInitialRoom(parsedRoom)
      } catch (error) {
        console.error('Failed to parse saved initial room:', error)
        localStorage.removeItem('gameFeedInitialRoom')
      }
    } else if (room) {
      // Only set initial room if no saved room exists and we have a room prop
      console.log('GameFeed useEffect - setting initial room from prop:', room.name)
      setInitialRoom(room)
    }
    
    hasInitialized.current = true
  }, [room])

  // Save actions to localStorage whenever actions change
  useEffect(() => {
    if (actions.length > 0) {
      localStorage.setItem('gameFeedActions', JSON.stringify(actions))
    }
  }, [actions])

  // Save initial room to localStorage when it changes
  useEffect(() => {
    if (initialRoom) {
      console.log('GameFeed useEffect - saving initial room:', initialRoom.name)
      localStorage.setItem('gameFeedInitialRoom', JSON.stringify(initialRoom))
    }
  }, [initialRoom])

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
    
    // Sort by timestamp (oldest first, newest at bottom)
    return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  const clearFeed = () => {
    console.log('GameFeed clearFeed - clearing everything')
    isClearingFeed.current = true // Set flag to prevent useEffect from interfering
    
    setActions([])
    localStorage.removeItem('gameFeedActions') // Clear localStorage as well
    localStorage.removeItem('gameFeedInitialRoom') // Clear saved initial room
    
    // Set the current room as the new initial room
    if (room) {
      console.log('GameFeed clearFeed - setting current room as new initial room:', room.name)
      setInitialRoom(room)
    }
    
    // Reset flags after a brief delay to allow state updates to complete
    setTimeout(() => {
      isClearingFeed.current = false
      hasInitialized.current = true
    }, 100)
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

  // Add current action result to the feed
  useEffect(() => {
    if (actionResult) {
      const newAction: ActionHistory = {
        id: `action-${Date.now()}`,
        action: actionResult.action,
        message: actionResult.message,
        timestamp: actionResult.timestamp,
        success: actionResult.success,
        roomData: actionResult.roomData
      }
      
      setActions(prev => {
        let combined = [...prev, newAction]
        
        // If this action has room data, add a separate room display action
        if (actionResult.roomData) {
          const roomDisplayAction: ActionHistory = {
            id: `room-${Date.now()}`,
            action: 'room-display',
            message: `Room: ${actionResult.roomData.name}`,
            timestamp: new Date(Date.now() + 1).toISOString(), // Slightly after the main action
            success: true,
            roomData: actionResult.roomData
          }
          combined = [...combined, roomDisplayAction]
        }
        
        return deduplicateActions(combined)
      })
      
      // Note: We don't update the initial room display on travel - it should remain the original room
      
      // Auto-scroll to bottom when new action is added
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
  }, [actionResult])


  // Listen for real-time action updates
  useEffect(() => {
    if (!socket || !player) {
      return
    }

    // Login player to Socket.io to receive room-based events
    socketHandlers.loginPlayer(player)

    // Listen for new actions
    const cleanupActions = socketHandlers.onActionCompleted((actionData: any) => {
      const newAction: ActionHistory = {
        id: actionData.id,
        action: actionData.action,
        message: actionData.message,
        timestamp: new Date(actionData.timestamp).toISOString(),
        roomId: actionData.roomId,
        metadata: actionData.metadata,
        success: actionData.success,
        roomData: actionData.roomData
      }
      
      // Add new action to the end of the list with deduplication
      setActions(prev => {
        let combined = [...prev, newAction]
        
        // If this action has room data, add a separate room display action
        if (actionData.roomData) {
          const roomDisplayAction: ActionHistory = {
            id: `room-${actionData.id}`,
            action: 'room-display',
            message: `Room: ${actionData.roomData.name}`,
            timestamp: new Date(new Date(actionData.timestamp).getTime() + 1).toISOString(), // Slightly after the main action
            success: true,
            roomData: actionData.roomData
          }
          combined = [...combined, roomDisplayAction]
        }
        
        return deduplicateActions(combined)
      })
      
      // Note: We don't update the initial room display on travel - it should remain the original room
      
      // Auto-scroll to bottom when new action is added
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    })

    return () => {
      cleanupActions()
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
      case 'room-display':
        return 'text-green-400'
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
        return 'arrow'
      case 'north':
        return 'arrow'
      case 'northeast':
        return 'arrow'
      case 'east':
        return 'arrow'
      case 'southeast':
        return 'arrow'
      case 'south':
        return 'arrow'
      case 'southwest':
        return 'arrow'
      case 'west':
        return 'arrow'
      case 'northwest':
        return 'arrow'
      case 'up':
        return 'arrow-up'
      case 'down':
        return 'arrow-down'
      case 'room-display':
        return 'world'
      default:
        return 'magic'
    }
  }

  const getActionRotation = (action: string) => {
    switch (action.toLowerCase()) {
      case 'north':
        return 0
      case 'northeast':
        return 45
      case 'east':
        return 90
      case 'southeast':
        return 135
      case 'south':
        return 180
      case 'southwest':
        return 225
      case 'west':
        return 270
      case 'northwest':
        return 315
      default:
        return 0
    }
  }

  // Get room-specific icon
  const getRoomIcon = (roomId: string) => {
    switch (roomId) {
      case '000': return 'roomzero'
      case '001': return 'sun'
      case '002': return 'redberry'
      case '003': return 'cabin2'
      case '004': return 'flower'
      case '005': return 'blueberry'
      case '006': return 'basicshop'
      case '007': return 'cave1'
      case '020': return 'waterfall'
      case '021': return 'tent'
      default: return 'sun'
    }
  }

  const renderRoomInfo = (roomData: any, action?: string, isMostRecent: boolean = false) => {
    // Get room-specific actions
    const getRoomActions = (roomId: string) => {
      switch (roomId) {
        case '000': // Room Zero
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'pick up map', label: 'Pick Up Map' },
            { action: 'press button', label: 'Press Button' },
          ]
        case '001': // Grassy Field Crossroads
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'ex chest', label: 'Examine Chest' },
            { action: 'open chest', label: 'Open Gold Chest' },
          ]
        case '002': // Grassy Field South
          return [
            { action: 'pick redberry', label: 'Pick Redberry' },
          ]
        case '003': // Wood Cabin
          return [
            { action: 'ex cabin', label: 'Examine Cabin' },
            { action: 'attack dummy', label: 'Attack Dummy' },
            { action: 'cook meat', label: 'Cook Meat' },
          ]
        case '004': // Flower Patch
          return [
            { action: 'pick flower', label: 'Pick Flower' },
          ]
        case '005': // Grassy Field North
          return [
            { action: 'pick blueberry', label: 'Pick Blueberry' },
            { action: 'ex tent', label: 'Examine Tent' },
          ]
        case '006': // Basic Shop
          return [
            { action: 'buy dagger', label: 'Buy Dagger' },
            { action: 'buy potion', label: 'Buy Potion' },
          ]
        case '007': // Cave Entrance
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'search', label: 'Search' },
          ]
        case '020': // Healing Springs
          return [
            { action: 'rest', label: 'Rest at Waterfall' },
          ]
        case '021': // Pajama Shaman
          return [
            { action: 'read sign', label: 'Read Sign' },
            { action: 'buy staff', label: 'Buy Staff' },
          ]
        default:
          return []
      }
    }

    const roomActions = getRoomActions(roomData.roomId)

    return (
      <div className="p-6">
        {/* Header with icon and two-line title */}
        <div className="flex items-start gap-4 mb-4">
          <Icon name={getRoomIcon(roomData.roomId)} size={64} color="yellow" />
          <div className="flex-1">
            <p className="text-blue-300 text-sm mb-1">This is it. The world is yours.</p>
            <h3 className="text-xl font-bold text-green-400">{roomData.name}</h3>
          </div>
        </div>

        {/* Room Description */}
        <p className="text-gray-300 leading-relaxed mb-6">
          {roomData.description}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Universal actions */}
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            West
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            South
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            North
          </button>
          <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm">
            East
          </button>
          
          {/* Room-specific actions */}
          {roomActions.map((actionItem) => (
            <button
              key={actionItem.action}
              className={`px-4 py-2 text-white rounded-md text-sm flex items-center gap-2 ${
                actionItem.action === 'read sign' ? 'bg-amber-600 hover:bg-amber-700' :
                actionItem.action === 'open chest' ? 'bg-orange-500 hover:bg-orange-600' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {actionItem.action === 'read sign' && <Icon name="sign" size={18} color="white" />}
              {actionItem.action === 'open chest' && <Icon name="chest" size={18} color="white" />}
              {actionItem.label}
            </button>
          ))}
        </div>

        {/* Additional room info sections */}
        {(roomData.players?.length > 0 || roomData.items?.length > 0 || roomData.npcs?.length > 0) && (
          <div className="mt-6 space-y-3">
            {/* Players in Room */}
            {roomData.players && roomData.players.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">Also Here:</h4>
                <div className="flex flex-wrap gap-2">
                  {roomData.players.map((player: any) => (
                    <span
                      key={player.id}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full"
                    >
                      [{player.level}] {player.username}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Items in Room */}
            {roomData.items && roomData.items.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-green-400 mb-2">Items:</h4>
                <div className="flex flex-wrap gap-2">
                  {roomData.items.map((item: any) => (
                    <span
                      key={item.id}
                      className="px-2 py-1 bg-green-600 text-white text-xs rounded-full"
                    >
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* NPCs in Room */}
            {roomData.npcs && roomData.npcs.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-purple-400 mb-2">NPCs:</h4>
                <div className="flex flex-wrap gap-2">
                  {roomData.npcs.map((npc: any) => (
                    <span
                      key={npc.id}
                      className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full"
                    >
                      {npc.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (!initialRoom) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading room...</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">Game Feed</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearFeed}
            className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Clear Feed
          </button>
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

      {/* Feed Content */}
      <div 
        ref={feedRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Initial Room Info - Always show at the top */}
        <div className="space-y-4">
          <div className="text-center text-gray-500 py-4">
            <p className="text-lg font-semibold mb-2">Welcome to {initialRoom.name}!</p>
            <p className="text-sm">Your adventure begins here.</p>
          </div>
          <div className={`bg-gray-800 rounded-lg ${
            actions.length === 0 ? 'border-2 border-green-500' : 'border border-gray-600'
          }`}>
            {renderRoomInfo(initialRoom, undefined, actions.length === 0)}
          </div>
        </div>

        {/* Actions List */}
        {actions.map((action, index) => {
          // Check if this is the last action in the feed (bottom-most)
          const isLastAction = index === actions.length - 1
          
          // Check if this is a room-display action
          if (action.action === 'room-display') {
            return (
              <div
                key={action.id}
                className={`bg-gray-800 rounded-lg ${
                  isLastAction ? 'border-2 border-green-500' : 'border border-gray-600'
                }`}
              >
                {renderRoomInfo(action.roomData, action.action, isLastAction)}
              </div>
            )
          }
          
          // Regular action (LOOK, REST, SEARCH, ATTACK, etc.)
          return (
            <div
              key={action.id}
              className={`bg-gray-800 rounded-lg p-4 border ${
                isLastAction ? 'border-2 border-green-500' : 'border border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <Icon 
                  name={getActionIcon(action.action)} 
                  size={24} 
                  color="gray" 
                  rotation={getActionRotation(action.action)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
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
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    {action.message}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}
