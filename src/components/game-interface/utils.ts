import type { Room, Player } from '@/lib/game-state'
import { TRAVEL_DIRECTION_KEYS, CLIENT_ROOM_GATES, COMMAND_SHORTHAND, MAP_CONFIG, type TravelDirectionKey, type MapConfigEntry } from './constants'

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

// Helper function to determine which map corresponds to a room
export const getMapIdForRoom = (roomId: string): string => {
  if (roomId === '000') return 'room-zero'
  if (roomId === '999') return 'lobby'
  if (roomId === '088') return 'solar-office'
  const scorpionDungeon = ['012b', '012c', '012d', '012e', '012f', '012g', '012h']
  if (roomId.startsWith('003b') || (roomId.startsWith('028') && roomId !== '028') || scorpionDungeon.includes(roomId)) return 'grassy-field-underground'
  if (roomId.startsWith('1')) return 'forest'
  return 'grassy-field'
}

// Helper function to get unlocked maps - all maps are available to everyone
export const getUnlockedMaps = (player: Player | null, currentRoomId: string | undefined): MapConfigEntry[] => {
  // Everyone can view all maps - no restrictions
  return MAP_CONFIG
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

