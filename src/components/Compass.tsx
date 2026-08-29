'use client'

import React, { useState, useRef } from 'react'
import { useGameStore } from '@/lib/game-state'
import { ArrowBigUp, ArrowBigUpDash } from 'lucide-react'
import Icon from './Icon'

interface CompassProps {
  room: any
  onAction?: (action: string) => void
  onNavigateToMap?: () => void
  onOpenTeleport?: () => void
  isMoveInProgress?: boolean
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

// Function to get room-specific map position using the same coordinates as the original
const getRoomMapPosition = (roomId: string | undefined) => {
  // Map room IDs to specific background-position coordinates (matching the original PHP implementation)
  const roomMapPositions: Record<string, string> = {
    '000': '-350px -350px',    // Room Zero
    '001': '-350px -350px',    // Grassy Field Crossroads
    '002': '-350px -455px',    // Grassy Field South
    '003': '-245px -455px',    // Wood Cabin
    '013': '-140px -560px',    // Marsh Behind the Cabin
    '003c': '-140px -455px',   // Young Soldier
    '004': '-245px -350px',    // Flower Patch
    '005': '-350px -245px',    // Grassy Field North
    '006': '-455px -350px',    // Basic Shop
    '007': '-455px -455px',    // Cave Entrance
    '014': '-140px -350px',    // Dirt Road West
    '015': '-35px -140px',     // On the Beach Sandy shores
    '016': '-35px -245px',     // On the Beach by a Giant Rock
    '017': '-35px -350px',     // Abandoned Docks
    '018': '-35px -455px',     // Rocky Beach
    '019': '-35px -560px',     // Sand Crab Nest
    '020': '-245px -245px',    // Healing Springs
    '021': '-455px -245px',    // Pajama Shaman
    '026': '-350px -560px',    // Stone Path South (south of 002)
    '027': '-350px -665px',    // Dwarf Guard - Gate to the Rocky Flats (south of 026)
    '028': '-245px -665px',    // Bat Cave Entrance (southwest of 026, west of 027)
    '088': 'center',            // Solar Office
    '999': 'center',            // The Lobby
    // Grassy Field Underground rooms (coordinates relative to underground map image)
    '003b':  '-245px -455px',   // Cabin Basement
    '003bb': '-140px -455px',   // Destroyed Basement
    // Spider Cave rooms (overworld map, 105px grid steps from 007 at -455 -455)
    '008': '-455px -560px',     // Spider Cave Exit (south of 007)
    '009': '-455px -665px',     // Spider Cave #009 (south of 008)
    '010': '-560px -665px',     // Spider Cave #010 (east of 009)
    '011': '-560px -560px',     // Spider Cave #011 (east of 008 / north of 010)
    '012': '-665px -560px',     // Above the Scorpion Pit (east of 011)
    // Scorpion Pit underground (105px grid steps, underground map)
    '012b': '-665px -560px',    // Scorpion Pit EXIT
    '012c': '-665px -665px',    // Scorpion Pit Path (south of 012b)
    '012d': '-560px -665px',    // Scorpion Control Room (south of 012e)
    '012e': '-560px -560px',    // Scorpion Guard Room (northwest of 012c)
    '012f': '-560px -455px',    // Scorpion Hall (north of 012e)
    '012g': '-665px -350px',    // Scorpion Queen Nest (northeast of 012f)
    '012h': '-665px -245px',    // Scorpion Throne Room (north of 012g)
    // Bat Cave underground (entry via 028.down = 028b)
    // Row alignment: 028h shares row Y=-455 with 003bb/003b (cabin basements)
    '028b': '-245px -665px',    // Bat Cave EXIT (col 3, bottom row)
    '028c': '-350px -665px',    // Abandoned Workshop (col 4, bottom row)
    '028d': '-245px -560px',    // Bat Cave hub (col 3, middle row; north of 028b)
    '028e': '-140px -665px',    // Bat Nest (col 2, bottom row)
    '028f': '-140px -560px',    // Salamander Cavern (col 2, middle row; north of 028e)
    '028g': '-35px -560px',     // Goblin Tracks (col 1, middle row; west of 028f)
    '028h': '-35px -455px',     // Goblin Dead End (col 1, same row as 003bb/003b)
    '028i': '-35px -350px',     // Goblin Hideout (col 1, top; directly N of 028h)
    // East forest-edge rooms (overworld map, 105px grid steps east from 006)
    '022': '-560px -350px',     // Dirt Road East (east of 006)
    '023': '-665px -350px',     // Jack's Forest Gate (east of 022)
    '024': '-665px -245px',     // Jack Lumber (north of 023)
    '025': '-665px -140px',     // Goblin Woods (north of 024)
    // Forest rooms (coordinates relative to forest map image)
    '101': '-35px -350px',      // Forest Path (entry from west)
    '102': '-140px -455px',     // Forest Path near a Cow Farm
    '103': '-140px -350px',     // Freddie's Cow Farm
    '103b': '-140px -245px',    // Cows (north of 103)
    '103c': '-35px -245px',     // More Cows (west of 103b)
    '104': '-245px -455px',     // Stone Path by a Forest Gate
    '105': '-245px -350px',     // Traveling Wizard
    '106': '-245px -560px',     // Traveling Warrior
    '107': '-245px -665px',     // Stone Path by a Hill
    '108': '-140px -665px',     // Dirt Path Behind a Hill
    '109': '-35px -560px',      // Behind a Hill by a Cave
    '110': '-35px -455px',      // Behind a Hill
    '111': '-140px -560px',     // Ogre Cave
    '112': '-245px -245px',     // Stone Path
    '113': '-245px -140px',     // Stone Path
    '114': '-245px -35px',      // Stone Path by a Magical Gate
    '115': '-140px -140px',     // Kobold Lair
    '116': '-350px -350px',     // Forest Entrance
    '117': '-350px -245px',     // Under a Massive Tree
    '118': '-350px -140px',     // Hunter Bill
    '119': '-455px -35px',      // Forest by a Gold Chest
    '120': '-455px -140px',     // Forest by a River
    '121': '-455px -245px',     // Forest Clearing (hub)
    '122': '-455px -350px',     // Forest Fork in the Road
    '123': '-455px -455px',     // Forest Beaten Path
    '124': '-455px -560px',     // Red Guard Tower
    '125': '-560px -560px',     // Small Graveyard
    '126': '-665px -560px',     // Forest by a Cliff
    '127': '-665px -455px',     // Surrounded by Trees
    '128': '-560px -455px',     // Forest Gnome Tree Hut
    '129': '-665px -665px',     // Forest Dead End
    '130': '-560px -245px',     // Abandoned Campsite
    '131': '-560px -350px',     // Forest by a Lake
    '132': '-665px -350px',     // Forest Rocky Path
    '133': '-665px -245px',     // Forest Twisted Path
    '134': '-665px -140px',     // Approaching Troll Territory
    '135': '-560px -140px',     // Forest atop a Hill
    '136': '-665px -35px',      // Abandoned Troll Guard Post
    '137': '-560px -35px',      // Troll Base Camp
  }

  return roomMapPositions[roomId || '000'] || '-350px -350px' // Default to center
}

// Helper function to get background color classes for a direction button
// Defaults to green if no custom color is specified
// This mapping ensures Tailwind can detect all color classes at build time
const getBackgroundColorClasses = (color: string): { base: string; hover: string } => {
  // Map common Tailwind color values to full class names
  const colorMap: Record<string, { base: string; hover: string }> = {
    'amber-50': { base: 'bg-amber-50/90', hover: 'hover:bg-amber-50' },
    'amber-100': { base: 'bg-amber-100/90', hover: 'hover:bg-amber-50' },
    'amber-200': { base: 'bg-amber-200/90', hover: 'hover:bg-amber-100' },
    'amber-300': { base: 'bg-amber-300/90', hover: 'hover:bg-amber-200' },
    'sand': { base: 'bg-amber-300/90', hover: 'hover:bg-amber-200' },
    'amber-400': { base: 'bg-amber-400/90', hover: 'hover:bg-amber-300' },
    'amber-500': { base: 'bg-amber-500/90', hover: 'hover:bg-amber-400' },
    'amber-600': { base: 'bg-amber-600/90', hover: 'hover:bg-amber-500' },
    'amber-700': { base: 'bg-amber-700/90', hover: 'hover:bg-amber-600' },
    'amber-800': { base: 'bg-amber-800/90', hover: 'hover:bg-amber-700' },
    'amber-900': { base: 'bg-amber-900/90', hover: 'hover:bg-amber-800' },
    'yellow-50': { base: 'bg-yellow-50/90', hover: 'hover:bg-yellow-50' },
    'yellow-100': { base: 'bg-yellow-100/90', hover: 'hover:bg-yellow-50' },
    'yellow-200': { base: 'bg-yellow-200/90', hover: 'hover:bg-yellow-100' },
    'yellow-300': { base: 'bg-yellow-300/90', hover: 'hover:bg-yellow-200' },
    'yellow-400': { base: 'bg-yellow-400/90', hover: 'hover:bg-yellow-300' },
    'yellow-500': { base: 'bg-yellow-500/90', hover: 'hover:bg-yellow-400' },
    'yellow-600': { base: 'bg-yellow-600/90', hover: 'hover:bg-yellow-500' },
    'yellow-700': { base: 'bg-yellow-700/90', hover: 'hover:bg-yellow-600' },
    'dirt': { base: 'bg-taupe-600/90', hover: 'hover:bg-taupe-500' },
    'brown': { base: 'bg-amber-900/90', hover: 'hover:bg-amber-800' },
    'yellow-800': { base: 'bg-yellow-800/90', hover: 'hover:bg-yellow-700' },
    'yellow-900': { base: 'bg-yellow-900/90', hover: 'hover:bg-yellow-800' },
    'red-50': { base: 'bg-red-50/90', hover: 'hover:bg-red-50' },
    'red-100': { base: 'bg-red-100/90', hover: 'hover:bg-red-50' },
    'red-200': { base: 'bg-red-200/90', hover: 'hover:bg-red-100' },
    'red-300': { base: 'bg-red-300/90', hover: 'hover:bg-red-200' },
    'red-400': { base: 'bg-red-400/90', hover: 'hover:bg-red-300' },
    'red-500': { base: 'bg-red-500/90', hover: 'hover:bg-red-400' },
    'red-600': { base: 'bg-red-600/90', hover: 'hover:bg-red-500' },
    'red-700': { base: 'bg-red-700/90', hover: 'hover:bg-red-600' },
    'red-800': { base: 'bg-red-800/90', hover: 'hover:bg-red-700' },
    'red-900': { base: 'bg-red-900/90', hover: 'hover:bg-red-800' },
    'blue-50': { base: 'bg-blue-50/90', hover: 'hover:bg-blue-50' },
    'blue-100': { base: 'bg-blue-100/90', hover: 'hover:bg-blue-50' },
    'blue-200': { base: 'bg-blue-200/90', hover: 'hover:bg-blue-100' },
    'blue-300': { base: 'bg-blue-300/90', hover: 'hover:bg-blue-200' },
    'blue-400': { base: 'bg-blue-400/90', hover: 'hover:bg-blue-300' },
    'blue-500': { base: 'bg-blue-500/90', hover: 'hover:bg-blue-400' },
    'blue-600': { base: 'bg-blue-600/90', hover: 'hover:bg-blue-500' },
    'blue-700': { base: 'bg-blue-700/90', hover: 'hover:bg-blue-600' },
    'blue-800': { base: 'bg-blue-800/90', hover: 'hover:bg-blue-700' },
    'blue-900': { base: 'bg-blue-900/90', hover: 'hover:bg-blue-800' },
    'green-50': { base: 'bg-green-50/90', hover: 'hover:bg-green-50' },
    'green-100': { base: 'bg-green-100/90', hover: 'hover:bg-green-50' },
    'green-200': { base: 'bg-green-200/90', hover: 'hover:bg-green-100' },
    'green-300': { base: 'bg-green-300/90', hover: 'hover:bg-green-200' },
    'green-400': { base: 'bg-green-400/90', hover: 'hover:bg-green-300' },
    'grass': { base: 'bg-green-400/90', hover: 'hover:bg-green-300' },
    'forest': { base: 'bg-green-800/90', hover: 'hover:bg-green-700' },
    'green-500': { base: 'bg-green-500/90', hover: 'hover:bg-green-400' },
    'green-600': { base: 'bg-green-600/90', hover: 'hover:bg-green-500' },
    'green-700': { base: 'bg-green-700/90', hover: 'hover:bg-green-600' },
    'green-800': { base: 'bg-green-800/90', hover: 'hover:bg-green-700' },
    'green-900': { base: 'bg-green-900/90', hover: 'hover:bg-green-800' },
    'purple-50': { base: 'bg-purple-50/90', hover: 'hover:bg-purple-50' },
    'purple-100': { base: 'bg-purple-100/90', hover: 'hover:bg-purple-50' },
    'purple-200': { base: 'bg-purple-200/90', hover: 'hover:bg-purple-100' },
    'purple-300': { base: 'bg-purple-300/90', hover: 'hover:bg-purple-200' },
    'purple-400': { base: 'bg-purple-400/90', hover: 'hover:bg-purple-300' },
    'purple-500': { base: 'bg-purple-500/90', hover: 'hover:bg-purple-400' },
    'purple-600': { base: 'bg-purple-600/90', hover: 'hover:bg-purple-500' },
    'purple-700': { base: 'bg-purple-700/90', hover: 'hover:bg-purple-600' },
    'purple-800': { base: 'bg-purple-800/90', hover: 'hover:bg-purple-700' },
    'purple-900': { base: 'bg-purple-900/90', hover: 'hover:bg-purple-800' },
    'orange-50': { base: 'bg-orange-50/90', hover: 'hover:bg-orange-50' },
    'orange-100': { base: 'bg-orange-100/90', hover: 'hover:bg-orange-50' },
    'orange-200': { base: 'bg-orange-200/90', hover: 'hover:bg-orange-100' },
    'orange-300': { base: 'bg-orange-300/90', hover: 'hover:bg-orange-200' },
    'orange-400': { base: 'bg-orange-400/90', hover: 'hover:bg-orange-300' },
    'orange-500': { base: 'bg-orange-500/90', hover: 'hover:bg-orange-400' },
    'orange-600': { base: 'bg-orange-600/90', hover: 'hover:bg-orange-500' },
    'orange-700': { base: 'bg-orange-700/90', hover: 'hover:bg-orange-600' },
    'orange-800': { base: 'bg-orange-800/90', hover: 'hover:bg-orange-700' },
    'orange-900': { base: 'bg-orange-900/90', hover: 'hover:bg-orange-800' },
    'pink-50': { base: 'bg-pink-50/90', hover: 'hover:bg-pink-50' },
    'pink-100': { base: 'bg-pink-100/90', hover: 'hover:bg-pink-50' },
    'pink-200': { base: 'bg-pink-200/90', hover: 'hover:bg-pink-100' },
    'pink-300': { base: 'bg-pink-300/90', hover: 'hover:bg-pink-200' },
    'pink-400': { base: 'bg-pink-400/90', hover: 'hover:bg-pink-300' },
    'pink-500': { base: 'bg-pink-500/90', hover: 'hover:bg-pink-400' },
    'pink-600': { base: 'bg-pink-600/90', hover: 'hover:bg-pink-500' },
    'pink-700': { base: 'bg-pink-700/90', hover: 'hover:bg-pink-600' },
    'pink-800': { base: 'bg-pink-800/90', hover: 'hover:bg-pink-700' },
    'pink-900': { base: 'bg-pink-900/90', hover: 'hover:bg-pink-800' },
    'gray-50': { base: 'bg-gray-50/90', hover: 'hover:bg-gray-50' },
    'gray-100': { base: 'bg-gray-100/90', hover: 'hover:bg-gray-50' },
    'gray-200': { base: 'bg-gray-200/90', hover: 'hover:bg-gray-100' },
    'gray-300': { base: 'bg-gray-300/90', hover: 'hover:bg-gray-200' },
    'gray-400': { base: 'bg-gray-400/90', hover: 'hover:bg-gray-300' },
    'gray-500': { base: 'bg-gray-500/90', hover: 'hover:bg-gray-400' },
    'gray-600': { base: 'bg-gray-600/90', hover: 'hover:bg-gray-500' },
    'gray-700': { base: 'bg-gray-700/90', hover: 'hover:bg-gray-600' },
    'gray-800': { base: 'bg-gray-800/90', hover: 'hover:bg-gray-700' },
    'gray-900': { base: 'bg-gray-900/90', hover: 'hover:bg-gray-800' },
    'indigo-50': { base: 'bg-indigo-50/90', hover: 'hover:bg-indigo-50' },
    'indigo-100': { base: 'bg-indigo-100/90', hover: 'hover:bg-indigo-50' },
    'indigo-200': { base: 'bg-indigo-200/90', hover: 'hover:bg-indigo-100' },
    'indigo-300': { base: 'bg-indigo-300/90', hover: 'hover:bg-indigo-200' },
    'indigo-400': { base: 'bg-indigo-400/90', hover: 'hover:bg-indigo-300' },
    'indigo-500': { base: 'bg-indigo-500/90', hover: 'hover:bg-indigo-400' },
    'indigo-600': { base: 'bg-indigo-600/90', hover: 'hover:bg-indigo-500' },
    'indigo-700': { base: 'bg-indigo-700/90', hover: 'hover:bg-indigo-600' },
    'indigo-800': { base: 'bg-indigo-800/90', hover: 'hover:bg-indigo-700' },
    'indigo-900': { base: 'bg-indigo-900/90', hover: 'hover:bg-indigo-800' },
  }
  
  return colorMap[color] || { base: `bg-${color}/90`, hover: `hover:bg-${color}` }
}

// Per-room directions that should render as "no exit" on the compass even though
// the underlying room data has a destination. The click still works — only the
// visual treatment is suppressed. Useful for hidden back-doors.
const HIDDEN_EXITS: Record<string, string[]> = {
  '017': ['southeast'],
  '019': ['northeast'],
}

const getDirectionColorClasses = (directionKey: string, directionColors: any, isAvailable: boolean): string => {
  if (!isAvailable) {
    return 'bg-gray-900/30 border-gray-800/20 opacity-25'
  }

  // Check if there's a custom color for this direction
  const customColor = directionColors?.[directionKey]
  
  if (customColor) {
    const colorClasses = getBackgroundColorClasses(customColor)
    return `${colorClasses.base} ${colorClasses.hover} border-white/10 hover:border-white/20 shadow-sm`
  }

  // Default to green
  return 'bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 border-green-500/30 hover:border-green-400/50 shadow-sm shadow-green-900/30'
}

export default function Compass({ room, onAction, onNavigateToMap, onOpenTeleport, isMoveInProgress = false }: CompassProps) {
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
    }, 1000) // Match CSS transition duration

    return () => {
      console.log('[Compass] Cleaning up transition timer for room change')
      clearTimeout(timer)
    }
  }, [room?.roomId, currentPosition])

  const handleNavigate = async (direction: string) => {
    console.log('[Compass] handleNavigate called with direction:', direction)
    console.log('[Compass] isNavigating:', isNavigating, 'isMoveInProgress:', isMoveInProgress, 'room[direction]:', room?.[direction], 'onAction:', !!onAction)
    if (isNavigating || isMoveInProgress || !onAction) {
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
  const isLobby = room.roomId === '999'
  const isSolarOffice = room.roomId === '088'
  const scorpionDungeonRooms = ['012b', '012c', '012d', '012e', '012f', '012g', '012h']
  const isUnderground = room.roomId?.startsWith('003b') || (room.roomId?.startsWith('028') && room.roomId !== '028') || scorpionDungeonRooms.includes(room.roomId)
  const isForest = room.roomId?.startsWith('1')
  const mapBackground = isRoomZero
    ? '/img/lightgray_map_roomzero.jpg'
    : isLobby
    ? '/img/lightgray_map_the_lobby.jpg'
    : isSolarOffice
    ? '/img/lightgray_map_solar_office.jpg'
    : isUnderground
    ? '/img/lightgray_map_grassyfield_underground_s1.jpg'
    : isForest
    ? '/img/lightgray_map_forest_main.jpg'
    : '/img/lightgray_map_grassyfield_main_s1.jpg'
  const mapPosition = isRoomZero || isLobby || isSolarOffice
    ? 'center'
    : (isTransitioning ? targetPosition : currentPosition)
  const mapTitle = isRoomZero ? 'Room Zero' : isLobby ? 'The Lobby' : isSolarOffice ? 'Solar Office' : isUnderground ? 'Grassy Field Underground' : isForest ? 'Forest' : 'Grassy Field'

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

  return (
    <div className="compass w-full sm:max-w-[380px] max-w-[320px] mx-auto">
      {/* Main D-pad */}
      <div className="relative">
        <div className="relative w-56 sm:w-64 h-56 sm:h-64 mx-auto">
          {/* Map circle in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onNavigateToMap?.()}
              className="w-[120px] sm:w-[150px] h-[120px] sm:h-[150px] cursor-pointer rounded-full bg-no-repeat transition-all duration-[1000ms] ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 border-[10px] sm:border-[25px] border-solid border-transparent shadow-xl shadow-black/30 hover:shadow-2xl"
              style={{
                backgroundImage: `url('${mapBackground}')`,
                backgroundPosition: mapPosition
              }}
              aria-label="View full map"
              title={mapTitle}
            />
          </div>

          {/* Direction buttons */}
          {directions.map((dir) => {
            const hiddenForRoom = HIDDEN_EXITS[room.roomId] ?? []
            const isAvailable = !!room[dir.key] && !hiddenForRoom.includes(dir.key)
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

            const isDisabled = isNavigating || isMoveInProgress
            const showSpinner = isMoveInProgress && isAvailable

            return (
              <button
                key={dir.key}
                onClick={() => handleNavigate(dir.key)}
                disabled={isDisabled}
                className={`absolute ${positionClasses[dir.position as keyof typeof positionClasses]} w-10 h-10 border rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${getDirectionColorClasses(dir.key, room.directionColors, isAvailable)} ${isDisabled ? 'cursor-wait opacity-60' : ''}`}
                title={isAvailable ? `Go ${dir.label}` : `No exit ${dir.label}`}
              >
                {showSpinner ? (
                  <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowBigUpDash
                    className={`h-5 w-5 ${isAvailable ? 'text-white' : 'text-gray-400'}`}
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

            const isDisabled = isNavigating || isMoveInProgress
            const showSpinner = isMoveInProgress && isAvailable

            return (
              <button
                key={dir.key}
                onClick={() => handleNavigate(dir.key)}
                disabled={isDisabled}
                className={`w-10 h-10 border rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${getDirectionColorClasses(dir.key, room.directionColors, isAvailable)} ${isDisabled ? 'cursor-wait opacity-60' : ''}`}
                title={isAvailable ? `Go ${dir.label}` : `No exit ${dir.label}`}
              >
                {showSpinner ? (
                  <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowBigUp
                    className={`h-5 w-5 ${isAvailable ? 'text-white' : 'text-gray-400'}`}
                    strokeWidth={1.75}
                    style={dir.rotation !== undefined ? { transform: `rotate(${dir.rotation}deg)` } : undefined}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Loading indicator - show during transition (not during move-in-progress as buttons show spinners) */}
        {isTransitioning && !isMoveInProgress && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-500/50 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  )
}