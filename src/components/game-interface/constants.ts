import type { Player } from '@/lib/game-state'
const { TELEPORT_LOCATIONS: SERVER_TELEPORT_LOCATIONS, TELEPORT_MP_COST: SERVER_TELEPORT_MP_COST } = require('@/lib/game-data/teleport-destinations')
const { MAP_SHEETS } = require('@/lib/game-data/world-map')

export const TRAVEL_DIRECTION_KEYS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down'] as const

export type TravelDirectionKey = (typeof TRAVEL_DIRECTION_KEYS)[number]

// Command shorthand mapping
export const COMMAND_SHORTHAND: Record<string, string> = {
  // Directions
  'n': 'north',
  'e': 'east',
  's': 'south',
  'w': 'west',
  'ne': 'northeast',
  'nw': 'northwest',
  'se': 'southeast',
  'sw': 'southwest',
  'u': 'up',
  'd': 'down',
  // Actions
  'l': 'look',
  'a': 'attack',
}

// Teleport network.
//
// Re-exported from the server's own list rather than copied, so the Fast travel
// grid cannot offer a destination the teleport handler would reject — or omit
// one it allows. Both derive from the world regions in game-data/world-map.js.
export interface TeleportLocation {
  roomId: string
  regionId: string
  name: string
  description: string
  /** VIP rooms: never need discovery. */
  alwaysOpen: boolean
}

export const TELEPORT_LOCATIONS: TeleportLocation[] = SERVER_TELEPORT_LOCATIONS
export const TELEPORT_MP_COST: number = SERVER_TELEPORT_MP_COST

/** A User column that records a found map sheet. */
export type MapFlag = keyof Pick<
  Player,
  | 'roomZeroMap'
  | 'grassyFieldMap'
  | 'grassyFieldUndergroundMap'
  | 'forestMap'
  | 'forestUndergroundMap'
  | 'redTownMap'
  | 'redTownSewersMap'
  | 'rockyFlatsMap'
  | 'rockyFlatsUndergroundMap'
  | 'neverEndingMineMap'
  | 'oceanMap'
  | 'oceanUnderwaterMap'
  | 'lobbyMap'
  | 'solarOfficeMap'
>

// One sheet of map artwork.
export type MapConfigEntry = {
  id: string
  src: string
  title: string
  flag: MapFlag
  /** World region the sheet belongs to (game-data/world-map.js). */
  region: string
  /** Surface / Underground / Sewers / Mine — the chip label inside a region. */
  level: string
}

// Map sheets, from the shared world table so the server's arrival unlocks and
// the client's map views cannot disagree about which sheet a room is on.
export const MAP_CONFIG: MapConfigEntry[] = MAP_SHEETS
