/**
 * The fixed teleport network.
 *
 * This is the server's authority on where a teleport may land, and the same list
 * the client renders in the Explore panel — it is imported by
 * `components/game-interface/constants.ts` rather than copied, so the menu can
 * never offer a destination the server rejects (or hide one it would allow).
 *
 * Destinations decided at runtime rather than listed here — a guild lair, a
 * defeat respawn, a flee retreat — are authorized per-use through
 * `game-engine/teleport-grants`, not by adding them to this list.
 */
const TELEPORT_LOCATIONS = [
  { roomId: '999', name: 'Lobby', description: 'The main lobby area' },
  { roomId: '001', name: 'Grassy Field', description: 'Grassy Field Crossroads' },
  { roomId: '000', name: 'Room Zero', description: 'The starting room' },
  { roomId: '088', name: 'Solar Office', description: 'A large, open-plan command office' },
  { roomId: '104', name: 'Forest Crossroads', description: 'The central crossroads of the forest' },
  { roomId: '210', name: 'Red Town', description: 'The Grand Square, at the heart of Red Town' },
  { roomId: '303', name: 'Rocky Flats', description: 'The Crossroads, where the Dwarf Captain stands watch' },
]

const TELEPORT_ROOM_IDS = new Set(TELEPORT_LOCATIONS.map((location) => location.roomId))

/** True when `roomId` is part of the always-available teleport network. */
function isFixedTeleportDestination(roomId) {
  return TELEPORT_ROOM_IDS.has(roomId)
}

module.exports = {
  TELEPORT_LOCATIONS,
  isFixedTeleportDestination,
}
