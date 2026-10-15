import type { Room } from '@/lib/game-state'
import { TRAVEL_DIRECTION_KEYS, COMMAND_SHORTHAND, MAP_CONFIG, type TravelDirectionKey } from './constants'
import { getRoomMapPosition } from './room-map-positions'

const worldMap = require('@/lib/game-data/world-map')

export const findTravelDirection = (fromRoom: Room | null, toRoomId: string): TravelDirectionKey | undefined => {
  if (!fromRoom) {
    return undefined
  }

  return TRAVEL_DIRECTION_KEYS.find((direction) => fromRoom[direction] === toRoomId)
}

/**
 * Whether this exit carries a gate, so the caller can skip the optimistic room
 * swap on a move the server may refuse.
 *
 * Read from the room the server sent. This used to consult a hand-maintained
 * client copy of ROOM_GATES that had fallen to 15 of the server's 65 gates —
 * every gate added since the sewers was missing, so newer content flashed the
 * destination optimistically and then rubber-banded back on rejection.
 */
export function checkIfExitHasGate(room: Room | null, direction: string): boolean {
  const gatedExits = room?.gatedExits
  if (!Array.isArray(gatedExits)) {
    return false
  }
  return gatedExits.includes(direction)
}

/**
 * Normalizes a command by converting shorthand to full command names.
 * Returns the full command if a shorthand is found, otherwise returns the original input.
 * This maintains backward compatibility with full commands.
 */
export const normalizeCommand = (input: string): string => {
  const normalized = input.toLowerCase().trim()
  return COMMAND_SHORTHAND[normalized] || normalized
}

/**
 * Which map sheet a room is drawn on. The rule lives in the shared world table
 * (`game-data/world-map.js`) so the server's arrival unlocks use the same
 * answer; this is the typed doorway to it.
 */
export const getMapIdForRoom = (roomId: string): string => worldMap.getMapIdForRoom(roomId)

/**
 * The map artwork, title and mini-map background-position for the sheet a room
 * sits on, for the compass mini-map.
 */
export const getRoomMapView = (roomId: string | undefined) => {
  const mapId = roomId ? getMapIdForRoom(roomId) : 'grassy-field'
  const entry = MAP_CONFIG.find((m) => m.id === mapId) ?? MAP_CONFIG[0]
  return { mapId, src: entry.src, title: entry.title, position: getRoomMapPosition(roomId) }
}

// Helper function to format direction phrases for feed messages
export const formatDirectionPhrase = (direction: string | null | undefined, context: 'enter' | 'exit'): string => {
  if (!direction) {
    return 'an unknown direction'
  }

  if (direction === 'up') {
    return context === 'enter' ? 'above' : 'upward'
  }

  if (direction === 'down') {
    return context === 'enter' ? 'below' : 'downward'
  }

  return `the ${direction.replace(/_/g, ' ')}`
}
