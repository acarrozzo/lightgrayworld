'use client'

import React, { useState, useRef } from 'react'
import Icon from './Icon'
import RoomDisplay from './RoomDisplay'
import { useGameStore } from '@/lib/game-state'

interface CompassProps {
  room: any
  onAction?: (action: string) => void
}

interface Direction {
  key: string
  icon: string
  label: string
  position: string
  rotation?: number
}

// Function to get room-specific map position using the same coordinates as the original
const getRoomMapPosition = (roomId: string | undefined) => {
  // Map room IDs to specific background-position coordinates (matching the original PHP implementation)
  const roomMapPositions: Record<string, string> = {
    '000': '-350px -350px',    // Room Zero
    '001': '-350px -350px',    // Grassy Field Crossroads
    '002': '-350px -455px',    // Grassy Field South
    '003': '-245px -455px',    // Wood Cabin
    '004': '-245px -350px',    // Flower Patch
    '005': '-350px -245px',    // Grassy Field North
    '006': '-455px -350px',    // Basic Shop
    '007': '-455px -455px',    // Cave Entrance
    '020': '-245px -245px',    // Healing Springs
    '021': '-455px -245px',    // Pajama Shaman
  }
  
  return roomMapPositions[roomId || '000'] || '-350px -350px' // Default to center
}

