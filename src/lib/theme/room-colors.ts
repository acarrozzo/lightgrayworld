/**
 * Room colour tokens.
 *
 * Rooms carry four optional colour overrides — name, subtitle, icon and
 * per-direction compass colours. Before the theme system these held raw
 * Tailwind fragments (`gray-300`, `red-800`) that components interpolated into
 * class names, which is what made the palette impossible to theme and easy to
 * break: `text-${room.iconColor}` produces a class Tailwind never compiled.
 *
 * They now hold semantic tokens from a closed vocabulary, resolved here to CSS
 * variables. A room with no override inherits its region's palette, which is
 * the common case; an override exists to say "this room is not like its
 * neighbours", which is a thing the original world data says often and is worth
 * preserving.
 *
 * Nothing in this file builds a class name.
 */

import type { RegionId } from './types'
import { DEFAULT_REGION, isRegionId } from './regions'
import { regionVarName } from './tokens'

/** Which part of a room a colour is being resolved for. */
export type RoomColorSlot = 'title' | 'subtitle' | 'icon' | 'direction' | 'accent' | 'tint'

/**
 * The vocabulary a room override may use.
 *
 * Kept deliberately small. Rooms describe *places*, so they reach for terrain,
 * atmosphere, region identity and text rank — not for gameplay roles like
 * `resource.hp`, which would weld a room's appearance to an unrelated meaning.
 */
export const ROOM_COLOR_TOKENS: Record<string, string> = {
  // Ground and material.
  'terrain.grass': '--terrain-grass',
  'terrain.forest': '--terrain-forest',
  'terrain.dirt': '--terrain-dirt',
  'terrain.wood': '--terrain-wood',
  'terrain.sand': '--terrain-sand',
  'terrain.stone': '--terrain-stone',
  'terrain.water': '--terrain-water',
  'terrain.ash': '--terrain-ash',
  'terrain.bone': '--terrain-bone',

  // Atmosphere.
  'mood.danger': '--mood-danger',
  'mood.arcane': '--mood-arcane',
  'mood.sacred': '--mood-sacred',
  'mood.treasure': '--mood-treasure',
  'mood.calm': '--mood-calm',
  'mood.decay': '--mood-decay',

  // Text rank, for rooms whose titles are deliberately plain.
  'text.bright': '--fg-bright',
  'text.primary': '--fg-primary',
  'text.secondary': '--fg-secondary',
  'text.muted': '--fg-muted',

  // Region identity, for a room that belongs to one region but points at
  // another — a Red Town gate seen from the Rocky Flats road, say.
  'world.roomZero': '--world-room-zero',
  'world.grassyField': '--world-grassy-field',
  'world.grassyFieldUnderground': '--world-grassy-field-underground',
  'world.beach': '--world-beach',
  'world.caves': '--world-caves',
  'world.scorpionPit': '--world-scorpion-pit',
  'world.forest': '--world-forest',
  'world.forestUnderground': '--world-forest-underground',
  'world.redTown': '--world-red-town',
  'world.redTownSewers': '--world-red-town-sewers',
  'world.rockyFlats': '--world-rocky-flats',
  'world.rockyFlatsUnderground': '--world-rocky-flats-underground',
  'world.neverendingMine': '--world-neverending-mine',
  'world.ocean': '--world-ocean',
  'world.underwater': '--world-underwater',
  'world.solarOffice': '--world-solar-office',
  'world.lobby': '--world-lobby',
}

/**
 * Legacy Tailwind fragments, mapped per slot.
 *
 * Two things are going on in the old values, and separating them is what makes
 * the migration faithful rather than lossy:
 *
 *  - **Meaning.** `forest`, `grass`, `dirt` and `sand` were already semantic;
 *    `red-*` meant danger (a bloody path, a fire altar, a scorpion pit), not
 *    Red Town; `purple-*` meant arcane; `yellow-*` meant treasure.
 *
 *  - **Slot.** The shade almost always tracked which field it was in, not what
 *    it meant — a room would carry `nameColor: red-500` with
 *    `subtitleColor: red-800` and `iconColor: red-600`, three shades of one
 *    idea. The theme now derives that lightness ramp itself, so the shades
 *    collapse onto a single token and the ramp is reapplied per slot.
 *
 * Greys are the exception that genuinely needs slot awareness: a grey room
 * *name* is plain text, while a grey room *icon* is stone.
 */
