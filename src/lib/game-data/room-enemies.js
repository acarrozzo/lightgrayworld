// Maps room IDs to enemies that appear there.
// Static rooms always have their enemy present.
// Probabilistic rooms use spawnChance + weighted enemy selection per player turn.
//
// Room 013: Marsh Behind the Cabin — Gator 50% spawn chance
// Room 016: — 50% spawn, rat 33% / giant rat 33% / sand crab 34%
// Room 018: Rocky Beach — Sand Crab 25% spawn chance
// Room 019: Sand Crab Nest — Sand Crab (always present)
// Room 003b: Cabin Basement — 50% spawn, rat 90% / giant rat 10%
// Room 003bb: Destroyed Basement — 50% spawn, rat 10% / giant rat 90%
// Room 008: Spider Cave Entrance — 50% spawn, spider 100%
//
// Config fields:
//   probabilistic  — uses spawnChance + weighted pool (vs. static always-present `enemies: [...]`)
//   spawnChance    — 0..1 chance a wave rolls at all
//   maxEnemies     — wave size (default 1)
//   guaranteed     — slugs that always lead the roster, in order
//   priority       — slug that ambushes first on entry/spawn, but ONLY if present AND aggressive;
//                    otherwise a random hostile is chosen (current fallback behavior)
//   enemies        — weighted pool used to fill remaining roster slots
// Room 009: Spider Cave #009 — 60% spawn, spider 50% / scorpion 50%
// Room 010: Spider Cave #010 — Giant Spider 60% spawn chance
// Room 011: Spider Cave #011 — 60% spawn, scorpion 70% / spider 30%
// Room 012: Scorpion Pit — Alpha Scorpion 70% spawn chance
// Room 012b: Scorpion Pit (alt) — Alpha Scorpion 70% spawn chance
// Room 012c: Scorpion Pit (deep) — 60% spawn, alpha-scorpion 80% / scorpion-guard 20%
// Room 012d: Narrow Passage — Giant Rat 60% spawn chance
// Room 012e: Scorpion — Scorpion Guard 60% spawn chance
// Room 012f: Wide Antechamber — Mammoth Scorpion 60% spawn chance
// Room 012g: Scorpion Queen Chamber — Scorpion Queen 60% spawn chance
// Room 012h: Scorpion King Throne — Scorpion King 60% spawn chance
// Room 028b: Bat Cave EXIT — 50% spawn, bat 100%
// Room 028c: Abandoned Workshop — 50% spawn, bat 100%
// Room 028d: Bat Cave — 50% spawn, bat 90% / golden-bat 10%
// Room 028e: Bat Nest — 100% spawn, bat 90% / golden-bat 10%
// Room 028f: Salamander Cavern — 50% spawn, salamander 90% / golden-bat 10%
// Room 028g: Goblin Tracks — 50% spawn, goblin 80% / goblin-bandit 20%
// Room 028h: Goblin Dead End — 50% spawn, goblin-bandit 80% / goblin 20%
// Room 028i: Goblin Hideout — 100% spawn, goblin-chief 100%
const ROOM_ENEMIES = {
  '013': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'gator', weight: 100 },
    ],
  },
  '016': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 25 },
      { slug: 'giant-rat', weight: 25 },
      { slug: 'sand-crab', weight: 50 },
    ],
  },
  '018': {
    probabilistic: true,
    spawnChance: 0.25,
    enemies: [
      { slug: 'sand-crab', weight: 100 },
    ],
  },
  '019': { enemies: ['sand-crab'] }, // always present
  '003b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 90 },
      { slug: 'giant-rat', weight: 10 },
    ],
  },
  '003bb': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 10 },
      { slug: 'giant-rat', weight: 90 },
    ],
  },
  '008': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'spider', weight: 100 },
    ],
  },
  '009': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'spider', weight: 50 },
      { slug: 'scorpion', weight: 50 },
    ],
  },
  '010': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'giant-spider', weight: 70 },
      { slug: 'scorpion', weight: 30 },
    ],
  },
  '011': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'scorpion', weight: 70 },
      { slug: 'spider', weight: 30 },
    ],
  },
  '012': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'giant-spider', weight: 50 },
      { slug: 'alpha-scorpion', weight: 50 },
    ],
  },
  '012b': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'alpha-scorpion', weight: 100 },
    ],
  },
  '012c': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'alpha-scorpion', weight: 80 },
      { slug: 'scorpion-guard', weight: 20 },
    ],
  },
  '012d': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'giant-rat', weight: 100 },
    ],
  },
  '012e': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'scorpion-guard', weight: 100 },
    ],
  },
  '012f': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'mammoth-scorpion', weight: 100 },
    ],
  },
  '012g': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'scorpion-queen', weight: 100 },
    ],
  },
  '012h': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'scorpion-king', weight: 100 },
    ],
  },
  '028b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'bat', weight: 100 },
    ],
  },
  '028c': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'bat', weight: 100 },
    ],
  },
  '028d': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'bat', weight: 90 },
      { slug: 'golden-bat', weight: 10 },
    ],
  },
  '028e': {
    probabilistic: true,
    spawnChance: 1.0,
    enemies: [
      { slug: 'bat', weight: 90 },
      { slug: 'golden-bat', weight: 10 },
    ],
  },
  '028f': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'salamander', weight: 90 },
      { slug: 'golden-bat', weight: 10 },
    ],
  },
  '028g': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'goblin', weight: 80 },
      { slug: 'goblin-bandit', weight: 20 },
    ],
  },
  '028h': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'goblin-bandit', weight: 80 },
      { slug: 'goblin', weight: 20 },
    ],
  },
  '028i': {
    probabilistic: true,
    spawnChance: 1.0,
    enemies: [
      { slug: 'goblin-chief', weight: 100 },
    ],
  },
}