export default function Compass({ room, onAction }: CompassProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<string>(() => getRoomMapPosition(room?.roomId))
  const [targetPosition, setTargetPosition] = useState<string>(() => getRoomMapPosition(room?.roomId))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevRoomId = useRef<string | null>(null)
  const roomPlayers = useGameStore((state) => state.roomPlayers)
  const currentPlayerId = useGameStore((state) => state.player?.id)

  // Initialize position when room changes
  React.useEffect(() => {
    console.log('[Compass] useEffect triggered for room:', room?.roomId)
    if (!room?.roomId) {
      return
    }

    const newPosition = getRoomMapPosition(room.roomId)
    const isFirstLoad = prevRoomId.current === null
    const isSameRoom = prevRoomId.current === room.roomId

    console.log('[Compass] Calculated newPosition:', newPosition, 'currentPosition:', currentPosition, 'prevRoomId:', prevRoomId.current)

    if (isFirstLoad || isSameRoom || currentPosition === '') {
      setCurrentPosition(newPosition)
      setTargetPosition(newPosition)
      setIsTransitioning(false)
      prevRoomId.current = room.roomId
      console.log('[Compass] Initial position set to:', newPosition)
      return
    }

    setTargetPosition(newPosition)
    setIsTransitioning(true)
    prevRoomId.current = room.roomId
    console.log('[Compass] Transition started to newPosition:', newPosition)

    const timer = setTimeout(() => {
      setCurrentPosition(newPosition)
      setIsTransitioning(false)
      console.log('[Compass] Transition complete, currentPosition updated to:', newPosition)
    }, 500) // Match CSS transition duration

    return () => {
      console.log('[Compass] Cleaning up transition timer for room change')
      clearTimeout(timer)
    }
  }, [room?.roomId, currentPosition])

  const handleNavigate = async (direction: string) => {
    console.log('[Compass] handleNavigate called with direction:', direction)
    console.log('[Compass] isNavigating:', isNavigating, 'room[direction]:', room?.[direction], 'onAction:', !!onAction)
    if (isNavigating || !room?.[direction] || !onAction) {
      console.log('[Compass] Early return - navigation blocked')
      return
    }

    setIsNavigating(true)
    console.log('[Compass] Calling onAction with direction:', direction)
    
    try {
      // Use the unified action system
      await onAction(direction)
      console.log('[Compass] onAction completed successfully')
    } catch (error) {
      console.error('[Compass] Navigation error:', error)
    } finally {
      setIsNavigating(false)
    }
  }

  if (!room) return null

  const isRoomZero = room.roomId === '000'
  const mapBackground = isRoomZero
    ? '/icons/roomzero.svg'
    : '/icons/lightgray_map_grassyfield_main.jpg'
  const mapPosition = isRoomZero
    ? 'center'
    : (isTransitioning ? targetPosition : currentPosition)

  const directions: Direction[] = [
    { key: 'northwest', icon: 'arrow', label: 'NW', position: 'top-left', rotation: 315 },
    { key: 'north', icon: 'arrow', label: 'N', position: 'top-center', rotation: 0 },
    { key: 'northeast', icon: 'arrow', label: 'NE', position: 'top-right', rotation: 45 },
    { key: 'west', icon: 'arrow', label: 'W', position: 'left', rotation: 270 },
    { key: 'east', icon: 'arrow', label: 'E', position: 'right', rotation: 90 },
    { key: 'southwest', icon: 'arrow', label: 'SW', position: 'bottom-left', rotation: 225 },
    { key: 'south', icon: 'arrow', label: 'S', position: 'bottom-center', rotation: 180 },
    { key: 'southeast', icon: 'arrow', label: 'SE', position: 'bottom-right', rotation: 135 },
  ]

  const verticalDirections: Direction[] = [
    { key: 'up', icon: 'arrow-up', label: 'UP', position: 'top' },
    { key: 'down', icon: 'arrow-down', label: 'DOWN', position: 'bottom' },
  ]

  return (
    <div className="space-y-4 w-full">
      {/* Main D-pad */}
      <div className="relative">
        <div className="relative w-64 h-64 mx-auto">
          {/* Map circle in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-[140px] h-[140px] rounded-full bg-no-repeat transition-all duration-500 ease-in-out"
              style={{
                backgroundImage: `url('${mapBackground}')`,
                backgroundPosition: mapPosition,
                border: '20px solid rgba(250, 250, 250, 0)'
              }}
            />
          </div>

          {/* Direction buttons */}
          {directions.map((dir) => {
            const isAvailable = !!room[dir.key]
            const positionClasses = {
              'top-left': 'top-8 left-8',
              'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
              'top-right': 'top-8 right-8',
              'left': 'top-1/2 left-4 transform -translate-y-1/2',
              'right': 'top-1/2 right-4 transform -translate-y-1/2',
              'bottom-left': 'bottom-8 left-8',
              'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
              'bottom-right': 'bottom-8 right-8',
            }

            return (
              <button
                key={dir.key}
                onClick={() => handleNavigate(dir.key)}
                disabled={!isAvailable || isNavigating}
                className={`absolute ${positionClasses[dir.position as keyof typeof positionClasses]} w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-600 rounded-full flex items-center justify-center transition-colors ${
                  isAvailable ? 'hover:border-blue-400' : ''
                }`}
                title={isAvailable ? `Go ${dir.label}` : `Cannot go ${dir.label}`}
              >
                <Icon 
                  name={dir.icon} 
                  size={14} 
                  color={isAvailable ? 'white' : 'gray'} 
                  rotation={dir.rotation}
                />
              </button>
            )
          })}
        </div>

        {/* Vertical directions (up/down) */}
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 flex flex-col gap-2">
          {verticalDirections.map((dir) => {
            const isAvailable = !!room[dir.key]
            
            return (
              <button
                key={dir.key}
                onClick={() => handleNavigate(dir.key)}
                disabled={!isAvailable || isNavigating}
                className={`w-8 h-8 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed border border-gray-600 rounded-full flex items-center justify-center transition-colors ${
                  isAvailable ? 'hover:border-blue-400' : ''
                }`}
                title={isAvailable ? `Go ${dir.label}` : `Cannot go ${dir.label}`}
              >
                <Icon 
                  name={dir.icon} 
                  size={14} 
                  color={isAvailable ? 'white' : 'gray'} 
                  rotation={dir.rotation}
                />
              </button>
            )
          })}
        </div>

        {/* Loading indicator - show during navigation or transition */}
        {(isNavigating || isTransitioning) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Room Display */}
      <RoomDisplay
        room={room}
        onAction={onAction}
        roomPlayers={roomPlayers}
        currentPlayerId={currentPlayerId}
        showPlayers={false}
      />
    </div>
  )
}