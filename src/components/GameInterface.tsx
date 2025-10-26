'use client'

import { useGameStore } from '@/lib/game-state'
import { useEffect, useState } from 'react'
import GameHeader from './GameHeader'
import GameSidebar from './GameSidebar'
import GameRightSidebar from './GameRightSidebar'
import GameFeed from './GameFeed'
import Icon from './Icon'

export default function GameInterface() {
  const { player, currentRoom, setCurrentRoom, setRoomPlayers, getAuthHeaders } = useGameStore()
  const [action, setAction] = useState('')
  const [actionResult, setActionResult] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

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

  useEffect(() => {
    if (player) {
      // Clear any stale currentRoom data from localStorage
      setCurrentRoom(null)
      
      // Load initial room data - API will use authenticated user's current room
      loadRoomData()
    }
  }, [player])

  const loadRoomData = async () => {
    try {
      const response = await fetch('/api/game/room/current', {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
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
          down: roomData.room.down
        }
        
        setCurrentRoom(roomWithDirections)
        setRoomPlayers(roomData.players)
      } else {
        const errorText = await response.text()
        console.error('Failed to load room data:', response.status, response.statusText, errorText)
      }
    } catch (error) {
      console.error('Failed to load room data:', error)
    }
  }

  const handleAction = async (actionType: string) => {
    setAction(actionType)
    setIsLoading(true)
    setActionResult(null)
    
    try {
      const response = await fetch('/api/game/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ action: actionType }),
      })

      const result = await response.json()
      
      if (response.ok) {
        setActionResult(result)
        
        // If this was a navigation/travel action, update the room data
        const travelActions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down', 'move', 'navigate']
        if (travelActions.includes(actionType.toLowerCase()) && result.success && result.roomData) {
          setCurrentRoom(result.roomData)
          setRoomPlayers(result.roomData.players || [])
        }
      } else {
        setActionResult({
          success: false,
          message: result.error?.message || 'Action failed',
          action: actionType,
          player: 'Unknown',
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Action failed:', error)
      setActionResult({
        success: false,
        message: 'Network error',
        action: actionType,
        player: 'Unknown',
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!player) {
    return <div>Loading...</div>
  }

  if (!currentRoom) {
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
                  onClick={() => handleAction('attack')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoading && action === 'attack' ? '...' : 'Attack'}
                </button>
                <button
                  onClick={() => handleAction('search')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoading && action === 'search' ? '...' : 'Search'}
                </button>
                <button
                  onClick={() => handleAction('rest')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoading && action === 'rest' ? '...' : 'Rest'}
                </button>
                <button
                  onClick={() => handleAction('look')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-semibold whitespace-nowrap"
                >
                  {isLoading && action === 'look' ? '...' : 'Look'}
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
