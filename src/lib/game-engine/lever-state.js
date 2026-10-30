/**
 * Per-player, session-only lever state.
 * Resets on disconnect or server restart.
 * Map<playerId, Set<leverIds>>
 *
 * Held on `globalThis`, the same pattern the presence, ghost and teleport-grant
 * stores use. The engine loads this file through Node; the room-load HTTP route
 * loads the copy Next bundled for it. With the map at module level those were
 * two maps, and the route's was always empty — so a refresh drew a pulled lever
 * as up and an opened wall as sealed, while the engine went on allowing the move.
 */
if (!globalThis.__activatedLevers) {
  globalThis.__activatedLevers = new Map()
}
const activatedLevers = globalThis.__activatedLevers

/**
 * The Kobold Lair's Control Room switch (115h), which grinds open the false west
 * wall of the Bloody Path (115e) onto the Hidden Chamber (115f). Session-scoped
 * like the original's `koboldswitch` flag, and — unlike the original, which
 * left it thrown for the session — spent on the crossing, as every lever in
 * the game is (Anthony, 2026-10-30: one rule, one label).
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

/**
 * The coral lever in the reef under the ocean (483), which opens the Coral
 * Door out of the Underwater Alcove (493) onto the Flower Patch (494).
 * Session-scoped like the original's `$_SESSION['underwaterswitch']`. The
 * original never spent it; this one is spent on the swim through, like every
 * lever in the game (Anthony, 2026-10-30: one rule, one label).
 */
const UNDERWATER_SWITCH = '483-underwaterswitch'

/**
 * The Champion's Camp lever (511), which grinds open the stone door on the
 * Dark Forest Clearing (505) onto the Silver Chest ledge (512). Session-scoped
 * like the original's `$_SESSION['darkforestsilverswitch']`, and spent the
 * moment you walk through — the original zeroed it on the crossing, so every
 * trip to the silver chest is another climb up the hill past the champions.
 */
const DARK_FOREST_SILVER_SWITCH = '511-silverswitch'

/**
 * The Dark Keep's two pairs of levers. The steel door in the Main Hall (516a)
 * wants the Storeroom's (516b) and the Burial Chamber's (516c); the ornate
 * door at the Top of the Stairwell (516e) wants the Barracks' (516f) and the
 * Paladin Altar's (516g). Each pair opens its own door and is spent on the
 * crossing, as the original spent them. (The original reused ONE pair of
 * session flags for both floors, so throwing the Storeroom's lever and the
 * Altar's would open both doors at once — a quirk of shared variables, not a
 * puzzle, and not kept.)
 */
/**
 * The Highway Toll (504) onto the mountain road. Not a lever but the same
 * thing mechanically, like Freddie's cow toll: an ephemeral per-player pass
 * that opens the way west and is spent on the crossing. The original opened
 * the road on `$endfight >= 1` — "You travel west over the body of the
 * Highwayman you just defeated" — or on a thousand gold; both set this.
 */
const HIGHWAY_TOLL = '504-highwaytoll'

/**
 * The Swamp's two levers, one pass each (Anthony, 2026-10-30). The Megalodon
 * Cave's (809) opens the gate between the Swampy Quagmire (810) and the Dragon
 * Nest (811); the Dragon Nest's opens Arcturus's gate (802) into Mage Ultima
 * (812). Both are spent on the crossing, like the Grotto door and the Silver
 * Chest ledge, so every trip through is another pull.
 */
const MEGALODON_LEVER = '809-lever'
const DRAGON_NEST_LEVER = '811-lever'