function getRoomEnemies(roomId) {
  return ROOM_ENEMIES[roomId] || null
}

function isProbabilistic(roomId) {
  return ROOM_ENEMIES[roomId]?.probabilistic === true
}

// The slug designated to attack first in a room, or null. Whether it actually
// gets the first strike is gated on the enemy also being present and aggressive
// (see RoomState.pickHostileTarget).
function getRoomPriorityEnemy(roomId) {
  return ROOM_ENEMIES[roomId]?.priority ?? null
}

// Picks a single enemy slug from a probabilistic room's weighted pool.
// Assumes the caller has already decided a spawn should happen.
function pickWeightedEnemy(config) {
  const totalWeight = config.enemies.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  for (const entry of config.enemies) {
    roll -= entry.weight
    if (roll <= 0) return entry.slug
  }
  return config.enemies[config.enemies.length - 1].slug
}

// Returns a slug (string) or null. Rolls spawnChance first, then picks
// an enemy by weight. Safe to call for any room — returns null for static rooms.
function rollRoomEnemy(roomId) {
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return null

  if (Math.random() > config.spawnChance) return null

  return pickWeightedEnemy(config)
}

// Returns an ordered array of enemy slugs for a single spawn "wave", or [].
// Rolls spawnChance once; on success builds a wave of `maxEnemies` enemies (default 1).
// Any `guaranteed` slugs always lead the wave in order; the remaining slots are filled
// with weighted random picks from the pool. Order is the queue order — index 0 is
// fought first.
function rollRoomEnemyGroup(roomId) {
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return []

  if (Math.random() > config.spawnChance) return []

  const count = config.maxEnemies && config.maxEnemies > 0 ? config.maxEnemies : 1
  const group = []

  // Guaranteed lead enemies always appear first, in the order listed.
  if (Array.isArray(config.guaranteed)) {
    for (const slug of config.guaranteed) {
      if (group.length >= count) break
      group.push(slug)
    }
  }

  // Fill the remaining slots with weighted random picks.
  while (group.length < count) {
    group.push(pickWeightedEnemy(config))
  }

  return group
}

module.exports = { ROOM_ENEMIES, getRoomEnemies, isProbabilistic, getRoomPriorityEnemy, rollRoomEnemy, rollRoomEnemyGroup }
