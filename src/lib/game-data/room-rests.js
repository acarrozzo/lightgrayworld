/**
 * The rests: the plain Rest every room has, and the special ones a room adds —
 * "Rest at the Fireplace", the guild fires, the fountains, Bathe in Glory.
 *
 * One CommonJS module so the server and the client agree on what a rest gives.
 * The handlers in game-engine/room-action-handlers.js apply it; the room's
 * button reads it to tell whether a click would raise anything, and when it
 * would not, wears the same grey check as a supply pill you already hold.
 *
 * A special rest raises HP and MP to a line: the max plus its `bonus` (an
 * overcharge), or the max itself when there is no bonus (a full restore). It
 * only ever raises. The original set hp/mp to exactly max + N, so the Grand
 * Square fountain (+25) took 75 back from a player fresh out of the Master
 * Temple (+100); here each side lands on whichever is higher, its own value or
 * the line. Below the line on one side and above it on the other raises the
 * one and keeps the other.
 *
 * The plain Rest is the original's: +Physical Training HP and +Mental Training
 * MP, up to the max, never taking an overcharge away.
 *
 * A rest with nothing to give is a free refusal (`noTurn`), the same as a
 * supply at its line: no turn spent, no room hazard, nothing written. In a
 * fight every rest is refused and costs the turn.
 */

/**
 * @typedef {object} RoomRest
 * @property {number} [bonus] HP and MP over the max this rest charges to. Absent: fills to the max.
 * @property {string} message The feed line when the rest lands.
 * @property {string} [requiresMembership] Faction id (factions.js) whose members may rest here.
 * @property {string} [lockedMessage] What a non-member is told, on the button and in the feed.
 * @property {{ field: string, clicks: number, label: string }} [buff] A click buff (buff-service) the rest also starts.
 */

/** Room id → action → the rest it is. */
const ROOM_RESTS = /** @type {Record<string, Record<string, RoomRest>>} */ ({
  // Grassy Field
  '020': {
    'rest at waterfall': {
      bonus: 10,
      message: 'You rest beneath the waterfall. Your HP and MP are fully restored, plus an extra +10 to each.',
    },
  },
  '999': {
    'rest in lobby': {
      bonus: 10,
      message: 'You rest near the fountain. Your HP and MP are fully restored, plus an extra +10 to each.',
    },
  },

  // Forest — Bill's fire supercharges rather than merely restoring; the
  // original set hp/mp to max + 10 here, which is why hunters stage out of it.
  '118': {
    'rest at camp': {
      bonus: 10,
      message: "You rest at Hunter Bill's camp and supercharge yourself. Your HP and MP are fully restored, plus an extra +10 to each.",
    },
  },

  // Red Town
  '210': {
    'rest at fountain': {
      bonus: 25,
      message: 'You rest at the fountain and supercharge yourself. Your HP and MP are fully restored, plus an extra +25 to each.',
    },
  },
  '225': {
    'rest at wizard fire': {
      bonus: 100,
      message: 'You rest at the Wizard’s Fire. Your HP and MP are fully restored, plus an extra +100 to each.',
      requiresMembership: 'wizards-guild',
      lockedMessage: 'Join the Wizard’s Guild to rest at its fire. Speak to the recruiter.',
    },
  },
  '226': {
    'rest at warrior fire': {
      bonus: 100,
      message: 'You rest at the Warrior’s Fire and supercharge yourself. Your HP and MP are fully restored, plus an extra +100 to each.',
      requiresMembership: 'warriors-guild',
      lockedMessage: 'Join the Warrior’s Guild to rest at its fire. Speak to the recruiter.',
    },
  },
  // The one safe room in the sewers, exactly as the original had it: a full
  // restore rather than an overcharge.
  '232x': {
    'rest at oasis': {
      message: 'You rest at the Sewer Oasis. Clean water, dry stone, and air you can stand — your HP and MP are fully replenished.',
    },
  },

  // Rocky Flats
  '306': {
    'rest on the ledge': {
      bonus: 50,
      message: 'You sit on the ledge and watch the road for a while. Your HP and MP are fully restored, plus an extra +50 to each.',
    },
  },
  '307': {
    'rest at the coal fire': {
      bonus: 50,
      message: 'You warm up at the coal fire in the middle of the square. Your HP and MP are fully restored, plus an extra +50 to each.',
    },
  },
  '308': {
    'rest at the forge': {
      bonus: 50,
      message: 'You rest at the Guild Forge. Your HP and MP are fully restored, plus an extra +50 to each.',
      requiresMembership: 'mining-guild',
      lockedMessage: 'Join the Mining Guild to rest at the forge. Speak to the recruiter.',
    },
  },

  // Blue Ocean
  '413': {
    'rest at the oasis': {
      bonus: 50,
      message: 'You rest by the fresh water spring at the Blue Oasis. Your HP and MP are fully restored, plus an extra +50 to each.',
    },
  },
  // The Master Temple's glory: the rest and +20 to everything for 100 clicks.
  '425': {
    'bathe in glory': {
      bonus: 100,
      message: "You bathe in the Master Temple's glory. Your HP and MP are fully restored, plus an extra +100 to each.",
      buff: { field: 'buffGloryClicks', clicks: 100, label: 'Glory' },
    },
  },
  '497': {
    'rest at the green pillar': {
      bonus: 100,
      message: 'You rest at the glowing green pillar. Your HP and MP are fully restored, plus an extra +100 to each.',
    },
  },

  // Dark Forest
  '502': {
    'rest at the outpost': {
      message: 'You rest at the Outpost and heal all your HP and MP!',
    },
  },
  '506': {
    'rest at the tree hut': {
      bonus: 75,
      message: 'You rest at the Tree Hut fireplace and super charge your health and mana. (+75 HP, +75 MP)',
    },
  },
  '515a': {
    'rest at the ranger fire': {
      bonus: 75,
      message: "You rest at the Ranger's Guild fire. (+75 HP, +75 MP)",
    },
  },
  '525': {
    'rest by the princess': {
      bonus: 100,
      message: 'You rest near the Forest Princess and feel great! (+100 HP, +100 MP)',
    },
  },

  // Star City
  '701': {
    'rest at the fountain': {
      bonus: 250,
      message: 'You rest at the fountain and feel rejuvenated! (+250 HP, +250 MP)',
    },
  },
})