const DARK_KEEP_STOREROOM_LEVER = '516b-lever'
const DARK_KEEP_BURIAL_LEVER = '516c-lever'
const DARK_KEEP_BARRACKS_LEVER = '516f-lever'
const DARK_KEEP_ALTAR_LEVER = '516g-lever'

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
  if (roomId === '483') {
    return isLeverPulled(playerId, UNDERWATER_SWITCH)
      ? 'The coral lever is DOWN. Something ground open somewhere to the south.'
      : 'A piece of coral shaped like a lever juts from the reef, UP.'
  }
  if (roomId === '493') {
    return isLeverPulled(playerId, UNDERWATER_SWITCH)
      ? 'The Coral Door stands open to the east.'
      : 'A massive Coral Door blocks the way east.'
  }
  if (roomId === '511') {
    return isLeverPulled(playerId, DARK_FOREST_SILVER_SWITCH)
      ? 'The lever is DOWN. Something ground open on the clearing to the south.'
      : 'A lever is wedged between the scattered equipment, UP.'
  }
  if (roomId === '505') {
    return isLeverPulled(playerId, DARK_FOREST_SILVER_SWITCH)
      ? 'The massive stone door to the northeast stands open.'
      : 'A massive stone door seals the way northeast.'
  }
  if (roomId === '516b') {
    return isLeverPulled(playerId, DARK_KEEP_STOREROOM_LEVER)
      ? 'The lever on the wall is DOWN.'
      : 'A lever juts from the wall, UP.'
  }
  if (roomId === '516c') {
    return isLeverPulled(playerId, DARK_KEEP_BURIAL_LEVER)
      ? 'The lever on the wall is DOWN.'
      : 'A lever juts from the wall between two coffins, UP.'
  }
  if (roomId === '516a') {
    const thrown = [DARK_KEEP_STOREROOM_LEVER, DARK_KEEP_BURIAL_LEVER].filter((id) => isLeverPulled(playerId, id)).length
    if (thrown === 2) return 'The solid steel door to the southwest stands open.'
    if (thrown === 1) return 'One of the two levers has been thrown. The steel door to the southwest has not moved yet.'
    return 'A solid steel door seals the way southwest.'
  }
  if (roomId === '516f') {
    return isLeverPulled(playerId, DARK_KEEP_BARRACKS_LEVER)
      ? 'The switch by the weapon racks is DOWN.'
      : 'A switch is set into the wall by the weapon racks, UP.'
  }
  if (roomId === '516g') {
    return isLeverPulled(playerId, DARK_KEEP_ALTAR_LEVER)
      ? 'The lever behind the altar is DOWN.'
      : 'A lever stands behind the altar, UP.'
  }
  if (roomId === '516e') {
    const thrown = [DARK_KEEP_BARRACKS_LEVER, DARK_KEEP_ALTAR_LEVER].filter((id) => isLeverPulled(playerId, id)).length
    if (thrown === 2) return 'The massive ornate door to the northeast stands open.'
    if (thrown === 1) return 'One of the two levers has been thrown. The ornate door to the northeast has not moved yet.'
    return 'A massive ornate door seals the way northeast.'
  }
  if (roomId === '809') {
    return isLeverPulled(playerId, MEGALODON_LEVER)
      ? 'The lever is DOWN. Something heavy swung open, a long way up and east of here.'
      : 'A lever juts from the cave wall, UP. Nobody puts a lever at the bottom of the sea for no reason.'
  }
  if (roomId === '810') {
    return isLeverPulled(playerId, MEGALODON_LEVER)
      ? 'The gate of driftwood and rusted iron stands open to the south.'
      : 'A gate of driftwood and rusted iron seals the way south.'
  }
  if (roomId === '811') {
    const lever = isLeverPulled(playerId, DRAGON_NEST_LEVER)
      ? 'The lever in the nest is DOWN. Iron ground on stone to the southwest.'
      : 'A lever stands in the eggshells, UP.'
    const gate = isLeverPulled(playerId, MEGALODON_LEVER)
      ? 'The gate of driftwood and rusted iron stands open to the north.'
      : 'The gate of driftwood and rusted iron is shut to the north.'
    return `${lever} ${gate}`
  }
  if (roomId === '802') {
    return isLeverPulled(playerId, DRAGON_NEST_LEVER)
      ? "Arcturus's gate to the north stands open."
      : "Arcturus's gate to the north is shut."
  }
  if (roomId === '504') {
    return isLeverPulled(playerId, HIGHWAY_TOLL)
      ? 'The way west up the mountain road is open. The Highwayman is not arguing.'
      : 'The Highwayman stands across the mountain road to the west. "Pay up or go back to where you came from!"'
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
      'pull lever': pulled
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  if (roomId === '325') {
    const pulled = isLeverPulled(playerId, GROTTO_SWITCH)
    return {
      'pull lever': pulled
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  if (roomId === '483') {
    const pulled = isLeverPulled(playerId, UNDERWATER_SWITCH)
    return {
      'pull lever': pulled
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  const darkForestLever = DARK_FOREST_LEVER_ROOMS[roomId]
  if (darkForestLever) {
    const pulled = isLeverPulled(playerId, darkForestLever)
    return {
      'pull lever': pulled
        ? { className: 'bg-status-success/80 hover:bg-status-success', icon: 'lever-down' }
        : { className: 'bg-status-warning/80 hover:bg-status-warning', icon: 'lever-up' },
    }
  }
  return null
}

/** The single-lever rooms the overrides above share, by the lever each one throws. */
const DARK_FOREST_LEVER_ROOMS = {
  '809': MEGALODON_LEVER,
  '811': DRAGON_NEST_LEVER,
  '511': DARK_FOREST_SILVER_SWITCH,
  '516b': DARK_KEEP_STOREROOM_LEVER,
  '516c': DARK_KEEP_BURIAL_LEVER,
  '516f': DARK_KEEP_BARRACKS_LEVER,
  '516g': DARK_KEEP_ALTAR_LEVER,
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
  HIGHWAY_TOLL,
  GROTTO_SWITCH,
  UNDERWATER_SWITCH,
  MEGALODON_LEVER,
  DRAGON_NEST_LEVER,
  DARK_FOREST_SILVER_SWITCH,
  DARK_KEEP_STOREROOM_LEVER,
  DARK_KEEP_BURIAL_LEVER,
  DARK_KEEP_BARRACKS_LEVER,
  DARK_KEEP_ALTAR_LEVER,
  DARK_FOREST_LEVER_ROOMS,
}
