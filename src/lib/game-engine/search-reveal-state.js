/**
 * Per-player, per-visit search reveal state.
 * Tracks which rooms a player has "search-revealed" since their last entry.
 * Cleared on re-entry to the same room and on disconnect.
 *
 * Used by rooms where searching unmasks a hidden exit (e.g. 003 -> 003c).
 */
const revealedRooms = new Map() // Map<playerId, Set<roomId | `${roomId}:${direction}`>>

/**
 * A room with one hidden exit is tracked by its room id. A room with several
 * (the Dark Grove's two secret ways, found one search at a time) is tracked per
 * direction, so the gate on each can ask about its own passage.
 */
function revealKey(roomId, direction) {
  return direction ? `${roomId}:${direction}` : roomId
}

function markRevealed(playerId, roomId, direction = null) {
  if (!revealedRooms.has(playerId)) {
    revealedRooms.set(playerId, new Set())
  }
  revealedRooms.get(playerId).add(revealKey(roomId, direction))
}

function clearRevealed(playerId, roomId) {
  const set = revealedRooms.get(playerId)
  if (!set) return
  set.delete(roomId)
  for (const key of [...set]) {
    if (key.startsWith(`${roomId}:`)) set.delete(key)
  }
}

function isRevealed(playerId, roomId, direction = null) {
  return revealedRooms.get(playerId)?.has(revealKey(roomId, direction)) ?? false
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
 *
 * A room may instead declare `stages`: an ordered list of the definitions
 * above, found one search at a time in that order. The Dark Grove (509) is the
 * case: the first successful search opens the way north, the next the way west.
 * Each stage's direction is tracked on its own, so its gate can be checked
 * independently, and `exhaustedMessage` is what a search says once every stage
 * has been found.
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
  // ==================== FOREST ====================
  // The two ends of the same hidden trail through the trees. The original drove
  // both off one shared `forestsearch` session flag, so finding the gap at one
  // end silently opened the other; per-room reveals mean each end has to be
  // found where it actually is. 1-in-2 per search, as the original rolled it.
  '127': {
    direction: 'north',
    toRoom: '132',
    chance: 0.5,
    successMessage: 'You push at the treeline and the trunks give way — what looked solid is two trees standing close. A passage runs north through them.',
    failMessage: 'You search and find nothing but bark and bramble. You should try searching again.',
    stateNote: 'A gap between the trees opens to the north.',
  },
  '132': {
    direction: 'south',
    toRoom: '127',
    chance: 0.5,
    successMessage: 'You work along the rocks and find where the trees part — a passage south, back into the deep forest.',
    failMessage: 'You search and find nothing but bark and bramble. You should try searching again.',
    stateNote: 'A gap between the trees opens to the south.',
  },

  // ==================== FOREST UNDERGROUND — OGRE LAIR ====================
  // The way into the Ogre Treasure Room. 1-in-3 per search in the original,
  // which is what makes the yard worth standing in while ogres come at you.
  '111g': {
    direction: 'northwest',
    toRoom: '111h',
    chance: 1 / 3,
    successMessage: 'You haul the crates aside and find the draft was coming from a gap in the rock. A passage runs northwest, and it smells of coin.',
    failMessage: 'You turn over crates and bones and find nothing, you should try searching again.',
    stateNote: 'A hidden passage gapes open to the northwest.',
  },

  // ==================== RED TOWN BACK ALLEYS ====================
  // The original drove all three of these off one shared `shadysearch` session
  // flag, so searching any one of them opened the others too. Per-room reveals
  // fix that: each hidden door has to be found where it actually is.
  '232': {
    direction: 'south',
    toRoom: '236',
    chance: 0.5,
    successMessage: 'You work along the alley wall behind the banners and find the boards give. Behind them is a narrow passage south, and lamplight at the far end of it.',
    failMessage: 'You turn over crates and pull at the banners, but the alley gives up nothing this time.',
    stateNote: 'A gap behind the banners opens onto a passage south.',
  },
  '233': {
    direction: 'southeast',
    toRoom: '232mm',
    chance: 0.5,
    successMessage: "You feel along the dark corner and your hand goes straight through the brickwork — a thief's passage, propped open and worn smooth by use, running southeast.",
    failMessage: 'You feel your way around the dark corner and find nothing but wet brick. Worth another try.',
    stateNote: "A thief's passage stands open to the southeast.",
  },
  '232mm': {
    direction: 'northeast',
    toRoom: '233',
    successMessage: 'You find the catch on the inside of the passage. It opens northeast, back out into the alley.',
    stateNote: 'The passage back to the alley is unlatched to the northeast.',
  },

  // ==================== RED TOWN SEWERS ====================
  // Legacy 232b shared the `catacombssearch` flag with 232j, so finding one door
  // silently opened the other. Split apart here. The pipe is a genuine one-way
  // shortcut in the original — it drops you at 232k with no way back through it.
  '232b': {
    direction: 'east',
    toRoom: '232k',
    chance: 0.5,
    successMessage: 'You climb the curve of the great pipe and find a split seam wide enough to squeeze into. It runs east, into somewhere much darker.',
    failMessage: "It's too dark to make out much along the pipe. You should search again.",
    stateNote: 'A split seam in the great pipe gapes open to the east.',
  },
  '232l': {
    direction: 'southwest',
    toRoom: '232m',
    successMessage: 'You shove at the dead end and a whole section of wall swings inward on hinges. That was easy. A passage runs southwest.',
    stateNote: 'The false wall stands open to the southwest.',
  },
  '232j': {
    direction: 'northeast',
    toRoom: '232p',
    successMessage: 'You search along the great stone wall and find the mechanism buried under centuries of grime. The catacombs door grinds open to the northeast.',
    stateNote: 'The catacombs stone door stands open to the northeast.',
  },

  // ==================== DARK FOREST ====================
  // The Dark Grove, where the original's `darkforestsearch` counter walked up
  // one notch per lucky search: north to the fallen tree first, then west into
  // the trees where the Ranger's Guild hides. Both 1-in-2, in that order.
  '509': {
    exhaustedMessage: 'You search the Dark Grove again. You have found everything there is to find here.',
    stages: [
      {
        direction: 'north',
        toRoom: '519',
        chance: 0.5,
        successMessage: 'You search the Dark Grove and discover a secret path to the north!',
        failMessage: 'You search the Dark Grove and find nothing.',
        stateNote: 'A secret path leads north out of the grove.',
      },
      {
        direction: 'west',
        toRoom: '514',
        chance: 0.5,
        successMessage: 'You search and find a secret way through the strange trees to the west!',
        failMessage: 'You search the Dark Grove and think you find something, but you don\'t.',
        stateNote: 'A secret way runs west through the strange trees.',
      },
    ],
  },
  // By a Fallen Tree: the same trail from the other end, south back to the
  // grove. The original drove both ends off one session flag; each end is its
  // own find here, as the Forest's hidden trail is.
  '519': {
    direction: 'south',
    toRoom: '509',
    chance: 0.5,
    successMessage: 'You search and find a secret way to the south through the trees!',
    failMessage: 'You search and find nothing, you should try searching again.',
    stateNote: 'A secret way leads south through the trees.',
  },
}

