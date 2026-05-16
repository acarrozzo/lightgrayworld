/**
 * Per-player, session-only lever state.
 * Resets on disconnect or server restart.
 * Map<playerId, Set<leverIds>>
 */
const activatedLevers = new Map()

function pullLever(playerId, leverId) {
  if (!activatedLevers.has(playerId)) {
    activatedLevers.set(playerId, new Set())
  }
  activatedLevers.get(playerId).add(leverId)
}

function resetLever(playerId, leverId) {
  activatedLevers.get(playerId)?.delete(leverId)
}

function isLeverPulled(playerId, leverId) {
  return activatedLevers.get(playerId)?.has(leverId) ?? false
}

function clearPlayerLevers(playerId) {
  activatedLevers.delete(playerId)
}

/**
 * Returns a dynamic state note string for rooms that have lever-driven state,
 * or null if the room has no lever state to display.
 */
function getRoomStateNote(playerId, roomId) {
  if (roomId === '012d') {
    const pulled = isLeverPulled(playerId, '012d-lever')
    return pulled
      ? 'The lever is currently pulled DOWN'
      : 'The lever is currently UP'
  }
  if (roomId === '012f') {
    const pulled = isLeverPulled(playerId, '012d-lever')
    return pulled
      ? 'The northeast passage is open.'
      : 'The northeast passage is sealed.'
  }
  return null
}

/**
 * Returns per-action overrides (className and/or icon) for room action buttons
 * based on dynamic state. Keys match action names defined in room-actions.ts.
 */
function getRoomActionOverrides(playerId, roomId) {
  if (roomId === '012d') {
    const pulled = isLeverPulled(playerId, '012d-lever')
    return {
      'pull lever': pulled
        ? { className: 'bg-green-700/80 hover:bg-green-700', icon: 'lever-down' }
        : { className: 'bg-yellow-600/80 hover:bg-yellow-600', icon: 'lever-up' },
    }
  }
  return null
}

module.exports = { pullLever, resetLever, isLeverPulled, clearPlayerLevers, getRoomStateNote, getRoomActionOverrides }
