/**
 * World regions: the unit of regional colour identity.
 *
 * This is deliberately *not* `getMapIdForRoom` from the game interface. That
 * function answers "which artwork sheet is this room drawn on", which is a
 * different question — the Beach, the Spider Cave and the Scorpion Pit all
 * share the Grassy Field sheet but are three distinct places, and the Red Guard
 * Captain's tower (215) is drawn on the Forest sheet while belonging to Red
 * Town. Colour identity follows the place, not the paper.
 *
 * `Room.region` in the database is the authority at runtime;
 * `getRegionForRoom` is the fallback used to seed that column and to colour
 * rooms that predate it.
 */

import type { RegionId } from './types'

export interface RegionMeta {
  id: RegionId
  /** Display name for the Color Lab and world tools. */
  name: string
}

export const REGIONS: RegionMeta[] = [
  { id: 'roomZero', name: 'Room Zero' },
  { id: 'grassyField', name: 'Grassy Field' },
  { id: 'grassyFieldUnderground', name: 'Grassy Field Underground' },
  { id: 'beach', name: 'The Beach' },
  { id: 'caves', name: 'Caves' },
  { id: 'scorpionPit', name: 'Scorpion Pit' },
  { id: 'forest', name: 'Forest' },
  { id: 'forestUnderground', name: 'Forest Underground' },
  { id: 'redTown', name: 'Red Town' },
  { id: 'redTownSewers', name: 'Red Town Sewers' },
  { id: 'rockyFlats', name: 'Rocky Flats' },
  { id: 'rockyFlatsUnderground', name: 'Rocky Flats Underground' },
  { id: 'neverendingMine', name: 'The Neverending Mine' },
  { id: 'solarOffice', name: 'Solar Office' },
  { id: 'lobby', name: 'The Lobby' },
]

export const REGION_IDS: RegionId[] = REGIONS.map((r) => r.id)

export const DEFAULT_REGION: RegionId = 'grassyField'

export function isRegionId(value: unknown): value is RegionId {
  return typeof value === 'string' && (REGION_IDS as string[]).includes(value)
}

/** The five shoreline rooms west and south-west of the Grassy Field. */
const BEACH = new Set(['015', '016', '017', '018', '019'])

/** Spider Cave proper, plus the whole Bat Cave complex under the stone path. */
const CAVES = new Set([
  '008', '009', '010', '011',
  '028', '028b', '028c', '028d', '028e', '028f', '028g', '028h', '028i',
])

/** The pit itself. `012` sits above it, in the open air, and stays overworld. */
const SCORPION_PIT = new Set(['012b', '012c', '012d', '012e', '012f', '012g', '012h'])

/** Under the Old Man's cabin. */
const GRASSY_FIELD_UNDERGROUND = new Set(['003b', '003bb'])

/** The Ogre Cave and Kobold Lair complexes below the forest. */
const FOREST_UNDERGROUND = new Set([
  '111a', '111b', '111c', '111d', '111e', '111f', '111g', '111h', '111i', '111j', '111k',
  '115a', '115b', '115c', '115d', '115e', '115f', '115g', '115h', '115i', '115j', '115k',
])

/**
 * The sewers, Thieve's Den and Catacombs below Red Town.
 *
 * Listed explicitly rather than matched on a `232` prefix, because two `232*`
 * rooms are above ground: the Back Alley by a Sewer (232) and the Thieve's Den
 * Secret Entrance (232mm).
 */
const RED_TOWN_SEWERS = new Set([
  '232a', '232b', '232c', '232d', '232e', '232f', '232g', '232h', '232i', '232j',
  '232k', '232l', '232m', '232n', '232o', '232p', '232q', '232r', '232s', '232t',
  '232u', '232v', '232w', '232x', '232y', '232z',
])

/**
 * Below Rocky Flats: the Abandoned Mine's four rooms, the chamber under the
 * Stone Grotto, and the mine head. Mine Level 0 belongs here rather than to the
 * Neverending Mine — it is the shaft entrance, still in Rocky Flats rock.
 */
const ROCKY_FLATS_UNDERGROUND = new Set(['315a', '315b', '315c', '315d', '321b', '311-00'])

export function getRegionForRoom(roomId: string | null | undefined): RegionId {
  if (!roomId) return DEFAULT_REGION

  if (roomId === '000') return 'roomZero'
  if (roomId === '999') return 'lobby'
  if (roomId === '088') return 'solarOffice'

  if (BEACH.has(roomId)) return 'beach'
  if (CAVES.has(roomId)) return 'caves'
  if (SCORPION_PIT.has(roomId)) return 'scorpionPit'
  if (GRASSY_FIELD_UNDERGROUND.has(roomId)) return 'grassyFieldUnderground'
  if (FOREST_UNDERGROUND.has(roomId)) return 'forestUnderground'
  if (RED_TOWN_SEWERS.has(roomId)) return 'redTownSewers'
  if (ROCKY_FLATS_UNDERGROUND.has(roomId)) return 'rockyFlatsUnderground'

  // Everything below Level 0 is the mine's own endless shaft.
  if (roomId.startsWith('311-')) return 'neverendingMine'

  // The Red Guard Captain's lookout tower carries a Red Town id but stands out
  // in the forest, and reads as forest.
  if (roomId === '215') return 'forest'

  if (roomId.startsWith('3')) return 'rockyFlats'
  if (roomId.startsWith('2')) return 'redTown'
  if (roomId.startsWith('1')) return 'forest'

  return DEFAULT_REGION
}
