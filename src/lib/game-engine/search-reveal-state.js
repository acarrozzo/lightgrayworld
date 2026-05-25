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
 * - chance (optional): probability in [0,1] that a search reveals the exit; defaults to 1 (always reveals)
 * - failMessage (optional): shown when a chance-based reveal misses; required if chance < 1
 */
const REVEAL_DEFINITIONS = {
  '003': {
    direction: 'west',
    toRoom: '003c',
    successMessage: 'You notice a draft beside the fireplace. Crouching down, you find a narrow opening behind the stones — a tunnel sloping upward into darkness.',
    stateNote: 'A tunnel opening is visible beside the fireplace.',
  },
  '028h': {
    direction: 'north',
    toRoom: '028i',
    chance: 0.5,
    successMessage: 'You run your hands along the slabs and feel a cold draft drifting through the bones. Behind a jagged stone you uncover a crawlspace — the goblins\' real path leads north.',
    failMessage: 'You sift through the bones and scraps but find nothing of interest. The stone walls give up no secrets this time.',
    stateNote: 'A crawlspace gapes open behind the northern slab.',
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
