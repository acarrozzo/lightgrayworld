'use client'

import React, { useState, useRef } from 'react'
import { ArrowBigUp, ArrowBigUpDash } from 'lucide-react'
import { getRoomMapPosition } from './game-interface/room-map-positions'
import { getRoomMapView } from './game-interface/utils'
import { roomColor } from '@/lib/theme/room-colors'

interface CompassProps {
  room: any
  onAction?: (action: string) => void
  onNavigateToMap?: () => void
  isMoveInProgress?: boolean
  /**
   * Party followers travel with their leader and cannot move on their own; the
   * server refuses the move anyway, so the D-pad greys out rather than sending
   * a press that only comes back as an error. Matches the room's text
   * direction buttons.
   */
  isLocked?: boolean
  lockedHint?: string
  /**
   * Overrides the outer sizing box. The default centres the D-pad in whatever
   * column it is given; the mobile strip narrows it so the basic-action buttons
   * fit beside it. Must leave 48px of left inset for the up/down buttons.
   */
  className?: string
}

interface Direction {
  key: string
  label: string
  position: string
  rotation?: number
}

interface VerticalDirection {
  key: string
  label: string
  rotation?: number
}

// Per-room directions that should render as "no exit" on the compass even though
// the underlying room data has a destination. The click still works — only the
// visual treatment is suppressed. Useful for hidden back-doors.
const HIDDEN_EXITS: Record<string, string[]> = {
  '017': ['southeast'],
  '019': ['northeast'],
}

/**
 * Compass button styling for one direction.
 *
 * The colour comes from the room's `directionColors` override if it has one for
 * this exit, otherwise from the room's region — so a path out of the Forest is
 * forest-coloured without anyone authoring that per room. It is applied as an
 * inline custom property rather than a class because the value is data-driven;
 * the utilities that consume it are written out literally so Tailwind still
 * generates them.
 *
 * This replaces a ~150-entry Tailwind colour map whose fallback branch built
 * `bg-${color}/90` at runtime — a class Tailwind never compiled, so any room
 * colour outside the map silently rendered with no background at all.
 */
const getDirectionStyle = (
  directionKey: string,
  directionColors: Record<string, string> | null | undefined,
  region: string | null | undefined,
  isAvailable: boolean
): { className: string; style?: React.CSSProperties } => {
  if (!isAvailable) {
    return { className: 'bg-surface-panel/30 border-line-subtle/20 opacity-25' }
  }

  return {
    className:
      'bg-[var(--compass-dir)] border-fg-bright/10 hover:border-fg-bright/20 hover:brightness-110 shadow-sm shadow-shadow',
    style: {
      '--compass-dir': roomColor(directionColors?.[directionKey], region, 'direction'),
    } as React.CSSProperties,
  }
}

/**
 * How long the mini-map slides from the old room to the new one. Must match
 * the `duration-[...]` on the map button below. Short and eased out so the
 * slide reads as arriving, not as travelling.
 */
const MAP_PAN_MS = 350

