import type { Room, Player } from '@/lib/game-state'
import { TRAVEL_DIRECTION_KEYS, CLIENT_ROOM_GATES, COMMAND_SHORTHAND, MAP_CONFIG, type TravelDirectionKey, type MapConfigEntry } from './constants'
import { getRoomMapMarker, getRoomMapPosition } from './room-map-positions'

export const findTravelDirection = (fromRoom: Room | null, toRoomId: string): TravelDirectionKey | undefined => {
  if (!fromRoom) {
    return undefined
  }

  return TRAVEL_DIRECTION_KEYS.find((direction) => fromRoom[direction] === toRoomId)
}

/**
 * Check if an exit has a gate (client-side check for optimistic update skipping)
 */
export function checkIfExitHasGate(roomId: string, direction: string): boolean {
  const roomGates = CLIENT_ROOM_GATES[roomId]
  if (!roomGates) {
    return false
  }
  return roomGates[direction] === true
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
 * Rooms below Red Town: the sewers proper, the Thieve's Den and the Catacombs.
 * Listed explicitly rather than matched on a `232` prefix because two `232*`
 * rooms live above ground on the Red Town map — the Back Alley by a Sewer (232)
 * and the Thieve's Den Secret Entrance (232mm).
 */
const RED_TOWN_SEWER_ROOMS = new Set([
  '232a', '232b', '232c', '232d', '232e', '232f', '232g', '232h', '232i', '232j',
  '232k', '232l', '232m', '232n', '232o', '232p', '232q', '232r', '232s', '232t',
  '232u', '232v', '232w', '232x', '232y', '232z',
])

// Helper function to determine which map corresponds to a room
/**
 * Rocky Flats rooms that sit on the underground sheet rather than the surface
 * one: the Abandoned Mine's four rooms and the chamber below the Stone Grotto.
 * The surface entrances (315, 321) stay on the surface map.
 */
const ROCKY_FLATS_UNDERGROUND = new Set(['315a', '315b', '315c', '315d', '321b'])

export const getMapIdForRoom = (roomId: string): string => {
  if (roomId === '000') return 'room-zero'
  if (roomId === '999') return 'lobby'
  if (roomId === '088') return 'solar-office'
  const scorpionDungeon = ['012b', '012c', '012d', '012e', '012f', '012g', '012h']
  if (roomId.startsWith('003b') || (roomId.startsWith('028') && roomId !== '028') || scorpionDungeon.includes(roomId)) return 'grassy-field-underground'
  const forestUnderground = ['111a','111b','111c','111d','111e','111f','111g','111h','111i','111j','111k','115a','115b','115c','115d','115e','115f','115g','115h','115i','115j','115k']
  if (forestUnderground.includes(roomId)) return 'forest-underground'
  if (RED_TOWN_SEWER_ROOMS.has(roomId)) return 'red-town-sewers'
  // The Neverending Mine: Level 0 is drawn on the Rocky Flats Underground sheet
  // where the mine head sits; everything below it is on the mine's own artwork.
  if (roomId === '311-00') return 'rocky-flats-underground'
  if (roomId.startsWith('311-')) return 'neverending-mine'
  if (ROCKY_FLATS_UNDERGROUND.has(roomId)) return 'rocky-flats-underground'
  if (roomId.startsWith('3')) return 'rocky-flats'
  // The Red Guard Captain's lookout tower is drawn on the Forest artwork even
  // though its room ID belongs to the Red Town block.
  if (roomId === '215') return 'forest'
  if (roomId.startsWith('2')) return 'red-town'
  if (roomId.startsWith('1')) return 'forest'
  return 'grassy-field'
}

/**
 * The map artwork, title and mini-map background-position for the map a room sits
 * on. Shared by the compass mini-map and the full map view so the two cannot drift.
 */
export const getRoomMapView = (roomId: string | undefined) => {
  const mapId = roomId ? getMapIdForRoom(roomId) : 'grassy-field'
  const entry = MAP_CONFIG.find((m) => m.id === mapId) ?? MAP_CONFIG[0]
  return { mapId, src: entry.src, title: entry.title, position: getRoomMapPosition(roomId) }
}

// Helper function to get unlocked maps - all maps are available to everyone
export const getUnlockedMaps = (player: Player | null, currentRoomId: string | undefined): MapConfigEntry[] => {
  // Everyone can view all maps - no restrictions
  return MAP_CONFIG
}

// Resolve the image + picker options for a map id. Shared by the sidebar map
// sub-view and the full-screen MapPanel so the two cannot drift.
export const resolveMapView = (
  currentMapId: string,
  availableMaps: MapConfigEntry[],
  currentRoomId?: string,
) => {
  const selected = MAP_CONFIG.find((m) => m.id === currentMapId)
  // Only mark the player's position while they are looking at the map they are
  // actually standing on — switching maps should not fake a location.
  const marker =
    currentRoomId && getMapIdForRoom(currentRoomId) === currentMapId
      ? getRoomMapMarker(currentRoomId)
      : null
  return {
    src: selected?.src || '',
    title: selected?.title || 'Map',
    options: availableMaps.map((map) => ({ id: map.id, src: map.src, title: map.title })),
    marker,
  }
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

