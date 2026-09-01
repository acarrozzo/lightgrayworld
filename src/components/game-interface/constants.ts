import type { Player } from '@/lib/game-state'
import type { TeleportLocation } from '@/components/game-interface/TeleportList'
const { TELEPORT_LOCATIONS: SERVER_TELEPORT_LOCATIONS } = require('@/lib/game-data/teleport-destinations')

export const TRAVEL_DIRECTION_KEYS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'up', 'down'] as const

export type TravelDirectionKey = (typeof TRAVEL_DIRECTION_KEYS)[number]

/**
 * Client-side map of room gates (mirrors server-side ROOM_GATES structure)
 * Used to skip optimistic updates for gated exits
 */
export const CLIENT_ROOM_GATES: Record<string, Record<string, boolean>> = {
  '002': {
    'south': true,
  },
  '003': {
    'west': true,
  },
  '004': {
    'west': true,
  },
  '020': {
    'northwest': true,
  },
  '012f': {
    'northeast': true,
  },
  // Red Town — the Red Guard's Ogre requirement on both roads in.
  '107': {
    'south': true,
  },
  '124': {
    'south': true,
  },
  // Back-alley and sewer secret doors (hidden until searched).
  '232': {
    'south': true,
  },
  '233': {
    'southeast': true,
  },
  '232mm': {
    'northeast': true,
  },
  '232b': {
    'east': true,
  },
  '232l': {
    'southwest': true,
  },
  '232j': {
    'northeast': true,
  },
  // The sewer river — both banks need wings.
  '232d': {
    'north': true,
  },
  '232y': {
    'south': true,
  },
}

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

// Teleport locations configuration.
//
// Re-exported from the server's own list rather than copied, so the menu cannot
// offer a destination the teleport handler would reject — or omit one it allows.
export const TELEPORT_LOCATIONS: TeleportLocation[] = SERVER_TELEPORT_LOCATIONS

// Map configuration entry type
export type MapConfigEntry = {
  id: string
  src: string
  title: string
  flag?: keyof Pick<Player, 'grassyFieldMap' | 'grassyFieldUndergroundMap' | 'forestUndergroundMap' | 'redTownMap' | 'redTownSewersMap' | 'rockyFlatsMap' | 'rockyFlatsUndergroundMap' | 'neverEndingMineMap' | 'roomZeroMap' | 'lobbyMap' | 'solarOfficeMap'>
}

// Map configuration
export const MAP_CONFIG: MapConfigEntry[] = [
  { id: 'grassy-field', src: '/img/lightgray_map_grassyfield_main_s1.jpg', title: 'Grassy Field', flag: 'grassyFieldMap' },
  { id: 'grassy-field-underground', src: '/img/lightgray_map_grassyfield_underground.jpg', title: 'Grassy Field Underground', flag: 'grassyFieldUndergroundMap' },
  { id: 'room-zero', src: '/img/lightgray_map_roomzero.jpg', title: 'Room Zero', flag: 'roomZeroMap' },
  { id: 'lobby', src: '/img/lightgray_map_the_lobby.jpg', title: 'The Lobby', flag: 'lobbyMap' },
  { id: 'solar-office', src: '/img/lightgray_map_solar_office.jpg', title: 'Solar Office', flag: 'solarOfficeMap' },
  { id: 'forest', src: '/img/lightgray_map_forest_main.jpg', title: 'Forest' },
  { id: 'forest-underground', src: '/img/lightgray_map_forest_underground.jpg', title: 'Forest Underground', flag: 'forestUndergroundMap' },
  { id: 'red-town', src: '/img/lightgray_map_redtown_main.jpg', title: 'Red Town', flag: 'redTownMap' },
  { id: 'red-town-sewers', src: '/img/lightgray_map_redtown_sewers.jpg', title: 'Red Town Sewers', flag: 'redTownSewersMap' },
  { id: 'rocky-flats', src: '/img/lightgray_map_rockyflats_main.jpg', title: 'Rocky Flats', flag: 'rockyFlatsMap' },
  { id: 'rocky-flats-underground', src: '/img/lightgray_map_rockyflats_underground.jpg', title: 'Rocky Flats Underground', flag: 'rockyFlatsUndergroundMap' },
  { id: 'neverending-mine', src: '/img/lightgray_map_neverendingmine_main.jpg', title: 'The Neverending Mine', flag: 'neverEndingMineMap' },
]