const LEGACY_SHARED: Record<string, string> = {
  grass: 'terrain.grass',
  forest: 'terrain.forest',
  dirt: 'terrain.dirt',
  sand: 'terrain.sand',

  'red-200': 'mood.danger',
  'red-300': 'mood.danger',
  'red-400': 'mood.danger',
  'red-500': 'mood.danger',
  'red-600': 'mood.danger',
  'red-700': 'mood.danger',
  'red-800': 'mood.danger',
  'red-900': 'mood.danger',
  'orange-500': 'mood.danger',
  'orange-600': 'mood.danger',

  'purple-400': 'mood.arcane',
  'purple-500': 'mood.arcane',
  'purple-600': 'mood.arcane',
  'violet-400': 'mood.arcane',
  'violet-500': 'mood.arcane',
  'pink-400': 'mood.arcane',

  'yellow-300': 'mood.treasure',
  'yellow-400': 'mood.treasure',
  'yellow-500': 'mood.treasure',
  'yellow-600': 'mood.treasure',
  'yellow-700': 'mood.treasure',
  'amber-400': 'mood.treasure',
  'amber-500': 'mood.treasure',
  'amber-600': 'mood.treasure',

  'green-300': 'terrain.grass',
  'green-400': 'terrain.grass',
  'green-500': 'terrain.grass',
  'green-600': 'terrain.forest',
  'green-700': 'terrain.forest',

  'blue-300': 'mood.calm',
  'blue-400': 'mood.calm',
  'blue-500': 'mood.calm',
  'blue-600': 'mood.calm',
  'blue-700': 'mood.calm',
  'blue-800': 'mood.calm',
  'blue-900': 'mood.calm',
  'sky-400': 'mood.calm',
  'sky-500': 'mood.calm',
}

const LEGACY_NEUTRALS_BY_SLOT: Record<string, Record<string, string>> = {
  title: {
    white: 'text.bright',
    'gray-100': 'text.bright',
    'gray-200': 'text.bright',
    'neutral-200': 'text.bright',
    'gray-300': 'text.primary',
    'gray-400': 'text.primary',
    'neutral-400': 'text.primary',
    'gray-500': 'text.secondary',
    'gray-600': 'text.secondary',
    'gray-700': 'text.muted',
  },
  subtitle: {
    white: 'text.primary',
    'gray-100': 'text.secondary',
    'gray-200': 'text.secondary',
    'neutral-200': 'text.secondary',
    'gray-300': 'text.secondary',
    'gray-400': 'text.muted',
    'neutral-400': 'text.muted',
    'gray-500': 'text.muted',
    'gray-600': 'text.muted',
    'gray-700': 'text.muted',
  },
  // A grey icon or compass arrow is stone, not text.
  icon: {
    white: 'text.bright',
    'gray-100': 'terrain.bone',
    'gray-200': 'terrain.bone',
    'neutral-200': 'terrain.bone',
    'gray-300': 'terrain.stone',
    'gray-400': 'terrain.stone',
    'neutral-400': 'terrain.stone',
    'gray-500': 'terrain.stone',
    'gray-600': 'terrain.ash',
    'gray-700': 'terrain.ash',
  },
}
LEGACY_NEUTRALS_BY_SLOT.direction = LEGACY_NEUTRALS_BY_SLOT.icon
LEGACY_NEUTRALS_BY_SLOT.accent = LEGACY_NEUTRALS_BY_SLOT.icon
LEGACY_NEUTRALS_BY_SLOT.tint = LEGACY_NEUTRALS_BY_SLOT.icon

/**
 * Translate one legacy value into a semantic token.
 *
 * Used by the data migration, and at runtime as a safety net for any row that
 * has not been migrated yet. Returns null for a value with no sensible reading,
 * which makes the room fall back to its region.
 */
export function legacyRoomColorToken(
  value: string | null | undefined,
  slot: RoomColorSlot
): string | null {
  if (!value) return null

  // Already migrated.
  if (value in ROOM_COLOR_TOKENS) return value

  // Old data occasionally carried an opacity suffix, e.g. `pink-400/70`.
  const bare = value.split('/')[0].trim()

  const neutral = LEGACY_NEUTRALS_BY_SLOT[slot]?.[bare]
  if (neutral) return neutral

  return LEGACY_SHARED[bare] ?? null
}

/** The CSS variable a region uses for one slot. */
export function regionSlotVar(region: RegionId, slot: RoomColorSlot): string {
  return `--world-${regionVarName(region)}-${slot}`
}

/**
 * The CSS colour for one slot of one room.
 *
 * Returns a `var(...)` expression for use in a `style` prop. Resolution order
 * is: the room's own override, then its region's palette. Both are theme
 * variables, so the result re-resolves when the theme changes with no re-render.
 */
export function roomColor(
  override: string | null | undefined,
  region: string | null | undefined,
  slot: RoomColorSlot
): string {
  const regionId: RegionId = isRegionId(region) ? region : DEFAULT_REGION
  const fallback = `var(${regionSlotVar(regionId, slot)})`

  const token = legacyRoomColorToken(override, slot)
  if (!token) return fallback

  const varName = ROOM_COLOR_TOKENS[token]
  if (!varName) return fallback

  // A room override names one colour; the region fallback is already
  // slot-appropriate, so it stays the backstop if the variable is missing.
  return `var(${varName}, ${fallback})`
}
