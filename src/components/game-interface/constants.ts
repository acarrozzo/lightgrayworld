import type { Player } from '@/lib/game-state'
import type { TeleportLocation } from '@/components/game-interface/TeleportList'

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

// Teleport locations configuration
export const TELEPORT_LOCATIONS: TeleportLocation[] = [
  { roomId: '999', name: 'Lobby', description: 'The main lobby area' },
  { roomId: '001', name: 'Grassy Field', description: 'Grassy Field Crossroads' },
  { roomId: '000', name: 'Room Zero', description: 'The starting room' },
  { roomId: '088', name: 'Solar Office', description: 'A large, open-plan command office' },
  { roomId: '104', name: 'Forest Crossroads', description: 'The central crossroads of the forest' },
  { roomId: '210', name: 'Red Town', description: 'The Grand Square, at the heart of Red Town' },
]

// Map configuration entry type
export type MapConfigEntry = {
  id: string
  src: string
  title: string
  flag?: keyof Pick<Player, 'grassyFieldMap' | 'grassyFieldUndergroundMap' | 'forestUndergroundMap' | 'redTownMap' | 'redTownSewersMap' | 'roomZeroMap' | 'lobbyMap' | 'solarOfficeMap'>
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
]

