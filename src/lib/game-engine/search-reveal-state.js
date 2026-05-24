/**
 * Per-player, per-visit search reveal state.
 * Tracks which rooms a player has "search-revealed" since their last entry.
 * Cleared on re-entry to the same room and on disconnect.
 *
 * Used by rooms where searching unmasks a hidden exit (e.g. 003 -> 003c).
 */
const revealedRooms = new Map() // Map<playerId, Set<roomId>>

function markRevealed(playerId, roomId) {
  if (!revealedRooms.has(playerId)) {
    revealedRooms.set(playerId, new Set())
  }
  revealedRooms.get(playerId).add(roomId)
}

function clearRevealed(playerId, roomId) {
  revealedRooms.get(playerId)?.delete(roomId)
}

function isRevealed(playerId, roomId) {
  return revealedRooms.get(playerId)?.has(roomId) ?? false
}

function clearPlayerReveals(playerId) {
  revealedRooms.delete(playerId)
}

/**
 * Per-room reveal definitions. Each entry describes what searching the room unmasks.
 * - direction: the compass key that becomes traversable when revealed
 * - toRoom: the destination of that direction
 * - successMessage: shown via action:feedback when the reveal fires
 * - stateNote: persistent hint text shown in the room while revealed
 */
const REVEAL_DEFINITIONS = {
  '003': {
    direction: 'west',
    toRoom: '003c',
    successMessage: 'You notice a draft beside the fireplace. Crouching down, you find a narrow opening behind the stones — a tunnel sloping upward into darkness.',
    stateNote: 'A tunnel opening is visible beside the fireplace.',
  },
}

function getRevealDefinition(roomId) {
  return REVEAL_DEFINITIONS[roomId] ?? null
}

function getRoomStateNote(playerId, roomId) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return null
  return isRevealed(playerId, roomId) ? def.stateNote : null
}

/**
 * Returns a partial exit map { [direction]: toRoom } that should override the
 * DB-canonical exits when serving room data to this player. For rooms with a
 * reveal definition, the configured direction is HIDDEN (set to null) until
 * the player has searched.
 */
function getExitOverlay(playerId, roomId) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return null
  if (isRevealed(playerId, roomId)) return null
  return { [def.direction]: null }
}

module.exports = {
  markRevealed,
  clearRevealed,
  isRevealed,
  clearPlayerReveals,
  getRevealDefinition,
  getRoomStateNote,
  getExitOverlay,
  REVEAL_DEFINITIONS,
}