function getRevealDefinition(roomId) {
  return REVEAL_DEFINITIONS[roomId] ?? null
}

/** A definition's hidden passages as a flat list, single or staged alike. */
function getRevealStages(roomId) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return []
  return Array.isArray(def.stages) ? def.stages : [def]
}

/**
 * The next passage a search in this room can find, or null once every one has
 * been. A single-passage room is a one-stage room.
 */
function getNextRevealStage(playerId, roomId) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return null
  if (!Array.isArray(def.stages)) return isRevealed(playerId, roomId) ? null : def
  return def.stages.find((stage) => !isRevealed(playerId, roomId, stage.direction)) ?? null
}

/** Whether one of a room's passages has been found: by direction for staged rooms. */
function isPassageRevealed(playerId, roomId, direction) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return false
  if (!Array.isArray(def.stages)) return isRevealed(playerId, roomId)
  return isRevealed(playerId, roomId, direction)
}

function getRoomStateNote(playerId, roomId) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return null
  if (!Array.isArray(def.stages)) return isRevealed(playerId, roomId) ? def.stateNote : null
  const notes = def.stages.filter((stage) => isRevealed(playerId, roomId, stage.direction)).map((stage) => stage.stateNote)
  return notes.length ? notes.join(' ') : null
}

/**
 * Returns a partial exit map { [direction]: toRoom } that should override the
 * DB-canonical exits when serving room data to this player. For rooms with a
 * reveal definition, the configured direction is HIDDEN (set to null) until
 * the player has searched — every unfound stage at once for a staged room.
 */
function getExitOverlay(playerId, roomId) {
  const def = REVEAL_DEFINITIONS[roomId]
  if (!def) return null
  if (!Array.isArray(def.stages)) {
    if (isRevealed(playerId, roomId)) return null
    return { [def.direction]: null }
  }
  const hidden = def.stages.filter((stage) => !isRevealed(playerId, roomId, stage.direction))
  if (hidden.length === 0) return null
  return Object.fromEntries(hidden.map((stage) => [stage.direction, null]))
}

module.exports = {
  markRevealed,
  clearRevealed,
  isRevealed,
  isPassageRevealed,
  clearPlayerReveals,
  getRevealDefinition,
  getRevealStages,
  getNextRevealStage,
  getRoomStateNote,
  getExitOverlay,
  REVEAL_DEFINITIONS,
}
