'use client'

import React, { useState, useRef, type ReactNode } from 'react'
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
   * Always draw the large ring instead of stepping up at 24rem. The desktop
   * sidebar's box sits just under that threshold at its minimum width, yet
   * has the room, so it asks for the large ring outright.
   */
  large?: boolean
  /**
   * Classes for the outer box. The D-pad centres itself inside it: Up and
   * Down in a column on its left, and on its right either `side` or a blank
   * of the same width, so the ring sits in the middle of the box.
   */
  className?: string
  /**
   * What stands to the right of the ring, in the column that mirrors Up and
   * Down: the phone strip puts its verbs there. Absent, a blank the width of
   * the left column keeps the ring centred.
   */
  side?: ReactNode
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
  large = false,
  className = 'w-full',
  side,
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

  // Written out literally so Tailwind generates them. The ring keeps its full
  // size wherever the box, less its two side columns, has room for it, and
  // gives up one step only on the narrowest phones; the map in its centre
  // stays the same size through that step.
  const ringWidth = large ? 'w-64' : 'w-52 @min-[360px]:w-56 @min-[400px]:w-64'
  const ringHeight = large ? 'h-64' : 'h-52 @min-[360px]:h-56 @min-[400px]:h-64'
  const mapSize = large
    ? 'w-[150px] h-[150px] border-[25px]'
    : 'w-[120px] @min-[400px]:w-[150px] h-[120px] @min-[400px]:h-[150px] border-[10px] @min-[400px]:border-[25px]'

  const isDisabled = isNavigating || isMoveInProgress || isLocked
  // Up and Down stand in a column to the left of the ring, as the original
  // placed them, and are always drawn: a room without them shows them faint,
  // so the column never comes and goes and the ring never moves.
  const hidden: string[] = HIDDEN_EXITS[room.roomId] ?? []

  const directionTitle = (label: string, isAvailable: boolean) => {
    if (isLocked) return lockedHint
    return isAvailable ? `Go ${label}` : `No exit ${label}`
  }

  return (
    <div
      className={`compass @container flex items-center justify-center ${className}`}
      title={isLocked ? lockedHint : undefined}
      // The breathing room between the ring and its two side columns. Scales
      // with the compass's own width (a phone strip or a resizable desktop
      // panel) between 6px and 24px.
      style={{ '--compass-side-gap': 'clamp(0.375rem, 3cqw, 1.5rem)' } as React.CSSProperties}
    >
      {/* Up and Down: the left column. */}
      <div className="flex w-11 flex-shrink-0 flex-col gap-2" style={{ marginRight: 'var(--compass-side-gap)' }}>
        {verticalDirections.map((dir) => {
          const isAvailable = !!room[dir.key] && !hidden.includes(dir.key)
          const directionStyle = getDirectionStyle(dir.key, room.directionColors, room.region, isAvailable)
          return (
            <button
              key={dir.key}
              type="button"
              onClick={() => handleNavigate(dir.key)}
              disabled={isDisabled || !isAvailable}
              title={directionTitle(dir.label, isAvailable)}
              aria-label={directionTitle(dir.label, isAvailable)}
              className={`flex h-11 w-11 flex-col items-center justify-center rounded-full border text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${directionStyle.className} ${
                isAvailable ? 'text-fg-bright' : 'text-fg-secondary'
              } ${isLocked ? 'cursor-not-allowed opacity-40' : isDisabled ? 'cursor-wait opacity-60' : ''}`}
              style={directionStyle.style}
            >
              {isMoveInProgress && isAvailable ? (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-fg-bright/70 border-t-transparent animate-spin" />
              ) : (
                <ArrowBigUp className="h-4 w-4" strokeWidth={1.75} style={{ transform: `rotate(${dir.rotation}deg)` }} aria-hidden="true" />
              )}
              <span className="leading-none">{dir.label === 'UP' ? 'Up' : 'Down'}</span>
            </button>
          )
        })}
      </div>

      {/* Main D-pad */}
      <div className={`relative flex-shrink-0 ${ringWidth}`}>
        <div className={`relative ${ringWidth} ${ringHeight}`}>
          {/* Map circle in center. Also opens the map; the World tab is
              the labelled way in. */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onNavigateToMap?.()}
              className={`${mapSize} cursor-pointer rounded-full bg-no-repeat transition-[background-position] duration-[350ms] ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas border-solid border-transparent shadow-xl shadow-black/30 hover:shadow-2xl`}
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

        {/* No spinner over the map while it pans: the exit buttons already show
            one while the server is confirming a move, and a second spinner
            appearing after the room had changed made arrival read as slower
            than it was. */}
      </div>

      {/* The right column: the holder's verbs, or a blank the left column's
          width so the ring stays centred. */}
      <div className="flex flex-shrink-0 flex-col items-stretch justify-center" style={{ marginLeft: 'var(--compass-side-gap)' }}>
        {side ?? <div className="w-11" aria-hidden="true" />}
      </div>
    </div>
  )
}
