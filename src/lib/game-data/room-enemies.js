// Maps room IDs to enemies that appear there.
// Static rooms always have their enemy present.
// Probabilistic rooms use spawnChance + weighted enemy selection per player turn.
//
// Room 017: On the Beach — Rat (non-aggressive)
// Room 016: Abandoned Docks — Giant Rat (aggressive)
// Room 015: Beach by Giant Rock — Sand Crab (non-aggressive)
// Room 003b: Cabin Basement — 50% spawn, rat 90% / giant rat 10%
// Room 003bb: Destroyed Basement — 50% spawn, rat 10% / giant rat 90%
const ROOM_ENEMIES = {
  '017': { enemies: ['rat'] },
  '016': { enemies: ['giant-rat'] },
  '015': { enemies: ['sand-crab'] },
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
}

function getRoomEnemies(roomId) {
  return ROOM_ENEMIES[roomId] || null
}

function isProbabilistic(roomId) {
  return ROOM_ENEMIES[roomId]?.probabilistic === true
}

// Returns a slug (string) or null. Rolls spawnChance first, then picks
// an enemy by weight. Safe to call for any room — returns null for static rooms.
function rollRoomEnemy(roomId) {
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return null

  if (Math.random() > config.spawnChance) return null

  const totalWeight = config.enemies.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  for (const entry of config.enemies) {
    roll -= entry.weight
    if (roll <= 0) return entry.slug
  }
  return config.enemies[config.enemies.length - 1].slug
}

module.exports = { ROOM_ENEMIES, getRoomEnemies, isProbabilistic, rollRoomEnemy }
