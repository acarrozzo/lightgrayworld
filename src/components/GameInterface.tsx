'use client'

import { useGameStore } from '@/lib/game-state'
import type { Room } from '@/lib/game-state'
import { useCallback, useEffect, useRef, useState } from 'react'
import GameHeader from './GameHeader'
import GameSidebar from './GameSidebar'
import GameRightSidebar from './GameRightSidebar'
import GameFeed from './GameFeed'
import Icon from './Icon'
import { useSocket } from '@/hooks/useSocket'
import { useSocketHandlers } from '@/lib/socket-handlers'

const TRAVEL_DIRECTION_KEYS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down'] as const

type TravelDirectionKey = (typeof TRAVEL_DIRECTION_KEYS)[number]

const findTravelDirection = (fromRoom: Room | null, toRoomId: string): TravelDirectionKey | undefined => {
  if (!fromRoom) {
    return undefined
  }

  return TRAVEL_DIRECTION_KEYS.find((direction) => fromRoom[direction] === toRoomId)
}

export default function GameInterface() {
  const { player, setPlayer, currentRoom, setCurrentRoom, setRoomPlayers, getAuthHeaders, isLoggedIn, cacheRoom, getCachedRoom } = useGameStore()
  const [action, setAction] = useState('')
  const [actionResult, setActionResult] = useState<any>(null)
  const [isLoadingRoom, setIsLoadingRoom] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const { socket } = useSocket()
  const socketHandlers = useSocketHandlers(socket)
  const lastLoginSocketId = useRef<string | null>(null)
  const gameFactsCleanupRef = useRef<(() => void) | null>(null)
  const isGameFactsListenerRegisteredRef = useRef(false)
  const playerRef = useRef(player)
  const currentRoomRef = useRef(currentRoom)

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedLeftSidebar = localStorage.getItem('leftSidebarOpen')
    const savedRightSidebar = localStorage.getItem('rightSidebarOpen')
    
    if (savedLeftSidebar !== null) {
      setLeftSidebarOpen(JSON.parse(savedLeftSidebar))
    }
    if (savedRightSidebar !== null) {
      setRightSidebarOpen(JSON.parse(savedRightSidebar))
    }
  }, [])

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('leftSidebarOpen', JSON.stringify(leftSidebarOpen))
  }, [leftSidebarOpen])

  useEffect(() => {
    localStorage.setItem('rightSidebarOpen', JSON.stringify(rightSidebarOpen))
  }, [rightSidebarOpen])

  // Keyboard shortcuts for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts on desktop (when sidebars are not always visible)
      if (window.innerWidth >= 1024) return
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '1':
            e.preventDefault()
            setLeftSidebarOpen(!leftSidebarOpen)
            break
          case '2':
            e.preventDefault()
            setRightSidebarOpen(!rightSidebarOpen)
            break
          case 'Escape':
            e.preventDefault()
            setLeftSidebarOpen(false)
            setRightSidebarOpen(false)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [leftSidebarOpen, rightSidebarOpen])

  // Touch/swipe gesture support for mobile
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    const minSwipeDistance = 50

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartX || !touchStartY) return

      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const deltaX = touchEndX - touchStartX
      const deltaY = touchEndY - touchStartY

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          // Swipe right - open left sidebar
          setLeftSidebarOpen(true)
          setRightSidebarOpen(false)
        } else {
          // Swipe left - open right sidebar
          setRightSidebarOpen(true)
          setLeftSidebarOpen(false)
        }
      }

      touchStartX = 0
      touchStartY = 0
    }

    // Only add touch listeners on mobile
    if (window.innerWidth < 1024) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
      document.addEventListener('touchend', handleTouchEnd, { passive: true })
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  const loadRoomData = useCallback(async (options?: { isTransition?: boolean; travel?: { toRoomId?: string }; requireAuth?: boolean }) => {
    const isTransition = options?.isTransition ?? false
    const travelTarget = options?.travel?.toRoomId
    const shouldUseAuth = options?.requireAuth ?? isLoggedIn

    if (!isTransition) {
      setIsLoadingRoom(true)
    }

    if (isTransition && travelTarget) {
      const cachedRoom = getCachedRoom(travelTarget)
      if (cachedRoom) {
        setCurrentRoom(cachedRoom)
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (shouldUseAuth) {
        Object.assign(headers, getAuthHeaders())
      }

      const endpoint = travelTarget
        ? `/api/game/room/current?roomId=${encodeURIComponent(travelTarget)}`
        : '/api/game/room/current'

      const response = await fetch(endpoint, {
        headers,
      })
      
      if (response.ok) {
        const roomData = await response.json()
        
        // Include navigation directions in the room data
        const roomWithDirections = {
          ...roomData.room,
          north: roomData.room.north,
          northeast: roomData.room.northeast,
          east: roomData.room.east,
          southeast: roomData.room.southeast,
          south: roomData.room.south,
          southwest: roomData.room.southwest,
          west: roomData.room.west,
          northwest: roomData.room.northwest,
          up: roomData.room.up,
          down: roomData.room.down,
          players: Array.isArray(roomData.players) ? roomData.players : []
        }
        
        // Cache the room data for future navigation
        cacheRoom(roomWithDirections)
        setCurrentRoom(roomWithDirections)
        setRoomPlayers(Array.isArray(roomData.players) ? roomData.players : [])

        if (player && player.currentRoom !== roomWithDirections.roomId) {
          console.log('[GameInterface] Syncing player.currentRoom to', roomWithDirections.roomId)

          if (shouldUseAuth) {
            try {
              const syncResponse = await fetch('/api/game/room/sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...getAuthHeaders(),
                },
                body: JSON.stringify({ roomId: roomWithDirections.roomId }),
              })

              if (!syncResponse.ok) {
                const errorText = await syncResponse.text()
                console.error(
                  'Failed to sync player room on server:',
                  syncResponse.status,
                  syncResponse.statusText,
                  errorText
                )
              }
            } catch (error) {
              console.error('Failed to sync player room on server:', error)
            }
          }

          setPlayer({ ...player, currentRoom: roomWithDirections.roomId })
        }

        if (options?.travel) {
          const travelDirection = findTravelDirection(currentRoom, roomWithDirections.roomId)
          const travelMessage = travelDirection
            ? `You travel ${travelDirection} to the ${roomWithDirections.name}`
            : `You travel to ${roomWithDirections.name}`

          setActionResult({
            action: 'move',
            message: travelMessage,
            timestamp: new Date().toISOString(),
            success: true,
            roomData: roomWithDirections,
          })
        }
      } else {
        const errorText = await response.text()
        console.error('Failed to load room data:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error('Failed to load room data:', error)
    } finally {
      if (!isTransition) {
        setIsLoadingRoom(false)
      }
      setIsInitialLoad(false)
    }
  }, [getAuthHeaders, cacheRoom, setCurrentRoom, setRoomPlayers, player, setPlayer, getCachedRoom, isLoggedIn])
  const loadRoomDataRef = useRef(loadRoomData)

  useEffect(() => {
    playerRef.current = player
  }, [player])

  useEffect(() => {
    currentRoomRef.current = currentRoom
  }, [currentRoom])

  useEffect(() => {
    loadRoomDataRef.current = loadRoomData
  }, [loadRoomData])

  useEffect(() => {
    if (player && isLoggedIn && !currentRoom) {
      // Only load room data if we don't already have it
      loadRoomData()
    }
  }, [player, isLoggedIn, currentRoom, loadRoomData])

  useEffect(() => {
    if (!isLoggedIn && isInitialLoad) {
      loadRoomData({ requireAuth: false })
    }
  }, [isLoggedIn, isInitialLoad, loadRoomData])

  const handleAction = async (actionType: string) => {
    console.log('[handleAction] Called with action:', actionType)
    setAction(actionType)
    setActionResult(null)
    
    // Check if this is a navigation action for optimistic updates
    const travelActions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'move', 'navigate']
    const isNavigationAction = travelActions.includes(actionType.toLowerCase())
    
    if (isNavigationAction) {
      console.log('[handleAction] Navigation action detected, currentRoom:', currentRoom?.roomId)
      if (!currentRoom) {
        console.warn('No current room available for navigation action')
        return
      }

      const targetRoomId = currentRoom[actionType as keyof typeof currentRoom]
      console.log('[handleAction] Target room:', targetRoomId)
      if (!targetRoomId || typeof targetRoomId !== 'string') {
        console.warn('Navigation target not available from current room')
        return
      }

      if (socket) {
        console.log('[handleAction] Emitting player-move event:', { fromRoom: currentRoom.roomId, toRoom: targetRoomId })
        socket.emit('player-move', {
          fromRoom: currentRoom.roomId,
          toRoom: targetRoomId,
        })
      } else {
        console.warn('Socket not connected; movement intent not sent')
      }

      return
    }

    console.log('[handleAction] Non-navigation action, sending via socketHandlers')
    const result = socketHandlers.sendGameAction(actionType)
    console.log('[handleAction] sendGameAction result:', result)
    if (!result) {
      console.warn('Failed to send game action via socket; action will be ignored')
    }
  }

  useEffect(() => {
    if (!socket) {
      return
    }

    if (gameFactsCleanupRef.current) {
      gameFactsCleanupRef.current()
      gameFactsCleanupRef.current = null
      isGameFactsListenerRegisteredRef.current = false
    }

    if (isGameFactsListenerRegisteredRef.current) {
      return
    }

    const cleanup = socketHandlers.onGameFacts(({ facts }) => {
      console.log('[GameInterface] Received facts:', facts.length, facts)
      const currentPlayer = playerRef.current
      const activeRoom = currentRoomRef.current

      if (!currentPlayer) {
        return
      }

      let updatedPlayerRoom: string | null = null
      facts.forEach((fact) => {
        if (fact.type === 'player_moved' && fact.data.playerId === currentPlayer.id) {
          updatedPlayerRoom = fact.data.toRoom
        }
      })

      if (updatedPlayerRoom && currentPlayer.currentRoom !== updatedPlayerRoom) {
        console.log('[GameInterface] Updating player currentRoom to:', updatedPlayerRoom)
        setPlayer({ ...currentPlayer, currentRoom: updatedPlayerRoom })
      }

      const shouldReload = facts.some((fact) => {
        if (fact.type !== 'player_moved') return false
        if (fact.data.playerId === currentPlayer.id) return true
        if (!activeRoom) return false
        return fact.data.toRoom === activeRoom.roomId || fact.data.fromRoom === activeRoom.roomId
      })

      console.log('[GameInterface] shouldReload:', shouldReload)
      if (shouldReload) {
        console.log('[GameInterface] Calling loadRoomData')
        const playerMovementFact = facts.find((fact) => fact.type === 'player_moved' && fact.data.playerId === currentPlayer.id)
        loadRoomDataRef.current?.({
          isTransition: true,
          travel: playerMovementFact ? { toRoomId: playerMovementFact.data.toRoom } : undefined,
        })
      }
    })

    gameFactsCleanupRef.current = cleanup
    isGameFactsListenerRegisteredRef.current = true

    return () => {
      if (gameFactsCleanupRef.current) {
        gameFactsCleanupRef.current()
        gameFactsCleanupRef.current = null
        isGameFactsListenerRegisteredRef.current = false
      }
    }
  }, [socket, socketHandlers, setPlayer])

  useEffect(() => {
    console.log('[GameInterface] Socket state:', {
      socket: !!socket,
      player: !!player,
      currentRoom: currentRoom?.roomId,
      playerRoom: player?.currentRoom,
      isLoggedIn,
      socketConnected: socket?.connected,
      socketId: socket?.id,
      lastLoginSocketId: lastLoginSocketId.current,
    })
  }, [socket, player, currentRoom, isLoggedIn])

  const attemptSocketLogin = useCallback(
    (reason: string) => {
      if (!socket) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket missing`)
        return false
      }

      if (!player) {
        console.log(`[GameInterface] Skipping socket login (${reason}): player missing`)
        return false
      }

      if (!isLoggedIn) {
        console.log(`[GameInterface] Skipping socket login (${reason}): user not logged in`)
        return false
      }

      if (!currentRoom) {
        console.log(`[GameInterface] Skipping socket login (${reason}): currentRoom missing`)
        return false
      }

      if (!socket.connected) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket not connected`, {
          socketId: socket.id,
          connected: socket.connected,
        })
        return false
      }

      if (!socket.id) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket lacks id`)
        return false
      }

      const alreadyLoggedIn = lastLoginSocketId.current === socket.id
      if (alreadyLoggedIn) {
        console.log(`[GameInterface] Skipping socket login (${reason}): socket already logged in`, {
          socketId: socket.id,
        })
        return true
      }

      const playerRoomId = player.currentRoom || currentRoom.roomId
      if (player.currentRoom !== currentRoom.roomId) {
        console.warn('[GameInterface] Player room mismatch during login, proceeding with fallback', {
          reason,
          playerRoom: player.currentRoom,
          currentRoom: currentRoom.roomId,
          fallbackRoom: playerRoomId,
        })
      }

      const payload = { ...player, currentRoom: playerRoomId }

      console.log('[GameInterface] Logging in player via socket', {
        reason,
        socketId: socket.id,
        playerId: player.id,
        playerRoom: payload.currentRoom,
      })

      const loginResult = socketHandlers.loginPlayer(payload)
      console.log('[GameInterface] loginPlayer result:', loginResult)
      if (loginResult) {
        lastLoginSocketId.current = socket.id
      }

      return loginResult
    },
    [socket, player, isLoggedIn, currentRoom, socketHandlers]
  )

  useEffect(() => {
    attemptSocketLogin('effect-trigger')
  }, [attemptSocketLogin])

  useEffect(() => {
    if (!socket) {
      return
    }

    const handleConnect = () => {
      console.log('[GameInterface] Socket connect event triggered')
      attemptSocketLogin('socket-connect-event')
    }

    socket.on('connect', handleConnect)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
    }
  }, [socket, attemptSocketLogin])

  useEffect(() => {
    if (!socket || !player || !isLoggedIn) {
      return
    }

    if (!socket.connected || !socket.id) {
      return
    }

    if (lastLoginSocketId.current === socket.id) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      attemptSocketLogin('fallback-timeout')
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [attemptSocketLogin, socket, player, isLoggedIn])

  if (!player || !isLoggedIn) {
    return <div>Loading...</div>
  }

  if (!currentRoom || (isLoadingRoom && isInitialLoad)) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading room data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col">
      <GameHeader 
        player={player} 
        onToggleLeftSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
        onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Overlay backdrop for mobile */}
        {(leftSidebarOpen || rightSidebarOpen) && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-10 lg:hidden"
            onClick={() => {
              setLeftSidebarOpen(false)
              setRightSidebarOpen(false)
            }}
          />
        )}
        
        {/* Left Sidebar - Player Info */}
        <div className={`
          bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0
          transition-transform duration-300 ease-in-out
          ${leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          xl:translate-x-0 xl:static xl:w-80
          absolute left-0 top-0 bottom-0 w-80 z-20
        `}>
          <GameSidebar 
            player={player} 
            onClose={() => setLeftSidebarOpen(false)} 
          />
        </div>
        
        {/* Main Game Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-hidden">
            <GameFeed room={currentRoom} actionResult={actionResult} />
          </div>
          
          {/* Action Controls Section */}
          <div className="bg-gray-800 border-t border-gray-700 p-4 flex-shrink-0">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3 items-center flex-wrap">
                {/* Custom Action Input */}
                <div className="flex flex-1 min-w-0">
                  <input
                    type="text"
                    placeholder="Enter custom action..."
                    className="flex-1 px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-r-md whitespace-nowrap"
                  >
                    Submit
                  </button>
                </div>

                {/* Action Buttons */}
                <button
                  onClick={() => {
                    console.log('[ActionButton] Attack button clicked')
                    handleAction('attack')
                  }}
                  disabled={isLoadingRoom}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoadingRoom && action === 'attack' ? '...' : 'Attack'}
                </button>
                <button
                  onClick={() => {
                    console.log('[ActionButton] Search button clicked')
                    handleAction('search')
                  }}
                  disabled={isLoadingRoom}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoadingRoom && action === 'search' ? '...' : 'Search'}
                </button>
                <button
                  onClick={() => {
                    console.log('[ActionButton] Rest button clicked')
                    handleAction('rest')
                  }}
                  disabled={isLoadingRoom}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoadingRoom && action === 'rest' ? '...' : 'Rest'}
                </button>
                <button
                  onClick={() => {
                    console.log('[ActionButton] Look button clicked')
                    handleAction('look')
                  }}
                  disabled={isLoadingRoom}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoadingRoom && action === 'look' ? '...' : 'Look'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Sidebar - Navigation & Chat */}
        <div className={`
          bg-gray-800 border-l border-gray-700 flex flex-col flex-shrink-0 h-full
          transition-transform duration-300 ease-in-out
          ${rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:static lg:w-96
          absolute right-0 top-0 bottom-0 w-96 z-20
        `}>
          <GameRightSidebar 
            room={currentRoom} 
            onAction={handleAction}
            onClose={() => setRightSidebarOpen(false)} 
          />
        </div>
      </div>
    </div>
  )
}