/**
 * @typedef {object} Vitals
 * @property {number | null | undefined} hp
 * @property {number | null | undefined} mp
 * @property {number | null | undefined} hpMax
 * @property {number | null | undefined} mpMax
 * @property {number | null | undefined} [physicalTraining]
 * @property {number | null | undefined} [mentalTraining]
 */

/**
 * @typedef {object} RestOutcome
 * @property {number} hp What HP becomes.
 * @property {number} mp What MP becomes.
 * @property {number} hpGain
 * @property {number} mpGain
 */

/**
 * The special rest a room's action is, or null.
 * @param {string | null | undefined} roomId
 * @param {string | null | undefined} action
 * @returns {RoomRest | null}
 */
function getRoomRest(roomId, action) {
  if (!roomId || typeof action !== 'string') return null
  return ROOM_RESTS[roomId]?.[action.toLowerCase().trim()] ?? null
}

/** @param {number | null | undefined} n @param {number} fallback */
const num = (n, fallback) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback)

/**
 * Where a rest leaves HP and MP. `rest` null is the plain Rest.
 * @param {Vitals} vitals
 * @param {RoomRest | null} rest
 * @returns {RestOutcome}
 */
function restOutcome(vitals, rest) {
  const curHp = num(vitals.hp, 0)
  const curMp = num(vitals.mp, 0)
  const hpMax = num(vitals.hpMax, 10)
  const mpMax = num(vitals.mpMax, 2)

  let hp
  let mp
  if (rest) {
    const bonus = num(rest.bonus, 0)
    hp = Math.max(curHp, hpMax + bonus)
    mp = Math.max(curMp, mpMax + bonus)
  } else {
    hp = Math.max(curHp, Math.min(hpMax, curHp + num(vitals.physicalTraining, 1)))
    mp = Math.max(curMp, Math.min(mpMax, curMp + num(vitals.mentalTraining, 0)))
  }
  return { hp, mp, hpGain: hp - curHp, mpGain: mp - curMp }
}

/**
 * Whether the rest's buff would add clicks: it starts at `clicks` and never
 * shortens what is left (buff-service's GREATEST), so it adds nothing only
 * while a full countdown is still running.
 * @param {RoomRest | null} rest
 * @param {Record<string, number> | null | undefined} buffs Click countdowns by User column.
 */
function restBuffWouldGain(rest, buffs) {
  if (!rest?.buff) return false
  return num(buffs?.[rest.buff.field], 0) < rest.buff.clicks
}

/**
 * True when resting would raise nothing: neither vital and no buff.
 * @param {Vitals} vitals
 * @param {RoomRest | null} rest
 * @param {Record<string, number> | null | undefined} [buffs]
 */
function isRestSettled(vitals, rest, buffs) {
  const { hpGain, mpGain } = restOutcome(vitals, rest)
  return hpGain === 0 && mpGain === 0 && !restBuffWouldGain(rest, buffs)
}

/**
 * What a rest with nothing to give says — on the grey button and in the feed.
 * @param {Vitals} vitals
 * @param {RoomRest | null} rest
 * @returns {string}
 */
function restSettledMessage(vitals, rest) {
  if (rest) {
    const bonus = num(rest.bonus, 0)
    if (rest.buff) {
      return `Your HP and MP are already at +${bonus} or more, and your ${rest.buff.label} buff still has all ${rest.buff.clicks} clicks.`
    }
    return bonus > 0
      ? `Your HP and MP are already at +${bonus} or more. Resting here won't raise them.`
      : 'You already have full HP and MP.'
  }
  // The plain Rest. Mental Training starts at 0, so a new character's rest
  // never brings MP back; at full HP that is a rest with nothing to give.
  const hpFull = num(vitals.hp, 0) >= num(vitals.hpMax, 10)
  const mpFull = num(vitals.mp, 0) >= num(vitals.mpMax, 2)
  if (hpFull && mpFull) return 'You already have full HP and MP.'
  if (hpFull) return "Your HP is full, and resting won't recover MP without Mental Training."
  return "Your MP is full, and resting won't recover HP without Physical Training."
}

module.exports = {
  ROOM_RESTS,
  getRoomRest,
  restOutcome,
  restBuffWouldGain,
  isRestSettled,
  restSettledMessage,
}