export default function Compass({
  room,
  onAction,
  onNavigateToMap,
  isMoveInProgress = false,
  isLocked = false,
  lockedHint = 'Following your party — leave to move freely',
  className = 'w-full sm:max-w-[380px] max-w-[320px] mx-auto',
}: CompassProps) {
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<string>(() => getRoomMapPosition(room?.roomId))
  const [targetPosition, setTargetPosition] = useState<string>(() => getRoomMapPosition(room?.roomId))
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevRoomId = useRef<string | null>(null)

  // Initialize position when room changes
  React.useEffect(() => {
    if (!room?.roomId) {
      return
    }

    const newPosition = getRoomMapPosition(room.roomId)
    const isFirstLoad = prevRoomId.current === null
    const isSameRoom = prevRoomId.current === room.roomId

    if (isFirstLoad || isSameRoom || currentPosition === '') {
      setCurrentPosition(newPosition)
      setTargetPosition(newPosition)
      setIsTransitioning(false)
      prevRoomId.current = room.roomId
      return
    }

    setTargetPosition(newPosition)
    setIsTransitioning(true)
    prevRoomId.current = room.roomId

    const timer = setTimeout(() => {
      setCurrentPosition(newPosition)
      setIsTransitioning(false)
    }, MAP_PAN_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [room?.roomId, currentPosition])

  const handleNavigate = async (direction: string) => {
    if (isNavigating || isMoveInProgress || isLocked || !onAction) {
      return
    }

    setIsNavigating(true)

    try {
      // Use the unified action system
      await onAction(direction)
    } catch (error) {
      console.error('[Compass] Navigation error:', error)
    } finally {
      setIsNavigating(false)
    }
  }

  if (!room) return null

  // Artwork + title come from the shared sheet table (world-map.js via
  // getRoomMapView), so the mini-map and the full map view always agree on which
  // sheet a room belongs to. Only the pan is local, because it animates between rooms.
  const { src: mapBackground, title: mapTitle } = getRoomMapView(room.roomId)
  const isSingleRoomMap = room.roomId === '000' || room.roomId === '999' || room.roomId === '088'
  const mapPosition = isSingleRoomMap
    ? 'center'
    : (isTransitioning ? targetPosition : currentPosition)

  const directions: Direction[] = [
    { key: 'northwest', label: 'NW', position: 'top-left', rotation: 315 },
    { key: 'north', label: 'N', position: 'top-center', rotation: 0 },
    { key: 'northeast', label: 'NE', position: 'top-right', rotation: 45 },
    { key: 'west', label: 'W', position: 'left', rotation: 270 },
    { key: 'east', label: 'E', position: 'right', rotation: 90 },
    { key: 'southwest', label: 'SW', position: 'bottom-left', rotation: 225 },
    { key: 'south', label: 'S', position: 'bottom-center', rotation: 180 },
    { key: 'southeast', label: 'SE', position: 'bottom-right', rotation: 135 },
  ]

  const verticalDirections: VerticalDirection[] = [
    { key: 'up', label: 'UP', rotation: 0 },
    { key: 'down', label: 'DOWN', rotation: 180 },
  ]

  const isDisabled = isNavigating || isMoveInProgress || isLocked
  const directionTitle = (label: string, isAvailable: boolean) => {
    if (isLocked) return lockedHint
    return isAvailable ? `Go ${label}` : `No exit ${label}`
  }

  return (
    <div className={`compass ${className}`} title={isLocked ? lockedHint : undefined}>
      {/* Main D-pad */}
      <div className="relative">
        <div className="relative w-56 sm:w-64 h-56 sm:h-64 mx-auto">
          {/* Map circle in center. Also opens the map; the Map button in the
              corner of the Explore panel is the labelled way in. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onNavigateToMap?.()}
              className="w-[120px] sm:w-[150px] h-[120px] sm:h-[150px] cursor-pointer rounded-full bg-no-repeat transition-[background-position] duration-[350ms] ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas border-[10px] sm:border-[25px] border-solid border-transparent shadow-xl shadow-black/30 hover:shadow-2xl"
              style={{
                backgroundImage: `url('${mapBackground}')`,
                backgroundPosition: mapPosition
              }}
              aria-label={`Open the map (${mapTitle})`}
              title={`Open the map — ${mapTitle}`}
            />
          </div>

          {/* Direction buttons */}
          {directions.map((dir) => {
            const hiddenForRoom = HIDDEN_EXITS[room.roomId] ?? []
            const isAvailable = !!room[dir.key] && !hiddenForRoom.includes(dir.key)
            const directionStyle = getDirectionStyle(dir.key, room.directionColors, room.region, isAvailable)
            const positionClasses = {
              'top-left': 'top-8.5 left-8.5',
              'top-center': 'top-1 left-1/2 transform -translate-x-1/2',
              'top-right': 'top-8.5 right-8.5',
              'left': 'top-1/2 left-1 transform -translate-y-1/2',
              'right': 'top-1/2 right-1 transform -translate-y-1/2',
              'bottom-left': 'bottom-8.5 left-8.5',
              'bottom-center': 'bottom-1 left-1/2 transform -translate-x-1/2',
              'bottom-right': 'bottom-8.5 right-8.5',
            }

            const showSpinner = isMoveInProgress && isAvailable

            return (
              <button
                key={dir.key}
                onClick={() => handleNavigate(dir.key)}
                disabled={isDisabled}
                className={`absolute ${positionClasses[dir.position as keyof typeof positionClasses]} w-10 h-10 border rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${directionStyle.className} ${
                  isLocked ? 'cursor-not-allowed opacity-40' : isDisabled ? 'cursor-wait opacity-60' : ''
                }`}
                style={directionStyle.style}
                title={directionTitle(dir.label, isAvailable)}
              >
                {showSpinner ? (
                  <div className="w-4 h-4 border-2 border-fg-bright/70 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowBigUpDash
                    className={`h-5 w-5 ${isAvailable ? 'text-fg-bright' : 'text-fg-secondary'}`}
                    strokeWidth={1.75}
                    style={dir.rotation !== undefined ? { transform: `rotate(${dir.rotation}deg)` } : undefined}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Vertical directions (up/down) */}
        <div className="absolute -left-12 top-1/2 transform -translate-y-1/2 flex flex-col gap-2">
          {verticalDirections.map((dir) => {
            const hiddenForRoom = HIDDEN_EXITS[room.roomId] ?? []
            const isAvailable = !!room[dir.key] && !hiddenForRoom.includes(dir.key)
            const directionStyle = getDirectionStyle(dir.key, room.directionColors, room.region, isAvailable)

            const showSpinner = isMoveInProgress && isAvailable

            return (
              <button
                key={dir.key}
                onClick={() => handleNavigate(dir.key)}
                disabled={isDisabled}
                className={`w-10 h-10 border rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${directionStyle.className} ${
                  isLocked ? 'cursor-not-allowed opacity-40' : isDisabled ? 'cursor-wait opacity-60' : ''
                }`}
                style={directionStyle.style}
                title={directionTitle(dir.label, isAvailable)}
              >
                {showSpinner ? (
                  <div className="w-4 h-4 border-2 border-fg-bright/70 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowBigUp
                    className={`h-5 w-5 ${isAvailable ? 'text-fg-bright' : 'text-fg-secondary'}`}
                    strokeWidth={1.75}
                    style={dir.rotation !== undefined ? { transform: `rotate(${dir.rotation}deg)` } : undefined}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* No spinner over the map while it pans: the exit buttons already show
            one while the server is confirming a move, and a second spinner
            appearing after the room had changed made arrival read as slower
            than it was. */}
      </div>
    </div>
  )
}
