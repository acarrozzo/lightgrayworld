/**
 * The Neverending Mine's ore roll.
 *
 * One swing of a pickaxe: roll the seam for this depth, check the pick is good
 * enough to work what came up, grant it, then roll once for the pick breaking.
 * The original ran exactly this out of `function-mine.php` on two inputs —
 * `mine here` (stay put and work the level) and `mine down` / `down` (dig
 * through to the next level) — so both paths call in here rather than each
 * growing their own copy of the table.
 *
 * The pick tiers gate what you can take out, not where you can go: a plain pick
 * digs all the way to Mine Level 30, it just comes back up with stone.
 */

const {
  grantItemOnce,
  getHeldQuantity,
  removeItemBySlug,
  getPlayerInventory,
} = require('./inventory-service')

/**
 * Pickaxes best-first. `rank` is what an ore's `needs` is compared against, so
 * "iron or better" is one number rather than a list of slugs.
 */
const PICKAXES = [
  { slug: 'mithril-pickaxe', label: 'mithril', rank: 3 },
  { slug: 'steel-pickaxe', label: 'steel', rank: 2 },
  { slug: 'iron-pickaxe', label: 'iron', rank: 1 },
  { slug: 'pickaxe', label: '', rank: 0 },
]

/** The pick each ore needs, by rank. */
const ORE = {
  stone: { slug: 'stone', name: 'Stone', needs: 0, needsLabel: null },
  iron: { slug: 'iron', name: 'Iron', needs: 1, needsLabel: 'an iron pickaxe' },
  coal: { slug: 'coal', name: 'Coal', needs: 2, needsLabel: 'a steel pickaxe' },
  mithril: { slug: 'mithril', name: 'Mithril', needs: 3, needsLabel: 'a mithril pickaxe' },
  sand: { slug: 'sand', name: 'Sand', needs: 0, needsLabel: null },
  mud: { slug: 'mud', name: 'Mud', needs: 0, needsLabel: null },
}

/**
 * The seam at each depth, as weights out of 100. These are the original's
 * rand(1,10) bands widened by ten so the odd-one-out slot (sand or mud, a coin
 * flip on the tenth roll in the original) can be written as two 5% entries.
 *
 * `maxDepth` bands are checked in order. The original's own bands stopped at 29
 * and left Mine Level 30 falling through to the iron table — the mine's map art
 * says 21-30 is the mithril seam, so the deepest band runs to 30 here.
 */
const SEAMS = [
  {
    maxDepth: 9,
    label: 'iron',
    weights: [
      { ore: 'stone', weight: 50 },
      { ore: 'iron', weight: 40 },
      { ore: 'sand', weight: 5 },
      { ore: 'mud', weight: 5 },
    ],
  },
  {
    maxDepth: 19,
    label: 'coal',
    weights: [
      { ore: 'coal', weight: 50 },
      { ore: 'stone', weight: 20 },
      { ore: 'iron', weight: 20 },
      { ore: 'sand', weight: 5 },
      { ore: 'mud', weight: 5 },
    ],
  },
  {
    maxDepth: 30,
    label: 'mithril',
    weights: [
      { ore: 'coal', weight: 60 },
      { ore: 'mithril', weight: 20 },
      { ore: 'stone', weight: 10 },
      { ore: 'sand', weight: 5 },
      { ore: 'mud', weight: 5 },
    ],
  },
]

/** 1-in-50 per swing, as in the original. */
const PICKAXE_BREAK_CHANCE = 1 / 50

/**
 * The mine level a room id names, or null if it is not a mine room.
 * '311-00' → 0, '311-17' → 17.
 */
function getMineDepth(roomId) {
  if (typeof roomId !== 'string' || !roomId.startsWith('311-')) return null
  const depth = Number(roomId.slice(4))
  return Number.isInteger(depth) ? depth : null
}

/** Is this a room a pickaxe can be swung in? Mine Level 0 has no ore in it. */
function isMineableRoom(roomId) {
  const depth = getMineDepth(roomId)
  return depth !== null && depth >= 1
}

function seamForDepth(depth) {
  return SEAMS.find((s) => depth <= s.maxDepth) ?? SEAMS[SEAMS.length - 1]
}

/** The best pickaxe the player is carrying, or null if they have none. */
async function getBestPickaxe(playerId) {
  for (const pick of PICKAXES) {
    if ((await getHeldQuantity(playerId, pick.slug)) > 0) return pick
  }
  return null
}

function rollSeam(depth, random = Math.random) {
  const seam = seamForDepth(depth)
  const total = seam.weights.reduce((sum, w) => sum + w.weight, 0)
  let roll = random() * total
  for (const entry of seam.weights) {
    roll -= entry.weight
    if (roll < 0) return ORE[entry.ore]
  }
  return ORE[seam.weights[seam.weights.length - 1].ore]
}

/**
 * Swing once at the given mine level.
 *
 * Returns `{ outcome, message, inventory }`, where outcome is:
 *   'no-pickaxe'  — nothing happened; the caller should refuse the action
 *   'too-hard'    — the seam gave up something this pick cannot work
 *   'mined'       — ore in the pack
 * `brokeMessage` is appended when the swing also cost the pick.
 */
async function mineOnce(playerId, roomId) {
  const depth = getMineDepth(roomId)
  if (depth === null || depth < 1) {
    return { outcome: 'no-ore', message: 'There is no ore in this room.', inventory: null }
  }

  const pick = await getBestPickaxe(playerId)
  if (!pick) {
    return {
      outcome: 'no-pickaxe',
      message: 'You need a pickaxe to mine. The Mining Guild sells them, and the mine head hands out spares.',
      inventory: null,
    }
  }

  const ore = rollSeam(depth)
  const withPick = pick.label ? `your ${pick.label} pickaxe` : 'your pickaxe'

  let message
  let inventory = null
  let outcome

  if (pick.rank < ore.needs) {
    outcome = 'too-hard'
    message = `You see some ${ore.name.toLowerCase()}, but you will need ${ore.needsLabel} or better to work it.`
  } else {
    const granted = await grantItemOnce(playerId, ore.slug, 1)
    inventory = granted.inventory ?? null
    if (!granted.granted) {
      outcome = 'too-hard'
      message = `You swing ${withPick} and free a piece of ${ore.name.toLowerCase()}, but you cannot carry any more of it.`
    } else {
      outcome = 'mined'
      message = `You swing ${withPick} and mine some ${ore.name}. [ +1 ${ore.name} ]`
    }
  }

  // The pick wears out whether or not the swing produced anything worth keeping.
  if (Math.random() < PICKAXE_BREAK_CHANCE) {
    const removed = await removeItemBySlug(playerId, pick.slug, 1)
    if (removed.success) {
      inventory = await getPlayerInventory(playerId)
      const named = pick.label ? `${pick.label} pickaxe` : 'pickaxe'
      message += ` Oh no — the ${named} breaks apart in your hands! [ -1 ${named} ]`
    }
  }

  return { outcome, message, inventory }
}

module.exports = {
  PICKAXES,
  ORE,
  SEAMS,
  PICKAXE_BREAK_CHANCE,
  getMineDepth,
  isMineableRoom,
  getBestPickaxe,
  rollSeam,
  mineOnce,
}
