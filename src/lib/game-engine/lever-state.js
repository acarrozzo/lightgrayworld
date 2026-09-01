/**
 * Per-player, session-only lever state.
 * Resets on disconnect or server restart.
 * Map<playerId, Set<leverIds>>
 */
const activatedLevers = new Map()

/**
 * The Kobold Lair's Control Room switch (115h), which grinds open the false west
 * wall of the Bloody Path (115e) onto the Hidden Chamber (115f). Session-scoped
 * exactly like the original's `koboldswitch` flag: flip it, walk the lair, and
 * it is gone again next session.
 */
const KOBOLD_SWITCH = '115h-lever'

/**
 * Freddie's cow-farm toll (103). Not a lever, but the same thing mechanically:
 * an ephemeral per-player flag that opens one passage and is spent on use. The
 * original kept it in `$_SESSION['cowtoll']` and cleared it the moment you went
 * through the gate, so every trip north costs another 50 gold.
 */
const COW_TOLL = '103-cowtoll'

/**
 * The Red Fort Kitchen's switch (325), which grinds the carved stone door open
 * on the Grotto entrance a long way southeast of it (319 → 321). Session-scoped
 * exactly like the original's `$_SESSION['grottoswitch']`: throw it, walk round
 * to the Grotto, and it has closed again by your next session.
 *
 * The original also cleared the flag the moment you walked through, so a second
 * trip in meant a second trip past the Butcher. That is kept — see the gate's
 * `onPass` in room-gates.js.
 */
const GROTTO_SWITCH = '325-grottoswitch'

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
  if (roomId === '115h') {
    return isLeverPulled(playerId, KOBOLD_SWITCH)
      ? 'The lever is DOWN. Something ground open behind the west wall of the lair.'
      : 'A heavy lever stands against the wall, UP.'
  }
  if (roomId === '115e' && isLeverPulled(playerId, KOBOLD_SWITCH)) {
    return 'The west wall stands open onto a hidden chamber.'
  }
  if (roomId === '325') {
    return isLeverPulled(playerId, GROTTO_SWITCH)
      ? 'The switch by the range is thrown. Something ground open a long way to the southeast.'
      : 'A switch is set into the stone beside the range.'
  }
  if (roomId === '319' && isLeverPulled(playerId, GROTTO_SWITCH)) {
    return 'The carved stone door stands open on the Grotto to the southwest.'
  }
  return null
}

/**
 * Exits masked by an un-flipped lever, in the same shape search-reveal-state's
 * overlay uses: `{ [direction]: null }` hides the DB-canonical exit until the
 * mechanism is thrown. Only the Kobold Lair's false wall works this way — the
 * Scorpion Nest passage (012f) is a visible door the player is told is sealed,
 * whereas 115f is meant to be a room nobody knows is there.
 */
function getExitOverlay(playerId, roomId) {
  if (roomId === '115e' && !isLeverPulled(playerId, KOBOLD_SWITCH)) {
    return { west: null }
  }
  // The Grotto's carved door, likewise: 319 shows no southwest exit at all until
  // the Red Fort Kitchen switch is thrown.
  if (roomId === '319' && !isLeverPulled(playerId, GROTTO_SWITCH)) {
    return { southwest: null }
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
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  if (roomId === '115h') {
    const pulled = isLeverPulled(playerId, KOBOLD_SWITCH)
    return {
      'flip lever': pulled
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  if (roomId === '325') {
    const pulled = isLeverPulled(playerId, GROTTO_SWITCH)
    return {
      'flip switch': pulled
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  return null
}

module.exports = {
  pullLever,
  resetLever,
  isLeverPulled,
  clearPlayerLevers,
  getRoomStateNote,
  getRoomActionOverrides,
  getExitOverlay,
  KOBOLD_SWITCH,
  COW_TOLL,
  GROTTO_SWITCH,
}
